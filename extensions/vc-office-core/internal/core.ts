import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PDFParse } from "pdf-parse";
import {
  createOutputPath,
  ensureSourceSeen,
  getOrInitWorkspace,
  registerArtifact,
  resolveSourcePath,
  toProjectRelative,
} from "../../vc-project-workspace/public.js";
import type {
  ConvertResult,
  DiffResult,
  DocumentBlock,
  DocumentObject,
  OfficeReadResult,
  PatchObject,
  PatchResult,
  RenderResult,
} from "../schema.js";
import { patchOpenXmlText, readDocxBlocks, readPptxBlocks, shortHash } from "./openxml.js";

const execFileAsync = promisify(execFile);
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(thisDir, "../../..");

export async function officeRead(inputPath: string): Promise<OfficeReadResult> {
  const resolved = await resolveSourcePath(inputPath);
  const sourceArtifact = resolved.artifact ?? (await ensureSourceSeen(resolved.projectRoot, resolved.sourcePath, "office_read"));
  const notices = [...resolved.notices];
  const warnings: string[] = [];
  let readablePath = resolved.sourcePath;
  let ext = path.extname(readablePath).toLowerCase();

  if (ext === ".doc" || ext === ".ppt") {
    const conversion = await convertLegacyOffice(readablePath, resolved.projectRoot);
    warnings.push(...conversion.warnings);
    if (conversion.convertedPath) {
      readablePath = conversion.convertedPath;
      ext = path.extname(readablePath).toLowerCase();
      notices.push(`Converted legacy Office file to ${readablePath}`);
    }
  }

  const { docType, blocks, parseWarnings } = await parseReadableFile(readablePath, ext);
  warnings.push(...parseWarnings);

  const document: DocumentObject = {
    schema_version: 1,
    doc_type: docType,
    source_path: toProjectRelative(resolved.projectRoot, readablePath) ?? readablePath,
    source_artifact_id: sourceArtifact.id,
    parsed_at: new Date().toISOString(),
    blocks,
    warnings,
  };

  const jsonPath = await createOutputPath({
    projectRoot: resolved.projectRoot,
    sourcePath: readablePath,
    kind: "parsed",
    extension: ".document.json",
  });
  const markdownPath = jsonPath.replace(/\.document\.json$/i, ".document.md");
  document.markdown_path = toProjectRelative(resolved.projectRoot, markdownPath);
  await writeFile(jsonPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, toMarkdown(document), "utf8");

  const artifact = await registerArtifact(resolved.projectRoot, {
    type: "parsed_created",
    source_artifact_id: sourceArtifact.id,
    artifact_path: jsonPath,
    markdown_path: markdownPath,
    tool: "office_read",
    warnings,
  });

  return {
    document,
    document_path: jsonPath,
    markdown_path: markdownPath,
    artifact_id: artifact.id,
    notices,
    warnings,
  };
}

export async function officeInspect(inputPath: string): Promise<Record<string, unknown>> {
  const result = await officeRead(inputPath);
  return {
    doc_type: result.document.doc_type,
    block_count: result.document.blocks.length,
    editable_block_count: result.document.blocks.filter((block) => block.editable).length,
    warnings: result.warnings,
    document_path: result.document_path,
    markdown_path: result.markdown_path,
  };
}

export async function officeConvert(inputPath: string): Promise<ConvertResult> {
  const resolved = await resolveSourcePath(inputPath);
  const ext = path.extname(resolved.sourcePath).toLowerCase();
  if (ext !== ".doc" && ext !== ".ppt") {
    return {
      source_path: resolved.sourcePath,
      warnings: [`conversion_not_required_for:${ext || "unknown"}`],
    };
  }
  const conversion = await convertLegacyOffice(resolved.sourcePath, resolved.projectRoot);
  return {
    source_path: resolved.sourcePath,
    converted_path: conversion.convertedPath,
    warnings: conversion.warnings,
  };
}

export async function documentParse(inputPath: string): Promise<OfficeReadResult> {
  return officeRead(inputPath);
}

export async function officeDiff(sourcePath: string, outputPath: string): Promise<DiffResult> {
  const resolved = await resolveSourcePath(sourcePath);
  const workspace = await getOrInitWorkspace();
  const diffPath = await createOutputPath({
    projectRoot: workspace.projectRoot,
    sourcePath: resolved.sourcePath,
    kind: "diff",
    extension: ".md",
    label: `${path.basename(resolved.sourcePath, path.extname(resolved.sourcePath))}_diff`,
  });
  const sourceInfo = existsSync(resolved.sourcePath) ? await fileSummary(resolved.sourcePath) : "source_missing";
  const outputInfo = existsSync(outputPath) ? await fileSummary(outputPath) : "output_missing";
  await writeFile(diffPath, [
    "# Office Diff",
    "",
    `Source: ${resolved.sourcePath}`,
    `Output: ${outputPath}`,
    "",
    "## Mechanical Summary",
    "",
    `- Source: ${sourceInfo}`,
    `- Output: ${outputInfo}`,
    "",
    "Detailed semantic diff is available for files generated through `office_patch`.",
    "",
  ].join("\n"), "utf8");
  return { diff_path: diffPath, warnings: ["semantic_diff_not_available_without_patch_context"] };
}

