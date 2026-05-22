# Mac Cleaner

Mac Cleaner es una app para macOS que ayuda a revisar y liberar espacio de forma segura.

La app muestra áreas que pueden revisarse, permite confirmar antes de actuar y evita incluir documentos personales en sus flujos de limpieza o desinstalación.

## Qué Hace

- Revisa áreas comunes donde se acumulan archivos innecesarios.
- Muestra espacio potencial antes de liberar nada.
- Ayuda a revisar archivos y carpetas grandes.
- Muestra actividad reciente de limpieza.
- Permite ajustar preferencias básicas de uso.
- Permite retirar apps instaladas moviéndolas a la Papelera.

## Principios

- Revisar antes de actuar.
- Pedir confirmación antes de cambios sensibles.
- Evitar permisos elevados en la versión inicial.
- No aceptar rutas arbitrarias desde la interfaz para acciones sensibles.
- Mantener documentos personales fuera de los procesos de limpieza y desinstalación.

## Secciones

- `Inicio`: vista general y acceso a limpieza guiada.
- `Espacio`: revisión de archivos y carpetas.
- `Actividad`: historial reciente y resúmenes.
- `Desinstalar`: retiro guiado de apps.
- `Ajustes`: preferencias de uso.

## Desarrollo

```bash
npm install
npm run tauri:dev
```

Para preparar una versión distribuible en macOS, consulta `docs/MACOS_SIGNING_NOTARIZATION_CHECKLIST.md`.

## Documentación

- `RELEASE_NOTES_v0.1.0.md`
- `docs/SAFETY_MODEL.md`
- `docs/MACOS_SIGNING_NOTARIZATION_CHECKLIST.md`
- `docs/RELEASE_VALIDATION.md`

## Licencia

Copyright © 2026 Mac Cleaner. All rights reserved.

El código fuente, binarios, interfaz, documentación y materiales relacionados son propietarios salvo acuerdo escrito en contrario. Consulta `LICENSE` para más detalles.
