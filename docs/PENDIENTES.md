# Pendientes de LuSpace

## Registro: términos, privacidad y consentimiento — retomado (08/10/2026)

Retomado por solicitud del usuario y autorizado para publicación como versión inicial. Se implementaron páginas públicas, dos casillas desmarcadas, validación de servidor y registro transaccional versionado por correo/Google. Responsable confirmado: Christian López. `contacto@luspace.cl` todavía no recibe mensajes; se informa en las páginas. Sigue pendiente revisión legal y habilitar un canal efectivo de privacidad. Detalle: `TERMINOS_PRIVACIDAD.md`.

- [ ] Preparar y revisar legalmente los Términos y condiciones y la Política de privacidad, con páginas accesibles.
- [x] Añadir casillas sin marcar por defecto al registro de familias nuevas, con enlaces a los documentos; no exigirlas en cada login.
- [x] Incluir el mismo paso para el registro con Google y validar la aceptación en el servidor.
- [x] Guardar usuario, fecha y versión de los documentos aceptados.
- [ ] Tratar por separado el consentimiento y la representación/autorización para datos sensibles de niños y niñas; no asumir que una casilla general satisface todos los requisitos.

## Dominio propio — informado el 08/10/2026

El usuario informó que LuSpace dispone de `luspace.cl` y compartió `http://luspace.cl/`. Este registro no confirma por sí solo el estado del DNS, HTTPS ni las integraciones.

- [ ] Verificar la vinculación del dominio a Cloudflare Pages, HTTPS y redirecciones HTTP/HTTPS y www.
- [ ] Revisar las URL y orígenes permitidos de Google OAuth y las rutas de retorno/webhooks de Mercado Pago antes de usar el nuevo dominio como principal.
- [ ] Comprobar los accesos familiar y administrativo, el 2FA y los adjuntos desde el dominio propio, sin mover ni mezclar datos familiares.

Avance del 08/10/2026: se añadió `luspace.cl` a la cuenta Cloudflare existente con plan Gratuito (0 US$). NIC Chile confirmó que la modificación técnica se realizó correctamente: servidores `derek.ns.cloudflare.com` y `veronica.ns.cloudflare.com`. Cloudflare indica que espera la propagación del registrador. La zona tiene ID `7ede19f787471b446bdc0ca51f0f3dfb`; el escaneo no encontró registros DNS previos.

El asistente de dominio personalizado de Pages todavía solicita completar la transferencia de DNS antes de vincular el dominio raíz. Pendiente: comprobar activación, completar asociación a `luspace-app`, configurar www/HTTPS y probar integraciones. No se modificaron secretos, OAuth, pagos, bases de datos ni archivos familiares. La URL `luspace-app.pages.dev` se conserva.

Revisión posterior del 08/10/2026: se solicitaron nuevamente la comprobación de servidores y la actualización del panel Cloudflare. Sigue indicando «Esperando a que su registrador propague sus nuevos servidores de nombres». Se reabrió la ficha NIC Chile y se verificó que ambos servidores anteriores permanecen guardados. Pages no tiene todavía dominios personalizados asociados.

Precaución para Google: el código actual usa una sola variable `GOOGLE_REDIRECT_URI` y una cookie OAuth vinculada al host. No basta con habilitar el nuevo dominio: iniciar el flujo desde `luspace.cl` y retornar a `pages.dev` perdería esa vinculación. Preparar una transición validada del origen/callback, conservar el dominio anterior hasta probarla y no ampliar cookies a dominios ajenos. No se cambió esta variable en producción.

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

### Recuperación completa en Cloudflare — hacer después (06/10/2026)

Pospuesta por solicitud del usuario. No ejecutar hasta que solicite retomarla.

- [ ] Crear una base D1 y un bucket R2 separados, dentro de los límites gratuitos y sin contratar servicios de pago.
- [ ] Recuperar allí una copia cifrada, sin modificar producción.
- [ ] Comprobar registros, documentos, permisos y separación entre familias.
- [ ] Medir el tiempo de recuperación y documentar el procedimiento y los resultados.

La postergación no desactiva los respaldos diarios configurados.

Contexto: el JPG antiguo de Salud no se perdió; su original estaba intacto en D1. Se corrigió la referencia incompatible con R2. Este incidente motiva reforzar la fiabilidad, sin prometer riesgo cero.
