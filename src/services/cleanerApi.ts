import { invoke } from "@tauri-apps/api/core";
import type { CommandTextResponse, DryRunResponse, ScanResponse } from "../types/cleaner";

export async function scanCleanable(): Promise<ScanResponse> {
  return invoke<ScanResponse>("scan_cleanable");
}

export async function dryRunCleaning(): Promise<DryRunResponse> {
  return invoke<DryRunResponse>("dry_run_cleaning");
}

export async function runCleaning(): Promise<CommandTextResponse> {
  return invoke<CommandTextResponse>("run_cleaning");
}

export async function findLargeFiles(threshold: "500M" | "1G" | "2G" | "5G"): Promise<CommandTextResponse> {
  return invoke<CommandTextResponse>("find_large_files", { threshold });
}

export async function getTopDirs(): Promise<CommandTextResponse> {
  return invoke<CommandTextResponse>("get_top_dirs");
}
