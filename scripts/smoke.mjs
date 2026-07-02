import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { DefaultResourceLoader, getAgentDir } from "@earendil-works/pi-coding-agent";

const root = process.cwd();
const smokeRoot = path.join(root, ".tmp-smoke");
const projectRoot = path.join(smokeRoot, "project");
process.env.PI_VC_HOME = path.join(smokeRoot, "global");

await rm(smokeRoot, { recursive: true, force: true });
await mkdir(projectRoot, { recursive: true });

const workspace = await import("../.tmp-build/vc-project-workspace/public.js");
const office = await import("../.tmp-build/vc-office-core/public.js");
const memory = await import("../.tmp-build/vc-memory/public.js");

const ws = await workspace.getOrInitWorkspace(projectRoot);
assert(ws.workspacePath.endsWith(path.join(".pi-vc", "workspace.json")), "workspace initialized");

const mdPath = path.join(projectRoot, "memo.md");
await writeFile(mdPath, "# Memo\n\nThis project uses a low-intrusion workspace.", "utf8");
const mdRead = await office.officeRead(mdPath);
assert(mdRead.document.blocks.length > 0, "markdown parsed");

const pdfPath = path.join(projectRoot, "sample.pdf");
await writeFile(pdfPath, buildPdf("Hello PDF text"), "ascii");
const pdfRead = await office.officeRead(pdfPath);
assert(pdfRead.document.blocks.some((block) => block.text.includes("Hello PDF text")), "pdf text parsed");

const docxPath = path.join(projectRoot, "sample.docx");
await writeFile(docxPath, await buildDocx(["Original project highlight", "Risk to verify"]));
const docxRead = await office.officeRead(docxPath);
assert(docxRead.document.blocks.length === 2, "docx parsed");
const patch = await office.officePatch({
  source_path: docxPath,
  target: docxRead.document.blocks[0].block_id,
  operation: "replace_text",
  value: "Updated project highlight",
  expected_content_hash: docxRead.document.blocks[0].content_hash,
});
assert(patch.output_path && patch.diff_path, "docx patch output created");

const capture = await memory.captureMemory({
  text: "User confirmed low-intrusion .pi-vc workspace as the default design.",
  category: "judgment",
  trigger: "smoke_test",
});
assert(capture.record?.path, "memory captured");
const recall = await memory.memoryRecall("low-intrusion workspace", 3);
assert(recall.results.length > 0, "memory recall works");

const loader = new DefaultResourceLoader({
  cwd: root,
  agentDir: getAgentDir(),
  additionalExtensionPaths: [
    "./extensions/vc-project-workspace/index.ts",
    "./extensions/vc-office-core/index.ts",
    "./extensions/vc-memory/index.ts",
  ],
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
});
await loader.reload();
const extensions = loader.getExtensions();
assert((extensions.diagnostics ?? []).length === 0, "pi extension loader diagnostics clean");

console.log("pi-vc-core smoke test passed.");

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}

async function buildDocx(paragraphs) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
    .map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`)
    .join("")}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

function buildPdf(text) {
  const objects = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  const stream = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`;
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream\nendobj\n`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
