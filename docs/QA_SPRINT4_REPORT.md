# Sprint 4 QA Report

Date: 2026-05-21

## Scope

Sprint 4 validates the current Phase 4 MVP after premium product copy, navigation, history preferences and safe app uninstall were added.

## Validated Locally

- Frontend production build.
- Rust unit tests.
- Safe app uninstall smoke test with a dummy `.app` inside a temporary HOME.
- Tauri desktop startup smoke test.
- Browser visual check for the premium navigation and uninstall section.
- Browser preview fallback message for actions that require Tauri desktop.
- Release notes and signing/notarization checklist refreshed.

## Commands

```bash
npm run build
cargo test
cargo test smoke_uninstall_dummy_app_moves_to_temp_trash -- --ignored --test-threads=1
npm run tauri:dev
```

## Results

- `npm run build`: passed.
- `cargo test`: passed with 8 active tests and 1 ignored smoke test.
- `smoke_uninstall_dummy_app_moves_to_temp_trash`: passed when run explicitly.
- `npm run tauri:dev`: passed startup smoke test. Vite started, Rust/Tauri compiled, and `target/debug/mac-cleaner-tauri` launched without startup errors.
- Browser preview console: no errors observed.

## Screenshots

Local QA screenshots were captured at:

```text
/private/tmp/mac-cleaner-sprint4/01-inicio.png
/private/tmp/mac-cleaner-sprint4/02-ajustes.png
/private/tmp/mac-cleaner-sprint4/03-desinstalar.png
```

The browser preview cannot execute native Tauri commands, so the uninstall view intentionally shows a friendly desktop-required message instead of a raw technical error:

```text
Esta acción necesita abrir Mac Cleaner en modo desktop para acceder de forma segura a tu Mac.
```

## Safe Uninstall Smoke Test

The smoke test creates a fake app bundle at:

```text
<temporary HOME>/Applications/Sprint Smoke.app
```

Then it runs the same Rust command path used by the app:

```text
uninstall_apps_to_trash(["user:Sprint Smoke.app"])
```

Expected and observed behavior:

- The fake `.app` is selected by internal ID, not by a free path.
- The source bundle is moved, not deleted directly.
- The destination is inside `<temporary HOME>/.Trash/Mac Cleaner Apps`.
- No real installed apps are touched.
- The temporary HOME is removed after the test.

## Product QA Notes

- Main navigation now matches the product model: `Inicio`, `Espacio`, `Actividad`, `Desinstalar`, `Ajustes`.
- The interface avoids exposing implementation terms in primary screens.
- The uninstall flow uses safer language: review first, confirmation, move to Trash.
- Advanced or support details remain available without dominating the primary experience.

## Release Readiness

Ready for PR review and merge after:

- GitHub CI remains green.
- A quick manual smoke test is run in Tauri desktop mode on macOS.
- The PR description is updated with Sprint 1-4 scope.

Not ready for public macOS distribution until:

- Developer ID signing is configured.
- Notarization is completed and stapled.
- Gatekeeper assessment passes.
- A clean-machine install test passes.
