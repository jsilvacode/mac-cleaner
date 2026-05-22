import { invoke } from "@tauri-apps/api/core";
import type {
  CleanCategory,
  CleanHistoryEntry,
  CommandTextResponse,
  DryRunResponse,
  ExportReportResponse,
  AppUninstallPlanResponse,
  AppUninstallResponse,
  InstalledAppsResponse,
  LargeFilesThreshold,
  PruneHistoryResponse,
  ScanResponse,
} from "../types/cleaner";

async function invokeCleaner<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("invoke") || message.includes("__TAURI") || message.includes("Tauri")) {
      throw new Error("Esta acción necesita abrir Mac Cleaner en modo desktop para acceder de forma segura a tu Mac.");
    }
    throw err;
  }
}

export async function scanCleanable(): Promise<ScanResponse> {
  return invokeCleaner<ScanResponse>("scan_cleanable");
}

export async function dryRunCleaning(categories: CleanCategory[]): Promise<DryRunResponse> {
  return invokeCleaner<DryRunResponse>("dry_run_cleaning", { categories });
}

export async function runCleaning(categories: CleanCategory[]): Promise<CommandTextResponse> {
  return invokeCleaner<CommandTextResponse>("run_cleaning", { categories });
}

export async function findLargeFiles(threshold: LargeFilesThreshold): Promise<CommandTextResponse> {
  return invokeCleaner<CommandTextResponse>("find_large_files", { threshold });
}

export async function getTopDirs(): Promise<CommandTextResponse> {
  return invokeCleaner<CommandTextResponse>("get_top_dirs");
}

export async function getCleanHistory(limit = 20): Promise<CleanHistoryEntry[]> {
  return invokeCleaner<CleanHistoryEntry[]>("get_clean_history", { limit });
}

export async function exportCleanHistoryReport(limit = 20): Promise<ExportReportResponse> {
  return invokeCleaner<ExportReportResponse>("export_clean_history_report", { limit });
}

export async function applyCleanHistoryRetention(retentionDays: number): Promise<PruneHistoryResponse> {
  return invokeCleaner<PruneHistoryResponse>("apply_clean_history_retention", { retentionDays });
}

export async function scanInstalledApps(): Promise<InstalledAppsResponse> {
  return invokeCleaner<InstalledAppsResponse>("scan_installed_apps");
}

export async function prepareAppUninstall(appIds: string[]): Promise<AppUninstallPlanResponse> {
  return invokeCleaner<AppUninstallPlanResponse>("prepare_app_uninstall", { appIds });
}

export async function uninstallAppsToTrash(appIds: string[]): Promise<AppUninstallResponse> {
  return invokeCleaner<AppUninstallResponse>("uninstall_apps_to_trash", { appIds });
}
