# Mac Cleaner

**Limpieza profunda para macOS.**

Mac Cleaner es una app de limpieza para macOS que elimina cachés, archivos temporales, logs antiguos, basura de aplicaciones y archivos residuales para recuperar espacio de forma efectiva.

La app no está pensada como un asistente pasivo de revisión. Su foco es limpiar basura real del sistema y de las aplicaciones, manteniendo controles claros cuando una acción pueda afectar archivos personales o configuraciones sensibles.

> Agresiva con la basura técnica. Clara con el usuario. Prudente solo cuando pueda afectar archivos personales o configuraciones sensibles.

## Qué Hace

- Limpia cachés, temporales y logs antiguos.
- Elimina archivos basura acumulados por aplicaciones.
- Desinstala aplicaciones y elimina sus archivos residuales.
- Vacía la Papelera y recupera espacio.
- Detecta carpetas pesadas, archivos grandes e instaladores antiguos.
- Muestra cuánto espacio puedes recuperar antes de limpiar.
- Muestra el resultado de la limpieza al finalizar.

## Qué Limpia

Mac Cleaner se enfoca en categorías concretas y entendibles:

- Cachés del usuario.
- Cachés de aplicaciones.
- Archivos temporales.
- Logs antiguos.
- Papelera.
- Basura acumulada por aplicaciones.
- Residuos de apps instaladas o desinstaladas.
- Instaladores antiguos y archivos pesados detectables.
- Basura generada por herramientas de desarrollo cuando exista una regla segura.

Los archivos grandes y carpetas pesadas son funciones complementarias. El foco principal es limpiar cachés, temporales, logs, basura técnica y residuos de aplicaciones.

## Qué No Hace

- No borra documentos personales de forma automática.
- No elimina fotos, videos, proyectos o carpetas personales sin confirmación explícita.
- No modifica partes críticas del sistema sin advertencia.
- No ejecuta acciones sensibles sin confirmación previa.
- No acepta rutas arbitrarias desde la interfaz para acciones peligrosas.
- No reemplaza una copia de seguridad.

## Secciones

- `Inicio`: estado general, basura detectada y acceso rápido a limpieza.
- `Limpiar`: escaneo y limpieza de cachés, temporales, logs, Papelera y residuos.
- `Desinstalar`: desinstala aplicaciones y elimina archivos residuales.
- `Espacio`: detecta carpetas pesadas, archivos grandes e instaladores antiguos.
- `Ajustes`: configura comportamiento de limpieza, confirmaciones y preferencias.

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
