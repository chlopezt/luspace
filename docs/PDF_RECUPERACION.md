# Recuperación del generador PDF

- Las importaciones PDF reconocen errores de descarga de módulos y reintentan una vez. Los errores normales de datos/generación no se confunden con despliegues nuevos.
- Cada compilación emite `app-version.json`. Se consulta sin caché solo ante un fallo de módulo. Si la versión cambió, hay conexión y no hay cambios sin guardar, se permite una recarga automática, como máximo una por versión durante diez minutos.
- Se conserva temporalmente en `sessionStorage` solo identidad de cuenta/perfil, selección de módulos y opción de foto, no datos del informe ni imágenes. Tras recargar se consume ese estado, se comprueba cuenta/perfil, se filtran permisos actuales y se abre el modal. El usuario pulsa Descargar PDF nuevamente; no se envía automáticamente otra exportación.
- Si la red falla, la versión no cambió, el almacenamiento del navegador está bloqueado o el fallo persiste, se muestra un aviso claro sin URL de módulos y se habilita el botón para reintentar. No hay bucles de recarga.
- Durante la generación se muestra «Generando informe…» y se deshabilitan descarga y selección.
- Preparación de consulta usa la misma protección de importación, pero nunca recarga automáticamente: conserva el borrador editable y solicita copiarlo o guardarlo antes de recargar.
- Esta recuperación no elimina ni modifica información en D1 o R2 y no sustituye los respaldos pendientes.
