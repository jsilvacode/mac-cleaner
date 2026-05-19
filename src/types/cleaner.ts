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
