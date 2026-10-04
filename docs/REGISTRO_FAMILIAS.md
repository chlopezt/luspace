# Registro familiar en Cloudflare

`/registro` crea una familia independiente y su SuperAdmin familiar. No asigna administración de plataforma. Utiliza D1 para identidad, sesiones y registros; R2 privado para adjuntos mediante la API autorizada existente. No requiere Supabase.

El servidor asigna los IDs y crea familia, administrador, contraseña hash, configuración inicial, sesión y auditoría en un único `DB.batch()` transaccional. Los campos de rol, estado comercial y cuota enviados por el cliente se ignoran. La prueba dura exactamente 14 días desde el registro UTC; cuota de 52.428.800 bytes, sin excepción comercial. La migración 0012 existente inicia la fecha de prueba automáticamente; este cambio no necesita otra migración.

La contraseña exige 12–128 caracteres, letras y números, con confirmación. Se normaliza el correo a minúsculas y se impide su duplicación con la restricción SQL. El alta tiene control de origen, límite de diez intentos por IP cada quince minutos y cookie HttpOnly. Ante error SQL se revierte toda el alta. No hay contraseña predeterminada ni cobro automático.

El registro está habilitado después de la instalación inicial mediante `LUSPACE_REGISTRATION_ENABLED=true`. Para detener nuevas altas, establecerlo a `false` y desplegar: se cierran el endpoint y el enlace, conservando las cuentas existentes. La instalación inicial continúa protegida con SETUP_KEY; `/register` no puede reemplazarla.

La nueva familia inicia vacía; el flujo existente permite crear el primer perfil. El indicador de prueba y los bloqueos de vencimiento/cuota existentes se aplican al nuevo administrador. Los pagos y la verificación de correo no están integrados: antes de abrir el servicio de forma general, completar el envío/verificación de correo y protección contra registro automatizado (por ejemplo Cloudflare Turnstile). La recuperación actual continúa a cargo del administrador familiar o soporte autorizado.

Validación: `npm test` comprueba aislamiento entre familias, acceso a documentos, rol, cuota, prueba, registro cerrado, datos inválidos, duplicados simultáneos, rollback transaccional y rate limiting. `npm run build` valida el formulario de producción.
