import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type {
  ArtifactRecord,
  ArtifactType,
  OutputPathRequest,
  ResolvedSourcePath,
  WorkspaceContext,
  WorkspaceIdentity,
} from "../schema.js";

const PI_VC_DIR = ".pi-vc";
const WORKSPACE_FILE = "workspace.json";
const ARTIFACTS_FILE = "artifacts.jsonl";

export function nowIso(): string {
  return new Date().toISOString();
}

export function globalPiVcDir(): string {
  if (process.env.PI_VC_HOME) return path.resolve(process.env.PI_VC_HOME);
  return path.join(homedir(), ".pi-vc");
}

export async function ensureGlobalConfig(): Promise<string> {
  const dir = globalPiVcDir();
  await mkdir(dir, { recursive: true });
  const configPath = path.join(dir, "config.json");
  if (!existsSync(configPath)) {
    await writeJson(configPath, {
      schema_version: 1,
      memory: {
        enabled: true,
        capture_mode: "selective_auto",
        notify_after_capture: true,
        max_auto_captures_per_session: 10,
      },
      dream: {
        enabled: true,
        interval_days: 7,
        remind_on_startup: true,
      },
      recall: {
        provider: "auto",
        preferred: "qmd",
        fallback: "text_search",
      },
      office: {
        convert_provider: "auto",
        render_provider: "auto",
        ocr_provider: "paddleocr",
      },
    });
  }
  return configPath;
}

export async function findWorkspaceRoot(startDir = process.cwd()): Promise<string | undefined> {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, PI_VC_DIR, WORKSPACE_FILE);
    if (existsSync(candidate)) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export async function initWorkspace(root = process.cwd()): Promise<WorkspaceContext> {
  const projectRoot = path.resolve(root);
  await mkdir(projectRoot, { recursive: true });
  const piVcDir = path.join(projectRoot, PI_VC_DIR);
  const workspacePath = path.join(piVcDir, WORKSPACE_FILE);
  await mkdir(piVcDir, { recursive: true });

  if (existsSync(workspacePath)) {
    const workspace = await readJson<WorkspaceIdentity>(workspacePath);
    return { projectRoot, piVcDir, workspacePath, workspace, created: false };
  }

  const workspace: WorkspaceIdentity = {
    schema_version: 1,
    project_id: `proj_${compactTimestamp()}_${randomBytes(3).toString("hex")}`,
    project_name: path.basename(projectRoot),
    created_at: nowIso(),
    layout: "compact",
  };
  await writeJson(workspacePath, workspace);
  return { projectRoot, piVcDir, workspacePath, workspace, created: true };
}

export async function getOrInitWorkspace(cwd = process.cwd()): Promise<WorkspaceContext> {
  const existingRoot = await findWorkspaceRoot(cwd);
  return initWorkspace(existingRoot ?? cwd);
}

