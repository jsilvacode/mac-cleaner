# Mac Cleaner Tauri Codex Pack

Repositorio base para evolucionar `mac_cleaner_v2.sh` hacia una aplicación instalable para macOS usando **Tauri + frontend web + motor Rust/Shell controlado**.

La decisión arquitectónica oficial es **Tauri-first**. La PWA pura queda limitada a sitio complementario, documentación, marketing, cuenta de usuario o pricing. La limpieza real de macOS debe ejecutarse desde una app instalable con backend nativo.

## Estructura

```text
.
├── src/                         # Frontend React + TypeScript
├── src-tauri/                   # Backend Tauri/Rust
├── scripts/                     # Motor Shell transitorio y seguro
├── README.md
├── LICENSE
└── .gitignore
```

## Comandos iniciales

```bash
npm install
npm run tauri:dev
```

## Motor transitorio

```bash
./scripts/mac_cleaner_v2.sh scan --json
./scripts/mac_cleaner_v2.sh dry-run --json
./scripts/mac_cleaner_v2.sh clean
./scripts/mac_cleaner_v2.sh large-files 1G
./scripts/mac_cleaner_v2.sh top-dirs
```

## Principio central

El frontend nunca borra archivos. El frontend solicita acciones al backend Rust. Rust valida la acción, ejecuta solo comandos permitidos y, mientras la lógica no esté migrada completamente a Rust, invoca el script Shell seguro como motor transitorio.

## Migration Status

- `scan_cleanable`: Rust nativo
- `dry_run_cleaning`: Rust nativo
- `find_large_files`: Rust nativo
- `get_top_dirs`: Rust nativo
- `run_cleaning`: Rust nativo por defecto (con fallback shell controlado por `MAC_CLEANER_FORCE_SHELL=1`)
- `MAC_CLEANER_DUAL_PARITY=1`: activa simulación de paridad Rust vs Shell (sin borrado)
- `get_clean_history`: historial local desde logs JSONL nativos
- `export_clean_history_report`: exporta reporte Markdown del historial local

## Phase 4 (in progress)

- Historial local integrado en backend y UI.
- Exportación de reporte de historial a `~/Library/Logs/mac_cleaner_tauri_agent/reports/`.
- Preferencias locales iniciales (categorías por defecto y threshold de archivos grandes).

## Interface direction

La documentación interna de arquitectura, seguridad y roadmap se mantiene fuera del repositorio público.

## License

Este proyecto se distribuye bajo licencia **GNU AGPL-3.0**. Consulta el archivo `LICENSE` para los términos completos.

## Release and Distribution Docs

- `RELEASE_NOTES_v0.1.0.md`
- `docs/MACOS_SIGNING_NOTARIZATION_CHECKLIST.md`
