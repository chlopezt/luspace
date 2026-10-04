# Registro con Google y con correo

Ambas alternativas conservan D1, el aislamiento familiar y la prueba de 14 días / 50 MB. El acceso administrativo de plataforma no usa Google.

## Activación

1. En Google Cloud Console, crear o seleccionar un proyecto, sin habilitar facturación ni APIs de pago.
2. En Google Auth Platform configurar marca, audiencia externa y contacto. Pedir solo `openid`, `email`, `profile`, no acceso a Gmail, Drive ni historial clínico.
3. Crear cliente OAuth de tipo **Aplicación web**. Registrar exactamente la URI de redirección `https://luspace-app.pages.dev/api/auth/google/callback`.
4. En Cloudflare Pages → luspace-app → Settings → Variables and Secrets (producción), configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` como secreto, y `GOOGLE_REDIRECT_URI` con esa URI. No guardar secretos en repositorio ni enviarlos por chat.
5. Publicar de nuevo para aplicar las variables. En modo de prueba de Google, agregar los correos de prueba en la audiencia; publicar la audiencia para abrirlo a otras familias siguiendo las instrucciones de Google.
6. Probar registro, retorno, sesión y nuevo inicio de sesión en Chrome normal. No usar navegador embebido para autorización de Google.

En `/registro`, pulsar **Continuar con Google**, sin introducir contraseña. Nombre y familia son opcionales en ese flujo; si se completan, se conservan. En `/login`, el botón inicia sesión en una cuenta creada mediante Google o crea una nueva familia con 14 días y 50 MB si esa identidad no está registrada, el correo no pertenece a otra cuenta y el registro está habilitado. En ausencia de datos del formulario se toma el nombre de Google y `Familia de [nombre]`; puede editarse después. Correo/contraseña sigue funcionando independientemente.

## Seguridad y límites

Flujo de código en servidor con PKCE S256, estado aleatorio de diez minutos consumido una sola vez y cookie HttpOnly/SameSite=Lax vinculada al navegador. UserInfo se obtiene directamente de Google con el token intercambiado en servidor; exige correo verificado y usa `sub` como identidad estable. Tokens de Google no se guardan. No se transmite información clínica.

No se vinculan cuentas existentes automáticamente por coincidencia de correo. Quienes ya tengan cuenta con contraseña deben continuar con ella; la vinculación voluntaria autenticada se implementará por separado. Una cuenta creada con Google no tiene contraseña local inicialmente. El restablecimiento administrativo puede asignar una contraseña local, conservando el acceso Google.

La migración `0015_google_login.sql` solo añade tablas, sin alterar familias existentes. El botón Google permanece deshabilitado hasta que estén las tres variables; no se simula una integración activa.

Referencia: https://developers.google.com/identity/protocols/oauth2/web-server y https://developers.google.com/identity/openid-connect/openid-connect.
