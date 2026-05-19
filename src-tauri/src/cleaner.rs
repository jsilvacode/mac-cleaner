use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::fs;
#[cfg(feature = "native-clean")]
use std::fs::OpenOptions;
#[cfg(feature = "native-clean")]
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, SystemTime};

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

const ALLOWED_CATEGORIES: [&str; 4] = ["user_cache", "user_logs", "trash", "tmp"];
#[cfg(feature = "native-clean")]
const DUAL_PARITY_FLAG: &str = "MAC_CLEANER_DUAL_PARITY";
#[cfg(feature = "native-clean")]
const FORCE_SHELL_FLAG: &str = "MAC_CLEANER_FORCE_SHELL";
#[cfg(feature = "native-clean")]
const CLEAN_LOG_SUBDIR: &str = "Library/Logs/mac_cleaner_tauri_agent";
#[cfg(feature = "native-clean")]
const CLEAN_LOG_FILE: &str = "run-native-clean.jsonl";
#[cfg(feature = "native-clean")]
const CLEAN_REPORTS_SUBDIR: &str = "Library/Logs/mac_cleaner_tauri_agent/reports";

struct ScanCategory {
    id: &'static str,
    label: &'static str,
    path: PathBuf,
    age_days: u32,
    risk: &'static str,
}

#[cfg(feature = "native-clean")]
#[derive(Debug)]
struct CleanPlanItem {
    category: String,
    path: PathBuf,
    size_kb: u64,
}

#[cfg(feature = "native-clean")]
#[derive(Debug, Serialize)]
struct NativeCleanItemResult {
    category: String,
    path: String,
    deleted: bool,
    reclaimed_kb: u64,
    error: Option<String>,
}

#[cfg(feature = "native-clean")]
#[derive(Debug, Serialize)]
struct NativeCleanResponse {
    ok: bool,
    mode: String,
    processed_categories: Vec<String>,
    reclaimed_total_kb: u64,
    reclaimed_total_human: String,
    items: Vec<NativeCleanItemResult>,
    log_file: String,
}

#[cfg(feature = "native-clean")]
#[derive(Debug, Serialize, Deserialize)]
struct CleanLogEvent {
    ts_epoch_secs: u64,
    event: String,
    category: Option<String>,
    path: Option<String>,
    status: String,
    reclaimed_kb: u64,
    error: Option<String>,
    detail: Option<String>,
}

#[cfg(feature = "native-clean")]
#[derive(Debug)]
struct CleanHistoryBuilder {
    started_at_epoch_secs: u64,
    ended_at_epoch_secs: Option<u64>,
    status: String,
    selected_categories: Vec<String>,
    candidate_count: u64,
    deleted_count: u64,
    error_count: u64,
    reclaimed_total_kb: u64,
}

fn script_path() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir
        .parent()
        .ok_or_else(|| "No se pudo resolver la raíz del proyecto".to_string())?;
    let path = repo_root.join("scripts").join("mac_cleaner_v2.sh");

    if !path.exists() {
        return Err(format!("No se encontró el script: {}", path.display()));
    }

    Ok(path)
}

fn run_script_dynamic(args: &[String]) -> Result<CommandTextResponse, String> {
    let path = script_path()?;
    let output = Command::new(path)
        .args(args)
        .output()
        .map_err(|err| format!("No se pudo ejecutar el motor local: {err}"))?;

    Ok(CommandTextResponse {
        ok: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn resolve_home() -> Result<PathBuf, String> {
    let raw = env::var("HOME").map_err(|_| "No se pudo resolver HOME del usuario".to_string())?;
    let path = PathBuf::from(raw);
    if path.as_os_str().is_empty() {
        return Err("HOME del usuario está vacío".to_string());
    }
    Ok(path)
}

#[cfg(feature = "native-clean")]
fn bool_env_enabled(key: &str) -> bool {
    match env::var(key) {
        Ok(raw) => matches!(
            raw.to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => false,
    }
}

#[cfg(feature = "native-clean")]
fn unix_timestamp_secs() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(feature = "native-clean")]
fn clean_log_file_path() -> Result<PathBuf, String> {
    let home = resolve_home()?;
    Ok(home.join(CLEAN_LOG_SUBDIR).join(CLEAN_LOG_FILE))
}

#[cfg(feature = "native-clean")]
fn append_clean_log(path: &PathBuf, event: &CleanLogEvent) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("No se pudo crear directorio de logs: {err}"))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|err| format!("No se pudo abrir log nativo: {err}"))?;

    let line = serde_json::to_string(event)
        .map_err(|err| format!("No se pudo serializar evento de log: {err}"))?;
    file.write_all(line.as_bytes())
        .map_err(|err| format!("No se pudo escribir evento de log: {err}"))?;
    file.write_all(b"\n")
        .map_err(|err| format!("No se pudo finalizar línea de log: {err}"))?;
    Ok(())
}

