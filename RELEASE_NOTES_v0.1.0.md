# Notas De Versión v0.1.0

## Resumen

Mac Cleaner v0.1.0 presenta la primera experiencia funcional de limpieza profunda para macOS.

Esta versión se enfoca en limpiar basura técnica real: cachés, temporales, logs antiguos, Papelera y residuos asociados a aplicaciones, manteniendo confirmaciones claras cuando una acción pueda afectar configuraciones o archivos personales.

## Destacados

- Limpieza activa de cachés, temporales, logs antiguos y Papelera.
- Desinstalación de aplicaciones con rastros asociados cuando existen reglas seguras.
- Detección de archivos grandes y carpetas pesadas como apoyo para recuperar espacio.
- Resultado inmediato después de limpiar.
- Ajustes para categorías de limpieza, tamaño mínimo de archivos grandes y conservación de resultados.
- Navegación actualizada: `Inicio`, `Limpiar`, `Desinstalar`, `Espacio`, `Ajustes`.

## Modelo De Seguridad

- La app limpia basura técnica con confirmación.
- Las acciones sensibles requieren confirmación explícita.
- La app no solicita permisos elevados en esta versión.
- La desinstalación se limita a apps y rastros asociados desde ubicaciones permitidas.
- Los elementos elegibles se mueven a la Papelera en lugar de eliminarse permanentemente.
- Documentos personales y rutas libres quedan fuera de las acciones automáticas.

## Incluido En Esta Versión

- `Inicio`: estado general, basura detectada y acceso rápido.
- `Limpiar`: escaneo y limpieza de categorías permitidas.
- `Desinstalar`: apps instaladas y archivos residuales asociados.
- `Espacio`: archivos grandes y carpetas pesadas.
- `Ajustes`: comportamiento de limpieza, resultados guardados y preferencias.

## Validación

Esta versión candidata fue validada con:

- Build de versión.
- Comprobaciones automatizadas de seguridad.
- Prueba de arranque en macOS.
- Prueba de limpieza.
- Prueba de desinstalación con una app de validación.
- Revisión visual de las secciones principales del producto.

## Limitaciones Conocidas

- La distribución pública requiere firmado con Developer ID y notarización de Apple.
- Las métricas reales de RAM, CPU y disco quedan planificadas para un siguiente sprint.
- Categorías avanzadas como navegadores, herramientas de desarrollo y residuos huérfanos requieren reglas específicas antes de activarse.

## Próximo Enfoque

- Indicadores reales de estado del Mac: disco, RAM y CPU.
- Limpieza de datos temporales de navegadores con reglas específicas.
- Basura técnica de herramientas de desarrollo.
- Firma, notarización y prueba de instalación en entorno limpio.
