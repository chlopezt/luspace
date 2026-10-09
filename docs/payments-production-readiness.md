# Mercado Pago: estado de preparación

Fecha: 8 de octubre de 2026. Esta implementación todavía no está publicada ni habilitada para contratar suscripciones reales.

## Configuración

- Aplicación real LuSpace: 3897124361346197; vendedor Chile: 146906297.
- Retorno: https://luspace.cl/login.
- Notificaciones: https://luspace.cl/api/billing/webhook.
- Importe previsto: CLP 5.938 mensual (pendiente de confirmación final del propietario).
- `LUSPACE_BILLING_LIVE_APPROVED=false` mantiene bloqueadas las nuevas contrataciones.
- `MP_ACCESS_TOKEN` se observó guardado como secreto cifrado en Cloudflare. No se leyó ni copió su contenido.
- `MP_WEBHOOK_SECRET` y `LUSPACE_BILLING_JOB_KEY` se observaron guardados en Cloudflare; la clave de conciliación también figura en GitHub Actions. No se leyeron sus valores; la coincidencia se comprobará ejecutando la tarea firmada.
- Pendiente: publicar con el bloqueo mantenido y verificar la cuenta real mediante una comprobación de solo lectura.

## Verificación local

Las pruebas generales y las diez pruebas de pagos pasan. Los casos de producción usan un proveedor simulado, no acreditan una transacción real. Las pruebas cubren aislamiento familiar, firmas, renovaciones, reembolsos, pagos manuales coexistentes y prevención de suscripciones duplicadas.

## Límites pendientes de resolver antes de habilitar ventas

- La búsqueda de cuotas pagina los resultados según Limit/Offset del SDK oficial, comprueba totales y rechaza páginas repetidas/incompletas. Un presupuesto limita el trabajo por ejecución; historias muy extensas requieren revisión, no se asumen completas.
- La conciliación periódica reintenta notificaciones fallidas de pagos, cuotas y suscripciones mediante recursos verificados del proveedor, sin confiar en el contenido inicial para conceder acceso.
- Confirmar el precio real, las comisiones aplicables y la configuración de alertas con el propietario.
- Ejecutar verificación real de vendedor, firma Webhook y tarea periódica tras el despliegue. Ninguna prueba del agente debe generar cobros o autorizar una suscripción real.

No se modificaron datos clínicos ni se contrataron servicios de infraestructura pagados.

