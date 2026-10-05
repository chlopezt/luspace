# Pendientes de LuSpace

## Prioridad crítica: protección de datos, respaldo y recuperación

Estado: motor cifrado, automatización diaria y panel operativo implementados; pruebas locales de integridad y aislamiento aprobadas. Falta confirmar la primera ejecución real en GitHub/Cloudflare antes de declarar el respaldo activo. No confundir la exportación JSON con este proceso.

- [ ] Respaldos automáticos de D1 y de todos los adjuntos R2, con manifiesto de referencias y una copia privada independiente.
- [x] Definir frecuencia diaria, retención de siete días y objetivo de pérdida máxima aproximada de 24 horas entre copias exitosas. El tiempo de recuperación remota debe medirse, no está garantizado.
- [ ] Restauración controlada y ensayos documentados que comprueben registros, archivos y aislamiento entre familias.
- [ ] Migraciones con validación previa, conservación de originales y procedimiento de reversión probado.
- [ ] Verificación de integridad y disponibilidad de adjuntos; alertas de fallos de lectura, respaldo y restauración, sin exponer contenido sensible.
- [x] Pruebas automatizadas de archivos antiguos, permisos, dos familias aisladas, clave incorrecta, copias incompletas y alteración de bytes.
- [ ] Evaluar y respetar límites gratuitos; no contratar planes ni activar servicios de pago. Informar cualquier limitación que impida una protección suficiente.

Pendiente específico: ensayar la recuperación en otra base D1 y otro bucket R2 y medirla antes de ampliar el servicio. El ensayo automático actual restaura una SQLite aislada y verifica todos los archivos, sin sobrescribir producción. Procedimiento y límites: `RESPALDOS_Y_RECUPERACION.md`.

Contexto: el JPG antiguo de Salud no se perdió; su original estaba intacto en D1. Se corrigió la referencia incompatible con R2. Este incidente motiva reforzar la fiabilidad, sin prometer riesgo cero.
