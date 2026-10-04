# Preparación de consultas

Acceso: Salud → Consultas médicas → Preparar próxima consulta.

Workers AI utiliza el binding AI y el modelo fijo @cf/meta/llama-3.1-8b-instruct.
La inferencia se habilita sólo cuando LUSPACE_AI_ENABLED="true" en Pages,
después de verificar que la cuenta mantiene Workers Free. No habilitar un plan
de pago: la cuota gratuita es compartida con otros proyectos de la cuenta.
LuSpace limita atómicamente a 10 intentos diarios UTC para toda la aplicación,
18.000 caracteres de contexto y 800 tokens de respuesta. Este límite no mide
la cuota global de Cloudflare y no garantiza gratuidad en una cuenta Workers Paid.

La vista previa no llama a IA. Se exige consentimiento y hash del contexto
antes de la inferencia. El backend valida familia, módulos y permiso crear
en Salud. Invitados y solo lectura no pueden generar. Se omiten campos de
identificación, contactos y archivos, pero los textos libres pueden contener
datos personales: la familia debe revisar la vista previa. Anamnesis y lectura
de adjuntos no están implementadas en esta versión.

Se ofrecen resumen básico, borrador editable, referencias de registros y PDF.
Los errores/cuota de Cloudflare producen un fallback explícito; nunca cambian
de proveedor ni habilitan pagos. El borrador no se guarda automáticamente.
La auditoría registra módulos y operación, no prompts ni respuestas.

Pruebas sin datos reales ni inferencia externa:
node --test tests/api.test.mjs tests/consultation.test.mjs
