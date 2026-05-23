use super::*;

pub(super) fn scan_installed_apps_impl() -> Result<InstalledAppsResponse, String> {
    Ok(InstalledAppsResponse {
        version: "0.1.0-app-uninstall".to_string(),
        mode: "scan".to_string(),
        items: collect_installed_apps()?,
    })
}

pub(super) fn prepare_app_uninstall_impl(
    app_ids: Vec<String>,
) -> Result<AppUninstallPlanResponse, String> {
    build_app_uninstall_plan(app_ids)
}

pub(super) fn uninstall_apps_to_trash_impl(
    app_ids: Vec<String>,
) -> Result<AppUninstallResponse, String> {
    let plan = build_app_uninstall_plan(app_ids)?;
    if plan.items.is_empty() {
        return Err(
            "No hay apps listas para retirar después de la revisión de seguridad.".to_string(),
        );
    }

    let mut results = Vec::new();
    let mut moved_total_kb = 0_u64;
    let mut moved_count = 0_usize;
    let mut skipped_count = plan.skipped.len();

    for item in plan.items {
        let source = PathBuf::from(&item.path);
        let app_name = source
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "No se pudo resolver el nombre de la app.".to_string())?;

        let path_display = source.display().to_string();
        let meta = match fs::symlink_metadata(&source) {
            Ok(meta) => meta,
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(format!("La app ya no está disponible: {err}")),
                });
                continue;
            }
        };

        if meta.file_type().is_symlink() || !meta.is_dir() || !is_app_bundle(&source) {
            skipped_count += 1;
            results.push(AppUninstallResultItem {
                id: item.id,
                name: item.name,
                item_type: item.item_type,
                source_path: path_display,
                destination_path: None,
                moved_to_trash: false,
                moved_size_kb: 0,
                moved_size_human: human_size_kb(0),
                error: Some("Omitida por no ser una app válida o por ser symlink.".to_string()),
            });
            continue;
        }

        let inside_allowed_apps = match is_path_in_app_roots(&source) {
            Ok(value) => value,
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(format!("No se pudo validar raíz de apps: {err}")),
                });
                continue;
            }
        };

        if !inside_allowed_apps {
            skipped_count += 1;
            results.push(AppUninstallResultItem {
                id: item.id,
                name: item.name,
                item_type: item.item_type,
                source_path: path_display,
                destination_path: None,
                moved_to_trash: false,
                moved_size_kb: 0,
                moved_size_human: human_size_kb(0),
                error: Some("Omitida por estar fuera de rutas permitidas.".to_string()),
            });
            continue;
        }

        let (removable, reason) = app_removal_status(app_name, &meta);
        if !removable {
            skipped_count += 1;
            results.push(AppUninstallResultItem {
                id: item.id,
                name: item.name,
                item_type: item.item_type,
                source_path: path_display,
                destination_path: None,
                moved_to_trash: false,
                moved_size_kb: 0,
                moved_size_human: human_size_kb(0),
                error: Some(reason),
            });
            continue;
        }

        let initial_identity = path_identity(&meta);
        let refreshed_meta = match revalidate_stable_path(&source, &initial_identity) {
            Ok(meta) => meta,
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(err),
                });
                continue;
            }
        };

        if !refreshed_meta.is_dir() || !is_app_bundle(&source) {
            skipped_count += 1;
            results.push(AppUninstallResultItem {
                id: item.id,
                name: item.name,
                item_type: item.item_type,
                source_path: path_display,
                destination_path: None,
                moved_to_trash: false,
                moved_size_kb: 0,
                moved_size_human: human_size_kb(0),
                error: Some("La app cambió durante la revisión de seguridad.".to_string()),
            });
            continue;
        }

        let destination = unique_trash_destination(app_name)?;
        let destination_display = destination.display().to_string();
        match fs::rename(&source, &destination) {
            Ok(_) => {
                moved_count += 1;
                moved_total_kb += item.size_kb;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: Some(destination_display),
                    moved_to_trash: true,
                    moved_size_kb: item.size_kb,
                    moved_size_human: item.size_human,
                    error: None,
                });
            }
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(format!(
                        "No se pudo mover a la Papelera. macOS puede requerir permisos: {err}"
                    )),
                });
            }
        }
    }

    let library = resolve_home()?.join("Library");
    for item in plan.leftovers {
        let source = PathBuf::from(&item.path);
        let path_display = source.display().to_string();
        let meta = match fs::symlink_metadata(&source) {
            Ok(meta) => meta,
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(format!("El rastro ya no está disponible: {err}")),
                });
                continue;
            }
        };

        if meta.file_type().is_symlink() || !is_path_inside_root(&library, &source) {
            skipped_count += 1;
            results.push(AppUninstallResultItem {
                id: item.id,
                name: item.name,
                item_type: item.item_type,
                source_path: path_display,
                destination_path: None,
                moved_to_trash: false,
                moved_size_kb: 0,
                moved_size_human: human_size_kb(0),
                error: Some("Rastro omitido por seguridad.".to_string()),
            });
            continue;
        }

        let initial_identity = path_identity(&meta);
        let refreshed_meta = match revalidate_stable_path(&source, &initial_identity) {
            Ok(meta) => meta,
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(err),
                });
                continue;
            }
        };

        if refreshed_meta.file_type().is_symlink() || !is_path_inside_root(&library, &source) {
            skipped_count += 1;
            results.push(AppUninstallResultItem {
                id: item.id,
                name: item.name,
                item_type: item.item_type,
                source_path: path_display,
                destination_path: None,
                moved_to_trash: false,
                moved_size_kb: 0,
                moved_size_human: human_size_kb(0),
                error: Some("El rastro cambió durante la revisión de seguridad.".to_string()),
            });
            continue;
        }

        let entry_name = source
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| format!("{} - {value}", item.name.replace('/', "-")))
            .unwrap_or_else(|| item.name.replace('/', "-"));
        let destination = unique_trash_destination_entry(&entry_name)?;
        let destination_display = destination.display().to_string();

        match fs::rename(&source, &destination) {
            Ok(_) => {
                moved_count += 1;
                moved_total_kb += item.size_kb;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: Some(destination_display),
                    moved_to_trash: true,
                    moved_size_kb: item.size_kb,
                    moved_size_human: item.size_human,
                    error: None,
                });
            }
            Err(err) => {
                skipped_count += 1;
                results.push(AppUninstallResultItem {
                    id: item.id,
                    name: item.name,
                    item_type: item.item_type,
                    source_path: path_display,
                    destination_path: None,
                    moved_to_trash: false,
                    moved_size_kb: 0,
                    moved_size_human: human_size_kb(0),
                    error: Some(format!("No se pudo mover el rastro a la Papelera: {err}")),
                });
            }
        }
    }

    Ok(AppUninstallResponse {
        ok: moved_count > 0,
        mode: "move-to-trash".to_string(),
        moved_count,
        skipped_count,
        moved_total_kb,
        moved_total_human: human_size_kb(moved_total_kb),
        items: results,
    })
}
