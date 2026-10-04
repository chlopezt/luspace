# Acceso administrativo independiente

- `/login`: portal familiar existente.
- `/admin/login`: login administrativo independiente.
- `/admin`: panel de plataforma con menú propio.

Aplicar la migración `db/migrations/0011_platform_login.sql` antes de desplegar el backend. No se crean contraseñas predeterminadas.

Primera activación: con la sesión familiar del propietario autorizado abierta, entrar a `/admin/login`, seleccionar «Configurar mi acceso administrativo», indicar el correo administrativo, verificar la contraseña familiar actual y crear otra contraseña de al menos 12 caracteres. Este formulario solo está disponible para un administrador de plataforma previamente asignado; no existe registro administrativo público. El correo puede ser distinto al familiar.

Las credenciales se almacenan con PBKDF2; las sesiones administrativas duran una hora, usan tokens aleatorios almacenados como hash y cookie HttpOnly independiente, limitada a `/api/platform`. Las cookies familiares no autorizan métricas de plataforma y las administrativas no autorizan endpoints familiares. La desactivación del administrador o de su usuario revoca el acceso en cada petición.

La identidad administrativa continúa vinculada al usuario propietario para revocación y auditoría, pero sus credenciales y sesiones son independientes. No se ha añadido recuperación automática ni MFA: planificar recuperación controlada y MFA antes de abrir el servicio comercialmente. El panel conserva únicamente métricas administrativas y no permite acceso clínico entre familias.

Verificación local: `npm test` y `npm run build`.
