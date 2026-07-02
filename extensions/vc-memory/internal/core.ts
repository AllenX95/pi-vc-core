import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  getOrInitWorkspace,
  globalPiVcDir,
  nowIso,
  registerArtifact,
  toProjectRelative,
} from "../../vc-project-workspace/public.js";
import type { DreamProposal, MemoryCaptureInput, MemoryRecord, RecallResult } from "../schema.js";

const execFileAsync = promisify(execFile);

export function globalMemoryDir(): string {
  return path.join(globalPiVcDir(), "memory");
}

export async function captureMemory(input: MemoryCaptureInput): Promise<{
  record?: MemoryRecord;
  warning?: string;
}> {
  const sensitive = detectSensitive(input.text);
  if (sensitive) {
    return { warning: `sensitive_content_detected:${sensitive}` };
  }

  const target = input.target ?? "short_term";
  if (target === "project") return captureProjectMemory(input);
  if (target === "long_term") return captureLongTermMemory(input);
  return captureShortTermMemory(input);
}

export async function memoryRecall(query: string, limit = 5): Promise<RecallResult> {
  const root = globalMemoryDir();
  const workspace = await getOrInitWorkspace();
  const dirs = [root, path.join(workspace.projectRoot, ".pi-vc", "memory")].filter(existsSync);
  return recallFromDirs(query, dirs, limit, "memory");
}

export async function documentRecall(query: string, limit = 5): Promise<RecallResult> {
  const workspace = await getOrInitWorkspace();
  const parsedDir = path.join(workspace.projectRoot, ".pi-vc", "parsed");
  return recallFromDirs(query, existsSync(parsedDir) ? [parsedDir] : [], limit, "document");
}

export async function listShortTerm(): Promise<string[]> {
  const inbox = path.join(globalMemoryDir(), "short-term", "inbox");
  if (!existsSync(inbox)) return [];
  return collectMarkdownFiles(inbox);
}

