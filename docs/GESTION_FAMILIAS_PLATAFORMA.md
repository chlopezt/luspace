# Gestión manual de familias

En `/admin`, abre **Familias → Gestión manual de familias → Gestionar parámetros y accesos**. Esta vista no abre documentos, diagnósticos ni perfiles de pacientes.

## Parámetros

- Nombre de la familia, estado comercial, fin de prueba y cuota de adjuntos (1 MiB–10 GiB).
- Excepción comercial: prevalece sobre vencimiento y cuota. No implica pago ni crea una suscripción facturada.
- Módulos: Perfil, Salud, Escolar, Anamnesis y Credencial RND.
- Funciones: preparación con IA, carga de adjuntos y generación del informe PDF.

Desactivar no borra datos. Reducir la cuota bloquea nuevas cargas que excedan el límite, sin borrar archivos existentes. Los controles de plataforma son independientes de la configuración familiar: el administrador familiar no puede reactivarlos. El backend consulta los controles en cada petición. La interfaz familiar los refleja al recargar/iniciar sesión.

## Cuentas

Restablecer contraseña familiar (12–128 caracteres), activar/desactivar o cerrar sesiones. Restablecer y desactivar revocan las sesiones existentes. Entrega la contraseña por un canal privado y pide al destinatario que la cambie desde su cuenta; no se envía correo automáticamente.

No se puede desactivar el último SuperAdmin activo. Las cuentas que administran la plataforma están protegidas frente a estas acciones de soporte, incluida la cuenta propia. Su contraseña administrativa no cambia al modificar una contraseña familiar.

Cada modificación exige motivo (5–500 caracteres) y verificación de la contraseña administrativa. Hay límite de diez intentos de cambio por administrador en quince minutos. Auditoría registra familia, usuario objetivo, cambios y motivo, nunca contraseñas.

## API

- `GET /api/platform/families/:familyId`: proyección administrativa y cuentas.
- `PUT /api/platform/families/:familyId`: configuración operacional.
- `POST /api/platform/families/:familyId/users/:userId/reset-password`
- `POST /api/platform/families/:familyId/users/:userId/active`
- `POST /api/platform/families/:familyId/users/:userId/close-sessions`

Solo acepta una sesión administrativa independiente vigente. No acepta sesiones familiares ni de invitados. CSRF y comprobación de origen permanecen activos. Los usuarios objetivo deben pertenecer a la familia indicada.

La migración `0013_platform_family_controls.sql` añade únicamente una tabla de configuración. No cambia permisos, pruebas ni cuentas existentes hasta que se guarden cambios explícitos. Cloudflare debe aplicar esta migración antes de desplegar el backend actualizado.

Validación: `npm test` y `npm run build`; la prueba de navegador usa una base local aislada, nunca datos de producción.
