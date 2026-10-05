# Editor de perfil por etapas

Nuevo y Editar perfil comparten cinco pestañas accesibles: Identificación,
Salud, Cuidado, Contactos y Privacidad. Los paneles permanecen montados al
cambiar de pestaña; los valores y cargas en curso no se descartan.

- Botón Guardar cambios fuera del área desplazable, siempre disponible.
- Validación de todos los paneles: al faltar un dato obligatorio se activa
  su pestaña y se enfoca el campo. No se envían solicitudes inválidas.
- Hospitalización conserva el comportamiento condicional y sus datos.
- Foto JPG/PNG y cédula PDF/JPG/PNG con carga compacta y vista previa
  validada. Los enlaces de vista previa utilizan blobs autorizados, no JSON.
- En perfiles nuevos hay que guardar antes de adjuntar: el almacenamiento
  requiere un perfil persistido y su propietario familiar.
- La institución/modalidad de cuidado y el nivel/etapa reutilizan las columnas
  existentes colegio_actual/curso_actual. No se migra ni elimina información.
  Las nuevas etiquetas también se muestran en la ficha y los informes.
- Privacidad abre los permisos reales por persona para el SuperAdmin familiar.
  Estos permisos afectan todos los perfiles familiares, no solo al niño actual.
  El borrador del perfil permanece abierto detrás y se conserva al regresar.
  Otros roles solo reciben la explicación; el backend sigue protegiendo las APIs.
- Estilos confinados al modal; sin cambios en sidebar, header o demás formularios.
  Una columna en móvil, dos columnas en escritorio y colores mediante variables
  del tema claro/oscuro/sistema.

QA: tests/browser/profile-editor.spec.ts (320, 375, 414, 1280 px, carga de foto,
persistencia entre pestañas, guardado completo, validación, teclado, privacidad y
modo oscuro). tests/browser/profile-fields.spec.ts cubre hospitalización y consultas.
