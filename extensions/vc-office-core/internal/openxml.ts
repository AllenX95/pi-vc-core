import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { DocumentBlock } from "../schema.js";

interface RawBlock extends DocumentBlock {
  locator: {
    xmlPath?: string;
    paragraphIndex?: number;
    paragraphTag?: "w:p" | "a:p";
    textTag?: "w:t" | "a:t";
  };
}

export async function readDocxBlocks(filePath: string): Promise<DocumentBlock[]> {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const xmlPath = "word/document.xml";
  const xml = await zip.file(xmlPath)?.async("string");
  if (!xml) return [];
  return extractParagraphBlocks(xml, {
    docType: "docx",
    xmlPath,
    paragraphTag: "w:p",
    textTag: "w:t",
  });
}

export async function readPptxBlocks(filePath: string): Promise<DocumentBlock[]> {
  const zip = await JSZip.loadAsync(await readFile(filePath));
  const slidePaths = Object.keys(zip.files)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  const blocks: DocumentBlock[] = [];
  for (const slidePath of slidePaths) {
    const xml = await zip.file(slidePath)?.async("string");
    if (!xml) continue;
    const slideBlocks = extractParagraphBlocks(xml, {
      docType: "pptx",
      xmlPath: slidePath,
      paragraphTag: "a:p",
      textTag: "a:t",
      slide: slideNumber(slidePath),
    });
    blocks.push(...slideBlocks);
  }
  return blocks;
}

export async function patchOpenXmlText(
  sourcePath: string,
  targetBlock: DocumentBlock,
  newValue: string,
  outputPath: string,
): Promise<void> {
  const locator = (targetBlock as RawBlock).locator;
  if (!locator?.xmlPath || locator.paragraphIndex === undefined || !locator.paragraphTag || !locator.textTag) {
    throw new Error(`Target block is not editable by OpenXML patcher: ${targetBlock.block_id}`);
  }

  const zip = await JSZip.loadAsync(await readFile(sourcePath));
  const file = zip.file(locator.xmlPath);
  if (!file) throw new Error(`XML part not found: ${locator.xmlPath}`);

  const xml = await file.async("string");
  const patched = replaceParagraphText(xml, locator.paragraphTag, locator.textTag, locator.paragraphIndex, newValue);
  zip.file(locator.xmlPath, patched);
  await writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer" }));
}

function extractParagraphBlocks(
  xml: string,
  options: {
    docType: "docx" | "pptx";
    xmlPath: string;
    paragraphTag: "w:p" | "a:p";
    textTag: "w:t" | "a:t";
    slide?: number;
  },
): DocumentBlock[] {
  const blocks: RawBlock[] = [];
  const paragraphRegex = new RegExp(`<${escapeRegex(options.paragraphTag)}[\\s\\S]*?<\\/${escapeRegex(options.paragraphTag)}>`, "g");
  const paragraphs = xml.match(paragraphRegex) ?? [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const text = extractTaggedText(paragraph, options.textTag).trim();
    if (!text) return;
    const hash = shortHash(text);
    const location: Record<string, unknown> = {
      xml_path: options.xmlPath,
      paragraph: paragraphIndex + 1,
    };
    if (options.slide) location.slide = options.slide;
    blocks.push({
      block_id:
        options.docType === "pptx"
          ? `pptx_slide${pad(options.slide ?? 0)}_para${pad(paragraphIndex + 1)}_${hash}`
          : `docx_body_para${pad(paragraphIndex + 1)}_${hash}`,
      type: "text",
      text,
      editable: true,
      source_type: "native_text",
      content_hash: hash,
      location,
      locator: {
        xmlPath: options.xmlPath,
        paragraphIndex,
        paragraphTag: options.paragraphTag,
        textTag: options.textTag,
      },
    });
  });
  return blocks;
}

function extractTaggedText(xml: string, tag: string): string {
  const regex = new RegExp(`<${escapeRegex(tag)}[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`, "g");
  const parts = [];
  for (const match of xml.matchAll(regex)) {
    parts.push(decodeXml(match[1] ?? ""));
  }
  return parts.join("");
}

function replaceParagraphText(
  xml: string,
  paragraphTag: "w:p" | "a:p",
  textTag: "w:t" | "a:t",
  paragraphIndex: number,
  newValue: string,
): string {
  const paragraphRegex = new RegExp(`<${escapeRegex(paragraphTag)}[\\s\\S]*?<\\/${escapeRegex(paragraphTag)}>`, "g");
  let current = 0;
  return xml.replace(paragraphRegex, (paragraph) => {
    if (current++ !== paragraphIndex) return paragraph;
    let replaced = false;
    const textRegex = new RegExp(`(<${escapeRegex(textTag)}[^>]*>)([\\s\\S]*?)(<\\/${escapeRegex(textTag)}>)`, "g");
    const updated = paragraph.replace(textRegex, (_match, open: string, _text: string, close: string) => {
      if (!replaced) {
        replaced = true;
        return `${open}${encodeXml(newValue)}${close}`;
      }
      return `${open}${close}`;
    });
    if (!replaced) throw new Error("No editable text run found in target paragraph.");
    return updated;
  });
}

function slideNumber(slidePath: string): number {
  return Number(path.basename(slidePath).match(/\d+/)?.[0] ?? 0);
}

export function shortHash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 6);
}

function pad(value: number): string {
  return String(value).padStart(3, "0");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
