export type MemoryType = "short_term" | "project" | "long_term";

export interface MemoryCaptureInput {
  text: string;
  category?: string;
  project?: string;
  tags?: string[];
  entities?: string[];
  trigger?: string;
  target?: MemoryType;
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  category: string;
  status: "candidate" | "active" | "archived";
  project?: string;
  tags: string[];
  entities: string[];
  trigger: string;
  created_at: string;
  updated_at: string;
  path: string;
}

export interface RecallResult {
  provider: "qmd" | "text_search";
  query: string;
  results: Array<{
    path: string;
    score: number;
    snippet: string;
  }>;
  warnings: string[];
}

export interface DreamProposal {
  id: string;
  created_at: string;
  candidate_count: number;
  promote: string[];
  update_project: string[];
  merge: string[];
  archive: string[];
  warnings: string[];
}
