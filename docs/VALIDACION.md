# Validación de esta entrega

Fecha: 2 de octubre de 2026.

- Compilación de producción: TypeScript y Vite, sin errores.
- Pages Functions: Worker compilado con Wrangler 4.146.0 y esbuild WASM, 49 KB aproximadamente. En este entorno restringido Windows el compilador nativo no puede recorrer carpetas superiores; `node scripts/check-cloudflare-wasm.cjs` usa el compilador portable para la misma entrada de Wrangler.
- API: prueba de autenticación, origen de solicitudes, aislamiento familiar, CRUD, validación numérica, permisos de editor, conflicto de anamnesis, archivos, PIN, canje simultáneo de uso único, revocación de sesión, respaldo y auditoría.
- Navegador Edge: alta inicial, perfil, medición, persistencia tras recargar, trayectoria escolar, anamnesis con autoguardado, PDF, móvil de 390 px, escritorio, temas, tratamientos, consulta, bitácora, RND con archivo, invitado con PIN, permisos y revocación, respaldo JSON.
- PDF: páginas renderizadas e inspeccionadas; márgenes y títulos legibles, logo, pie privado y numeración. Comprobación de coordenadas del texto dentro de las páginas.
- Referencias OMS: 121 filas por sexo para peso (0–120 meses) y 229 por sexo para talla (0–228 meses); sin meses ausentes. Archivos y fuentes registrados.
- Dependencias: `npm audit` sin vulnerabilidades conocidas en el momento de la revisión. Esto no sustituye una auditoría de la aplicación.

Las pruebas usan una familia ficticia aislada en `../work/`. La instalación real en `.local/` no fue poblada con datos de prueba. La publicación real, entrega de cookies HTTPS, disponibilidad R2/D1 y límites del plan Cloudflare deben comprobarse después de conectar la cuenta del propietario. No se crearon recursos externos ni se publicó un repositorio.
