# Protección de datos y recuperación

## Qué implementa esta versión
- GitHub Actions programa un respaldo diario (07:23 UTC, aproximadamente 04:23 en Chile durante UTC-3), con ejecución manual desde `Respaldar LuSpace`. El horario puede retrasarse; no es una garantía de disponibilidad ni un SLA.
- Exportación SQL completa de la D1 **luspace-db** identificada explícitamente por UUID. Nunca selecciona la primera base de la cuenta.
- SQL comprimido, adjuntos D1/R2 y manifiesto cifrados con AES-256-GCM. Nonce aleatorio por objeto, autenticación de nombre y verificación SHA-256; manifiesto publicado al final.
- Bucket separado **luspace-backups**, privado por defecto, sin binding en la aplicación y sin dominio público. Una copia incompleta no figura como respaldo verificado.
- Se comparan bytes y huellas, tablas y filas, integridad SQLite, claves foráneas y propiedad familiar de cada adjunto.
- Cada copia se reconstruye en memoria antes de subir y se vuelve a leer desde R2 para otro ensayo. Las sesiones familiares/administrativas se eliminan y los enlaces invitados se desactivan solo en esa copia de ensayo, nunca en producción.
- Objetos R2 sin referencia se conservan como cuarentena cifrada; no se reasocian a perfiles ni se publican.
- Retención objetivo: 7 días. Solo se retiran copias del prefijo administrado que superaron ese plazo, después de completar y verificar una copia nueva; se conservan la nueva y al menos una previa. Los originales no se borran. Si falla la limpieza, se conservan las copias y se avisa.
- Copia independiente del proveedor: artifact de GitHub con **solo archivos cifrados**, retención de 1 día. Requiere guardar la clave de recuperación fuera de GitHub y de Cloudflare. Aunque el repositorio sea público, no se publica SQL ni manifiesto clínico sin cifrar.
- Panel de plataforma `Respaldos y recuperación` y campana: último respaldo verificado, archivos comprobados, ensayo, estado independiente y fallos. Sin visibilidad de contenido clínico.
- Alertas cuando no hay respaldo verificado en 36 horas. El objetivo de pérdida máxima es aproximadamente 24 horas **solo cuando se cumplen las ejecuciones**. Si fallan, la pérdida potencial aumenta y debe investigarse. El tiempo de recuperación real no está garantizado: medirlo con un ensayo operativo antes de ampliar el servicio.

## Configuración necesaria
1. Guardar una clave aleatoria de 32 bytes (64 caracteres hexadecimales) en GitHub Secrets como `LUSPACE_BACKUP_KEY`.
2. Conservar la misma clave en un gestor de contraseñas y una copia segura separada. Perderla impide descifrar las copias. Cambiarla sin preservar la anterior impide recuperar respaldos antiguos y detiene su limpieza automática.
3. El token `CLOUDFLARE_API_TOKEN` necesita exportación y consultas de D1, lista de buckets y lectura/escritura de objetos R2. Esos permisos no se amplían automáticamente. Un rechazo se muestra como fallo.
4. Ejecutar el workflow y verificar éxito de la copia R2, del ensayo y del artifact independiente. Tener código o un cron no equivale a un respaldo real comprobado.

## Controles de costo
- Máximo 100 MB cifrados por copia, 1 GB en el bucket de respaldos y umbral preventivo de 8 GB sumados entre los buckets de la cuenta, comprobados antes de copiar. Hasta 2.000 archivos/objetos por lote, solicitudes limitadas y sin activación de planes pagados.
- No se usa R2 Infrequent Access. Se rechaza un inventario que no pueda comprobarse o exceda los límites internos.
- La copia GitHub usa runner estándar, artifact de hasta 100 MB y un día de retención. Revisar el consumo compartido de artifacts/Packages de la cuenta y mantener el presupuesto de GitHub en $0 con bloqueo de sobreconsumo.
- Los límites internos no garantizan costo cero frente a actividad ajena, cambios concurrentes u operaciones de otros servicios. Si se alcanzan, el respaldo se detiene sin borrar los originales. Revisar cuota y reducir alcance/retención o descargar una copia local; no contratar planes sin autorización.

## Ensayo / restauración local (no producción)
Descargar y descomprimir el artifact cifrado en una carpeta privada. Conservar SQL, documentos y claves fuera del repositorio.

```powershell
node scripts/restore-backup.mjs --input RUTA_A_COPIA_CIFRADA --key-file RUTA_A_CLAVE_PRIVADA
```

Solo verifica en memoria. Para obtener una copia local recuperada, indicar una carpeta **nueva**, fuera del proyecto y del respaldo original:

```powershell
node scripts/restore-backup.mjs --input RUTA_A_COPIA_CIFRADA --key-file RUTA_A_CLAVE_PRIVADA --output ..\work\restauracion-nueva
```

No acepta un directorio existente ni sobrescribe la base actual. La carpeta recuperada contiene datos sensibles; guardarla de forma privada y cifrada, no subirla a GitHub.

## Procedimiento para una recuperación productiva
1. Identificar incidencia y fecha de la última copia válida; no asumir que el archivo descargado está completo.
2. Detener cambios temporalmente y conservar una copia del estado actual antes de recuperar.
3. Descargar copias cifradas y verificar clave, manifiesto, SQL, adjuntos y propiedad familiar.
4. Restaurar en otra D1 y otro bucket privados, sin conexiones a producción. No reactivar las sesiones o invitados antiguos.
5. Comprobar accesos de dos familias, roles, PDF, archivos y cuotas; registrar tiempos y resultados. Esta versión incluye pruebas automatizadas y ensayo SQLite, **no certifica una restauración remota D1 completa**.
6. Solo tras aprobación explícita, cambiar los bindings hacia el entorno comprobado. Conservar originales y reversión. No ofrece un endpoint público ni un botón para sobrescribir producción.

## Fuentes y alcance
- D1 Time Travel conserva hasta 7 días en Free y puede complementar la recuperación de datos, pero no restaura los objetos R2: https://developers.cloudflare.com/d1/reference/time-travel/
- R2 Standard incluye uso gratuito sujeto a almacenamiento y operaciones: https://developers.cloudflare.com/r2/pricing/
- GitHub comparte el consumo de artifacts con otros productos: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Las pruebas sintéticas verifican dos familias, permisos de API, recuperación de bytes, archivos heredados, detección de corrupción y revocación de sesiones. No sustituyen una auditoría independiente ni eliminan todo riesgo de pérdida de datos.
