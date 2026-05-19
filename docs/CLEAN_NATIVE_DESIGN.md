# Native Clean Design (Rust)

## Goal

Replace shell-based `clean` with a native Rust command that preserves the current security guarantees and logging traceability.

## Scope

- Keep current allowed categories:
  - `user_cache`
  - `user_logs`
  - `trash`
  - `tmp`
- Keep category allowlist validation in backend.
- Keep explicit user confirmation in UI before execution.
- Keep shell bridge as fallback until native parity is validated.

## Safety Invariants

- No `sudo`.
- No arbitrary path input from UI.
- No symlink traversal.
- No deletion for files newer than category age rule.
- No deletion of root or empty-resolved paths.
- Per-item deletion failures must not abort the full run.

## Proposed Rust Data Model

```rust
struct CleanPlanItem {
    category: String,
    path: PathBuf,
    size_kb: u64,
}

struct CleanResultItem {
    category: String,
    path: String,
    deleted: bool,
    reclaimed_kb: u64,
    error: Option<String>,
}

struct NativeCleanResponse {
    ok: bool,
    mode: String, // "clean"
    processed_categories: Vec<String>,
    reclaimed_total_kb: u64,
    reclaimed_total_human: String,
    items: Vec<CleanResultItem>,
    log_file: String,
}
```

## Logging Equivalence Requirements

Current shell behavior logs action-level information in `~/Library/Logs/mac_cleaner_tauri_agent/run.log`.
Native implementation should preserve equivalent observability with structured lines.

### Required log fields per event

- Timestamp (ISO-8601).
- Event type (`start`, `candidate`, `delete_ok`, `delete_error`, `category_done`, `end`).
- Category id.
- Logical path.
- Result status.
- Reclaimed size (`kb`).
- Error message (if any).

Example JSON line:

```json
{"ts":"2026-05-19T08:20:00Z","event":"delete_ok","category":"user_logs","path":"/Users/.../Library/Logs/foo.log","reclaimed_kb":120,"status":"ok"}
```

## Execution Flow

1. Validate categories against allowlist.
2. Build candidate list with current dry-run Rust logic.
3. Write `start` log event.
4. For each candidate:
   - Re-check symlink and age conditions.
   - Delete file/dir with `remove_file` or `remove_dir_all`.
   - Compute reclaimed size from precomputed candidate size.
   - Log success or failure per item.
5. Aggregate total reclaimed space.
6. Write `end` log event.
7. Return `NativeCleanResponse`.

## Rollout Plan

1. Implement `run_cleaning_native(categories)` behind feature flag.
2. Keep existing shell-backed `run_cleaning` as default path.
3. Add parity tests:
   - category validation
   - no-symlink deletion
   - age threshold enforcement
   - log file generation
4. Add temporary dual-run verification mode (dry-run compare only).
5. Switch default to native clean once parity is confirmed.

## Feature Flags

Compile-time feature (Rust/Cargo):

- `native-clean`

Runtime flags (environment variables):

- `MAC_CLEANER_NATIVE_CLEAN=1`
  - Enables native deletion path when binary is built with `native-clean`.
- `MAC_CLEANER_DUAL_PARITY=1`
  - Enables dual simulation/parity mode (no deletion, compares native vs shell dry-run).
  - Takes precedence over `MAC_CLEANER_NATIVE_CLEAN`.

## Test Matrix

- Empty category list (reject).
- Unknown category (reject).
- Category with no candidates.
- Mixed candidates with delete success/failure.
- Symlink candidate (must skip).
- Recent file candidate (must skip).
- Log directory unavailable (fallback behavior).

## Open Decisions

- Keep plain-text logs vs JSON Lines only.
- Decide retention policy for local logs.
- Define max candidates per run for UX responsiveness.
