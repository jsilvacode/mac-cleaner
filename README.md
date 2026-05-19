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

## Interface direction

La documentación interna de arquitectura, seguridad y roadmap se mantiene fuera del repositorio público.