#[cfg(feature = "native-clean")]
fn clean_reports_dir_path() -> Result<PathBuf, String> {
    let home = resolve_home()?;
    Ok(home.join(CLEAN_REPORTS_SUBDIR))
}

#[cfg(feature = "native-clean")]
fn parse_selected_categories(detail: Option<&str>) -> Vec<String> {
    let Some(raw) = detail else {
        return Vec::new();
    };
    let Some(csv) = raw.strip_prefix("selected_categories=") else {
        return Vec::new();
    };

    csv.split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty() && ALLOWED_CATEGORIES.contains(item))
        .map(ToString::to_string)
        .collect()
}

#[cfg(feature = "native-clean")]
fn finalize_history_run(
    runs: &mut Vec<CleanHistoryEntry>,
    builder: CleanHistoryBuilder,
    log_path: &PathBuf,
) {
    let run_id = format!("native-{}-{}", builder.started_at_epoch_secs, runs.len() + 1);
    runs.push(CleanHistoryEntry {
        run_id,
        started_at_epoch_secs: builder.started_at_epoch_secs,
        ended_at_epoch_secs: builder.ended_at_epoch_secs,
        status: builder.status,
        selected_categories: builder.selected_categories,
        candidate_count: builder.candidate_count,
        deleted_count: builder.deleted_count,
        error_count: builder.error_count,
        reclaimed_total_kb: builder.reclaimed_total_kb,
        reclaimed_total_human: human_size_kb(builder.reclaimed_total_kb),
        log_file: log_path.display().to_string(),
    });
}

#[cfg(feature = "native-clean")]
fn collect_clean_history(limit: usize) -> Result<Vec<CleanHistoryEntry>, String> {
    let log_path = clean_log_file_path()?;
    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&log_path).map_err(|err| {
        format!(
            "No se pudo leer historial de limpieza en {}: {err}",
            log_path.display()
        )
    })?;

    let mut runs: Vec<CleanHistoryEntry> = Vec::new();
    let mut current: Option<CleanHistoryBuilder> = None;

    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        let Ok(event) = serde_json::from_str::<CleanLogEvent>(line) else {
            continue;
        };

        match event.event.as_str() {
            "start" => {
                if let Some(builder) = current.take() {
                    finalize_history_run(&mut runs, builder, &log_path);
                }
                current = Some(CleanHistoryBuilder {
                    started_at_epoch_secs: event.ts_epoch_secs,
                    ended_at_epoch_secs: None,
                    status: "running".to_string(),
                    selected_categories: parse_selected_categories(event.detail.as_deref()),
                    candidate_count: 0,
                    deleted_count: 0,
                    error_count: 0,
                    reclaimed_total_kb: 0,
                });
            }
            "candidate" => {
                if let Some(builder) = current.as_mut() {
                    builder.candidate_count += 1;
                }
            }
            "delete_ok" => {
                if let Some(builder) = current.as_mut() {
                    builder.deleted_count += 1;
                    builder.reclaimed_total_kb += event.reclaimed_kb;
                }
            }
            "delete_error" => {
                if let Some(builder) = current.as_mut() {
                    builder.error_count += 1;
                }
            }
            "end" => {
                if let Some(mut builder) = current.take() {
                    builder.ended_at_epoch_secs = Some(event.ts_epoch_secs);
                    builder.status = event.status;
                    if event.reclaimed_kb > 0 {
                        builder.reclaimed_total_kb = event.reclaimed_kb;
                    }
                    finalize_history_run(&mut runs, builder, &log_path);
                }
            }
            _ => {}
        }
    }

    if let Some(mut builder) = current {
        builder.status = "incomplete".to_string();
        finalize_history_run(&mut runs, builder, &log_path);
    }

    runs.sort_by(|a, b| b.started_at_epoch_secs.cmp(&a.started_at_epoch_secs));
    if runs.len() > limit {
        runs.truncate(limit);
    }

    Ok(runs)
}

