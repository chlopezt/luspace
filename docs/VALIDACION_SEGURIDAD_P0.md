# Validación final de seguridad P0

Fecha: 2026-10-10. Rama: `fix/p0-authorization-privacy`.
Corrección inicial: `c67a317`; referencia anterior: `20566ba`.

## Alcance y aislamiento

Se revisaron la política compartida, consultas y mutaciones de la API, informes, adjuntos, enlaces invitados, administración familiar y navegación. Todas las pruebas usan bases temporales, familias, credenciales y documentos sintéticos. La comparación anterior usa una copia temporal obtenida con `git archive 20566ba`, sin cambiar de rama ni editar `main`.

No se accedió a la cuenta familiar potencialmente real, a bases remotas ni a datos de producción. No se ejecutaron migraciones remotas, despliegues, conciliaciones de producción o cambios de pagos. No se fusionó la rama. Los ajustes hechos por las pruebas de administración solo afectan su base sintética.

## Matriz comprobada

Las pruebas de API cubren cinco actores familiares, además de las pruebas existentes del operador de plataforma:

| Actor sintético | Lectura | Crear / editar | Eliminar | Descargar documento | Exportar | Administración |
| --- | --- | --- | --- | --- | --- | --- |
| Propietario (`superadmin`, permisos vacíos) | Sí, dentro de su familia | Sí | Sí | Sí | Sí | Familiar; la plataforma exige sesión separada |
| Administrador familiar adicional (`superadmin`, permisos vacíos) | Sí, dentro de su familia | Sí | Sí | Sí | Sí | Familiar; la plataforma exige sesión separada |
| Miembro limitado (`salud`, `ver/crear/editar/descargar`) | Solo Salud | Solo Salud | No | Sí, documentos visibles de Salud | Solo Salud | No |
| Invitado (`salud`) | Solo el niño y módulo compartidos | No | No | No como descarga directa | Solo el niño y módulo compartidos | No |
| Miembro sin permisos (`{}`) | No hay datos familiares | No | No | No | No | Solo su cuenta y contraseña propia |
| Operador de plataforma | Métricas operativas; sin acceso clínico por esa sesión | Controles operativos autorizados | Sin borrado clínico por esa sesión | Sin descarga clínica por esa sesión | Sin exportación clínica por esa sesión | Plataforma, con autenticación separada |

También se comprobaron lectura sin permiso de descarga, adjuntar sin crear, editar conservando adjuntos antiguos, rechazo de adjuntos nuevos sin autorización, campos privados, conservación de datos ocultos al guardar, sobrescritura de registros únicos, revocación de sesiones, acceso cruzado entre familias y perfiles, permisos malformados y enlaces cuyo creador perdió acceso.

La vista previa de un documento legible sigue siendo lectura y permite recibir sus bytes. El permiso de descarga controla la descarga explícita (`?download=1`); no es una protección contra guardar un contenido que ya se puede visualizar. Los informes invitados conservan el comportamiento del enlace autorizado.

## Correcciones adicionales

1. **Borrado de documentos privados:** conocer un ID y tener `eliminar` ya no permite borrar un documento oculto por privacidad o categorías sensibles. Se exige que el documento esté en el catálogo autorizado y pertenezca al perfil accesible.
2. **Contraseña propia:** un miembro autenticado sin permisos clínicos puede cambiar su contraseña verificando la actual. Se cierran sus sesiones y no obtiene permisos de datos. Los invitados siguen excluidos.
3. **Acceso sin módulos:** se muestra un aviso de autorización pendiente. La página de cuenta y administración familiar funciona sin seleccionar un niño; también sirve al propietario antes de crear perfiles.
4. **Editor de permisos:** muestra permisos efectivos, evita módulos preseleccionados para permisos ausentes y permite habilitar `ver` explícitamente o guardar una revocación completa. Las categorías opcionales antiguas omitidas se muestran conforme a su acceso efectivo, evitando reducirlas al guardar sin intención.
5. **Guardado de permisos:** rechaza listas o categorías malformadas y nombres desconocidos, incluidos nombres heredados del prototipo de JavaScript. Omitir restricciones opcionales conserva las anteriores; cambiar módulos o acciones no elimina silenciosamente las restricciones de privacidad. Los cambios válidos cierran las sesiones del miembro.

