use super::*;

pub(super) fn get_clean_history_impl(limit: Option<u32>) -> Result<Vec<CleanHistoryEntry>, String> {
    #[cfg(feature = "native-clean")]
    {
        let max_limit = 200_u32;
        let requested = limit.unwrap_or(20).clamp(1, max_limit);
        collect_clean_history(requested as usize)
    }

    #[cfg(not(feature = "native-clean"))]
    {
        let _ = limit;
        Err("Historial nativo no disponible: feature native-clean desactivado.".to_string())
    }
}

pub(super) fn export_clean_history_report_impl(
    limit: Option<u32>,
) -> Result<ExportReportResponse, String> {
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

        Ok(ExportReportResponse {
            ok: true,
            report_path: report_path.display().to_string(),
            exported_runs: history.len(),
        })
    }

    #[cfg(not(feature = "native-clean"))]
    {
        let _ = limit;
        Err("Exportación no disponible: feature native-clean desactivado.".to_string())
    }
}

pub(super) fn apply_clean_history_retention_impl(
    retention_days: u32,
) -> Result<PruneHistoryResponse, String> {
    #[cfg(feature = "native-clean")]
    {
        let min_days = 1_u32;
        let max_days = 3650_u32;
        if !(min_days..=max_days).contains(&retention_days) {
            return Err("Retención inválida. Usa un valor entre 1 y 3650 días.".to_string());
        }

        let log_path = clean_log_file_path()?;
        let lines = read_clean_log_lines(&log_path)?;
        let runs = split_runs_from_log_lines(&lines);

        let now = unix_timestamp_secs();
        let retention_secs = u64::from(retention_days) * 24 * 60 * 60;
        let cutoff = now.saturating_sub(retention_secs);

        let mut kept_chunks: Vec<Vec<String>> = Vec::new();
        let mut removed_runs = 0_usize;
        for (started_at, run_lines) in runs {
            if started_at >= cutoff {
                kept_chunks.push(run_lines);
            } else {
                removed_runs += 1;
            }
        }

        let mut output = String::new();
        for chunk in &kept_chunks {
            for line in chunk {
                output.push_str(line);
                output.push('\n');
            }
        }

        fs::write(&log_path, output)
            .map_err(|err| format!("No se pudo aplicar retención sobre log nativo: {err}"))?;

        Ok(PruneHistoryResponse {
            ok: true,
            kept_runs: kept_chunks.len(),
            removed_runs,
            log_file: log_path.display().to_string(),
        })
    }

    #[cfg(not(feature = "native-clean"))]
    {
        let _ = retention_days;
        Err("Retención no disponible: feature native-clean desactivado.".to_string())
    }
}