export async function resolveSourcePath(inputPath: string, cwd = process.cwd()): Promise<ResolvedSourcePath> {
  const workspace = await getOrInitWorkspace(cwd);
  const originalPath = inputPath.trim().replace(/^["']|["']$/g, "");
  const candidate = path.isAbsolute(originalPath)
    ? path.resolve(originalPath)
    : path.resolve(cwd, originalPath);

  if (!existsSync(candidate)) {
    throw new Error(`Source path does not exist: ${candidate}`);
  }

  if (isInside(candidate, workspace.projectRoot)) {
    const artifact = await ensureSourceSeen(workspace.projectRoot, candidate, "workspace_resolve_path");
    return {
      projectRoot: workspace.projectRoot,
      originalPath,
      sourcePath: candidate,
      relation: "project_local",
      artifact,
      notices: workspace.created
        ? [`Initialized pi-vc workspace at ${workspace.workspacePath}`]
        : [],
    };
  }

  const imported = await importExternalFile(candidate, workspace.projectRoot);
  return {
    projectRoot: workspace.projectRoot,
    originalPath,
    sourcePath: imported.copiedTo,
    relation: "external_imported",
    artifact: imported.artifact,
    notices: [
      ...(workspace.created ? [`Initialized pi-vc workspace at ${workspace.workspacePath}`] : []),
      `Imported external file: source=${candidate}; copied_to=${imported.copiedTo}; reason=pi-vc-core does not process external files in-place`,
    ],
  };
}

export async function importExternalFile(sourcePath: string, projectRoot?: string): Promise<{
  copiedTo: string;
  artifact: ArtifactRecord;
}> {
  const workspace = projectRoot ? await initWorkspace(projectRoot) : await getOrInitWorkspace();
  const resolvedSource = path.resolve(sourcePath);

  if (!existsSync(resolvedSource)) {
    throw new Error(`External file does not exist: ${resolvedSource}`);
  }
  if (isInside(resolvedSource, workspace.projectRoot)) {
    throw new Error(`File is already inside project root: ${resolvedSource}`);
  }

  const inputDir = path.join(workspace.piVcDir, "input");
  await mkdir(inputDir, { recursive: true });
  const copiedTo = await uniquePath(path.join(inputDir, path.basename(resolvedSource)));
  await copyFile(resolvedSource, copiedTo);

  const artifact = await registerArtifact(workspace.projectRoot, {
    type: "external_imported",
    source_path: resolvedSource,
    artifact_path: copiedTo,
    sha256: await sha256(copiedTo),
    tool: "workspace_import_file",
  });
  return { copiedTo, artifact };
}

export async function createOutputPath(request: OutputPathRequest): Promise<string> {
  const workspace = await initWorkspace(request.projectRoot);
  const dir = path.join(workspace.piVcDir, request.kind, request.subdir ?? "");
  await mkdir(dir, { recursive: true });

  const sourceBase = request.sourcePath
    ? path.basename(request.sourcePath, path.extname(request.sourcePath))
    : request.kind;
  const safeBase = sanitizeFilePart(request.label ?? sourceBase);
  const ext = normalizeExtension(request.extension ?? "");
  return uniquePath(path.join(dir, `${safeBase}_${compactTimestamp()}${ext}`));
}

export async function registerArtifact(
  projectRoot: string,
  record: Omit<ArtifactRecord, "id" | "created_at"> & { id?: string; created_at?: string },
): Promise<ArtifactRecord> {
  const workspace = await initWorkspace(projectRoot);
  const artifactsPath = path.join(workspace.piVcDir, ARTIFACTS_FILE);
  const artifact: ArtifactRecord = {
    id: record.id ?? `art_${compactTimestamp()}_${randomBytes(3).toString("hex")}`,
    created_at: record.created_at ?? nowIso(),
    ...record,
  };
  await appendFile(artifactsPath, `${JSON.stringify(toProjectRelativeArtifact(workspace.projectRoot, artifact))}\n`, "utf8");
  return toProjectRelativeArtifact(workspace.projectRoot, artifact);
}

export async function listArtifacts(projectRoot?: string, type?: ArtifactType): Promise<ArtifactRecord[]> {
  const workspace = projectRoot ? await initWorkspace(projectRoot) : await getOrInitWorkspace();
  const artifactsPath = path.join(workspace.piVcDir, ARTIFACTS_FILE);
  if (!existsSync(artifactsPath)) return [];
  const text = await readFile(artifactsPath, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ArtifactRecord)
    .filter((record) => !type || record.type === type);
}

export async function ensureSourceSeen(
  projectRoot: string,
  sourcePath: string,
  tool: string,
): Promise<ArtifactRecord> {
  const hash = await sha256(sourcePath);
  const existing = (await listArtifacts(projectRoot, "source_seen")).find((record) => {
    return record.source_path === toProjectRelative(projectRoot, sourcePath) && record.sha256 === hash;
  });
  if (existing) return existing;
  return registerArtifact(projectRoot, {
    type: "source_seen",
    source_path: sourcePath,
    sha256: hash,
    tool,
  });
}

export async function writeSafeLog(projectRoot: string, event: Record<string, unknown>): Promise<void> {
  const workspace = await initWorkspace(projectRoot);
  const logsDir = path.join(workspace.piVcDir, "logs");
  await mkdir(logsDir, { recursive: true });
  await appendFile(
    path.join(logsDir, "pi-vc.log.jsonl"),
    `${JSON.stringify({ timestamp: nowIso(), ...event })}\n`,
    "utf8",
  );
}

export function isInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

export function toProjectRelative(projectRoot: string, filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const resolved = path.resolve(filePath);
  return isInside(resolved, projectRoot) ? path.relative(projectRoot, resolved) || "." : resolved;
}

export async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function uniquePath(targetPath: string): Promise<string> {
  if (!existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  for (let i = 2; i < 10_000; i += 1) {
    const candidate = path.join(dir, `${base}_${i}${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not create unique path for ${targetPath}`);
}

function toProjectRelativeArtifact(projectRoot: string, artifact: ArtifactRecord): ArtifactRecord {
  return {
    ...artifact,
    source_path: toProjectRelative(projectRoot, artifact.source_path),
    artifact_path: toProjectRelative(projectRoot, artifact.artifact_path),
    markdown_path: toProjectRelative(projectRoot, artifact.markdown_path),
    diff_path: toProjectRelative(projectRoot, artifact.diff_path),
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_").slice(0, 80) || "artifact";
}

function normalizeExtension(ext: string): string {
  if (!ext) return "";
  return ext.startsWith(".") ? ext : `.${ext}`;
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
