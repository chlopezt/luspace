# Términos, privacidad y registro — 08/10/2026

Versión inicial `2026-10-08-v1`. Responsable confirmado por el titular: Christian López. Contacto solicitado: `contacto@luspace.cl`; el titular informó que aún no recibe mensajes. Se muestra este límite en las páginas. No afirmar que las solicitudes se están recibiendo ni que existe cumplimiento legal certificado.

Rutas públicas `/terminos` y `/privacidad`; enlaces en la landing y el registro, accesibles sin sesión. Dos casillas inicialmente desmarcadas: aceptación contractual/privacidad y declaración separada de mayoría de edad, representación/autorización y tratamiento de datos sensibles para el cuidado. Esta declaración no comprueba ni reemplaza la legitimación específica para cada niño/a; revisar ese flujo con asesoría legal.

El servidor rechaza registros públicos por correo o Google sin valores booleanos `true` y la versión vigente. Google guarda la versión en el estado temporal protegido por cookie, PKCE, caducidad y consumo único. Una identidad nueva que entra desde Login se remite a Registro sin crear familia, cuenta o sesión. Las cuentas Google existentes conservan su login normal. No se vinculan identidades por correo automáticamente.

La aceptación se inserta en `consentimientos_registro` en la misma transacción que familia, cuenta y sesión: usuario, familia, fecha del servidor, versión, canal y declaración de autorización. Un trigger impide atribuirla a otra familia. No guardar contraseñas, OTP ni documentos de identidad en esta tabla. No se inventan aceptaciones de usuarios existentes; tampoco se bloquea su login ni se cambia el bootstrap privado de instalación.

La migración 0027 es aditiva. Los respaldos cifrados incluyen la nueva tabla; las pruebas verifican restauración y su vínculo familiar. Mantener `shared/legal-content-v1.js` histórico e inmutable tras activación; al modificar textos crear versión y archivo nuevos, no reutilizar una aceptación antigua para finalidades nuevas.

## Pendientes indispensables

- Habilitar y probar recepción de `contacto@luspace.cl`; definir canal seguro para solicitudes, verificación de identidad y seguimiento.
- Revisión legal del nombre/identificación del proveedor, información comercial, representación de menores, consentimiento, transferencias internacionales, contratos con encargados, conservación/eliminación y respuesta a incidentes.
- Revisar el flujo por niño/a y miembros invitados; la aceptación del administrador al registrar una familia no autoriza por sí sola cualquier tratamiento posterior.
- Revisar preparación para Ley 21.719, cuya vigencia comienza el 1 de diciembre de 2026. No confundirla con las disposiciones vigentes de Ley 19.628.
- No prometer eliminación/restauración completa remota ni canales que aún no están operativos; documentar procedimientos efectivos.

Fuentes de referencia (no sustituyen revisión profesional):
- https://www.bcn.cl/leychile/navegar?idNorma=141599&idVersion=2023-05-09
- https://www.bcn.cl/leychile/navegar?idNorma=1209272
