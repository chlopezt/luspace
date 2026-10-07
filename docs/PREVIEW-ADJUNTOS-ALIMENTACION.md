# Revisión previa: adjuntos, acordeones y alimentación

Estado: vista previa aprobada por el usuario para publicación. Los accesos siguientes son exclusivamente locales y ficticios; no sirven en producción.

## Abrir la vista previa aislada

Desde la carpeta `luspace-app` en PowerShell:

```powershell
node scripts/seed-contextual-preview.mjs
$env:LUSPACE_DATA_DIR='../work/contextual-preview-v2'
$env:VITE_LUSPACE_PREVIEW='true'
node node_modules/vite/bin/vite.js --port 5181
```

Familia: `http://127.0.0.1:5181/login`, cuenta ficticia
`familia@preview.luspace.test`, contraseña `VistaPrevia!2026`.

Plataforma: `http://127.0.0.1:5181/admin/login`, cuenta ficticia
`admin@preview.luspace.test`, contraseña `AdminVista!2026`.

Estas credenciales son solo para los datos sintéticos locales. No son accesos reales.
La base y los objetos están en `../work/contextual-preview-v2`, fuera de la app.
No se usan credenciales de Cloudflare ni datos de las familias reales.

## Qué revisar

- Salud: Mediciones, Tratamientos, Consultas, Exámenes y Vacunas colapsables.
- Alimentación: vía, textura, volumen/unidad, tolerancia y síntomas; archivos múltiples.
- Escolar: acordeones por registro; documentos separados para Manual y PIE/PACI/PAEC.
- Anamnesis: siete secciones colapsables, autoguardado con control de versión y archivos por sección.
- Formularios: seleccionar varios archivos, asociar documentos anteriores, guardar y recargar.
- Cada documento: nombre compacto, vista previa de imagen o tarjeta Ver PDF, descarga.
- No existe el bloque general de adjuntos al final de Salud/Escolar.
- Auditoría e IA: ocultas por defecto; habilitación individual desde plataforma → Familias → Gestionar familia → Visibilidad de Auditoría e IA.
- Nombre visible del rol principal: Administrador de la familia; el identificador interno no cambia.
- Móvil: 320, 375 y 414 px; escritorio: 1280 px.

## Protección y compatibilidad

- Migración `0021_contextual_files_nutrition.sql` aditiva; conserva campos y archivos antiguos.
- Máximo 20 adjuntos distintos por lista; validación servidor de familia, niño y módulo.
- Las columnas antiguas de adjunto único siguen disponibles y visibles. Al editar, se incorporan a la lista sin borrar el original.
- Los documentos antiguos sin asociación NO se asignan automáticamente. Se seleccionan en “Asociar un archivo ya subido”.
- Retirar de un registro es desvincular; no elimina el documento original. La eliminación física rechaza archivos aún asociados a registros o anamnesis.
- Los accesos de lectura no pueden crear, editar, eliminar ni subir archivos.
- Los controles administrativos exigen sesión de plataforma, contraseña administrativa y motivo; se registran en auditoría.
- No se desactiva la recopilación de auditoría; solo su acceso familiar.
- La IA también requiere los permisos y controles familiares existentes: su casilla no los sustituye.

## Validación

```powershell
npm test
npm run build
$env:PW_BASE_URL='http://127.0.0.1:5181'
$env:PW_CONTEXTUAL_PREVIEW='1'
npx playwright test tests/browser/contextual-preview.spec.ts tests/browser/care-lists.spec.ts tests/browser/attachments.spec.ts tests/browser/vaccinations.spec.ts
```

Antes de publicar: aprobación visual del usuario, respaldo verificado, aplicación controlada de la migración aditiva y despliegue coordinado de API/interfaz. No publicar desde este documento sin autorización.