export async function dreamPrepare(): Promise<DreamProposal> {
  const candidates = await listShortTerm();
  const proposal: DreamProposal = {
    id: `dream_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    created_at: nowIso(),
    candidate_count: candidates.length,
    promote: [],
    update_project: [],
    merge: [],
    archive: candidates,
    warnings: candidates.length === 0 ? ["no_short_term_candidates"] : [],
  };

  const pendingDir = path.join(globalMemoryDir(), "dream", "pending");
  await mkdir(pendingDir, { recursive: true });
  await writeFile(path.join(pendingDir, `${proposal.id}.json`), `${JSON.stringify(proposal, null, 2)}\n`, "utf8");
  return proposal;
}

export async function dreamCommit(proposalId?: string): Promise<{
  reportPath: string;
  archived: string[];
  warnings: string[];
}> {
  const dreamDir = path.join(globalMemoryDir(), "dream");
  const pendingDir = path.join(dreamDir, "pending");
  const archiveDir = path.join(dreamDir, "archive");
  const reportsDir = path.join(dreamDir, "reports");
  await mkdir(archiveDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });

  const proposalPath = await resolveProposalPath(pendingDir, proposalId);
  if (!proposalPath) throw new Error("No pending Dream proposal found. Run dream_prepare first.");

  const proposal = JSON.parse(await readFile(proposalPath, "utf8")) as DreamProposal;
  const archived: string[] = [];
  for (const candidate of proposal.archive) {
    if (!existsSync(candidate)) continue;
    const archivePath = path.join(archiveDir, path.basename(candidate));
    await rename(candidate, archivePath);
    archived.push(archivePath);
  }

  const reportPath = path.join(reportsDir, `${proposal.id}-report.md`);
  await writeFile(reportPath, renderDreamReport(proposal, archived), "utf8");
  await writeFile(path.join(dreamDir, "last-dream.md"), `---\nlast_dream_at: ${nowIso()}\nproposal_id: ${proposal.id}\n---\n\n# Last Dream\n\nCommitted ${proposal.id}.\n`, "utf8");
  await rename(proposalPath, path.join(archiveDir, path.basename(proposalPath)));

  return { reportPath, archived, warnings: proposal.warnings };
}

export async function startupDreamCheck(intervalDays = 7): Promise<{
  shouldRemind: boolean;
  lastDreamAt?: string;
  warning?: string;
}> {
  const lastDreamPath = path.join(globalMemoryDir(), "dream", "last-dream.md");
  if (!existsSync(lastDreamPath)) {
    return { shouldRemind: true, warning: "no_last_dream_record" };
  }
  const text = await readFile(lastDreamPath, "utf8");
  const lastDreamAt = text.match(/last_dream_at:\s*(.+)/)?.[1]?.trim();
  if (!lastDreamAt) return { shouldRemind: true, warning: "invalid_last_dream_record" };
  const elapsedMs = Date.now() - Date.parse(lastDreamAt);
  return {
    shouldRemind: elapsedMs >= intervalDays * 24 * 60 * 60 * 1000,
    lastDreamAt,
  };
}

async function captureShortTermMemory(input: MemoryCaptureInput): Promise<{ record: MemoryRecord }> {
  const dir = path.join(globalMemoryDir(), "short-term", "inbox");
  await mkdir(dir, { recursive: true });
  const record = createRecord(input, "short_term", "candidate", path.join(dir, `${datePart()}-${slug(input.text)}.md`));
  await writeMemoryFile(record, input.text);
  return { record };
}

async function captureProjectMemory(input: MemoryCaptureInput): Promise<{ record: MemoryRecord }> {
  const workspace = await getOrInitWorkspace();
  const dir = path.join(workspace.projectRoot, ".pi-vc", "memory");
  await mkdir(dir, { recursive: true });
  const record = createRecord(input, "project", "active", path.join(dir, "decisions.md"));
  await appendMemorySection(record.path, record, input.text);
  await registerArtifact(workspace.projectRoot, {
    type: "memory_created",
    artifact_path: record.path,
    tool: "memory_capture",
  });
  return { record };
}

async function captureLongTermMemory(input: MemoryCaptureInput): Promise<{ record: MemoryRecord }> {
  const category = input.category ?? "judgments";
  const dir = path.join(globalMemoryDir(), "long-term", sanitizePathPart(category));
  await mkdir(dir, { recursive: true });
  const record = createRecord(input, "long_term", "active", path.join(dir, `${datePart()}-${slug(input.text)}.md`));
  await writeMemoryFile(record, input.text);
  return { record };
}

function createRecord(
  input: MemoryCaptureInput,
  type: MemoryRecord["type"],
  status: MemoryRecord["status"],
  filePath: string,
): MemoryRecord {
  const timestamp = nowIso();
  return {
    id: `mem_${timestamp.replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    type,
    category: input.category ?? "judgment",
    status,
    project: input.project,
    tags: input.tags ?? [],
    entities: input.entities ?? [],
    trigger: input.trigger ?? "user_signal",
    created_at: timestamp,
    updated_at: timestamp,
    path: filePath,
  };
}

async function writeMemoryFile(record: MemoryRecord, text: string): Promise<void> {
  await writeFile(record.path, `${frontmatter(record)}\n# ${titleFromText(text)}\n\n${text.trim()}\n`, "utf8");
}

async function appendMemorySection(filePath: string, record: MemoryRecord, text: string): Promise<void> {
  const section = `\n\n## ${record.created_at} ${record.category}\n\n${text.trim()}\n`;
  if (!existsSync(filePath)) {
    await writeFile(filePath, `${frontmatter(record)}\n# Project Decisions\n${section}`, "utf8");
  } else {
    await writeFile(filePath, `${await readFile(filePath, "utf8")}${section}`, "utf8");
  }
}

function frontmatter(record: MemoryRecord): string {
  return [
    "---",
    `id: ${record.id}`,
    `type: ${record.type}`,
    `category: ${record.category}`,
    `status: ${record.status}`,
    record.project ? `project: ${record.project}` : undefined,
    `tags: [${record.tags.join(", ")}]`,
    `entities: [${record.entities.join(", ")}]`,
    `trigger: ${record.trigger}`,
    `created_at: ${record.created_at}`,
    `updated_at: ${record.updated_at}`,
    "---",
  ].filter(Boolean).join("\n");
}

async function recallFromDirs(
  query: string,
  dirs: string[],
  limit: number,
  _kind: "memory" | "document",
): Promise<RecallResult> {
  const warnings: string[] = [];
  const qmdAvailable = await commandAvailable("qmd");
  if (!qmdAvailable) warnings.push("qmd_unavailable_using_basic_text_search");
  const files = (await Promise.all(dirs.map(collectMarkdownFiles))).flat();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const lower = text.toLowerCase();
    const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
    if (score > 0 || query.trim() === "") {
      results.push({ path: file, score, snippet: snippet(text, terms[0]) });
    }
  }
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return {
    provider: qmdAvailable ? "qmd" : "text_search",
    query,
    results: results.slice(0, limit),
    warnings,
  };
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectMarkdownFiles(fullPath));
    if (entry.isFile() && /\.md$/i.test(entry.name)) files.push(fullPath);
  }
  return files;
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--help"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function detectSensitive(text: string): string | undefined {
  if (/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/i.test(text)) return "credential_like_text";
  if (/\b\d{16,19}\b/.test(text)) return "card_or_long_number";
  if (/\b\d{17}[\dXx]\b/.test(text)) return "cn_id_like_number";
  return undefined;
}

