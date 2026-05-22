# Mac Cleaner

Mac Cleaner es una utilidad premium para macOS diseñada para ayudar a las personas a entender, revisar y recuperar espacio en su Mac con calma.

El producto se centra en claridad y control: muestra qué se puede revisar, solicita confirmación antes de actuar y mantiene los archivos personales fuera de los flujos sensibles.

## Qué Hace

- Revisa áreas que suelen acumular archivos innecesarios.
- Muestra espacio potencial antes de liberar nada.
- Ayuda a identificar archivos y carpetas grandes para revisión manual.
- Mantiene una vista local de actividad reciente.
- Permite ajustar cuánto historial de actividad conservar.
- Ayuda a retirar apps instaladas moviéndolas a la Papelera.

## Principios Del Producto

- Revisar antes de actuar.
- No solicitar permisos elevados en la versión inicial.
- No aceptar rutas arbitrarias desde la interfaz para acciones sensibles.
- Mantener documentos personales fuera de los procesos de limpieza y desinstalación.
- Priorizar acciones reversibles cuando sea posible.

## Experiencia Actual

La app se organiza en cinco secciones:

- `Inicio`: estado general y entrada guiada a la limpieza.
- `Espacio`: herramientas para revisar archivos y carpetas.
- `Actividad`: historial reciente y resúmenes.
- `Desinstalar`: retiro guiado de apps.
- `Ajustes`: preferencias para personalizar la experiencia.

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

Este proyecto se distribuye bajo licencia **GNU AGPL-3.0**. Consulta `LICENSE` para más detalles.
