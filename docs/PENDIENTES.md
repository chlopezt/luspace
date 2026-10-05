# Pendientes de LuSpace

## Prioridad crítica: protección de datos, respaldo y recuperación

Estado: motor cifrado, automatización diaria y panel operativo publicados. Primera copia real verificada el 05/10/2026 a las 05:20 UTC: 7 adjuntos comprobados, ensayo aislado aprobado y copia cifrada independiente en GitHub (2.23 MB). Ejecución: https://github.com/chlopezt/luspace/actions/runs/37267263726. No confundir la exportación JSON con este proceso.

- [x] Respaldos automáticos cifrados de D1 y adjuntos R2/D1, con manifiesto y copia independiente cifrada; primera ejecución real verificada.
- [x] Definir frecuencia diaria, retención de siete días y objetivo de pérdida máxima aproximada de 24 horas entre copias exitosas. El tiempo de recuperación remota debe medirse, no está garantizado.
- [ ] Restauración controlada y ensayos documentados que comprueben registros, archivos y aislamiento entre familias.
- [ ] Migraciones con validación previa, conservación de originales y procedimiento de reversión probado.
- [ ] Verificación de integridad y disponibilidad de adjuntos; alertas de fallos de lectura, respaldo y restauración, sin exponer contenido sensible.
- [x] Pruebas automatizadas de archivos antiguos, permisos, dos familias aisladas, clave incorrecta, copias incompletas y alteración de bytes.
- [ ] Evaluar y respetar límites gratuitos; no contratar planes ni activar servicios de pago. Informar cualquier limitación que impida una protección suficiente.

Pendiente específico: ensayar la recuperación en otra base D1 y otro bucket R2 y medirla antes de ampliar el servicio. El ensayo automático actual restaura una SQLite aislada y verifica todos los archivos, sin sobrescribir producción. Procedimiento y límites: `RESPALDOS_Y_RECUPERACION.md`.

Contexto: el JPG antiguo de Salud no se perdió; su original estaba intacto en D1. Se corrigió la referencia incompatible con R2. Este incidente motiva reforzar la fiabilidad, sin prometer riesgo cero.
