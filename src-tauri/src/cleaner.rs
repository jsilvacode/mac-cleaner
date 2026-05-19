use serde::{Deserialize, Serialize};
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

fn run_script(args: &[&str]) -> Result<CommandTextResponse, String> {
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

fn validate_and_build_categories_csv(
    categories: Vec<String>,
    empty_error: &str,
) -> Result<String, String> {
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

    Ok(selected.join(","))
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
    let categories_csv = validate_and_build_categories_csv(
        categories,
        "Selecciona al menos una categoría para ejecutar dry-run.",
    )?;
    let args = vec![
        "dry-run".to_string(),
        "--json".to_string(),
        "--categories".to_string(),
        categories_csv,
    ];
    let response = run_script_dynamic(&args)?;
    if !response.ok {
        return Err(response.stderr);
    }
    serde_json::from_str::<DryRunResponse>(&response.stdout)
        .map_err(|err| format!("No se pudo interpretar el dry-run JSON: {err}"))
}

#[tauri::command]
pub fn run_cleaning(categories: Vec<String>) -> Result<CommandTextResponse, String> {
    let categories_csv = validate_and_build_categories_csv(
        categories,
        "Selecciona al menos una categoría para limpiar.",
    )?;
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
    run_script(&["large-files", threshold.as_str()])
}

#[tauri::command]
pub fn get_top_dirs() -> Result<CommandTextResponse, String> {
    run_script(&["top-dirs"])
}

#[cfg(test)]
mod tests {
    use super::scan_cleanable;

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
}
