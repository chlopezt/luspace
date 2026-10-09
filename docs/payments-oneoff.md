# Pago único y ventana de pago

La familia elige entre un mes sin renovación (Checkout Pro, preferencia) y renovación mensual (preapproval existente). Ambos importes son los definidos por el servidor; no se aceptan precios del navegador. No hay solicitudes de cobro en la conciliación automática.

## Seguridad y convivencia

- Solo el Administrador de la familia puede iniciar un checkout. Mantener CSRF, autenticación y limitación de solicitudes.
- Una orden contiene referencia opaca, familia y entorno propios. El proveedor recibe el producto y la referencia, no antecedentes clínicos.
- Confirmar pago por API autenticada, no por parámetros del retorno. Verificar vendedor, entorno, importe, moneda, referencia, preferencia, orden comercial y pertenencia del pago. Notificaciones con HMAC y bandeja duradera existente.
- Las tablas nuevas son aditivas; no modificar adjuntos, datos clínicos, suscripciones ni transferencias existentes.
- La aprobación concede un mes calendario con ajuste a fin de mes; conserva días de prueba y períodos manuales/automáticos ya pagados. Reembolsos y contracargos retiran solamente el acceso de ese pago.
- No crear un pago único con renovación pendiente, autorizada o pausada. Cancelar primero la renovación; el período confirmado se conserva.
- No iniciar otra compra ni una renovación mientras hay un pago único pendiente o vigente. Al terminar ese período se puede elegir otra modalidad. Reservas cruzadas se controlan en el INSERT, no solo mediante consultas previas.
- Repetir el botón devuelve la misma preferencia. Una respuesta incierta jamás genera automáticamente una segunda orden. Sin preferencia confirmada se requiere revisión del operador; no eliminar la reserva a ciegas.
- Una preferencia abandonada expira a los cinco días. Liberarla únicamente después de verificar expiración en el proveedor y ausencia de pagos aprobados/en proceso/pendientes. No liberar por reloj local solamente.
- Segundo pago aprobado sobre una misma orden: fallo explícito y alerta de conciliación, no un segundo mes silencioso. Revisión del operador y eventual reembolso realizado por el titular.
- La conciliación horaria revisa dos órdenes, cuatro contratos y cuatro avisos como máximo, dentro del presupuesto existente de 40 consultas. Dimensionar frecuencia y límites antes de un volumen alto; no marcar éxito ante historial incompleto.

## Verificación

`npm run test:billing`: proveedor simulado, sin pagos reales. Cubre pago único, recurrencia, firma, cuotas, reintegros, idempotencia, vencimiento, roles, aislamiento entre familias y transferencias. `npm test`: regresiones generales. `npm run build`: compilación de interfaz.

La primera compra real de Checkout Pro y su retorno requieren ejecución voluntaria del titular. El agente no confirma pagos ni acepta una suscripción real durante las pruebas.
