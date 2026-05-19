# Release Notes v0.1.0

## Highlights

- Initial public release of a Tauri-first Mac Cleaner application.
- Secure Shell bridge integrated through Rust commands.
- Premium macOS-oriented React UI with guided cleaning flow.
- Dry-run-first safety model before cleanup execution.
- Large files and top directories inspection actions.

## What's Included

### Core architecture

- React + TypeScript frontend.
- Rust backend with auditable Tauri commands.
- Transitional shell engine (`scripts/mac_cleaner_v2.sh`) invoked only from Rust.

### Security model

- No `sudo` requirement in the initial version.
- Explicit command allowlist and threshold validation.
- Whitelisted cleanup paths only.
- No arbitrary shell command execution from frontend.
- Dry-run + explicit user confirmation before cleanup.

### Implemented commands

- `scan_cleanable`
- `dry_run_cleaning`
- `run_cleaning`
- `find_large_files` (allowed: `500M`, `1G`, `2G`, `5G`)
- `get_top_dirs`

## Developer Experience

- GitHub Actions CI configured for:
  - TypeScript/Vite build validation.
  - Rust `cargo check` validation in `src-tauri`.

## Known limitations

- Core cleaning logic still uses a transitional shell bridge.
- Signing and notarization pipeline is not automated yet.
- Per-category selective clean is planned for next iterations.

## Next milestone focus

- Migrate critical scan/clean logic from shell to Rust.
- Add release automation and signed macOS build pipeline.
- Expand safe category support with explicit policy and tests.
