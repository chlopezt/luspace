# Administración de plataforma

Primera etapa: métricas administrativas de solo lectura. No incluye cobros,
trial, suspensión comercial ni migración a Supabase. La familia actual no cambia.

El rol es independiente del rol familiar: tabla administradores_plataforma.
No hay endpoint ni formulario público para asignarlo. Un operador autorizado
de infraestructura debe validar el ID exacto de la cuenta y provisionarlo en D1:

```sql
INSERT INTO administradores_plataforma(usuario_id,activo)
VALUES ('ID_VERIFICADO_DEL_USUARIO',1)
ON CONFLICT(usuario_id) DO UPDATE SET activo=1;
```

Para revocarlo, actualizar activo=0. El backend comprueba la asignación en cada
petición; las sesiones existentes no conservan privilegios revocados.

GET /api/platform/overview permite solo el rol explícito y devuelve campos
allowlist: identificador/nombre de familia, fecha de alta, número de miembros
activos, número de archivos y suma de bytes. Nunca devuelve niños, contactos,
diagnósticos, nombres de documentos, claves R2 o registros de auditoría clínica.
Las consultas al panel se registran en auditoria_plataforma.

El rol no interviene en child(), records(), allowed() ni admin() familiar:
continúa prohibido acceder a otras familias por las APIs clínicas existentes.
La proyección contiene hasta 200 familias recientes; paginación se agregará
antes de superar esa cantidad. La interfaz no simula estados de suscripción.

El propietario de Cloudflare conserva capacidad técnica para consultar D1/R2.
Esto no es cifrado de extremo a extremo ni oculta datos al operador de infraestructura.

Verificación:
node --test tests/platform.test.mjs tests/api.test.mjs tests/consultation.test.mjs
