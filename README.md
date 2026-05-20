# Mac Cleaner

Repositorio base, aplicación instalable para macOS usando **Tauri + frontend web + motor Rust/Shell**.

La decisión arquitectónica oficial es **Tauri-first**. PWA queda limitada a sitio complementario, documentación, marketing, cuenta de usuario o pricing. La limpieza real de macOS  se ejecuta desde una app instalable con backend nativo.

## Estructura

```
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

El frontend nunca borra archivos. El frontend solicita acciones al backend Rust. Rust valida la acción y ejecuta solo comandos permitidos.

## Migration Status

- `scan_cleanable`: Rust nativo
- `dry_run_cleaning`: Rust nativo
- `find_large_files`: Rust nativo
- `get_top_dirs`: Rust nativo
- `run_cleaning`: Rust nativo por defecto (con fallback shell controlado por `MAC_CLEANER_FORCE_SHELL=1`)
- `MAC_CLEANER_DUAL_PARITY=1`: activa simulación de paridad Rust vs Shell (sin borrado)

## Interface direction

La documentación interna de arquitectura, seguridad y roadmap se mantiene fuera del repositorio público.

## License

Este proyecto se distribuye bajo licencia **GNU AGPL-3.0**. Consulta el archivo `LICENSE` para los términos completos.

## Release and Distribution Docs

- `RELEASE_NOTES_v0.1.0.md`
- `docs/MACOS_SIGNING_NOTARIZATION_CHECKLIST.md`
