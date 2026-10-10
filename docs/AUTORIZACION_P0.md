# Correcciones P0 de autorización y privacidad

Base revisada: `20566ba0f0e3ea0b41b43f4b9c5412c22665ab69`.
Rama: `fix/p0-authorization-privacy`.

Este documento registra la entrega inicial `c67a317`. La validación posterior, correcciones adicionales y cifras actualizadas están en [VALIDACION_SEGURIDAD_P0.md](VALIDACION_SEGURIDAD_P0.md).

## Vulnerabilidades corregidas

- Los permisos requeridos ausentes, vacíos, malformados o desconocidos ya no conceden acceso por defecto. Cada operación exige acceso de lectura al módulo y el permiso de acción correspondiente; se respetan los bloqueos de plataforma.
- Una política compartida filtra RUT, teléfono, dirección, diagnósticos, fotos y adjuntos según los permisos. Se aplica a perfiles, registros, informes, catálogo de documentos, descarga de archivos y anamnesis. Los campos ocultos se conservan al editar otros datos, incluso si el cliente intenta enviarlos.
- Los invitados quedan limitados al niño y los módulos del enlace. Consultar otro perfil se rechaza. La creación de enlaces exige permisos suficientes para compartir los datos completos del módulo; las sesiones y los enlaces existentes se vuelven a validar contra los permisos y el estado actuales de su creador.
- Descargar informes y adjuntar archivos requieren sus propios permisos. Un usuario con permiso de edición puede conservar adjuntos anteriores, pero no añadir referencias nuevas sin `adjuntar`.
- Un POST de creación sobre un registro único existente exige también `editar`, evitando sobrescrituras con permisos de creación solamente.
- El dashboard, la navegación, los formularios y la anamnesis usan la política compartida para no solicitar módulos prohibidos ni mostrar campos privados. La API sigue siendo la autoridad de seguridad.

## Archivos

| Archivos | Cambio |
| --- | --- |
| `shared/access-policy.js` | Normalización, autorización por módulo/acción y proyección de datos privados. |
| `server/api.js` | Aplicación de políticas en consultas, mutaciones, informes, adjuntos e invitados. |
| `server/file-catalog.js`, `server/record-files.js` | Protección del catálogo y de referencias a archivos. |
| `src/AccessPolicy.tsx` | Contexto de permisos de la interfaz. |
| `src/App.tsx`, `src/Dashboard.tsx` | Navegación, informes y dashboard según permisos efectivos. |
| `src/components.tsx`, `src/Anamnesis.tsx` | Ocultación de campos y secciones restringidos. |
| `tests/authorization.test.mjs` | Diez casos de regresión con usuarios y datos sintéticos. |
| `tests/browser/authorization.spec.ts` | Regresión de navegación, dashboard y formulario privados. |
| `package.json` | Incorporación de las regresiones de servidor a `npm test`. |

## Compatibilidad y cambios de comportamiento

- Cuentas antiguas que dependían del acceso implícito por permisos vacíos necesitarán una asignación explícita por el administrador. No se modifican sus datos ni se migran permisos automáticamente.
- Leer y editar no implican descargar o adjuntar. Las cuentas que necesiten estas funciones deben tener `descargar` o `adjuntar` respectivamente. Los nuevos editores reciben las seis acciones explícitas para conservar las capacidades previstas anteriormente.
- La omisión de restricciones opcionales `sensibles` y `privacidad` mantiene el contrato existente dentro de módulos y acciones explícitamente autorizados. Una lista `sensibles: []` no concede ninguna categoría sensible.
- Los invitados conservan lectura e informes de los módulos compartidos del perfil autorizado. Los enlaces pueden reducir su alcance o dejar de funcionar si cambian los permisos, restricciones de privacidad o estado del creador.
- La anamnesis oculta secciones completas cuando contienen categorías restringidas; al guardar otros campos se conserva el contenido oculto. Esto puede reducir la información visible respecto del comportamiento anterior.
- No hay cambios de esquema, configuración de pagos ni dependencias. No se ejecutaron despliegues ni operaciones sobre datos reales.

## Validación ejecutada

| Comando | Resultado |
| --- | --- |
| `npm test` | 43 pruebas aprobadas; ninguna fallida, omitida o cancelada. |
| `node --test tests/*.test.mjs` | 60 pruebas aprobadas; ninguna fallida, omitida o cancelada. Incluye pruebas existentes con proveedores de pago simulados. |
| `node --test tests/authorization.test.mjs` | 10 regresiones aprobadas, incluida preservación de datos privados, sesiones invitadas revocadas, aislamiento familiar y permisos independientes. |
| `npx --no-install playwright test --config /workspace/luspace-cloud/playwright.config.mjs authorization.spec.ts` | 1 prueba aprobada con Chromium del sistema y almacenamiento sintético aislado. |
| `npm run build` | TypeScript y Vite completados. Persiste el aviso de tamaño de chunks superior a 500 kB. |
| `WRANGLER_LOG_PATH=/workspace/luspace/.wrangler/logs npx --no-install wrangler pages functions build --outdir .wrangler/functions-build` | Compilación local de Functions completada; no despliega. |

La configuración auxiliar de Playwright pertenece al entorno, no al repositorio; adapta el ejecutable de Chromium y el directorio de datos. No se ejecutó la suite completa de navegador. Las pruebas de servidor crean y eliminan bases temporales; las de navegador usan un directorio de datos aislado. No se prueba contra servicios de producción.

## Riesgos pendientes

- El texto libre puede contener información privada fuera de los campos estructurados. La proyección no intenta interpretar ni redactar semánticamente todas las notas; la anamnesis se protege de forma conservadora por sección.
- Algunos controles de acciones de pantallas secundarias conservan la distinción general entre lectura y edición. La API rechaza acciones sin permiso; conviene continuar ajustando cada botón a los permisos independientes para evitar intentos que terminan en 403.
- Las cuentas y los enlaces antiguos requieren revisar su configuración explícita antes de adoptar este cambio. No se ejecuta una migración que amplíe permisos automáticamente.
- Los resultados validan el entorno local y las regresiones incorporadas. La validación posterior en un entorno de prueba de Cloudflare queda fuera de esta entrega y no se ha desplegado nada.
