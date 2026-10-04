# Adjuntos privados D1 → R2

## Separación de familias

Los registros y permisos permanecen en D1. El objeto usa una clave interna `familia_id/nino_id/archivo_id`, sin nombres del paciente ni del documento. El bucket `luspace-files` debe ser Estándar y privado, sin dominio público, sin `r2.dev` y sin URLs presignadas públicas.

Los adjuntos siguen pasando por `/api/files/:id`. Antes de acceder a R2, el servidor exige sesión vigente, consulta los metadatos con `id AND familia_id`, verifica perfil, módulo y permisos, y comprueba que la clave del objeto coincida exactamente con la familia y perfil de esos metadatos. Una ruta de carpeta no sustituye estos controles de autorización. La cuenta Cloudflare propietaria mantiene acceso de infraestructura; el rol de plataforma de LuSpace no obtiene lectura clínica.

## Copia y verificación

1. Aplicar migración `0014_r2_verified_files.sql`, sin borrar ni reescribir blobs existentes.
2. Vincular `FILES` al bucket y habilitar `LUSPACE_R2_ENABLED=true`.
3. En `/admin` → Almacenamiento → Copia segura, ejecutar el lote de hasta diez archivos.
4. Por cada archivo: reconstruir original D1, comprobar tamaño, calcular SHA-256, escribir en R2 y volver a leer la copia para verificar tamaño y digest.
5. Solo entonces actualizar su ubicación, SHA-256 y fecha de verificación. Mantener IDs y familia. No cambiar referencias de foto, credencial o consulta.
6. Conservar chunks originales y el BLOB heredado en D1. No hay endpoint de limpieza automática del respaldo en esta versión.

El proceso se puede reintentar: solo selecciona archivos cuyo puntero sigue en D1 y compara el puntero original al actualizar. Los detalles de la auditoría incluyen identificadores, bytes y verificación, no documentos ni contenido clínico. La interfaz de plataforma solo presenta progreso agregado. Solo la sesión administrativa independiente puede ejecutar la copia, con protección de origen y límite de diez solicitudes por quince minutos.

Una lectura de un archivo migrado primero verifica el contenido de R2; si falla y existe una copia D1 íntegra, usa ese original. Un adjunto nuevo en R2 no tiene copia D1 automática: no se devuelve contenido corrupto y una falla produce un error recuperable.

Las nuevas cargas se guardan en R2 cuando existe el binding y el flag. La verificación ocurre antes de crear sus metadatos. Si la inserción SQL falla por cuota, se intenta retirar el objeto nuevo. Si falta la configuración R2, las cargas conservan el método D1; la copia muestra estado pendiente, no un éxito ficticio.

## Eliminación explícita

Al eliminar un adjunto se verifican familia y permisos, se retira su objeto R2 y luego sus metadatos/chunks de D1, actualizando las cuotas existentes. El borrado explícito de una credencial RND retira sus adjuntos correspondientes. Esto no es la limpieza de respaldos tras migrar: es una eliminación pedida por el usuario en la aplicación.

R2 y D1 no comparten transacciones distribuidas. La validación evita recrear metadatos borrados durante una copia, y retira el objeto cuando detecta un registro ya eliminado. Una interrupción o carrera de operaciones puede dejar objetos huérfanos; conciliarlos requiere una revisión administrativa aparte, sin eliminar objetos a ciegas.

## Costos

Las cuotas de familia continúan activas. La app incorpora una reserva global de ocho mil millones de bytes lógicos de adjuntos vigentes, inferior a los 10 GB-mes incluidos de R2 Estándar. Esto **no es un bloqueo de facturación de Cloudflare**: otros buckets, objetos huérfanos y operaciones Clase A/B cuentan por separado. Configurar alertas de presupuesto de la cuenta y revisar consumo real antes de ampliar familias o cuotas. La copia inicial de los adjuntos existentes es un uso puntual; no se contrata Infrequent Access ni un plan Workers de pago.

El dashboard distingue D1 (metadatos) y R2. Su suma de adjuntos es lógica, no factura ni medición real de todo el bucket. Los originales retenidos siguen ocupando D1 hasta una limpieza posterior expresamente autorizada.

## Verificación

`npm test` incluye pruebas con R2 simulado: hash/tamaño, preservación de originales, cuotas, autorización de plataforma, aislamiento entre dos familias, rechazo de clave manipulada, fallback ante corrupción, carga nueva, eliminación individual y cascada RND.

Después del despliegue, comprobar el progreso en producción y una consulta autorizada de adjunto. No afirmar que la migración productiva está completa hasta que el estado remoto tenga `pending=0` y todos los archivos existentes estén verificados. No copiar datos clínicos a fixtures locales, GitHub o capturas de informes.
