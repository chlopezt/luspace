# LuSpace

Aplicación familiar de cuidado con autenticación, salud, crecimiento OMS, escolaridad, anamnesis con autoguardado, reportes PDF, credencial RND, documentos privados, invitados temporales, usuarios, auditoría y respaldo JSON.

## Ejecutar en esta computadora

Requiere **Node.js 24**. Desde la carpeta `luspace-app`:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abre **http://127.0.0.1:5173/**. El primer acceso crea la familia y la cuenta SuperAdmin; después registra el perfil del niño/a. La aplicación crea automáticamente la base SQLite y los archivos en `.local/`. Ese directorio es privado, está excluido de Git y nunca debe borrarse sin respaldo. No hay credenciales predeterminadas ni datos clínicos precargados.

## Estructura

```text
luspace-app/
  src/                 Interfaz, formularios, gráficos y exportación PDF
  shared/              Modelos y funciones compartidas
  server/api.js        API con autorización y validación
  server/security.js   Contraseñas, sesiones y hashes
  server/local.js      Adaptador SQLite + archivos para desarrollo
  functions/api/       Pages Functions para D1 + R2
  db/migrations/       Migraciones inicial y de seguridad
  db/schema.sql        Esquema inicial de referencia
  public/brand/        Logotipo recibido
  public/data/         Referencias oficiales OMS y procedencia
  scripts/             Importación OMS y recuperación local
  tests/               Pruebas de acceso, datos y navegador
  docs/                Arquitectura y guía de uso
  wrangler.toml        Configuración Cloudflare Pages, D1 y R2
```

## Comprobaciones

```powershell
npm.cmd run build
node --test tests/api.test.mjs
npx.cmd playwright test
```

Las pruebas de navegador usan Edge instalado y una base aislada en `../work/`; nunca tu base real. Para cambiar de navegador, ajusta `channel` en `playwright.config.ts`. La compilación estática está en `dist/`; `vite preview` solo sirve el frontend, por lo que para probar todo debes usar `npm run dev` o Wrangler Pages con bindings locales.

## GitHub

Crea un repositorio **privado** vacío llamado `luspace-app`. Ejecuta los siguientes comandos dentro de esta carpeta, reemplazando `TU_USUARIO`:

```powershell
git init
git add .
git commit -m "feat: plataforma LuSpace"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/luspace-app.git
git push -u origin main
```

No subas `.local/`, `.dev.vars`, claves, archivos clínicos ni respaldos. El ZIP de entrega solo contiene código y recursos de marca/referencia.

## Cloudflare D1 y R2

```powershell
npx.cmd wrangler login
npx.cmd wrangler d1 create luspace-db
npx.cmd wrangler r2 bucket create luspace-files
```

Copia el `database_id` devuelto a `wrangler.toml`. El bucket debe permanecer **privado**: no habilites `r2.dev` ni dominio público de documentos. Aplica las migraciones en una base nueva:

```powershell
npx.cmd wrangler d1 migrations apply luspace-db --remote
```

Las migraciones incluyen todas las tablas originales más sesiones, credenciales, rate limiting y metadatos de archivos. Si ya aplicaste manualmente el esquema de una versión anterior, no vuelvas a aplicar a ciegas las migraciones iniciales: respalda esa base y compara su historial antes de continuar.

## Publicar en Cloudflare Pages con GitHub

1. En Cloudflare abre **Workers & Pages → Create application → Pages → Connect to Git**.
2. Selecciona `luspace-app`, rama `main`, comando `npm run build`, salida `dist`, raíz del proyecto la carpeta que contiene `package.json`.
3. Configura Node.js 24 en las variables de compilación (`NODE_VERSION=24`).
4. Verifica bindings **DB → luspace-db** y **FILES → luspace-files**. Están declarados en `wrangler.toml`; Pages Functions los lee en el servidor.
5. Crea dos secretos distintos en la configuración de Pages: **SETUP_KEY** (clave de instalación) e **IP_SALT** (sal para las claves de límite de intentos). Usa valores aleatorios largos de un gestor de contraseñas. No deben empezar con `VITE_` ni incluirse en Git. No configures `LOCAL_DEV` en producción.
6. Despliega o vuelve a desplegar para aplicar secretos y bindings. Abre el sitio HTTPS y crea la cuenta inicial usando `SETUP_KEY`. El alta inicial queda bloqueada al existir la primera cuenta.
7. Comprueba crear, recargar y editar un registro, descargar un PDF, subir un adjunto, canjear un enlace en ventana privada y revocarlo. Los registros locales no se transfieren automáticamente a la nube.

La lógica del servidor ya está en `functions/api/[[path]].js`. No publiques únicamente `dist/` como un sitio sin Functions: perderías la API. Para revisión local del bundle Cloudflare:

```powershell
npx.cmd wrangler pages functions build --outdir .wrangler/functions-build
```

En entornos Windows restringidos donde el compilador nativo no pueda leer las carpetas superiores, se incluye una alternativa portable: `node scripts/check-cloudflare-wasm.cjs`. La verificación de esta entrega está en `docs/VALIDACION.md`.

Fuentes oficiales: [bindings Pages](https://developers.cloudflare.com/pages/functions/bindings/), [configuración Wrangler para Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [desarrollo local](https://developers.cloudflare.com/pages/functions/local-development/).

## Respaldo

**Familiar:** en Auditoría, descarga JSON. Incluye datos y metadatos de documentos; excluye contraseñas, sesiones y secretos. Descarga los adjuntos desde sus módulos si también los necesitas.

**Infraestructura:** exporta SQL (incluye credenciales cifradas como hash; protege este archivo) y conserva copia del bucket privado por separado:

```powershell
npx.cmd wrangler d1 export luspace-db --remote --output ./luspace-backup.sql
```

No guardes respaldos dentro del repositorio. Un respaldo de desarrollo requiere detener el servidor y copiar **toda** `.local/`, no solo el archivo SQLite mientras está en uso. La restauración automática del JSON familiar no está incluida.

## Recuperación local del SuperAdmin

Con el servidor detenido, ejecuta el script de recuperación en esta computadora. Pide correo y contraseña por entrada privada; solo modifica `.local` y cierra todas las sesiones del usuario.

```powershell
node scripts/reset-local-password.mjs
```

En producción, solicita recuperación a otro SuperAdmin. Si no existe, el responsable de la cuenta Cloudflare debe realizar una recuperación controlada en D1; no hay una puerta de acceso pública ni restablecimiento por correo sin un proveedor configurado.

## Referencias OMS

Se incluyen tablas oficiales para ambos sexos: peso de 0 a 120 meses y talla de 0 a 228 meses. El valor se aproxima al mes más cercano. Las fuentes y metodología están en `docs/ARQUITECTURA.md` y `public/data/who-sources.json`. Para regenerarlas:

```powershell
node scripts/import-who.mjs
```

Consulta `docs/GUIA_DE_USO.md` para los flujos familiares. El despliegue en una cuenta Cloudflare/GitHub todavía requiere tus credenciales y recursos; el proyecto local no los crea ni publica automáticamente.
