use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

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

#[tauri::command]
pub fn scan_cleanable() -> Result<ScanResponse, String> {
    let response = run_script(&["scan", "--json"])?;
    if !response.ok {
        return Err(response.stderr);
    }
    serde_json::from_str::<ScanResponse>(&response.stdout)
        .map_err(|err| format!("No se pudo interpretar el escaneo JSON: {err}"))
}

#[tauri::command]
pub fn dry_run_cleaning() -> Result<DryRunResponse, String> {
    let response = run_script(&["dry-run", "--json"])?;
    if !response.ok {
        return Err(response.stderr);
    }
    serde_json::from_str::<DryRunResponse>(&response.stdout)
        .map_err(|err| format!("No se pudo interpretar el dry-run JSON: {err}"))
}

#[tauri::command]
pub fn run_cleaning() -> Result<CommandTextResponse, String> {
    // La confirmación de usuario ocurre en la UI antes de invocar este comando.
    // Ejecutamos en modo no interactivo para evitar bloqueos por prompts.
    run_script(&["clean", "--yes"])
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
