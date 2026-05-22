# Scripts

Este directorio contiene utilidades de desarrollo usadas durante validación local.

Estos archivos no son la interfaz pública del producto. El usuario debe interactuar con Mac Cleaner desde la app de macOS.

## Uso De Desarrollo

```bash
./mac_cleaner_v2.sh scan --json
./mac_cleaner_v2.sh dry-run --json
./mac_cleaner_v2.sh clean --yes
./mac_cleaner_v2.sh large-files 1G
./mac_cleaner_v2.sh top-dirs
```

## Nota De Seguridad

El uso directo de scripts está pensado para desarrollo y verificación. Los flujos de producto deben realizarse desde la app, donde se presentan revisión y confirmación de forma clara.
