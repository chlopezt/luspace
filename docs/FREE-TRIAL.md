# Etapa comercial: prueba de 14 días

Migración D1: `0012_family_subscription.sql`. Las familias existentes quedan `active` y `commercial_exempt=1`; esto es una excepción de continuidad, no un plan público gratuito. Las nuevas familias reciben 14 días desde `created_at`, cuota de 52.428.800 bytes y estado `trial`. No hay pagos ni altas públicas multifamiliares habilitados todavía.

El servidor expira la prueba al recibir peticiones, incluso sin tareas programadas. `past_due`, `canceled` y `expired` bloquean POST/PUT/PATCH de contenido familiar, nuevas invitaciones y preparación de consultas. Se conservan lectura, exportación, gestión de seguridad y eliminación para liberar espacio. Las fechas usan UTC; la UI calcula días redondeando hacia arriba y revisa el estado cada minuto y al recuperar foco.

La cuota se controla por metadatos de `archivos`. Actualmente las subidas se almacenan como chunks en D1, no en R2; no presentar este contador como facturación real de R2. Los triggers de SQLite reservan espacio al insertar y descuentan al eliminar, incluyendo eliminación en cascada de adjuntos RND. Si dos subidas compiten, la transacción que supera el límite se revierte. Una futura migración a R2 necesitará reserva transaccional previa, confirmación y recuperación de objetos huérfanos.

Imágenes: máximo 1920 px, JPEG de hasta 300.000 bytes; se intenta reducir calidad y tamaño progresivamente. Los PDF no se convierten ni se comprimen. Se debe comprobar que los textos de exámenes/credenciales sigan legibles en la vista previa. Si no es posible comprimir, se informa y no se guarda un archivo parcial. El servidor también rechaza imágenes grandes para familias no exentas.

El botón Activar suscripción es informativo: no cobra ni concede estado activo. No existe un endpoint público de autoactivación. Antes de abrir nuevos registros: configurar contratación, precios, vencimiento/retención, condiciones de privacidad, avisos y webhooks verificados. No introducir credenciales de pago en el frontend.

Validación: `npm test` incluye pruebas de migración, excepción legacy, expiración, cuota, rollback y liberación de espacio. `npm run build` valida TypeScript y producción.
