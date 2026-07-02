import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  createOutputPath,
  ensureGlobalConfig,
  getOrInitWorkspace,
  importExternalFile,
  listArtifacts,
  registerArtifact,
  resolveSourcePath,
} from "./public.js";
import { formatDependencyDoctor, runDependencyDoctor } from "./internal/dependencies.js";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "workspace_init",
    label: "VC Workspace Init",
    description: "Initialize or inspect the compact .pi-vc workspace for the current VC project.",
    parameters: Type.Object({
      root: Type.Optional(Type.String({ description: "Project root. Defaults to current working directory." })),
    }),
    async execute(_toolCallId, params) {
      const workspace = await getOrInitWorkspace(params.root ?? process.cwd());
      await ensureGlobalConfig();
      return textResult(`Workspace ${workspace.created ? "initialized" : "ready"} at ${workspace.workspacePath}`, {
        workspace,
      });
    },
  });

  pi.registerTool({
    name: "vc_dependency_doctor",
    label: "VC Dependency Doctor",
    description: "Check pi-vc-core required/recommended/optional dependencies and return install guidance for missing items.",
    parameters: Type.Object({}),
    async execute() {
      const checks = await runDependencyDoctor();
      return textResult(formatDependencyDoctor(checks), { checks });
    },
  });

  pi.registerTool({
    name: "workspace_resolve_path",
    label: "VC Resolve Path",
    description: "Resolve a project file path safely, importing external files into .pi-vc/input when needed.",
    parameters: Type.Object({
      path: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const resolved = await resolveSourcePath(params.path);
      return textResult(resolved.notices.concat(`Resolved source: ${resolved.sourcePath}`).join("\n"), resolved);
    },
  });

  pi.registerTool({
    name: "workspace_import_file",
    label: "VC Import File",
    description: "Copy an external file into the current project's .pi-vc/input directory and register it.",
    parameters: Type.Object({
      path: Type.String(),
      projectRoot: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const imported = await importExternalFile(params.path, params.projectRoot);
      return textResult(`Imported external file to ${imported.copiedTo}`, imported);
    },
  });

  pi.registerTool({
    name: "workspace_create_output_path",
    label: "VC Create Output Path",
    description: "Create a safe output path under .pi-vc for parsed, output, diff, cache, logs, or memory artifacts.",
    parameters: Type.Object({
      projectRoot: Type.String(),
      kind: Type.Union([
        Type.Literal("input"),
        Type.Literal("output"),
        Type.Literal("parsed"),
        Type.Literal("diff"),
        Type.Literal("cache"),
        Type.Literal("logs"),
        Type.Literal("memory"),
      ]),
      sourcePath: Type.Optional(Type.String()),
      extension: Type.Optional(Type.String()),
      label: Type.Optional(Type.String()),
      subdir: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const outputPath = await createOutputPath(params);
      return textResult(outputPath, { outputPath });
    },
  });

  pi.registerTool({
    name: "workspace_register_artifact",
    label: "VC Register Artifact",
    description: "Register a source, parsed, output, or memory artifact in .pi-vc/artifacts.jsonl.",
    parameters: Type.Object({
      projectRoot: Type.String(),
      type: Type.Union([
        Type.Literal("source_seen"),
        Type.Literal("external_imported"),
        Type.Literal("parsed_created"),
        Type.Literal("output_created"),
        Type.Literal("memory_created"),
      ]),
      source_path: Type.Optional(Type.String()),
      source_artifact_id: Type.Optional(Type.String()),
      artifact_path: Type.Optional(Type.String()),
      markdown_path: Type.Optional(Type.String()),
      diff_path: Type.Optional(Type.String()),
      sha256: Type.Optional(Type.String()),
      tool: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const { projectRoot, ...record } = params;
      const artifact = await registerArtifact(projectRoot, record);
      return textResult(`Registered artifact ${artifact.id}`, artifact);
    },
  });

  pi.registerTool({
    name: "workspace_list_artifacts",
    label: "VC List Artifacts",
    description: "List artifacts registered for the current VC project.",
    parameters: Type.Object({
      type: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params) {
      const workspace = await getOrInitWorkspace();
      const artifacts = await listArtifacts(workspace.projectRoot, params.type as never);
      return textResult(formatArtifacts(artifacts), { artifacts, workspace });
    },
  });

  pi.registerCommand("vc-init", {
    description: "Initialize the current directory as a compact pi-vc workspace.",
    handler: async (args, ctx) => {
      const workspace = await getOrInitWorkspace(args?.trim() || process.cwd());
      await ensureGlobalConfig();
      ctx.ui.notify(`pi-vc workspace ${workspace.created ? "initialized" : "ready"}: ${workspace.workspacePath}`, "info");
    },
  });

  pi.registerCommand("vc-overview", {
    description: "Show registered pi-vc project materials and generated artifacts.",
    handler: async (_args, ctx) => {
      const workspace = await getOrInitWorkspace();
      const artifacts = await listArtifacts(workspace.projectRoot);
      ctx.ui.notify(formatArtifacts(artifacts), "info");
    },
  });

  pi.registerCommand("vc-doctor", {
    description: "Check baseline pi-vc local runtime readiness.",
    handler: async (_args, ctx) => {
      const workspace = await getOrInitWorkspace();
      await ensureGlobalConfig();
      const checks = await runDependencyDoctor();
      ctx.ui.notify([`pi-vc workspace: ok (${workspace.workspacePath})`, "", formatDependencyDoctor(checks)].join("\n"), "info");
    },
  });
}

function textResult(text: string, details: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function formatArtifacts(artifacts: Array<{ id: string; type: string; artifact_path?: string; source_path?: string }>): string {
  if (artifacts.length === 0) return "No pi-vc artifacts registered yet.";
  return artifacts
    .map((artifact) => `${artifact.id} ${artifact.type} ${artifact.artifact_path ?? artifact.source_path ?? ""}`.trim())
    .join("\n");
}
