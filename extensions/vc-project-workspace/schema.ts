export type WorkspaceLayout = "compact";

export interface WorkspaceIdentity {
  schema_version: 1;
  project_id: string;
  project_name: string;
  created_at: string;
  layout: WorkspaceLayout;
}

export type ArtifactType =
  | "source_seen"
  | "external_imported"
  | "parsed_created"
  | "output_created"
  | "memory_created";

export interface ArtifactRecord {
  id: string;
  type: ArtifactType;
  created_at: string;
  source_path?: string;
  source_artifact_id?: string;
  artifact_path?: string;
  markdown_path?: string;
  diff_path?: string;
  sha256?: string;
  tool?: string;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkspaceContext {
  projectRoot: string;
  piVcDir: string;
  workspacePath: string;
  workspace: WorkspaceIdentity;
  created: boolean;
}

export interface ResolvedSourcePath {
  projectRoot: string;
  originalPath: string;
  sourcePath: string;
  relation: "project_local" | "external_imported";
  artifact?: ArtifactRecord;
  notices: string[];
}

export type OutputKind = "input" | "output" | "parsed" | "diff" | "cache" | "logs" | "memory";

export interface OutputPathRequest {
  projectRoot: string;
  sourcePath?: string;
  kind: OutputKind;
  extension?: string;
  label?: string;
  subdir?: string;
}
