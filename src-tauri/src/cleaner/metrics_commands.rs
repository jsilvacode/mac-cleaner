use std::process::Command;
use std::thread;
use std::time::Duration;
use sysinfo::System;

use super::types::SystemMetrics;

const BYTES_PER_GB: f32 = 1_073_741_824.0;

fn bytes_to_gb(value: u64) -> f32 {
    value as f32 / BYTES_PER_GB
}

fn parse_battery_percent(stdout: &str) -> Option<u8> {
    stdout.split_whitespace().find_map(|token| {
        if !token.contains('%') {
            return None;
        }
        let clean = token.trim_matches(|ch: char| ch == ';' || ch == '%' || ch == ',');
        clean.parse::<u8>().ok()
    })
}

fn parse_charging_state(stdout: &str) -> bool {
    let lower = stdout.to_ascii_lowercase();
    if lower.contains("discharging") {
        return false;
    }

    lower.contains("ac power")
        || lower.contains("charging")
        || lower.contains("charged")
        || lower.contains("finishing charge")
}

fn read_battery_state() -> (Option<u8>, bool) {
    let Ok(output) = Command::new("pmset").arg("-g").arg("batt").output() else {
        return (None, false);
    };

    if !output.status.success() {
        return (None, false);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let percent = parse_battery_percent(&stdout);
    let charging = parse_charging_state(&stdout);
    (percent, charging)
}

pub(super) fn get_system_metrics_impl() -> Result<SystemMetrics, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();

    // sysinfo CPU usage necesita dos lecturas separadas para obtener delta real.
    sys.refresh_cpu_usage();
    thread::sleep(Duration::from_millis(220));
    sys.refresh_cpu_usage();

    let (battery_percent, is_charging) = read_battery_state();
    let cpu_usage_percent = sys.global_cpu_info().cpu_usage();

    Ok(SystemMetrics {
        cpu_usage_percent,
        ram_used_gb: bytes_to_gb(sys.used_memory()),
        ram_total_gb: bytes_to_gb(sys.total_memory()),
        battery_percent,
        is_charging,
    })
}

#[cfg(test)]
mod tests {
    use super::{parse_battery_percent, parse_charging_state};

    #[test]
    fn parses_pmset_percentage() {
        let sample = "Now drawing from 'AC Power'\n-InternalBattery-0 93%; charging; 0:11 remaining";
        assert_eq!(parse_battery_percent(sample), Some(93));
    }

    #[test]
    fn charging_parser_handles_discharging_without_false_positive() {
        let discharging = "Now drawing from 'Battery Power'\n-InternalBattery-0 82%; discharging; 5:20 remaining";
        let charging = "Now drawing from 'AC Power'\n-InternalBattery-0 82%; charging; 0:20 remaining";
        assert!(!parse_charging_state(discharging));
        assert!(parse_charging_state(charging));
    }
}
