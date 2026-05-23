mod cleaner;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cleaner::scan_cleanable,
            cleaner::dry_run_cleaning,
            cleaner::run_cleaning,
            cleaner::find_large_files,
            cleaner::get_top_dirs,
            cleaner::scan_installed_apps,
            cleaner::prepare_app_uninstall,
            cleaner::uninstall_apps_to_trash,
            cleaner::get_clean_history,
            cleaner::export_clean_history_report,
            cleaner::apply_clean_history_retention,
            cleaner::get_system_metrics
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
