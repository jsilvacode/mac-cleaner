export type RiskLevel = "bajo" | "medio" | "alto";
export type CleanCategory = "user_cache" | "user_logs" | "trash" | "tmp";

export interface ScanItem {
  id: CleanCategory;
  label: string;
  path: string;
  age_days: number;
  risk: RiskLevel;
  estimated_kb: number;
  estimated_human: string;
}

export interface ScanResponse {
  version: string;
  mode: "scan";
  items: ScanItem[];
}

export interface DryRunCandidate {
  category: CleanCategory;
  path: string;
  size_kb: number;
  size_human: string;
  risk: RiskLevel;
}

export interface DryRunResponse {
  version: string;
  mode: "dry-run";
  candidates: DryRunCandidate[];
}

export interface CommandTextResponse {
  ok: boolean;
  stdout: string;
  stderr: string;
}

export interface CleanHistoryEntry {
  run_id: string;
  started_at_epoch_secs: number;
  ended_at_epoch_secs: number | null;
  status: string;
  selected_categories: CleanCategory[];
  candidate_count: number;
  deleted_count: number;
  error_count: number;
  reclaimed_total_kb: number;
  reclaimed_total_human: string;
  log_file: string;
}

export interface ExportReportResponse {
  ok: boolean;
  report_path: string;
  exported_runs: number;
}

export type LargeFilesThreshold = "500M" | "1G" | "2G" | "5G";

export interface CleaningPreferences {
  defaultCategories: CleanCategory[];
  largeFilesThreshold: LargeFilesThreshold;
}
