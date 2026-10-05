# Carnet de vacunas y testimonios

## Vacunas
- Salud > Carnet de vacunas. Registrar/editar/eliminar una dosis sin crear registros ficticios automáticamente.
- Referencia PNI Chile, septiembre 2026: https://saludresponde.minsal.cl/calendarios-de-vacunacion/
- Neumocócica: PCV20 desde septiembre 2026; tercera dosis a los 6 meses solo para prematuros. Fiebre amarilla: solo Rapa Nui.
- Meningocócica B: 2, 4 y 18 meses; ACWY: 12 meses. Varicela: 18 y 36 meses. dTPa: 1° y 8° básico; VPH: dosis única en 4° básico en la pauta 2026.
- Referencia actual, no reconstrucción automática de calendarios históricos. Confirmar cohorte/pauta y dosis condicionales con el vacunatorio.
- Una dosis sin registro se muestra «Por verificar». El atraso se calcula solo sobre dosis que la familia incorporó al seguimiento; puede corregirse con la fecha prevista.
- Las fechas por edad usan meses calendario y ajustan el último día del mes. Las dosis escolares requieren fecha confirmada, sin inferir el curso por edad.
- Progreso = dosis administradas / dosis incorporadas al seguimiento. No certifica esquema PNI al día ni se conecta al Registro Nacional de Inmunizaciones.
- Fechas de aplicación obligatorias para administradas, entre nacimiento y hoy. Dosis de catálogo únicas por niño; particulares permiten varias dosis/años.
- D1: migración aditiva 0019, sin alteración de registros anteriores. Todos los accesos reutilizan el aislamiento familiar, permisos Salud, cuotas de suscripción y auditoría existentes.
- Informes Salud incluyen las vacunas registradas, ordenadas por aplicación más reciente, con estados y campos informados; no se exportan registros virtuales del catálogo.

## Testimonios
- Carrusel público antes de precios. 1/2/3 tarjetas en móvil/tablet/escritorio; scroll-snap táctil, flechas, puntos y teclado; sin reproducción automática.
- Cuatro textos aportados por el titular, quien confirmó que provienen de participantes reales. Avatares con iniciales, sin fotografías ni datos clínicos infantiles.
- Contenido en shared/testimonials.js. No se añadieron identidades, edades ni comentarios no proporcionados.
- Mantener consentimiento para uso público de nombre, cita y calificación; retirar cualquier reseña si su autor lo solicita.

## Verificación
- npm test
- npm run build
- PW_BASE_URL=http://127.0.0.1:5175 npx playwright test tests/browser/vaccinations.spec.ts tests/browser/testimonials.spec.ts tests/browser/report-layout.spec.ts
