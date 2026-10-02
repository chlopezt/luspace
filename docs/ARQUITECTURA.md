# Arquitectura de LuSpace

## Aplicación

React + TypeScript + Vite. Tailwind define los colores de marca; CSS compartido conserva el diseño aprobado. Radix Dialog gestiona foco, escape, lectura accesible y bloqueo del fondo en modales. Recharts presenta los datos reales y las referencias OMS. React PDF genera documentos en el navegador mediante carga diferida.

## Persistencia y ejecución

`server/api.js` es la API común. En desarrollo, `server/local.js` adapta `node:sqlite` y archivos locales a las interfaces D1/R2. En Cloudflare, `functions/api/[[path]].js` ejecuta la misma API con los bindings `DB` y `FILES`. El navegador solo almacena la preferencia de tema; los datos clínicos permanecen en la base de datos.

Cada usuario pertenece a una familia. Los niños tienen `familia_id`; todos los accesos a sus entidades primero verifican ese vínculo en servidor. SuperAdmin significa administrador de su propia familia, no acceso a otras familias. El esquema permite múltiples familias; el alta comercial/autoservicio de nuevas familias no está habilitada. La instalación crea una sola familia inicial.

## Autenticación y permisos

Las sesiones son tokens aleatorios de 256 bits. Solo se guarda SHA-256 del token, con caducidad de 8 horas para usuarios y hasta 1 hora para una sesión de invitado (sin superar la caducidad del enlace). Se envían en cookie HttpOnly, SameSite=Strict y Secure en HTTPS. Cada solicitud vuelve a comprobar usuario activo o enlace activo y no vencido. No se usan permisos ni identificadores de familia enviados por el navegador como autoridad.

Contraseñas y PIN: PBKDF2-SHA256 con 100.000 iteraciones, sal aleatoria y comparación constante. Las APIs limitan intentos por IP y por cuenta/enlace. Se comprueba Origin en todas las mutaciones. El servidor no registra contraseñas, tokens crudos, PIN ni contenido clínico en los mensajes de auditoría.

Los enlaces usan `/invitado#token` para que el secreto no llegue al historial de solicitudes HTTP ni al Referer. También se admite la ruta `/invitado/token`, pero no se genera por esa razón. El canje de un enlace de un solo uso incrementa el contador mediante una actualización SQL condicional, evitando un segundo canje simultáneo. Las consultas posteriores ocurren en una sesión de lectura. Revocar elimina las sesiones y cada petición comprueba la revocación.

## Documentos

Los objetos se almacenan bajo claves `familia/niño/id`, con metadata de propietario y módulo en D1. No se publican URLs de R2. Las descargas pasan por la API autorizada. Solo se reciben PDF, PNG y JPEG de hasta 10 MB y se verifica su firma binaria. La vista de archivo usa CSP sandbox y no-store. Un archivo retirado de un formulario sigue disponible en Documentos adjuntos hasta eliminarlo explícitamente.

## Anamnesis

JSON estructurado con siete secciones. Autoguardado después de una pausa al escribir, reintento explícito y advertencia al salir si hay cambios pendientes. Un número de versión evita que dos cuidadores sobrescriban silenciosamente sus cambios. Un conflicto conserva el texto en pantalla para poder copiarlo y comparar.

## Crecimiento

`public/data/who.json` contiene L, M y S mensuales oficiales, separados por sexo de referencia. `who-sources.json` registra URLs, número de filas y fecha de importación. `scripts/import-who.mjs` regenera los datos y comprueba todos los meses. Se usa OMS 2006 entre 0 y 60 meses y OMS 2007 después. Peso hasta 120 meses; talla hasta 228 meses. No se extrapolan referencias fuera de esos intervalos. Los percentiles son aproximados al mes más cercano y no clasifican al niño como “normal” o “anormal”. La medición de talla requiere longitud acostado antes de 2 años y altura de pie después.

## Auditoría y respaldos

Eventos familiares filtrables y paginados: altas, modificaciones, eliminaciones, acceso, exportación y revocación. La dirección IP informada por Cloudflare se guarda en el registro y solo se muestra a SuperAdmin. El límite de intentos usa una clave derivada con hash y sal configurable. JSON exporta los datos de la familia, auditoría y metadatos de archivos, sin contraseñas, sesiones ni tokens secretos. Para respaldo de infraestructura completo, exportar SQL y objetos R2 por separado; el JSON familiar no es un archivo de restauración automática.

## Alcance de publicación

El proyecto contiene la implementación de los módulos solicitados. Configurar la cuenta Cloudflare, secretos, bindings y repositorio es un paso de infraestructura separado. Las pruebas locales no equivalen a una auditoría de seguridad independiente. Los costos y límites dependen del uso y de los planes vigentes de Cloudflare.
