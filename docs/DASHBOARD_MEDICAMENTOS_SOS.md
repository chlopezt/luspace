# Dashboard: medicamentos activos e historial SOS

Validación local: 10 de octubre de 2026. Rama: `fix/dashboard-medications-sos`.

## Causa y corrección

El dashboard presentaba `SosReminders` dentro de «Dosis SOS recientes». Ese componente calcula avisos por intervalo prescrito, agrupa medicamentos y descarta avisos vencidos; no representa el historial de administraciones. Por ello, dosis reales sin intervalo o con avisos antiguos dejaban el desplegable sin contenido. Además, el control desaparecía cuando no había dosis, y un error al consultarlas interrumpía la carga conjunta del dashboard.

El nuevo `DashboardSos` consulta el endpoint existente para el niño seleccionado al abrir el panel. Muestra las cinco últimas administraciones ordenadas por fecha, sin agrupar ni eliminar dosis por su intervalo. «Recientes» significa los últimos cinco registros disponibles, sin imponer un plazo clínico. El contador indica el total devuelto por la API y, cuando hay más de cinco, ofrece acceso al historial completo existente. Los recordatorios prescritos de la sección SOS mantienen su comportamiento.

Cada tarjeta muestra medicamento, fecha y hora en America/Santiago y dosis registrada cuando está disponible. Las fechas ausentes o inválidas se identifican sin fabricar valores. Se distinguen carga, error con reintento y el estado vacío «No hay dosis SOS registradas recientemente». Cerrar el panel o cambiar de perfil invalida la respuesta pendiente para evitar presentar registros del perfil anterior.

## Interfaz y compatibilidad

- «Ver tratamientos» es un botón secundario turquesa con icono, bordes redondeados y estados hover, focus y active. Abre la pestaña existente de tratamientos continuos; antes la navegación abría Mediciones.
- «+ Agregar» conserva el estilo violeta y abre el formulario existente de tratamientos. «Registrar dosis SOS» abre el formulario SOS existente, únicamente con lectura y creación autorizadas y sin bloqueo de escritura.
- Encabezado SOS con historial, contador y chevron animado. Panel sutil con tarjetas compactas y desplazamiento interno para limitar la altura móvil.
- Áreas táctiles de al menos 44 px, teclado, región etiquetada, controles inaccesibles mientras el panel está cerrado y compatibilidad con movimiento reducido.
- Los nombres, dosis, frecuencias y horas de referencia de tratamientos no se modifican. No se cambian rutas, contratos API, políticas P0, base de datos ni configuraciones de pagos.
- Se verifica la acción de crear al abrir formularios y al mostrar el botón principal de Records. Usuarios que únicamente pueden editar dejan de ver un control de creación que el servidor ya rechazaba.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `src/Dashboard.tsx` | Acciones de tratamientos y nuevo panel SOS; carga SOS independiente. |
| `src/DashboardSos.tsx` | Consulta, estados, historial, accesibilidad y acciones permitidas. |
| `src/dashboard-medications.css` | Estilos y transiciones, temas y tamaños móviles. |
| `src/App.tsx` | Navegación a la pestaña y solicitud inicial de formulario existentes. |
| `src/components.tsx` | Apertura del formulario existente y verificación de permisos de creación. |
| `shared/care.js` | Ordenación y límite del historial, separado de recordatorios. |
| `tests/care.test.mjs` | Prueba del historial con registros repetidos, antiguos y fechas ausentes. |
| `tests/browser/dashboard-medications.spec.ts` | Nueve pruebas de integración con datos sintéticos. |
| `tests/browser/care-lists.spec.ts` | Fixtures compatibles con permisos P0, configuración del sitio y propietario del archivo. |
| `docs/DASHBOARD_MEDICAMENTOS_SOS.md` | Este informe. |

## Resultados reproducibles

| Comando | Resultado |
| --- | --- |
| `npm test` | 53 aprobadas, 0 fallidas. |
| `node --test tests/care.test.mjs tests/authorization.test.mjs` | 22 aprobadas, 0 fallidas; incluidas también en las 53 anteriores. |
| `npx playwright test --config=/workspace/luspace-cloud/playwright-p0.config.mjs dashboard-medications.spec.ts authorization.spec.ts care-lists.spec.ts` | 14 aprobadas, 0 fallidas: 9 nuevas, 3 P0 y 2 de regresión de listas/consultas. |
| `npm run build` | TypeScript y Vite completados. Permanece el aviso previo sobre chunks superiores a 500 kB. |
| `git diff --check` | Sin errores. |

Playwright usa Chromium local y una base SQLite nueva por ejecución fuera del repositorio (`/workspace/work/p0-focused-browser-*`). Las familias de prueba usan correos `example.test`; las solicitudes de creación representan clientes sintéticos distintos con direcciones del bloque documental 192.0.2.0/24 para no acumular el límite de intentos de registro de todos los casos en una sola IP. No se desactiva el límite de la aplicación.

Cobertura: apertura/cierre con ratón y teclado, datos existentes sin intervalo, duplicados, últimos cinco, conservación de dosis y horarios, registro mediante formulario existente, vacío, carga, error/reintento, navegación, respuestas tardías al cambiar de perfil, lectores, usuarios sin Salud, invitados y aislamiento entre perfiles. Se comprobaron anchos 320, 375, 414 y 1280, temas claro/oscuro, ausencia de desbordamiento horizontal y movimiento reducido. Capturas sintéticas: `/workspace/work/medicine-{light,dark}-{320,375,414,1280}.png`.

## Límites y riesgos pendientes

Se validó Chromium local; no se verificaron dispositivos físicos ni todos los navegadores. Se ejecutaron las suites relacionadas, no toda la batería histórica de navegador. La API devuelve actualmente el historial completo y el cliente presenta cinco: una paginación futura podría reducir transferencias en perfiles con historiales extensos. No se introducen cambios de servidor en esta entrega.

No se utilizaron cuentas ni registros familiares reales, no se hicieron despliegues ni se integró la rama a main.
