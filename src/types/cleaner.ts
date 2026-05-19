export type RiskLevel = "bajo" | "medio" | "alto";

export interface ScanItem {
  id: string;
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
  category: string;
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