Archivos adicionales respecto de `c67a317`: `server/api.js`, `src/App.tsx`, `src/Administration.tsx`, `tests/authorization.test.mjs`, `tests/browser/authorization.spec.ts` y documentación. No se cambiaron dependencias, esquema ni configuración de pagos.

## Compatibilidad y propuesta para cuentas existentes

No se inspeccionaron permisos de cuentas reales, por lo que no se determina cuántas necesitan ajustes.

- El propietario o administrador familiar con rol `superadmin` mantiene sus capacidades aunque tenga `{}`. Los bloqueos de plataforma y suscripción siguen aplicándose.
- Un editor o lector sin módulos y acciones válidos queda sin acceso a datos. Esto elimina el acceso implícito anterior y es una denegación intencional, no un error de inicio de sesión.
- Las cuentas con módulos y acciones explícitos conservan su alcance; descargar y adjuntar deben estar autorizados de forma independiente. `sensibles: []` no concede categorías sensibles.
- Cambiar permisos, privacidad, estado del creador o módulos bloqueados puede reducir o revocar enlaces invitados existentes.

Procedimiento propuesto, sin migración automática:

1. Un administrador autorizado revisa los roles y permisos en **Familia y accesos**, usando únicamente metadatos de acceso para el inventario. No se debe incluir información clínica en el informe.
2. Identifica cuentas con JSON inválido, módulos o acciones vacíos, o necesidades de descarga/adjuntos no reflejadas en las acciones. Las cuentas sin necesidad confirmada siguen sin acceso.
3. Confirma con el propietario el alcance mínimo de cada miembro. Selecciona explícitamente módulos, `ver`, acciones y categorías sensibles necesarias; mantiene las restricciones de privacidad pertinentes.
4. Guarda cada ajuste mediante la interfaz administrativa, que cierra las sesiones del miembro. El usuario vuelve a iniciar sesión y se revisan los enlaces compartidos afectados.
5. Ensaya el procedimiento con las cuentas sintéticas antes de autorizar cualquier cambio sobre cuentas reales. Esta entrega no ejecuta ese inventario ni esos ajustes reales.

## Pruebas y límites

La ejecución general de navegador usa Chromium del sistema y un límite diagnóstico de 20 segundos por caso, idéntico para la rama y la copia de referencia. Se interrumpió una ejecución inicial con el límite de 90 segundos al confirmar fallos repetidos y se sustituyó por la ejecución completa comparable; la ejecución interrumpida no se cuenta como una suite aprobada.

Las pruebas finales enfocadas de seguridad usan el límite normal de 90 segundos y almacenamiento nuevo. La prueba de plataforma también usa 90 segundos y `PLATFORM_QA_DB` apuntando exclusivamente a su base sintética. Su primer intento general carecía de esa variable; después se corrigió la configuración auxiliar y se ejecutó de forma independiente.

Las configuraciones auxiliares están fuera del checkout, en `/workspace/luspace-cloud`.

| Ejecución | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| Servidor completo: `node --test tests/*.test.mjs` | 69 | 0 | 0 |
| Script de CI: `npm test` (subconjunto del anterior) | 52 | 0 | 0 |
| Regresiones P0: `node --test tests/authorization.test.mjs` (incluidas arriba) | 19 | 0 | 0 |
| Navegador enfocado final: `authorization.spec.ts` | 3 | 0 | 0 |
| Navegador de plataforma con base aislada: `platform-dashboard.spec.ts` | 1 | 0 | 0 |
| Navegador general comparativo de la rama (52 casos) | 16 | 34 | 2 |
| Navegador general de referencia `20566ba` (51 casos) | 15 | 34 | 2 |

Las cifras son por ejecución y no deben sumarse: las suites de servidor comparten pruebas y la prueba enfocada inicial también está incluida en la ejecución general. Node cuenta 14 casos superiores y cinco subcasos de la matriz, dando 19 regresiones. La ejecución general se inició antes de incorporar los dos nuevos casos de navegador; los tres casos P0 se volvieron a ejecutar sobre el código final.

Comandos de navegador:

```sh
npx --no-install playwright test --config /workspace/luspace-cloud/playwright.config.mjs --timeout=20000
npx --no-install playwright test --config /workspace/luspace-cloud/playwright-baseline.config.mjs
npx --no-install playwright test --config /workspace/luspace-cloud/playwright-p0.config.mjs authorization.spec.ts
npx --no-install playwright test --config /workspace/luspace-cloud/playwright-platform-p0.config.mjs platform-dashboard.spec.ts
```

