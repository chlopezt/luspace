# Segundo factor del administrador de plataforma

Activación voluntaria en `/admin#account-security`. No altera cuentas familiares.

1. Ingresar con correo y contraseña administrativos.
2. Abrir Seguridad de mi cuenta, escribir la contraseña y configurar 2FA.
3. Escanear el QR con una aplicación autenticadora o ingresar la clave manual.
4. Confirmar un código de seis dígitos; la configuración caduca en diez minutos.
5. Guardar fuera de LuSpace los diez códigos de recuperación. Se muestran una sola vez.

El QR se genera localmente; no se usan servicios de QR, SMS ni API de pago.
TOTP sigue RFC 6238, HMAC-SHA-1, seis dígitos y períodos de treinta segundos, con tolerancia de un período de reloj. Se impide reutilizar un paso ya aceptado.

La semilla se cifra con AES-256-GCM y datos adicionales ligados al ID administrativo. La clave de cifrado se deriva de la contraseña administrativa con PBKDF2-SHA-256, sal aleatoria y cien mil iteraciones; la contraseña no se persiste en texto plano. Esto protege las semillas almacenadas sin introducir una clave compartida en el código fuente. Mantener una contraseña administrativa fuerte y única es indispensable.

No cambiar directamente el hash administrativo en D1: si en el futuro se añade cambio de contraseña, debe volver a cifrar la semilla con la nueva contraseña dentro del mismo proceso validado. La credencial familiar es independiente.

Los códigos de recuperación tienen 96 bits aleatorios y se almacenan como hashes ligados al administrador. Cada uno requiere también contraseña y se consume una sola vez. No existe omisión pública del segundo factor. Si se pierde el teléfono y todos los códigos, la recuperación requiere intervención verificada del titular de infraestructura, no un registro nuevo ni una API pública.

Activar/desactivar cierra otras sesiones administrativas. Una sesión anterior sin segundo factor no pasa la autorización cuando 2FA está activo. Las modificaciones administrativas requieren una verificación reciente de quince minutos; usar Seguridad de mi cuenta para renovarla. Leer los paneles sigue disponible mientras la sesión sea válida.

La desactivación exige contraseña más código TOTP nuevo o código de recuperación. La auditoría registra activación, desactivación, verificaciones e intentos de login 2FA rechazados, nunca semillas, URI, QR ni códigos.

D1 y su respaldo cifrado conservan la semilla cifrada y los hashes de recuperación. El proceso existente de restauración elimina sesiones, obligando a volver a autenticar. Guardar códigos de recuperación en un gestor de contraseñas o lugar seguro independiente.
