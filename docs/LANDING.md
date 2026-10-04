# Presentación pública

`/presentacion` siempre muestra la página pública. `/` muestra la presentación para visitantes sin sesión tras la instalación inicial; las familias con sesión mantienen su Inicio y el acceso de plataforma conserva `/admin`.

Componentes: `src/Landing.tsx` y `src/landing.css`. Los estilos están acotados a `.lp`, sin cambiar el sidebar ni el dashboard familiar. Enlaces internos con desplazamiento suave en escritorio y respeto por movimiento reducido. Navegación accesible por teclado, enlace de salto, preguntas desplegables nativas.

Header con logo, características/precios/seguridad/preguntas, login y CTA de registro; ambas acciones se mantienen visibles a 320 px. La ilustración usa CSS/SVG y datos ilustrativos, nunca datos de pacientes.

Tarifa comercial informada por el propietario: $4.990 CLP mensuales + IVA. Prueba de 14 días a $0 y 50 MB; sin tarjeta, sin cobro automático, sin plan gratuito permanente. Se informa que los pagos todavía no están habilitados. Carnet de vacunas señalado como pendiente, no como funcionalidad disponible. Acceso Google indicado como pendiente mientras no existan sus credenciales.

Validación: `tests/browser/landing.spec.ts` verifica 320, 375, 414 y 1280 px, ausencia de desbordamiento y enlaces de acceso. `tests/browser/registration.spec.ts` mantiene el flujo de registro con correo.
