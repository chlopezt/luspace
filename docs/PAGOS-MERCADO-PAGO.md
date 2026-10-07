# Pagos automáticos: implementación por etapas

## Estado actual (7 de octubre de 2026)

- Aplicación LuSpace creada en Mercado Pago, solución Suscripciones.
- Activación de credenciales de prueba confirmada por el panel.
- Base local: migración aditiva 0022, verificación HMAC-SHA256, separación test/producción,
  identificación opaca de la suscripción por familia y rechazo de duplicados.
- NO se han aplicado estas tablas a producción ni habilitado cobros.
- Implementados localmente: checkout pendiente, continuación de solicitud sin duplicados,
  receptor firmado con bandeja durable, conciliación mediante API, renovación por período
  de factura, cancelación, historial familiar y resumen de plataforma.
- Producción bloqueada explícitamente en esta etapa, incluso con credenciales reales.
- Rama remota `payments-preview` y proyecto independiente `luspace-payments-preview`.
  Base exclusiva `luspace-payments-preview-db`, sin copias de datos familiares, R2 ni IA.
  El despliegue principal quedó fijado a su UUID original para no confundir las bases.
  El preview requiere secretos propios; no hereda las credenciales de producción.
- Vendedor ficticio verificado por ID de la ficha: `3745839756`.
  Aplicación de pruebas de ese vendedor: `3968959036503963` (Suscripciones).
  Access Token y firma webhook guardados como secretos en el dashboard del preview.
  Valores no leídos. El titular reportó copiar las claves de la aplicación ficticia.
  Pendientes: validar token por API, inicializar cuenta LuSpace ficticia con SETUP_KEY,
  confirmar correo del comprador ficticio y volver a desplegar para aplicar los secretos.
- Validación local: proveedor ficticio en tests; esto NO demuestra funcionamiento end-to-end
  con Mercado Pago. Falta configurar claves del vendedor ficticio y validar sus respuestas reales.
- El receptor responde error si no pudo conciliar, para solicitar reintento del proveedor;
  conserva el evento en D1. Hay conciliación manual en el modal. Falta un proceso programado
  de conciliación/reintento antes de considerar lista la operación productiva.

## Próximos pasos

1. Preparar vendedor y comprador ficticios de Chile según la documentación específica de
   Suscripciones. Confirmar que la credencial corresponde al vendedor ficticio; no basta
   inferir el entorno a partir del prefijo del token.
2. Configurar secretos en el servidor de un preview aislado: MP_ACCESS_TOKEN y
   MP_WEBHOOK_SECRET. Nunca en VITE_*, GitHub público, documentos o chat.
3. Configurar vendedor esperado, monto final CLP y URL fija de retorno. El precio anunciado
   es $4.990 + IVA; confirmar total y redondeo antes de crear cobros. El monto 5938 de los
   tests es ficticio, NO una configuración de precio productivo ni asesoría tributaria.
4. Implementar checkout autenticado solo para Administrador de la familia. Crear referencia
   opaca en servidor, bloquear duplicados/concurrencia y no aceptar familia ni monto del cliente.
   POST /preapproval con status pending y URL init_point verificada del proveedor.
5. Receptor de notificaciones: firma válida, tamaño limitado, persistir antes de responder,
   cola durable, reintentos, deduplicación y lectura posterior de la API autenticada.
   Nunca activar por query de retorno, cuerpo de webhook ni autorización de tarjeta solamente.
6. Registrar pago aprobado y período cubierto en transacción. Vincular referencia, vendedor,
   moneda, importe y suscripción. No extender dos veces por eventos repetidos; no hacer
   retroceder el estado por eventos antiguos. Conciliación programada para notificaciones perdidas.
7. Cancelación, reembolsos, mora y fin de período: conservar consulta/descarga de información.
   Respetar excepciones manuales existentes. Datos clínicos y tarjetas NO se envían a la pasarela.
8. Historial familiar y dashboard administrativo, validación sandbox integral, aprobación explícita
   del titular antes de activar producción. Emisión tributaria requiere revisión independiente;
   un comprobante de pasarela no sustituye automáticamente una boleta.

## Configuración del preview aislado (NO usar la base de datos de producción)

Variables del servidor, nunca VITE_*:

- LUSPACE_BILLING_MODE=test
- LUSPACE_BILLING_ISOLATED=true (preview remoto con D1 independiente; no necesario en LOCAL_DEV)
- LUSPACE_BILLING_AMOUNT_CLP: monto de simulación entero, pendiente precio final aprobado.
- MP_TEST_SELLER_ID: ID de vendedor ficticio chileno; se comprueba contra /users/me y test_user.
- MP_TEST_BUYER_ID y MP_TEST_BUYER_USERNAME: identificadores de la cuenta ficticia compradora. Se consulta /users/{id} y se comprueban ID, sitio MLC, marca test_user y usuario antes de aceptar su correo. Nunca se deduce un correo a partir del ID.
- MP_TEST_BUYER_EMAIL: correo de la cuenta ficticia compradora cuando la consulta pública omite ese dato; no el correo de la familia. Admite testuserNUMERO@testuser.com y test_user_NUMERO@testuser.com. La tabla de cuentas de prueba no muestra el correo; no solicitar contraseñas ni códigos en el chat.
- MP_BILLING_BACK_URL: URL fija del preview + /login, sin query ni fragmentos.
- MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET: secretos privados del entorno de pruebas.

Callback: POST https://DOMINIO-PREVIEW/api/billing/webhook. Temas: subscription_preapproval,
subscription_authorized_payment y payment. La firma y live_mode de cada tópico deben validarse
con notificaciones reales de prueba. No rebajar estas protecciones para hacer pasar una prueba.

Solo un Administrador de la familia puede crear, conciliar o cancelar una suscripción. El servidor
deriva familia y monto; rechaza llamadas del Editor/Invitado. La vuelta del checkout NO activa
la cuenta: se requiere confirmar el pago mediante la API. No se guardan tarjetas ni datos clínicos.

Validación de UI: tests/browser/billing.spec.ts intercepta solo respuestas de pagos ficticias;
las capturas son de demostración de interfaz, no pruebas de un cargo del proveedor.

## Fuentes primarias

- https://www.mercadopago.cl/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments
- https://www.mercadopago.cl/developers/es/docs/your-integrations/test/accounts
- https://www.mercadopago.cl/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
- https://github.com/mercadopago/openapi/blob/main/schemas/webhooks.yaml

Las utilidades verifican todos los componentes de la firma y una tolerancia de 5 minutos.
Validar el formato y reintentos reales del tópico de Suscripciones antes de conectar el receptor.
