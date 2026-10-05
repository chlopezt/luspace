# Convivientes, hospitalización y acompañante

- Perfil nuevo y edición: «¿Con quién vive?» ofrece opciones y «Otro» con texto libre. Se guarda en `ninos.convivientes` y aparece en la ficha de identificación.
- Hospitalización: «Sin registrar», «Sí» o «No». Motivo y tiempo de estadía aparecen al elegir «Sí», tanto en el formulario como en el resumen y el informe. Al alternar la respuesta, los detalles ingresados se conservan; no se borran automáticamente.
- Consultas: especialidad con catálogo y «Otra especialidad», que permite texto libre. Las especialidades antiguas se mantienen exactamente, aunque no pertenezcan al catálogo.
- Acompañante opcional con opciones y «Otro». Se guarda en `consultas_medicas.acompanante`, se muestra en la consulta y se incluye en los detalles del enlace de Google Calendar.
- Migración D1 `0018_profile_household_hospitalization.sql`: solo agrega columnas con valores vacíos; no reescribe perfiles, especialidades ni archivos existentes.
- Compatibilidad: cuando un formulario antiguo omite los nuevos campos durante una edición, el backend no borra los valores guardados. Enviar un valor vacío explícitamente permite limpiarlos.
- Permisos familiares existentes y aislamiento por niño/familia se mantienen. No se activan servicios ni planes de pago.
