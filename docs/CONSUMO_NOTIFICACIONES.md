# Consumo y notificaciones de plataforma

En `/admin`, «Consumo y alertas» muestra exclusivamente datos operativos. La
campana informa nuevas familias de los últimos 30 días, pruebas que vencen en
3 días, cuotas familiares/globales desde 70 %, reservas pendientes y límite
diario de IA. Hasta 100 avisos, leídos por administrador, no compartidos.
Actualización al abrir, manual y cada 2 minutos con la página visible. Sin
correos, push del navegador ni servicios de pago. No es vigilancia en segundo
plano cuando la página está cerrada.

API exclusiva de sesión administrativa independiente:

- `GET /api/platform/consumption`
- `GET /api/platform/notifications`
- `POST /api/platform/notifications/read` con `keys` de avisos vigentes

El consumo se calcula desde los metadatos D1; no es la facturación Cloudflare.
No se muestran pacientes, diagnósticos ni nombres de documentos. R2 Standard
incluye una referencia de 10 GB-mes: https://developers.cloudflare.com/r2/pricing/
El límite interno es 8.000.000.000 bytes para archivos + reservas, contando todas
las familias, también exentas. Alertas a 70/85/95 %, bloqueo al superar el límite.
Una subida que no cabe se rechaza aunque el porcentaje actual sea menor a 100.

Migración `0016_consumption_notifications.sql`: reserva atómica antes de escribir
en R2; liberación y alta de metadatos en la misma transacción. Un fallo limpia el
objeto antes de liberar espacio. Si no se puede confirmar la eliminación, la
reserva permanece para revisión técnica. No caduca ni se elimina sola. Las
operaciones simultáneas no pueden sobrepasar el límite mediante esta API. No
incluye objetos externos, huérfanos sin reserva, otros buckets ni operaciones.

D1: tope interno de 200.000.000 bytes para contenido de adjuntos; los originales
migrados siguen conservados. El contador no mide el tamaño físico total de D1,
registros o índices. El trigger protege las nuevas inserciones de chunks. La
migración no elimina ni modifica documentos existentes. La IA conserva el
límite interno de 10 solicitudes al día UTC; no se presenta como neuronas.

Sin permisos adicionales de analítica, consumo real de cuenta, operaciones
R2 A/B, filas D1, peticiones Workers y neuronas AI figuran «No disponible».
No garantiza cero cargos: revisar la cuenta Cloudflare y usos fuera de LuSpace.
No se activan planes ni credenciales nuevas. El respaldo/restauración es la
siguiente etapa y no forma parte de este cambio.
