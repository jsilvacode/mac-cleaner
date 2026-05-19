import { invoke } from "@tauri-apps/api/core";
import type {
  CleanCategory,
  CleanHistoryEntry,
  CommandTextResponse,
  DryRunResponse,
  ExportReportResponse,
  LargeFilesThreshold,
  ScanResponse,
} from "../types/cleaner";

export async function scanCleanable(): Promise<ScanResponse> {
  return invoke<ScanResponse>("scan_cleanable");
}

export async function dryRunCleaning(categories: CleanCategory[]): Promise<DryRunResponse> {
  return invoke<DryRunResponse>("dry_run_cleaning", { categories });
}

export async function runCleaning(categories: CleanCategory[]): Promise<CommandTextResponse> {
  return invoke<CommandTextResponse>("run_cleaning", { categories });
}

export async function findLargeFiles(threshold: LargeFilesThreshold): Promise<CommandTextResponse> {
  return invoke<CommandTextResponse>("find_large_files", { threshold });
}

export async function getTopDirs(): Promise<CommandTextResponse> {
  return invoke<CommandTextResponse>("get_top_dirs");
}

export async function getCleanHistory(limit = 20): Promise<CleanHistoryEntry[]> {
  return invoke<CleanHistoryEntry[]>("get_clean_history", { limit });
}

export async function exportCleanHistoryReport(limit = 20): Promise<ExportReportResponse> {
  return invoke<ExportReportResponse>("export_clean_history_report", { limit });
}