`npm run build` completó TypeScript y Vite; persiste el aviso de chunks mayores de 500 kB. La compilación local también completó con:

```sh
WRANGLER_LOG_PATH=/workspace/luspace/.wrangler/logs npx --no-install wrangler pages functions build --outdir .wrangler/functions-build
```

Se compararon automáticamente los resultados de los 51 casos comunes por archivo y título: no hubo diferencias de aprobado/fallido/omitido. El caso adicional inicial de autorización pasó. Esto permite atribuir los fallos observados a condiciones anteriores a P0, pero no prueba que una regresión no pueda quedar oculta tras un fallo previo.

Fallos generales reproducidos en la base: `attachments` (1), `audience-purpose` (1), `auth-access` (1), `care-lists` (2), `care` (1), `family-controls` (1), `header-rnd` (1), `landing` (1), `pdf-recovery` (4), `platform-dashboard` (1), `profile-editor` (6), `profile-fields` (2), `registration` (1), `responsive` (1), `startup` (3), `trial-ui` (1), `vaccinations` (4), `workflow` (2).

Entre las causas observadas están mocks genéricos de API que devuelven `[]` para `site-config` y provocan un error en `SiteBanner`, selectores desactualizados, aserciones de diseño y fixtures que presuponen cuentas locales determinadas. Varios mocks de editor también omiten permisos explícitos, por lo que deberán adaptarse al nuevo contrato para validar esos escenarios. No se cambió la aplicación ni esas pruebas ajenas a P0 para ocultar sus fallos.

El fallo de `platform-dashboard` por falta de `PLATFORM_QA_DB` se resolvió en la configuración auxiliar y su ejecución independiente pasó. Las dos pruebas `contextual-preview` se omitieron porque exigen un preview sintético previamente sembrado y `PW_CONTEXTUAL_PREVIEW`; no se apuntó a un preview remoto o familiar real.

GitHub Actions: se intentó `gh run list --branch fix/p0-authorization-privacy --limit 5`; GitHub respondió `Forbidden` en `api.github.com`. No se puede afirmar que CI haya pasado. Se inspeccionó `ci.yml`: verifica `npm test`, pruebas de pagos simulados, frontend y Functions; los tests de pagos están incluidos en la ejecución local completa. No se dispararon workflows manualmente.

## Pull request

Destino: `main`, desde `fix/p0-authorization-privacy`, en modo borrador. La rama está publicada, pero la API de GitHub responde `Forbidden` y no permite crear el PR desde este entorno. Enlace para crearlo manualmente: https://github.com/chlopezt/luspace/compare/main...fix/p0-authorization-privacy?expand=1 . Seleccionar **Create draft pull request** y usar este informe como evidencia de revisión. Para reintentar desde el entorno, se necesita acceso a `api.github.com`; no se requiere compartir credenciales por chat.

## Riesgos pendientes y criterio de integración

- La suite general de navegador no está completamente verde. Fallos previos o de fixtures pueden ocultar regresiones que las pruebas enfocadas no ejercitan. No equivalen a vulnerabilidades P0 confirmadas, pero limitan la validación global.
- El texto libre puede contener datos privados fuera de campos estructurados. La proyección no redacta semánticamente todas las notas; la anamnesis se protege por sección.
- Algunas pantallas secundarias aún presentan acciones según la distinción general de lectura/edición. La API rechaza acciones no autorizadas, pero pueden producir errores 403 en la interfaz.
- La omisión de restricciones opcionales en cuentas antiguas conserva su contrato previo dentro de módulos autorizados; conviene que el propietario confirme esas categorías en el inventario manual.
- No hay validación remota sobre Cloudflare ni confirmación de resultados de CI si GitHub continúa inaccesible.
- El workflow existente `deploy.yml` despliega al recibir un push a `main`. Integrar puede activar ese despliegue; cualquier integración debe coordinarse con la aprobación explícita del usuario y el control de publicación existente. No se modificó dicho workflow.

Las regresiones P0 y las compilaciones deben estar aprobadas antes de revisar el PR. Para una integración sin reservas se requiere además resolver o aceptar explícitamente los límites de la suite general, confirmar CI y planificar la revisión manual de permisos de cuentas existentes. Esta validación no autoriza integrar ni desplegar.
