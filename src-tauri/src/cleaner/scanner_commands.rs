use super::*;

pub(super) fn scan_cleanable_impl() -> Result<ScanResponse, String> {
    let categories = build_scan_categories()?;
    let mut items = Vec::with_capacity(categories.len());

    for category in categories {
        let estimated_kb = collect_category_candidates(&category)
            .iter()
            .map(|(_, size_kb)| *size_kb)
            .sum();
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

pub(super) fn dry_run_cleaning_impl(categories: Vec<String>) -> Result<DryRunResponse, String> {
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

pub(super) fn run_cleaning_impl(categories: Vec<String>) -> Result<CommandTextResponse, String> {
    let selected =
        validate_and_normalize_categories(categories, "Selecciona al menos una categoría para limpiar.")?;

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

pub(super) fn find_large_files_impl(threshold: String) -> Result<CommandTextResponse, String> {
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

pub(super) fn get_top_dirs_impl() -> Result<CommandTextResponse, String> {
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
