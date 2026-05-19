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
            cleaner::get_clean_history,
            cleaner::export_clean_history_report,
            cleaner::apply_clean_history_retention
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
