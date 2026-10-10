# Vista previa para revisar cambios

La automatización está en `.github/workflows/preview.yml`. Al subir un commit de una rama `fix/**`, `feat/**` o `preview/**`, GitHub ejecuta `npm test`, compila el proyecto y publica la revisión en un proyecto independiente de Cloudflare Pages.

URL prevista y estable: `https://review.luspace-review.pages.dev`. Confirmar que el último workflow **Vista previa LuSpace** terminó correctamente antes de revisar: una ejecución fallida deja visible la revisión anterior. El resumen del workflow muestra el enlace. Todas las ramas de revisión comparten esta vista previa; el último despliegue completado es el visible.

Después de publicar, `scripts/verify-preview.mjs` comprueba el commit servido, la API de Functions, el bloqueo de registro público, la autenticación con la cuenta ficticia, las dosis SOS, la navegación a tratamientos y el ancho móvil mediante Chrome. Un fallo se muestra en el workflow aunque el despliegue ya haya terminado.

Cuenta exclusivamente ficticia:

- Correo: `familia@preview.luspace.test`
- Contraseña: `VistaPrevia!2026`

No introducir datos personales, médicos ni contraseñas reales. El sitio es una demostración pública con una cuenta compartida; sus registros pueden ser modificados por quienes tengan estas credenciales.

La compilación de revisión activa el aviso existente «Vista previa · Datos ficticios · Producción sin cambios». Esta variable se usa únicamente en el workflow de revisión.

## Aislamiento

El script `scripts/deploy-preview.mjs` usa únicamente el proyecto `luspace-review`, la rama de Pages `review` y la base D1 `luspace-review-db`. Nunca lee `wrangler.toml` para obtener los bindings de producción ni despliega desde main. La base debe ser nueva o estar marcada expresamente como sintética. Si detecta un recurso existente sin la marca esperada, aborta.

La configuración generada se guarda en `.private-wrangler/preview/` (ignorada por Git). No tiene credenciales de Mercado Pago, Google ni de IA, y desactiva pagos, registro público, IA y R2. No cambia la configuración del proyecto `luspace-app`, el dominio `luspace.cl` ni la base de usuarios reales. Los adjuntos de demostración, si se crean, permanecen en la D1 aislada.

El fixture inicial contiene una familia, un niño de demostración, dos tratamientos y tres dosis SOS ficticias. Se genera desde cero localmente y se importa una sola vez; los siguientes despliegues conservan los datos de prueba. No copia datos de ninguna base existente. La cuenta ficticia es administradora de su familia; no incluye credenciales de administración de plataforma.

## Flujo de revisión

1. Implementar y probar el cambio en una rama independiente.
2. Subir los commits de esa rama a GitHub y comprobar el workflow de vista previa.
3. Compartir el enlace y probar desde móvil o escritorio. Si la página estaba abierta, recargar para obtener la revisión actual.
4. Corregir lo necesario en la misma rama; el enlace se actualiza tras la siguiente ejecución correcta.
5. Integrar a main y publicar en producción únicamente después de la aprobación explícita del propietario.

El workflow de producción existente no se modifica y continúa ligado a main. Esta automatización estará disponible para nuevas ramas creadas desde una revisión que incluya estos archivos. GitHub Actions necesita el secreto existente `CLOUDFLARE_API_TOKEN` con permisos para administrar el proyecto Pages y D1 de prueba. Si hay varias cuentas Cloudflare accesibles, el script exige `CLOUDFLARE_ACCOUNT_ID` para evitar seleccionar una arbitrariamente.