#[cfg(feature = "native-clean")]
fn build_history_markdown_report(entries: &[CleanHistoryEntry]) -> String {
    let mut report = String::new();
    report.push_str("# Mac Cleaner Native History Report\n\n");
    report.push_str(&format!("Generated at epoch: `{}`\n\n", unix_timestamp_secs()));

    if entries.is_empty() {
        report.push_str("No hay ejecuciones nativas registradas.\n");
        return report;
    }

    for entry in entries {
        let selected = if entry.selected_categories.is_empty() {
            "none".to_string()
        } else {
            entry.selected_categories.join(", ")
        };
        report.push_str(&format!("## {}\n\n", entry.run_id));
        report.push_str(&format!("- Status: `{}`\n", entry.status));
        report.push_str(&format!(
            "- Started (epoch): `{}`\n",
            entry.started_at_epoch_secs
        ));
        report.push_str(&format!(
            "- Ended (epoch): `{}`\n",
            entry.ended_at_epoch_secs
                .map(|v| v.to_string())
                .unwrap_or_else(|| "n/a".to_string())
        ));
        report.push_str(&format!("- Categories: `{selected}`\n"));
        report.push_str(&format!("- Candidates: `{}`\n", entry.candidate_count));
        report.push_str(&format!("- Deleted: `{}`\n", entry.deleted_count));
        report.push_str(&format!("- Errors/Skipped: `{}`\n", entry.error_count));
        report.push_str(&format!(
            "- Reclaimed: `{}` (`{} KB`)\n",
            entry.reclaimed_total_human, entry.reclaimed_total_kb
        ));
        report.push_str(&format!("- Log file: `{}`\n\n", entry.log_file));
    }

    report
}

fn build_scan_categories() -> Result<Vec<ScanCategory>, String> {
    let home = resolve_home()?;
    Ok(vec![
        ScanCategory {
            id: "user_cache",
            label: "Caché de usuario",
            path: home.join("Library").join("Caches"),
            age_days: 7,
            risk: "medio",
        },
        ScanCategory {
            id: "user_logs",
            label: "Logs de usuario",
            path: home.join("Library").join("Logs"),
            age_days: 14,
            risk: "bajo",
        },
        ScanCategory {
            id: "trash",
            label: "Papelera de usuario",
            path: home.join(".Trash"),
            age_days: 7,
            risk: "medio",
        },
        ScanCategory {
            id: "tmp",
            label: "Temporales /tmp",
            path: PathBuf::from("/tmp"),
            age_days: 1,
            risk: "medio",
        },
    ])
}

fn is_older_than(meta: &fs::Metadata, age_days: u32) -> bool {
    let Ok(modified_at) = meta.modified() else {
        return false;
    };
    let Ok(elapsed) = SystemTime::now().duration_since(modified_at) else {
        return false;
    };
    let min_age = Duration::from_secs(u64::from(age_days) * 24 * 60 * 60);
    elapsed >= min_age
}

fn size_kb(path: &PathBuf) -> u64 {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return 0;
    };

    if meta.file_type().is_symlink() {
        return 0;
    }

    if meta.is_file() {
        return meta.len().div_ceil(1024);
    }

    if !meta.is_dir() {
        return 0;
    }

    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    let mut total = 0_u64;
    for entry in entries.flatten() {
        total += size_kb(&entry.path());
    }
    total
}

fn estimate_cleanable_kb(path: &PathBuf, age_days: u32) -> u64 {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return 0;
    };

    if meta.file_type().is_symlink() || !meta.is_dir() {
        return 0;
    }

    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    let mut total = 0_u64;
    for entry in entries.flatten() {
        let target = entry.path();
        let Ok(target_meta) = fs::symlink_metadata(&target) else {
            continue;
        };
        if target_meta.file_type().is_symlink() || !is_older_than(&target_meta, age_days) {
            continue;
        }
        total += size_kb(&target);
    }

    total
}

fn human_size_kb(kb: u64) -> String {
    if kb >= 1_073_741_824 {
        format!("{:.2} TB", kb as f64 / 1_073_741_824_f64)
    } else if kb >= 1_048_576 {
        format!("{:.2} GB", kb as f64 / 1_048_576_f64)
    } else if kb >= 1024 {
        format!("{:.2} MB", kb as f64 / 1024_f64)
    } else {
        format!("{kb} KB")
    }
}

