export type DocType = "docx" | "pptx" | "pdf" | "markdown" | "text" | "unknown";

export interface DocumentBlock {
  block_id: string;
  type: "text" | "table_cell" | "page_text";
  text: string;
  editable: boolean;
  source_type: "native_text" | "ocr_text" | "plain_text" | "metadata";
  content_hash: string;
  location: Record<string, unknown>;
}

export interface DocumentObject {
  schema_version: 1;
  doc_type: DocType;
  source_path: string;
  source_artifact_id?: string;
  parsed_at: string;
  blocks: DocumentBlock[];
  markdown_path?: string;
  warnings: string[];
}

export interface OfficeReadResult {
  document: DocumentObject;
  document_path: string;
  markdown_path: string;
  artifact_id?: string;
  notices: string[];
  warnings: string[];
}

export interface PatchObject {
  source_path: string;
  target: string;
  operation: "replace_text";
  value: string;
  expected_content_hash?: string;
  preserve_formatting?: boolean;
}

export interface PatchResult {
  output_path: string;
  diff_path: string;
  artifact_id?: string;
  warnings: string[];
}

export interface ConvertResult {
  source_path: string;
  converted_path?: string;
  warnings: string[];
}

export interface DiffResult {
  diff_path: string;
  warnings: string[];
}

export interface RenderResult {
  preview_path?: string;
  warnings: string[];
  mechanical_checks: Array<{
    name: string;
    status: "pass" | "warn" | "not_available";
    detail?: string;
  }>;
}
