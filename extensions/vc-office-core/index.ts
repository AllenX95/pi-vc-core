import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  documentParse,
  inspectOfficeEnvironment,
  officeConvert,
  officeDiff,
  officeInspect,
  officePatch,
  officeRead,
  officeRender,
} from "./public.js";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "office_read",
    label: "VC Office Read",
    description: "Parse a Word, PowerPoint, PDF, Markdown, or text project file through vc-office-core.",
    parameters: Type.Object({
      path: Type.String({ description: "Path selected by the user, including Pi @file-resolved paths." }),
    }),
    async execute(_toolCallId, params) {
      const result = await officeRead(params.path);
      return textResult(formatReadResult(result), result);
    },
  });

  pi.registerTool({
    name: "office_inspect",
    label: "VC Office Inspect",
    description: "Inspect document structure and editable block counts.",
    parameters: Type.Object({
      path: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const result = await officeInspect(params.path);
      return textResult(JSON.stringify(result, null, 2), result);
    },
  });

  pi.registerTool({
    name: "office_convert",
    label: "VC Office Convert",
    description: "Convert a legacy .doc or .ppt file through configured local providers.",
    parameters: Type.Object({
      path: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const result = await officeConvert(params.path);
      return textResult(
        result.converted_path
          ? `Converted file: ${result.converted_path}`
          : `No converted file. Warnings: ${result.warnings.join("; ") || "none"}`,
        result,
      );
    },
  });

  pi.registerTool({
    name: "document_parse",
    label: "VC Document Parse",
    description: "Parse a document, including PDFs and scanned-document fallbacks, through vc-office-core.",
    parameters: Type.Object({
      path: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const result = await documentParse(params.path);
      return textResult(formatReadResult(result), result);
    },
  });

  pi.registerTool({
    name: "office_patch",
    label: "VC Office Patch",
    description: "Apply a safe block-level text replacement patch to .docx or .pptx.",
    parameters: Type.Object({
      source_path: Type.String(),
      target: Type.String(),
      operation: Type.Literal("replace_text"),
      value: Type.String(),
      expected_content_hash: Type.Optional(Type.String()),
      preserve_formatting: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params) {
      const result = await officePatch(params);
      return textResult(`Patched file: ${result.output_path}\nDiff: ${result.diff_path}`, result);
    },
  });

  pi.registerTool({
    name: "office_diff",
    label: "VC Office Diff",
    description: "Generate a mechanical diff report for a source/output file pair.",
    parameters: Type.Object({
      source_path: Type.String(),
      output_path: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const result = await officeDiff(params.source_path, params.output_path);
      return textResult(`Diff report: ${result.diff_path}`, result);
    },
  });

  pi.registerTool({
    name: "office_render",
    label: "VC Office Render",
    description: "Try to render an Office file or return clear provider warnings and mechanical checks.",
    parameters: Type.Object({
      path: Type.String(),
    }),
    async execute(_toolCallId, params) {
      const result = await officeRender(params.path);
      return textResult(
        [
          result.preview_path ? `Preview: ${result.preview_path}` : "Preview: unavailable",
          `Warnings: ${result.warnings.join("; ") || "none"}`,
          ...result.mechanical_checks.map((check) => `${check.name}: ${check.status}${check.detail ? ` (${check.detail})` : ""}`),
        ].join("\n"),
        result,
      );
    },
  });

  pi.registerTool({
    name: "office_environment",
    label: "VC Office Environment",
    description: "Check local Office/OCR/recall provider commands visible to vc-office-core.",
    parameters: Type.Object({}),
    async execute() {
      const result = await inspectOfficeEnvironment();
      return textResult(result.map((item) => `${item.name}: ${item.ok ? "ok" : "missing"}`).join("\n"), { result });
    },
  });

  pi.registerCommand("vc-read", {
    description: "Parse one project material file through vc-office-core.",
    handler: async (args, ctx) => {
      const filePath = args?.trim();
      if (!filePath) {
        ctx.ui.notify("Usage: /vc-read <path>", "warning");
        return;
      }
      const result = await officeRead(filePath);
      ctx.ui.notify(formatReadResult(result), result.warnings.length ? "warning" : "info");
    },
  });
}

function textResult(text: string, details: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function formatReadResult(result: Awaited<ReturnType<typeof officeRead>>): string {
  return [
    ...result.notices,
    `Parsed document: ${result.document_path}`,
    `Markdown view: ${result.markdown_path}`,
    `Blocks: ${result.document.blocks.length}`,
    result.warnings.length ? `Warnings: ${result.warnings.join("; ")}` : "Warnings: none",
  ].filter(Boolean).join("\n");
}
