# Scripts

`mac_cleaner_v2.sh` es el motor seguro transitorio del proyecto.

## Uso directo

```bash
./mac_cleaner_v2.sh scan --json
./mac_cleaner_v2.sh dry-run --json
./mac_cleaner_v2.sh clean
./mac_cleaner_v2.sh clean --yes
```

## Rol dentro de Tauri

Rust invoca este script solo mediante comandos allowlist. El frontend nunca lo ejecuta directamente.

## Migración futura

La lógica de escaneo, cálculo de tamaño y limpieza segura debe migrarse progresivamente a Rust. Shell debe quedar como fallback o herramienta auxiliar.