export async function officeRender(inputPath: string): Promise<RenderResult> {
  const resolved = await resolveSourcePath(inputPath);
  const ext = path.extname(resolved.sourcePath).toLowerCase();
  const warnings: string[] = [];
  const checks: RenderResult["mechanical_checks"] = [];
  checks.push({
    name: "file_exists",
    status: existsSync(resolved.sourcePath) ? "pass" : "warn",
  });

  if (ext === ".docx" || ext === ".pptx") {
    checks.push({
      name: "provider_render",
      status: "not_available",
      detail: "MS Office COM / LibreOffice render provider hook is not implemented in this first pass.",
    });
    warnings.push("render_provider_not_implemented");
  } else {
    checks.push({
      name: "provider_render",
      status: "not_available",
      detail: `No render provider for ${ext || "unknown"}.`,
    });
    warnings.push("render_unavailable_for_file_type");
  }

  return { warnings, mechanical_checks: checks };
}

export async function officePatch(patch: PatchObject): Promise<PatchResult> {
  const resolved = await resolveSourcePath(patch.source_path);
  const ext = path.extname(resolved.sourcePath).toLowerCase();
  if (ext !== ".docx" && ext !== ".pptx") {
    throw new Error(`office_patch currently supports .docx and .pptx sources only. Got: ${ext}`);
  }

  const { blocks } = await parseReadableFile(resolved.sourcePath, ext);
  const target = blocks.find((block) => block.block_id === patch.target);
  if (!target) throw new Error(`Target block not found: ${patch.target}`);
  if (patch.expected_content_hash && target.content_hash !== patch.expected_content_hash) {
    throw new Error(`Target hash mismatch for ${patch.target}. Re-run office_read before patching.`);
  }

  const outputPath = await createOutputPath({
    projectRoot: resolved.projectRoot,
    sourcePath: resolved.sourcePath,
    kind: "output",
    extension: ext,
    label: `${path.basename(resolved.sourcePath, ext)}_edited`,
  });
  await patchOpenXmlText(resolved.sourcePath, target, patch.value, outputPath);

  const diffPath = await createOutputPath({
    projectRoot: resolved.projectRoot,
    sourcePath: resolved.sourcePath,
    kind: "diff",
    extension: ".md",
    label: `${path.basename(resolved.sourcePath, ext)}_diff`,
  });
  await writeFile(diffPath, renderDiff(resolved.sourcePath, outputPath, target, patch.value), "utf8");

  const artifact = await registerArtifact(resolved.projectRoot, {
    type: "output_created",
    source_artifact_id: resolved.artifact?.id,
    artifact_path: outputPath,
    diff_path: diffPath,
    tool: "office_patch",
    warnings: ["render_not_run_in_first_implementation"],
  });

  return {
    output_path: outputPath,
    diff_path: diffPath,
    artifact_id: artifact.id,
    warnings: ["render_not_run_in_first_implementation"],
  };
}

export async function inspectOfficeEnvironment(): Promise<Array<{ name: string; ok: boolean; detail?: string }>> {
  const checks = [
    ["pwsh", ["--version"]],
    ["powershell", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"]],
    ["soffice", ["--version"]],
    ["python", ["--version"]],
    ["paddleocr", ["--help"]],
    ["qmd", ["--help"]],
  ] as const;
  const results = [];
  for (const [command, args] of checks) {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { timeout: 5000 });
      results.push({ name: command, ok: true, detail: firstLine(stdout || stderr) });
    } catch {
      results.push({ name: command, ok: false });
    }
  }
  return results;
}

async function parseReadableFile(filePath: string, ext: string): Promise<{
  docType: DocumentObject["doc_type"];
  blocks: DocumentBlock[];
  parseWarnings: string[];
}> {
  if (ext === ".docx") {
    return { docType: "docx", blocks: await readDocxBlocks(filePath), parseWarnings: [] };
  }
  if (ext === ".pptx") {
    return { docType: "pptx", blocks: await readPptxBlocks(filePath), parseWarnings: [] };
  }
  if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    const text = await readFile(filePath, "utf8");
    return {
      docType: ext === ".txt" ? "text" : "markdown",
      blocks: textToBlocks(text),
      parseWarnings: [],
    };
  }
  if (ext === ".pdf") {
    const parsedPdf = await readPdfBlocks(filePath);
    return {
      docType: "pdf",
      blocks: parsedPdf.blocks,
      parseWarnings: parsedPdf.warnings,
    };
  }
  return {
    docType: "unknown",
    blocks: [],
    parseWarnings: [`unsupported_file_type:${ext || "none"}`],
  };
}

