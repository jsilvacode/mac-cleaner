use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::fs;
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

const ALLOWED_CATEGORIES: [&str; 4] = ["user_cache", "user_logs", "trash", "tmp"];

struct ScanCategory {
    id: &'static str,
    label: &'static str,
    path: PathBuf,
    age_days: u32,
    risk: &'static str,
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

fn collect_dry_run_candidates(category: &ScanCategory) -> Vec<DryRunCandidate> {
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
        candidates.push(DryRunCandidate {
            category: category.id.to_string(),
            path: target.display().to_string(),
            size_kb: item_size_kb,
            size_human: human_size_kb(item_size_kb),
            risk: category.risk.to_string(),
        });
    }

    candidates.sort_by(|a, b| a.path.cmp(&b.path));
    candidates
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

    let selected_set: HashSet<&str> = selected.iter().map(String::as_str).collect();
    let mut candidates = Vec::new();

    for category in build_scan_categories()? {
        if selected_set.contains(category.id) {
            candidates.extend(collect_dry_run_candidates(&category));
        }
    }

    Ok(DryRunResponse {
        version: "2.1.0-rust-dry-run".to_string(),
        mode: "dry-run".to_string(),
        candidates,
    })
}

#[tauri::command]
pub fn run_cleaning(categories: Vec<String>) -> Result<CommandTextResponse, String> {
    let categories_csv = validate_and_normalize_categories(
        categories,
        "Selecciona al menos una categoría para limpiar.",
    )?
    .join(",");
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
}