function renderDreamReport(proposal: DreamProposal, archived: string[]): string {
  return [
    `# Dream Report ${proposal.created_at.slice(0, 10)}`,
    "",
    "## Promoted to Long-term",
    "",
    proposal.promote.length ? proposal.promote.map((item) => `- ${item}`).join("\n") : "- None",
    "",
    "## Updated Project Memory",
    "",
    proposal.update_project.length ? proposal.update_project.map((item) => `- ${item}`).join("\n") : "- None",
    "",
    "## Merged",
    "",
    proposal.merge.length ? proposal.merge.map((item) => `- ${item}`).join("\n") : "- None",
    "",
    "## Archived",
    "",
    archived.length ? archived.map((item) => `- ${item}`).join("\n") : "- None",
    "",
  ].join("\n");
}

async function resolveProposalPath(pendingDir: string, proposalId?: string): Promise<string | undefined> {
  if (!existsSync(pendingDir)) return undefined;
  if (proposalId) {
    const explicit = path.join(pendingDir, `${proposalId}.json`);
    return existsSync(explicit) ? explicit : undefined;
  }
  const proposals = (await readdir(pendingDir)).filter((name) => name.endsWith(".json")).sort();
  return proposals.length ? path.join(pendingDir, proposals[proposals.length - 1]) : undefined;
}

function datePart(): string {
  return new Date().toISOString().slice(0, 10);
}

function slug(text: string): string {
  return sanitizePathPart(text.slice(0, 32).toLowerCase().replace(/\s+/g, "-")) || "memory";
}

function sanitizePathPart(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80);
}

function titleFromText(text: string): string {
  return text.trim().split(/\r?\n/)[0]?.slice(0, 80) || "Memory";
}

function snippet(text: string, term?: string): string {
  if (!term) return text.replace(/\s+/g, " ").slice(0, 240);
  const lower = text.toLowerCase();
  const index = lower.indexOf(term.toLowerCase());
  if (index < 0) return text.replace(/\s+/g, " ").slice(0, 240);
  return text.slice(Math.max(0, index - 80), index + 160).replace(/\s+/g, " ");
}