fn parse_threshold_to_bytes(threshold: &str) -> Option<u64> {
    let (raw_value, suffix) = threshold.split_at(threshold.len().saturating_sub(1));
    let value = raw_value.parse::<u64>().ok()?;
    match suffix {
        "M" => Some(value * 1024 * 1024),
        "G" => Some(value * 1024 * 1024 * 1024),
        _ => None,
    }
}

fn collect_large_files(path: &PathBuf, min_bytes: u64, out: &mut Vec<(PathBuf, u64)>) {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return;
    };

    if meta.file_type().is_symlink() {
        return;
    }

    if meta.is_file() {
        let size_bytes = meta.len();
        if size_bytes > min_bytes {
            out.push((path.clone(), size_bytes));
        }
        return;
    }

    if !meta.is_dir() {
        return;
    }

    let Ok(entries) = fs::read_dir(path) else {
        return;
    };

    for entry in entries.flatten() {
        collect_large_files(&entry.path(), min_bytes, out);
    }
}

fn format_large_files_output(home: &PathBuf, threshold: &str, files: &[(PathBuf, u64)]) -> String {
    let mut output = String::new();
    output.push_str("Archivos grandes en HOME\n");
    output.push_str(&format!(
        "Buscando archivos mayores a {threshold}. No se eliminará nada.\n"
    ));
    output.push_str(&format!("HOME: {}\n\n", home.display()));

    if files.is_empty() {
        output.push_str("No se encontraron archivos sobre el umbral.\n");
        return output;
    }

    for (path, size_bytes) in files {
        let size_kb = size_bytes.div_ceil(1024);
        output.push_str(&format!(
            "{:>10}  {}\n",
            human_size_kb(size_kb),
            path.display()
        ));
    }

    output
}

fn format_top_dirs_output(home: &PathBuf, dirs: &[(PathBuf, u64)]) -> String {
    let mut output = String::new();
    output.push_str("Top carpetas más pesadas en HOME\n");
    output.push_str(&format!("HOME: {}\n\n", home.display()));

    if dirs.is_empty() {
        output.push_str("No se encontraron carpetas evaluables.\n");
        return output;
    }

    for (path, kb) in dirs {
        output.push_str(&format!("{:>10}  {}\n", human_size_kb(*kb), path.display()));
    }

    output
}

fn validate_and_normalize_categories(
    categories: Vec<String>,
    empty_error: &str,
) -> Result<Vec<String>, String> {
    if categories.is_empty() {
        return Err(empty_error.to_string());
    }

    if categories.len() > ALLOWED_CATEGORIES.len() {
        return Err("Se recibieron demasiadas categorías.".to_string());
    }

    let mut selected: Vec<String> = Vec::with_capacity(categories.len());
    for category in categories {
        if !ALLOWED_CATEGORIES.contains(&category.as_str()) {
            return Err(format!("Categoría no permitida: {category}"));
        }
        if !selected.iter().any(|item| item == &category) {
            selected.push(category);
        }
    }

    Ok(selected)
}

#[cfg(feature = "native-clean")]
fn category_by_id<'a>(categories: &'a [ScanCategory], id: &str) -> Option<&'a ScanCategory> {
    categories.iter().find(|item| item.id == id)
}

fn collect_category_candidates(category: &ScanCategory) -> Vec<(PathBuf, u64)> {
    let Ok(meta) = fs::symlink_metadata(&category.path) else {
        return Vec::new();
    };

    if meta.file_type().is_symlink() || !meta.is_dir() {
        return Vec::new();
    }

    let Ok(entries) = fs::read_dir(&category.path) else {
        return Vec::new();
    };

    let mut candidates = Vec::new();
    for entry in entries.flatten() {
        let target = entry.path();
        let Ok(target_meta) = fs::symlink_metadata(&target) else {
            continue;
        };
        if target_meta.file_type().is_symlink() || !is_older_than(&target_meta, category.age_days) {
            continue;
        }

        let item_size_kb = size_kb(&target);
        candidates.push((target, item_size_kb));
    }

    candidates.sort_by(|a, b| a.0.cmp(&b.0));
    candidates
}

