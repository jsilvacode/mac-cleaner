# Modelo De Seguridad

Mac Cleaner limpia basura técnica de forma activa, pero mantiene límites claros cuando una acción puede afectar archivos personales, configuraciones sensibles o entornos de trabajo.

## Principio Central

Ser agresiva con basura técnica, no con archivos personales.

## Limpieza Permitida

La app puede limpiar con confirmación categorías de bajo riesgo o riesgo medio controlado:

- Cachés del usuario.
- Cachés de aplicaciones.
- Archivos temporales.
- Logs antiguos.
- Papelera.
- Basura acumulada por aplicaciones.
- Residuos claros de apps.

## Acciones Sensibles

La app debe pedir confirmación clara cuando una acción pueda afectar:

- Documentos personales.
- Fotos o videos.
- Proyectos.
- Configuraciones sensibles.
- Sesiones.
- Entornos de desarrollo.
- Datos que no sean claramente basura técnica.

## Reglas Obligatorias

- No usar permisos elevados en la versión inicial.
- No aceptar rutas arbitrarias desde la interfaz para acciones peligrosas.
- No seguir symlinks.
- No borrar elementos modificados recientemente.
- Mostrar qué se eliminará antes de ejecutar una limpieza sensible.
- Mostrar resultado inmediato después de limpiar.
- Preferir omitir antes que borrar algo dudoso.

## Seguridad En Desinstalación

La sección `Desinstalar` mueve apps elegibles y rastros asociados a la Papelera cuando vienen de ubicaciones y reglas permitidas.

- Revisa apps instaladas desde ubicaciones esperadas de macOS.
- Omite apps protegidas o modificadas recientemente.
- Mueve elementos a la Papelera en lugar de eliminarlos permanentemente.
- No elimina documentos personales ni rutas libres.
- Muestra apps, rastros asociados y elementos omitidos antes de ejecutar.

## Preparación Para Distribución

Antes de distribuir públicamente una versión, debe completarse:

- Validación de build.
- Validación del producto en macOS.
- Firmado y notarización.
- Prueba de instalación en un entorno limpio.
