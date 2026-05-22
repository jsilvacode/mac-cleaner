# Modelo De Seguridad

Mac Cleaner se diseña alrededor de una promesa simple: el usuario debe entender qué se revisa antes de que algo cambie en su Mac.

## Principios Centrales

- Revisar primero, actuar después.
- Solicitar confirmación explícita antes de acciones sensibles.
- Evitar permisos elevados en la versión inicial.
- Mantener documentos personales fuera de los flujos de limpieza y desinstalación.
- Preferir acciones reversibles cuando sea posible.
- Mostrar resultados claros después de cada acción.

## Seguridad En Limpieza

Las áreas de limpieza son intencionalmente limitadas. La app las presenta con lenguaje humano y evita pedir al usuario rutas arbitrarias para operaciones sensibles.

Antes de liberar espacio, Mac Cleaner prepara una revisión para que el usuario entienda qué será afectado. La limpieza solo continúa después de una confirmación.

## Seguridad En Retiro De Apps

La experiencia de desinstalación es conservadora:

- Revisa apps instaladas desde ubicaciones esperadas de macOS.
- Omite apps que no deberían ofrecerse para retiro.
- Mueve apps elegibles a la Papelera en lugar de eliminarlas permanentemente.
- No elimina documentos personales, contenedores de apps ni datos creados por el usuario.

## Actividad Y Transparencia

Mac Cleaner conserva actividad local para que el usuario pueda entender acciones recientes y resultados. La retención de esa actividad puede limitarse desde preferencias.

## Preparación Para Distribución

Antes de distribuir públicamente una versión, debe completarse:

- Validación de generación de versión.
- Validación del producto en macOS.
- Firmado y notarización.
- Prueba de instalación en un entorno limpio.
