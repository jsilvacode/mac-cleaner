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

export interface PruneHistoryResponse {
  ok: boolean;
  kept_runs: number;
  removed_runs: number;
  log_file: string;
}

export interface InstalledAppItem {
  id: string;
  name: string;
  path: string;
  scope: "system" | "user" | string;
  size_kb: number;
  size_human: string;
  removable: boolean;
  reason: string;
}

export interface InstalledAppsResponse {
  version: string;
  mode: "scan";
  items: InstalledAppItem[];
}

export interface AppUninstallPlanItem {
  id: string;
  name: string;
  item_type: "app" | string;
  path: string;
  destination_hint: string;
  size_kb: number;
  size_human: string;
  risk: string;
}

export interface AppUninstallLeftoverItem {
  id: string;
  app_id: string;
  name: string;
  item_type: "leftover" | string;
  path: string;
  destination_hint: string;
  size_kb: number;
  size_human: string;
  risk: string;
}

export interface AppUninstallPlanResponse {
  version: string;
  mode: "review";
  items: AppUninstallPlanItem[];
  leftovers: AppUninstallLeftoverItem[];
  skipped: InstalledAppItem[];
  total_kb: number;
  total_human: string;
}

export interface AppUninstallResultItem {
  id: string;
  name: string;
  item_type: "app" | "leftover" | string;
  source_path: string;
  destination_path: string | null;
  moved_to_trash: boolean;
  moved_size_kb: number;
  moved_size_human: string;
  error: string | null;
}

export interface AppUninstallResponse {
  ok: boolean;
  mode: "move-to-trash";
  moved_count: number;
  skipped_count: number;
  moved_total_kb: number;
  moved_total_human: string;
  items: AppUninstallResultItem[];
}

export type LargeFilesThreshold = "500M" | "1G" | "2G" | "5G";

export interface CleaningPreferences {
  defaultCategories: CleanCategory[];
  largeFilesThreshold: LargeFilesThreshold;
  historyRetentionDays: number;
  historyExportLimit: number;
}
