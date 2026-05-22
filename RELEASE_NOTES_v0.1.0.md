# Release Notes v0.1.0

## Highlights

- Initial public release of a Tauri-first Mac Cleaner application.
- Native Rust cleaning flow enabled by default with controlled shell fallback for parity.
- Premium macOS-oriented React UI with guided cleaning, activity and uninstall flows.
- Dry-run-first safety model before cleanup execution.
- Large files and top directories inspection actions.
- Local activity history, retention preferences and Markdown summary export.
- Safe installed-app uninstall flow that moves selected apps to the user Trash.

## What's Included

### Core architecture

- React + TypeScript frontend.
- Rust backend with auditable Tauri commands.
- Native Rust scan, dry-run, clean, large-files and top-directories implementation.
- Transitional shell engine (`scripts/mac_cleaner_v2.sh`) kept as a controlled fallback only.
- Local JSONL activity log and report export.

### Security model

- No `sudo` requirement in the initial version.
- Explicit command allowlist and threshold validation.
- Whitelisted cleanup paths only.
- No arbitrary shell command execution from frontend.
- Dry-run + explicit user confirmation before cleanup.
- No free paths accepted from the UI for destructive operations.
- App uninstall only scans `/Applications` and `~/Applications`.
- App uninstall moves eligible `.app` bundles to `~/.Trash/Mac Cleaner Apps`.
- Protected macOS apps, symlinks and recently modified apps are skipped.
- App uninstall does not remove documents, preferences, containers or personal data.

### Implemented commands

- `scan_cleanable`
- `dry_run_cleaning`
- `run_cleaning`
- `find_large_files` (allowed: `500M`, `1G`, `2G`, `5G`)
- `get_top_dirs`
- `get_clean_history`
- `export_clean_history_report`
- `apply_clean_history_retention`
- `scan_installed_apps`
- `prepare_app_uninstall`
- `uninstall_apps_to_trash`

## Product Experience

- Premium navigation: `Inicio`, `Espacio`, `Actividad`, `Ajustes`, `Desinstalar`.
- User-friendly Spanish microcopy for non-technical Mac owners.
- Activity filters by status, date range, area and sort order.
- Advanced preferences for activity retention and export size.
- Guided uninstall section with review-first and reversible-to-Trash language.

## Developer Experience

- GitHub Actions CI configured for:
  - TypeScript/Vite build validation.
  - Rust `cargo check` validation in `src-tauri`.
- Local QA commands used for this milestone:
  - `npm run build`
  - `cargo test`
  - `cargo test smoke_uninstall_dummy_app_moves_to_temp_trash -- --ignored --test-threads=1`

## Known limitations

- Signing and notarization pipeline is not automated yet.
- Native app uninstall currently removes the `.app` bundle only by moving it to Trash.
- App uninstall does not yet offer optional cleanup of app support files, preferences or containers.
- macOS signed build and clean-machine install test are still required before public distribution.

## Next milestone focus

- Add release automation and signed macOS build pipeline.
- Run notarized macOS distribution QA on a clean machine.
- Add optional post-uninstall leftover scan with explicit per-location review.
- Prepare marketing screenshots, pricing page and onboarding copy.
