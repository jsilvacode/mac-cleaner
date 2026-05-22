# Notas De Versión v0.1.0

## Resumen

Mac Cleaner v0.1.0 presenta la primera experiencia completa del producto para cuidado y limpieza guiada en macOS.

Esta versión está enfocada en ayudar al usuario a decidir con confianza: revisar primero, confirmar con intención y evitar tocar archivos personales.

## Destacados

- Interfaz clara orientada a macOS y usuarios no técnicos.
- Flujo de limpieza guiado con revisión previa.
- Herramientas para revisar archivos y carpetas grandes.
- Actividad local con filtros y resúmenes.
- Preferencias para retención de actividad y tamaño de resúmenes.
- Retiro guiado de apps mediante movimiento a la Papelera.
- Navegación pulida: `Inicio`, `Espacio`, `Actividad`, `Desinstalar`, `Ajustes`.

## Modelo De Seguridad

- Las acciones de limpieza requieren revisión previa.
- Las acciones sensibles requieren confirmación explícita.
- La app no solicita permisos elevados en esta versión.
- El retiro de apps se limita a aplicaciones instaladas en ubicaciones esperadas de macOS.
- Las apps elegibles se mueven a la Papelera en lugar de eliminarse permanentemente.
- Documentos personales, contenedores de apps y archivos creados por el usuario no forman parte del retiro de apps.

## Incluido En Esta Versión

- `Inicio`: vista general y punto de entrada guiado.
- `Espacio`: revisión de archivos y carpetas grandes.
- `Actividad`: historial local con filtros y resúmenes.
- `Desinstalar`: retiro guiado de apps con flujo reversible desde la Papelera.
- `Ajustes`: preferencias de áreas, actividad y resúmenes.

## Validación

Esta versión candidata fue validada con:

- Verificación de generación de versión.
- Comprobaciones automatizadas de seguridad.
- Prueba de arranque en macOS.
- Prueba de retiro seguro con una app de validación.
- Revisión visual de las secciones principales del producto.

## Limitaciones Conocidas

- La distribución pública requiere firmado con Developer ID y notarización de Apple.
- El retiro de apps se enfoca actualmente en mover el paquete principal de la app a la Papelera.
- La revisión opcional de archivos residuales posteriores al retiro queda planificada para una versión futura.

## Próximo Enfoque

- Flujo de firmado y notarización para macOS.
- Validación de instalación en un entorno limpio.
- Onboarding inicial y capturas comerciales del producto.
- Revisión opcional de archivos residuales después de retirar una app.
