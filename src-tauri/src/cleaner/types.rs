use super::*;

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResponse {
    pub version: String,
    pub mode: String,
    pub items: Vec<ScanItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanItem {
    pub id: String,
    pub label: String,
    pub path: String,
    pub age_days: u32,
    pub risk: String,
    pub estimated_kb: u64,
    pub estimated_human: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DryRunResponse {
    pub version: String,
    pub mode: String,
    pub candidates: Vec<DryRunCandidate>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DryRunCandidate {
    pub category: String,
    pub path: String,
    pub size_kb: u64,
    pub size_human: String,
    pub risk: String,
}

#[derive(Debug, Serialize)]
pub struct CommandTextResponse {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanHistoryEntry {
    pub run_id: String,
    pub started_at_epoch_secs: u64,
    pub ended_at_epoch_secs: Option<u64>,
    pub status: String,
    pub selected_categories: Vec<String>,
    pub candidate_count: u64,
    pub deleted_count: u64,
    pub error_count: u64,
    pub reclaimed_total_kb: u64,
    pub reclaimed_total_human: String,
    pub log_file: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportReportResponse {
    pub ok: bool,
    pub report_path: String,
    pub exported_runs: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PruneHistoryResponse {
    pub ok: bool,
    pub kept_runs: usize,
    pub removed_runs: usize,
    pub log_file: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledAppItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub scope: String,
    pub size_kb: u64,
    pub size_human: String,
    pub removable: bool,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledAppsResponse {
    pub version: String,
    pub mode: String,
    pub items: Vec<InstalledAppItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUninstallPlanItem {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub path: String,
    pub destination_hint: String,
    pub size_kb: u64,
    pub size_human: String,
    pub risk: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUninstallLeftoverItem {
    pub id: String,
    pub app_id: String,
    pub name: String,
    pub item_type: String,
    pub path: String,
    pub destination_hint: String,
    pub size_kb: u64,
    pub size_human: String,
    pub risk: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUninstallPlanResponse {
    pub version: String,
    pub mode: String,
    pub items: Vec<AppUninstallPlanItem>,
    pub leftovers: Vec<AppUninstallLeftoverItem>,
    pub skipped: Vec<InstalledAppItem>,
    pub total_kb: u64,
    pub total_human: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUninstallResultItem {
    pub id: String,
    pub name: String,
    pub item_type: String,
    pub source_path: String,
    pub destination_path: Option<String>,
    pub moved_to_trash: bool,
    pub moved_size_kb: u64,
    pub moved_size_human: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUninstallResponse {
    pub ok: bool,
    pub mode: String,
    pub moved_count: usize,
    pub skipped_count: usize,
    pub moved_total_kb: u64,
    pub moved_total_human: String,
    pub items: Vec<AppUninstallResultItem>,
}

pub(super) struct ScanCategory {
    pub(super) id: &'static str,
    pub(super) label: &'static str,
    pub(super) path: PathBuf,
    pub(super) age_days: u32,
    pub(super) risk: &'static str,
}

#[cfg(feature = "native-clean")]
#[derive(Debug)]
pub(super) struct CleanPlanItem {
    pub(super) category: String,
    pub(super) path: PathBuf,
    pub(super) size_kb: u64,
}

#[cfg(feature = "native-clean")]
#[derive(Debug, Serialize)]
pub(super) struct NativeCleanItemResult {
    pub(super) category: String,
    pub(super) path: String,
    pub(super) deleted: bool,
    pub(super) reclaimed_kb: u64,
    pub(super) error: Option<String>,
}

#[cfg(feature = "native-clean")]
#[derive(Debug, Serialize)]
pub(super) struct NativeCleanResponse {
    pub(super) ok: bool,
    pub(super) mode: String,
    pub(super) processed_categories: Vec<String>,
    pub(super) reclaimed_total_kb: u64,
    pub(super) reclaimed_total_human: String,
    pub(super) items: Vec<NativeCleanItemResult>,
    pub(super) log_file: String,
}

#[cfg(feature = "native-clean")]
#[derive(Debug, Serialize, Deserialize)]
pub(super) struct CleanLogEvent {
    pub(super) ts_epoch_secs: u64,
    pub(super) event: String,
    pub(super) category: Option<String>,
    pub(super) path: Option<String>,
    pub(super) status: String,
    pub(super) reclaimed_kb: u64,
    pub(super) error: Option<String>,
    pub(super) detail: Option<String>,
}

#[cfg(feature = "native-clean")]
#[derive(Debug)]
pub(super) struct CleanHistoryBuilder {
    pub(super) started_at_epoch_secs: u64,
    pub(super) ended_at_epoch_secs: Option<u64>,
    pub(super) status: String,
    pub(super) selected_categories: Vec<String>,
    pub(super) candidate_count: u64,
    pub(super) deleted_count: u64,
    pub(super) error_count: u64,
    pub(super) reclaimed_total_kb: u64,
}