async function readPdfBlocks(filePath: string): Promise<{
  blocks: DocumentBlock[];
  warnings: string[];
}> {
  try {
    const parser = new PDFParse({ data: await readFile(filePath) });
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    await parser.destroy();
    if (!text) {
      return {
        blocks: [],
        warnings: ["pdf_has_no_extractable_text_needs_ocr"],
      };
    }
    const blocks = text
      .split(/\n\s*\n+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part, index): DocumentBlock => {
        const hash = shortHash(part);
        return {
          block_id: `pdf_text_block${String(index + 1).padStart(3, "0")}_${hash}`,
          type: "page_text",
          text: part,
          editable: false,
          source_type: "native_text",
          content_hash: hash,
          location: { block: index + 1 },
        };
      });
    return {
      blocks,
      warnings: [],
    };
  } catch (error) {
    return {
      blocks: [],
      warnings: [`pdf_text_extraction_failed:${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

async function convertLegacyOffice(sourcePath: string, projectRoot: string): Promise<{
  convertedPath?: string;
  warnings: string[];
}> {
  const ext = path.extname(sourcePath).toLowerCase();
  const targetExt = ext === ".doc" ? ".docx" : ext === ".ppt" ? ".pptx" : undefined;
  if (!targetExt) return { warnings: [] };

  const outputPath = await createOutputPath({
    projectRoot,
    sourcePath,
    kind: "cache",
    subdir: "converted",
    extension: targetExt,
    label: `${path.basename(sourcePath, ext)}_converted`,
  });

  const scriptPath = path.join(packageRoot, "scripts", "office-com-convert.ps1");
  const pwsh = await findCommand("pwsh").catch(() => undefined);
  const powershell = pwsh ?? (await findCommand("powershell").catch(() => undefined));
  if (!powershell || !existsSync(scriptPath)) {
    return { warnings: ["conversion_provider_unavailable"] };
  }

  try {
    await execFileAsync(powershell, [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-InputPath",
      sourcePath,
      "-OutputPath",
      outputPath,
    ], { timeout: 120000 });
    return { convertedPath: outputPath, warnings: [] };
  } catch (error) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    return { warnings: [`ms_office_com_conversion_failed:${error instanceof Error ? error.message : String(error)}`] };
  }
}

async function findCommand(command: string): Promise<string> {
  await execFileAsync(command, ["--version"], { timeout: 3000 });
  return command;
}

function textToBlocks(text: string): DocumentBlock[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const hash = shortHash(part);
      return {
        block_id: `text_block${String(index + 1).padStart(3, "0")}_${hash}`,
        type: "text",
        text: part,
        editable: false,
        source_type: "plain_text",
        content_hash: hash,
        location: { block: index + 1 },
      };
    });
}

function toMarkdown(document: DocumentObject): string {
  const lines = [
    `# Parsed ${document.doc_type} Document`,
    "",
    `Source: ${document.source_path}`,
    `Parsed at: ${document.parsed_at}`,
    "",
  ];
  if (document.warnings.length > 0) {
    lines.push("## Warnings", "", ...document.warnings.map((warning) => `- ${warning}`), "");
  }
  lines.push("## Blocks", "");
  for (const block of document.blocks) {
    lines.push(`### ${block.block_id}`, "", block.text, "");
  }
  return `${lines.join("\n")}\n`;
}

function renderDiff(sourcePath: string, outputPath: string, target: DocumentBlock, after: string): string {
  return [
    "# Office Patch Diff",
    "",
    `Source: ${sourcePath}`,
    `Output: ${outputPath}`,
    "",
    `Block: ${target.block_id}`,
    "",
    "## Before",
    "",
    target.text,
    "",
    "## After",
    "",
    after,
    "",
    "## Render / Validation",
    "",
    "- Render status: not_run_in_first_implementation",
    "- Visual QA: not available, preview requires human review",
    "",
  ].join("\n");
}

async function fileSummary(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return `${data.byteLength} bytes sha1=${createHash("sha1").update(data).digest("hex").slice(0, 10)}`;
}

function firstLine(value: string): string | undefined {
  return value.split(/\r?\n/).find(Boolean)?.slice(0, 120);
}

export function hashText(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 6);
}
