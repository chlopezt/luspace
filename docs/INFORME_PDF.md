# Informe de Cuidado y Salud Pediátrica

Plantilla compacta A4 con identidad LuSpace, ficha del niño/a en teal suave,
advertencia de alergias en ámbar, tablas de mediciones y tratamientos,
tarjetas de antecedentes y notas escolares. La anamnesis agrupa sus subsecciones
en tarjetas violeta claro. La foto sigue siendo opcional.

## Datos y privacidad

- Se utiliza exclusivamente el payload autorizado de `/api/export` y la foto
  que el usuario eligió incluir. No se consultan datos de otras familias.
- Los campos vacíos, listas vacías y valores `sin_registrar` se omiten.
  Los valores numéricos cero y las respuestas negativas registradas se conservan.
- Los instantes con zona horaria se muestran en `America/Santiago`. Las fechas
  sin hora y las horas locales sin zona conservan el día y hora registrados.
- Los textos y listas extensos no se truncan. Las tarjetas y filas normales
  permanecen juntas; los contenidos mayores que una página pueden continuar.
- La bitácora distingue observaciones/incidentes de resolución/apoyos. No se
  atribuyen autores ni se inventan correos o respuestas que no existen en los datos.

## Paginación y descarga

El encabezado y pie se aplican después de la diagramación, con numeración real
`Página X de Y`, logo y fecha de emisión. Cada página del cuerpo se encapsula
antes del estampado para aislar los estados gráficos del contenido.
Se mantiene la recuperación protegida de imports dinámicos para ambos módulos PDF.

Nombre: `Informe-LuSpace_Nombre_Apellidos_DD-MM-AAAA.pdf`; sin acentos,
caracteres de ruta ni espacios. Sin nombre: `Ficha_Pediatrica`.
La fecha del archivo corresponde a la misma emisión del documento.

Un ejemplo con todos los módulos y textos breves ocupa 3 páginas. Los historiales
más extensos generan las páginas necesarias: nunca se elimina información para
imponer una cantidad fija.

## Verificación

```powershell
npm test
npm run build
$env:PW_BASE_URL='http://127.0.0.1:5175'
npx playwright test tests/browser/report-layout.spec.ts tests/browser/pdf-recovery.spec.ts
```

Las pruebas de navegador generan PDFs sintéticos en `tmp/pdfs/`, no datos reales.
Revisar todas las páginas renderizadas con Poppler y comprobar con pypdf:
fechas sin ISO crudo, ausencia de campos vacíos, numeración en cada página y
preservación del marcador final de las notas largas.