fn build_dry_run_candidates(selected: &[String]) -> Result<Vec<DryRunCandidate>, String> {
    let selected_set: HashSet<&str> = selected.iter().map(String::as_str).collect();
    let categories = build_scan_categories()?;
    let mut candidates = Vec::new();

    for category in categories {
        if !selected_set.contains(category.id) {
            continue;
        }

        for (path, size_kb) in collect_category_candidates(&category) {
            candidates.push(DryRunCandidate {
                category: category.id.to_string(),
                path: path.display().to_string(),
                size_kb,
                size_human: human_size_kb(size_kb),
                risk: category.risk.to_string(),
            });
        }
    }

    candidates.sort_by(|a, b| {
        a.category
            .cmp(&b.category)
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(candidates)
}

#[cfg(feature = "native-clean")]
fn build_clean_plan(selected: &[String]) -> Result<Vec<CleanPlanItem>, String> {
    let selected_set: HashSet<&str> = selected.iter().map(String::as_str).collect();
    let categories = build_scan_categories()?;
    let mut plan = Vec::new();

    for category in categories {
        if !selected_set.contains(category.id) {
            continue;
        }
        for (path, size_kb) in collect_category_candidates(&category) {
            plan.push(CleanPlanItem {
                category: category.id.to_string(),
                path,
                size_kb,
            });
        }
    }

    plan.sort_by(|a, b| {
        a.category
            .cmp(&b.category)
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(plan)
}

#[cfg(feature = "native-clean")]
fn run_cleaning_parity_mode(selected: &[String]) -> Result<CommandTextResponse, String> {
    let selected_csv = selected.join(",");
    let native_candidates = build_dry_run_candidates(selected)?;

    let args = vec![
        "dry-run".to_string(),
        "--json".to_string(),
        "--categories".to_string(),
        selected_csv,
    ];
    let shell_response = run_script_dynamic(&args)?;
    if !shell_response.ok {
        return Err(format!(
            "Dual parity: el dry-run shell falló: {}",
            shell_response.stderr
        ));
    }

    let shell_dry_run = serde_json::from_str::<DryRunResponse>(&shell_response.stdout)
        .map_err(|err| format!("Dual parity: no se pudo interpretar dry-run shell: {err}"))?;

    let native_set: HashSet<String> = native_candidates
        .iter()
        .map(|item| format!("{}::{}", item.category, item.path))
        .collect();
    let shell_set: HashSet<String> = shell_dry_run
        .candidates
        .iter()
        .map(|item| format!("{}::{}", item.category, item.path))
        .collect();

    let missing_in_shell = native_set.difference(&shell_set).count();
    let missing_in_native = shell_set.difference(&native_set).count();
    let perfect_match = missing_in_shell == 0 && missing_in_native == 0;

    let mut report = String::new();
    report.push_str("Dual parity mode (simulation only): no files were deleted.\n");
    report.push_str(&format!("Selected categories: {}\n", selected.join(",")));
    report.push_str(&format!("Native candidates: {}\n", native_set.len()));
    report.push_str(&format!("Shell candidates: {}\n", shell_set.len()));
    report.push_str(&format!("Missing in shell: {missing_in_shell}\n"));
    report.push_str(&format!("Missing in native: {missing_in_native}\n"));
    report.push_str(&format!(
        "Parity result: {}\n",
        if perfect_match { "OK" } else { "MISMATCH" }
    ));

    Ok(CommandTextResponse {
        ok: perfect_match,
        stdout: report,
        stderr: if perfect_match {
            String::new()
        } else {
            "Dual parity detectó diferencias entre shell y Rust.".to_string()
        },
    })
}

#[cfg(feature = "native-clean")]
fn run_cleaning_native(selected: &[String]) -> Result<CommandTextResponse, String> {
    let categories = build_scan_categories()?;
    let plan = build_clean_plan(selected)?;
    let log_path = clean_log_file_path()?;

    let _ = append_clean_log(
        &log_path,
        &CleanLogEvent {
            ts_epoch_secs: unix_timestamp_secs(),
            event: "start".to_string(),
            category: None,
            path: None,
            status: "ok".to_string(),
            reclaimed_kb: 0,
            error: None,
            detail: Some(format!("selected_categories={}", selected.join(","))),
        },
    );

    let mut reclaimed_total_kb = 0_u64;
    let mut items = Vec::new();

    for item in plan {
        let category = match category_by_id(&categories, &item.category) {
            Some(category) => category,
            None => {
                items.push(NativeCleanItemResult {
                    category: item.category.clone(),
                    path: item.path.display().to_string(),
                    deleted: false,
                    reclaimed_kb: 0,
                    error: Some("Categoría no encontrada en configuración".to_string()),
                });
                continue;
            }
        };

        let path_display = item.path.display().to_string();
        let _ = append_clean_log(
            &log_path,
            &CleanLogEvent {
                ts_epoch_secs: unix_timestamp_secs(),
                event: "candidate".to_string(),
                category: Some(item.category.clone()),
                path: Some(path_display.clone()),
                status: "ok".to_string(),
                reclaimed_kb: 0,
                error: None,
                detail: None,
            },
        );

        let meta = match fs::symlink_metadata(&item.path) {
            Ok(meta) => meta,
            Err(err) => {
                let message = format!("No se pudo leer candidato: {err}");
                let _ = append_clean_log(
                    &log_path,
                    &CleanLogEvent {
                        ts_epoch_secs: unix_timestamp_secs(),
                        event: "delete_error".to_string(),
                        category: Some(item.category.clone()),
                        path: Some(path_display.clone()),
                        status: "error".to_string(),
                        reclaimed_kb: 0,
                        error: Some(message.clone()),
                        detail: None,
                    },
                );
                items.push(NativeCleanItemResult {
                    category: item.category.clone(),
                    path: path_display,
                    deleted: false,
                    reclaimed_kb: 0,
                    error: Some(message),
                });
                continue;
            }
        };

        if meta.file_type().is_symlink() {
            let message = "Candidato omitido por ser symlink".to_string();
            let _ = append_clean_log(
                &log_path,
                &CleanLogEvent {
                    ts_epoch_secs: unix_timestamp_secs(),
                    event: "delete_error".to_string(),
                    category: Some(item.category.clone()),
                    path: Some(path_display.clone()),
                    status: "skipped".to_string(),
                    reclaimed_kb: 0,
                    error: Some(message.clone()),
                    detail: None,
                },
            );
            items.push(NativeCleanItemResult {
                category: item.category.clone(),
                path: path_display,
                deleted: false,
                reclaimed_kb: 0,
                error: Some(message),
            });
            continue;
        }

        if !is_older_than(&meta, category.age_days) {
            let message = "Candidato omitido por antigüedad reciente".to_string();
            let _ = append_clean_log(
                &log_path,
                &CleanLogEvent {
                    ts_epoch_secs: unix_timestamp_secs(),
                    event: "delete_error".to_string(),
                    category: Some(item.category.clone()),
                    path: Some(path_display.clone()),
                    status: "skipped".to_string(),
                    reclaimed_kb: 0,
                    error: Some(message.clone()),
                    detail: None,
                },
            );
            items.push(NativeCleanItemResult {
                category: item.category.clone(),
                path: path_display,
                deleted: false,
                reclaimed_kb: 0,
                error: Some(message),
            });
            continue;
        }

        let delete_result = if meta.is_file() {
            fs::remove_file(&item.path)
        } else if meta.is_dir() {
            fs::remove_dir_all(&item.path)
        } else {
            Err(std::io::Error::other("Tipo de candidato no soportado"))
        };

        match delete_result {
            Ok(_) => {
                reclaimed_total_kb += item.size_kb;
                let _ = append_clean_log(
                    &log_path,
                    &CleanLogEvent {
                        ts_epoch_secs: unix_timestamp_secs(),
                        event: "delete_ok".to_string(),
                        category: Some(item.category.clone()),
                        path: Some(path_display.clone()),
                        status: "ok".to_string(),
                        reclaimed_kb: item.size_kb,
                        error: None,
                        detail: None,
                    },
                );
                items.push(NativeCleanItemResult {
                    category: item.category,
                    path: path_display,
                    deleted: true,
                    reclaimed_kb: item.size_kb,
                    error: None,
                });
            }
            Err(err) => {
                let message = format!("No se pudo eliminar candidato: {err}");
                let _ = append_clean_log(
                    &log_path,
                    &CleanLogEvent {
                        ts_epoch_secs: unix_timestamp_secs(),
                        event: "delete_error".to_string(),
                        category: Some(item.category.clone()),
                        path: Some(path_display.clone()),
                        status: "error".to_string(),
                        reclaimed_kb: 0,
                        error: Some(message.clone()),
                        detail: None,
                    },
                );
                items.push(NativeCleanItemResult {
                    category: item.category,
                    path: path_display,
                    deleted: false,
                    reclaimed_kb: 0,
                    error: Some(message),
                });
            }
        }
    }

    let _ = append_clean_log(
        &log_path,
        &CleanLogEvent {
            ts_epoch_secs: unix_timestamp_secs(),
            event: "end".to_string(),
            category: None,
            path: None,
            status: "ok".to_string(),
            reclaimed_kb: reclaimed_total_kb,
            error: None,
            detail: Some("native_clean_completed".to_string()),
        },
    );

    let response = NativeCleanResponse {
        ok: true,
        mode: "clean".to_string(),
        processed_categories: selected.to_vec(),
        reclaimed_total_kb,
        reclaimed_total_human: human_size_kb(reclaimed_total_kb),
        items,
        log_file: log_path.display().to_string(),
    };

    let stdout = serde_json::to_string_pretty(&response)
        .map_err(|err| format!("No se pudo serializar respuesta de limpieza nativa: {err}"))?;

    Ok(CommandTextResponse {
        ok: true,
        stdout,
        stderr: String::new(),
    })
}

#[tauri::command]
pub fn scan_cleanable() -> Result<ScanResponse, String> {
    let categories = build_scan_categories()?;
    let mut items = Vec::with_capacity(categories.len());

    for category in categories {
        let estimated_kb = estimate_cleanable_kb(&category.path, category.age_days);
        items.push(ScanItem {
            id: category.id.to_string(),
            label: category.label.to_string(),
            path: category.path.display().to_string(),
            age_days: category.age_days,
            risk: category.risk.to_string(),
            estimated_kb,
            estimated_human: human_size_kb(estimated_kb),
        });
    }

    Ok(ScanResponse {
        version: "2.1.0-rust-scan".to_string(),
        mode: "scan".to_string(),
        items,
    })
}

#[tauri::command]
pub fn dry_run_cleaning(categories: Vec<String>) -> Result<DryRunResponse, String> {
    let selected = validate_and_normalize_categories(
        categories,
        "Selecciona al menos una categoría para ejecutar dry-run.",
    )?;
    let candidates = build_dry_run_candidates(&selected)?;

    Ok(DryRunResponse {
        version: "2.1.0-rust-dry-run".to_string(),
        mode: "dry-run".to_string(),
        candidates,
    })
}

#[tauri::command]
pub fn run_cleaning(categories: Vec<String>) -> Result<CommandTextResponse, String> {
    let selected = validate_and_normalize_categories(
        categories,
        "Selecciona al menos una categoría para limpiar.",
    )?;

    #[cfg(feature = "native-clean")]
    {
        if bool_env_enabled(DUAL_PARITY_FLAG) {
            return run_cleaning_parity_mode(&selected);
        }
        if !bool_env_enabled(FORCE_SHELL_FLAG) {
            return run_cleaning_native(&selected);
        }
    }

    let categories_csv = selected.join(",");
    let args = vec![
        "clean".to_string(),
        "--yes".to_string(),
        "--categories".to_string(),
        categories_csv,
    ];

    run_script_dynamic(&args)
}

#[tauri::command]
pub fn find_large_files(threshold: String) -> Result<CommandTextResponse, String> {
    let allowed = ["500M", "1G", "2G", "5G"];
    if !allowed.contains(&threshold.as_str()) {
        return Err("Threshold no permitido. Usa 500M, 1G, 2G o 5G.".to_string());
    }

    let min_bytes = parse_threshold_to_bytes(&threshold)
        .ok_or_else(|| "No se pudo interpretar el threshold solicitado.".to_string())?;
    let home = resolve_home()?;
    let mut files = Vec::new();
    collect_large_files(&home, min_bytes, &mut files);
    files.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

    Ok(CommandTextResponse {
        ok: true,
        stdout: format_large_files_output(&home, &threshold, &files),
        stderr: String::new(),
    })
}

#[tauri::command]
pub fn get_top_dirs() -> Result<CommandTextResponse, String> {
    let home = resolve_home()?;
    let mut rows = Vec::new();

    let entries =
        fs::read_dir(&home).map_err(|err| format!("No se pudo leer HOME para top dirs: {err}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = fs::symlink_metadata(&path) else {
            continue;
        };
        if meta.file_type().is_symlink() {
            continue;
        }
        let kb = size_kb(&path);
        rows.push((path, kb));
    }

    rows.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    rows.truncate(10);

    Ok(CommandTextResponse {
        ok: true,
        stdout: format_top_dirs_output(&home, &rows),
        stderr: String::new(),
    })
}

#[tauri::command]
pub fn get_clean_history(limit: Option<u32>) -> Result<Vec<CleanHistoryEntry>, String> {
    #[cfg(feature = "native-clean")]
    {
        let max_limit = 200_u32;
        let requested = limit.unwrap_or(20).clamp(1, max_limit);
        return collect_clean_history(requested as usize);
    }

    #[cfg(not(feature = "native-clean"))]
    {
        let _ = limit;
        Err("Historial nativo no disponible: feature native-clean desactivado.".to_string())
    }
}

#[tauri::command]
pub fn export_clean_history_report(limit: Option<u32>) -> Result<ExportReportResponse, String> {
    #[cfg(feature = "native-clean")]
    {
        let max_limit = 200_u32;
        let requested = limit.unwrap_or(20).clamp(1, max_limit);
        let history = collect_clean_history(requested as usize)?;
        let report_text = build_history_markdown_report(&history);
        let reports_dir = clean_reports_dir_path()?;
        fs::create_dir_all(&reports_dir)
            .map_err(|err| format!("No se pudo crear directorio de reportes: {err}"))?;

        let report_path = reports_dir.join(format!("history-report-{}.md", unix_timestamp_secs()));
        fs::write(&report_path, report_text)
            .map_err(|err| format!("No se pudo escribir reporte de historial: {err}"))?;

        return Ok(ExportReportResponse {
            ok: true,
            report_path: report_path.display().to_string(),
            exported_runs: history.len(),
        });
    }

    #[cfg(not(feature = "native-clean"))]
    {
        let _ = limit;
        Err("Exportación no disponible: feature native-clean desactivado.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        dry_run_cleaning, parse_threshold_to_bytes, scan_cleanable,
        validate_and_normalize_categories,
    };

    #[test]
    fn scan_cleanable_returns_expected_categories() {
        let result = scan_cleanable().expect("scan_cleanable should return a response");
        assert_eq!(result.mode, "scan");
        assert_eq!(result.items.len(), 4);
        let ids: Vec<&str> = result.items.iter().map(|item| item.id.as_str()).collect();
        assert!(ids.contains(&"user_cache"));
        assert!(ids.contains(&"user_logs"));
        assert!(ids.contains(&"trash"));
        assert!(ids.contains(&"tmp"));
    }

    #[test]
    fn dry_run_requires_categories() {
        let err = dry_run_cleaning(Vec::new())
            .expect_err("dry_run_cleaning should fail on empty categories");
        assert!(err.contains("Selecciona al menos una categoría"));
    }

    #[test]
    fn category_validation_rejects_invalid_ids() {
        let err = validate_and_normalize_categories(vec!["xcode_cache".to_string()], "empty")
            .expect_err("validation should reject unknown category");
        assert!(err.contains("Categoría no permitida"));
    }

    #[test]
    fn dry_run_scopes_candidates_to_selection() {
        let result =
            dry_run_cleaning(vec!["tmp".to_string()]).expect("dry_run should work for tmp");
        assert_eq!(result.mode, "dry-run");
        for candidate in result.candidates {
            assert_eq!(candidate.category, "tmp");
        }
    }

    #[test]
    fn threshold_parser_supports_allowed_values() {
        assert_eq!(parse_threshold_to_bytes("500M"), Some(500 * 1024 * 1024));
        assert_eq!(parse_threshold_to_bytes("1G"), Some(1024 * 1024 * 1024));
        assert_eq!(parse_threshold_to_bytes("2G"), Some(2 * 1024 * 1024 * 1024));
        assert_eq!(parse_threshold_to_bytes("5G"), Some(5 * 1024 * 1024 * 1024));
        assert_eq!(parse_threshold_to_bytes("100K"), None);
        assert_eq!(parse_threshold_to_bytes("abc"), None);
    }

    #[test]
    fn category_validation_deduplicates_ids() {
        let result = validate_and_normalize_categories(
            vec![
                "tmp".to_string(),
                "user_logs".to_string(),
                "tmp".to_string(),
            ],
            "empty",
        )
        .expect("validation should succeed");
        assert_eq!(result, vec!["tmp".to_string(), "user_logs".to_string()]);
    }
}
