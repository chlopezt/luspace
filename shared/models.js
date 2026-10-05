const f = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
export const modules = {
  perfil: "Perfil clínico",
  salud: "Salud",
  escolar: "Escolar",
  anamnesis: "Anamnesis",
  rnd: "Credencial RND",
};
export const fieldVisible = (field, row) =>
  !field.showWhen || row[field.showWhen.key] === field.showWhen.value;
export const medicalSpecialties = [
  "Pediatría General / Infantil", "Medicina General / Familiar",
  "Broncopulmonar / Neumología", "Cardiología Pediátrica", "Dermatología",
  "Endocrinología Pediátrica", "Gastroenterología", "Inmunología / Alergias",
  "Kinesiología / Fisioterapia", "Neurología Pediátrica", "Nutrición / Dietética",
  "Nutriología", "Odontopediatría", "Oftalmología", "Otorrinolaringología",
  "Psiquiatría Infantil", "Psicología Infantil", "Terapia Ocupacional",
  "Fonoaudiología", "Traumatología / Ortopedia", "Laboratorio / Toma de Muestras",
  "Enfermería", "Nefrología Pediátrica", "Urología Pediátrica",
  "Hematología Pediátrica", "Oncología Pediátrica", "Infectología Pediátrica",
  "Cirugía Pediátrica", "Reumatología Pediátrica", "Genética Clínica",
  "Neonatología", "Medicina Física y Rehabilitación", "Psicopedagogía",
];
export const models = {
  ninos: {
    title: "Perfil del niño/a",
    module: "perfil",
    fields: [
      f("primer_nombre", "Nombre", "text", { required: true }),
      f("apellidos", "Apellidos"),
      f("rut", "RUT", "rut"),
      f("fecha_nacimiento", "Fecha de nacimiento", "date", { required: true }),
      f("convivientes", "¿Con quién vive?", "select-other", {
        options: ["Ambos padres", "Madre", "Padre", "Abuelos", "Tutores"],
        otherLabel: "Otro", customLabel: "Especifica con quién vive", maxLength: 180, preserveIfMissing: true,
      }),
      f("sexo_referencia", "Sexo de referencia OMS", "select", {
        options: ["sin_registrar", "masculino", "femenino"],
      }),
      f("foto_perfil_id", "Foto de perfil", "file", { viewLabel: "Ver foto de perfil" }),
      f("carnet_identidad_id", "Cédula de identidad", "file", { viewLabel: "Ver carnet de identidad" }),
      f("grupo_sanguineo", "Grupo sanguíneo", "select", {
        options: ["sin_registrar", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
      }),
      f("prevision_salud", "Previsión de salud", "select", {
        options: ["sin_registrar", "Fonasa A", "Fonasa B", "Fonasa C", "Fonasa D", "Isapre", "Particular"],
      }),
      f("alergias", "Alergias y reacciones", "textarea"),
      f("diagnostico", "Diagnósticos confirmados", "textarea"),
      f("hospitalizado", "¿Ha estado hospitalizado/a?", "select", {
        options: ["", "Sí", "No"], preserveIfMissing: true,
      }),
      f("hospitalizacion_motivo", "Motivo de hospitalización", "textarea", {
        showWhen: { key: "hospitalizado", value: "Sí" }, preserveIfMissing: true,
      }),
      f("hospitalizacion_estadia", "Tiempo de estadía", "text", {
        showWhen: { key: "hospitalizado", value: "Sí" }, maxLength: 180, preserveIfMissing: true,
      }),
      f("especialistas_json", "Profesionales y especialistas tratantes (uno por línea)", "lines"),
      f("contacto_emergencia_principal_nombre", "Contacto de emergencia principal: nombre"),
      f("contacto_emergencia_principal_parentesco", "Contacto principal: parentesco"),
      f("contacto_emergencia_principal_telefono", "Contacto principal: teléfono", "tel"),
      f("contacto_emergencia_secundario_nombre", "Contacto de emergencia secundario: nombre"),
      f("contacto_emergencia_secundario_parentesco", "Contacto secundario: parentesco"),
      f("contacto_emergencia_secundario_telefono", "Contacto secundario: teléfono", "tel"),
      f("colegio_actual", "Institución o modalidad de cuidado", "text", { placeholder: "Hogar, familiar, sala cuna, jardín, colegio…" }),
      f("curso_actual", "Nivel, etapa o curso actual", "text", { placeholder: "Lactante menor, Medio Menor, Kínder, 1° Básico, No aplica…" }),
      f("rnd_habilitado", "Mostrar credencial RND", "checkbox"),
    ],
  },
  registros_crecimiento: {
    title: "Mediciones",
    module: "salud",
    fields: [
      f("fecha_medicion", "Fecha", "date", { required: true }),
      f("peso_kg", "Peso (kg)", "number", { min: 0.1, max: 300 }),
      f("talla_cm", "Talla o longitud (cm)", "number", { min: 20, max: 230 }),
      f("perimetro_cefalico_cm", "Perímetro cefálico (cm)", "number", {
        min: 10,
        max: 80,
      }),
      f("notas", "Notas y método de medición", "textarea"),
    ],
  },
  medicamentos: {
    title: "Tratamientos",
    module: "salud",
    fields: [
      f("nombre", "Medicamento", "text", { required: true }),
      f("dosis", "Dosis indicada", "text", { required: true }),
      f("frecuencia_horas", "Frecuencia (horas)", "number", {
        required: true,
        min: 1,
        max: 720,
      }),
      f("hora_referencia", "Primera dosis programada", "datetime-local", {
        required: true,
      }),
      f("fecha_inicio", "Inicio", "date", { required: true }),
      f("fecha_termino", "Término", "date"),
      f("activo", "Tratamiento activo", "checkbox"),
      f("instrucciones_especiales", "Indicaciones del profesional", "textarea"),
    ],
  },
  consultas_medicas: {
    title: "Consultas médicas",
    module: "salud",
    fields: [
      f("fecha", "Fecha y hora", "datetime-local", { required: true }),
      f("medico_nombre", "Profesional", "text", { required: true }),
      f("especialidad", "Especialidad", "select-other", {
        options: medicalSpecialties, otherLabel: "Otra especialidad",
        customLabel: "Especifica la especialidad", maxLength: 180,
      }),
      f("acompanante", "Acompañante", "select-other", {
        options: ["Madre", "Padre", "Ambos padres", "Abuelo/a", "Tutor/a", "Otro familiar", "Cuidador/a"],
        otherLabel: "Otro", customLabel: "Especifica el acompañante", maxLength: 180, preserveIfMissing: true,
      }),
      f("motivo_consulta", "Motivo", "textarea"),
      f("diagnostico", "Diagnóstico informado", "textarea"),
      f("plan_tratamiento", "Plan de tratamiento", "textarea"),
      f("archivo_r2_key", "Receta o examen", "file"),
    ],
  },
  examenes_medicos: {
    title: "Exámenes médicos",
    module: "salud",
    fields: [
      f("nombre", "Nombre del examen", "text", { required: true }),
      f("fecha", "Fecha de toma", "date", { required: true }),
      f("lugar", "Centro, laboratorio o lugar"),
      f("observaciones", "Observaciones", "textarea"),
      f("archivo_id", "Resultado o imagen", "file"),
    ],
  },
  vacunas: {
    title: "Carnet de vacunas", module: "salud",
    fields: [
      f("catalogo_id", "Referencia", "text", { hidden: true, maxLength: 80 }),
      f("referencia", "Calendario de referencia", "text", { hidden: true, maxLength: 100 }),
      f("nombre", "Vacuna", "text", { required: true, maxLength: 180 }),
      f("dosis", "Dosis / refuerzo", "text", { maxLength: 120 }),
      f("etapa", "Etapa", "select", {options:["Particulares","0–6 meses","12–36 meses","Escolar"]}),
      f("estado", "Estado", "select", {options:["Pendiente/Próxima","Administrada","Atrasada"]}),
      f("fecha_aplicacion", "Fecha de aplicación", "date", {showWhen:{key:"estado",value:"Administrada"}}),
      f("fecha_prevista", "Fecha prevista (opcional)", "date"),
      f("centro", "Centro o lugar de vacunación", "text", {maxLength:250}),
      f("lote_marca", "Lote / marca (opcional)", "text", {maxLength:180}),
      f("notas", "Notas u observaciones", "textarea"),
    ],
  },
  perfiles_escolares: {
    title: "Manual de apoyo",
    module: "escolar",
    single: true,
    fields: [
      f("colegio_actual", "Colegio actual"),
      f("curso", "Curso"),
      f("pie_paci_activo", "PIE / PACI activo", "checkbox"),
      f("fortalezas", "Fortalezas e intereses", "textarea"),
      f("detonantes", "Detonantes sensoriales y ansiedad", "textarea"),
      f(
        "estrategias_autorregulacion",
        "Estrategias de calma y autorregulación",
        "textarea",
      ),
      f("adecuaciones_json", "Adecuaciones vigentes (una por línea)", "lines"),
      f("paec_json", "PAEC: apoyos emocionales y conductuales (uno por línea)", "lines"),
    ],
  },
  historial_colegios: {
    title: "Historial de colegios",
    module: "escolar",
    fields: [
      f("establecimiento", "Establecimiento", "text", { required: true }),
      f("periodo_desde", "Desde", "date"),
      f("periodo_hasta", "Hasta", "date"),
      f("cursos_realizados", "Cursos realizados"),
      f("motivo_retiro", "Motivo de retiro o cambio", "textarea", {
        required: true,
      }),
      f("observaciones", "Observaciones", "textarea"),
    ],
  },
  bitacora_escolar_diaria: {
    title: "Bitácora diaria",
    module: "escolar",
    fields: [
      f("fecha", "Día", "date", { required: true }),
      f("estado_animo", "Estado de ánimo", "select", {
        required: true,
        options: ["tranquilo", "sobrecargado", "feliz", "fatigado"],
      }),
      f("crisis_sobrecarga", "Hubo crisis o sobrecarga sensorial", "checkbox"),
      f("incidentes", "Qué ocurrió", "textarea"),
      f("resolucion", "Apoyos y resolución", "textarea"),
    ],
  },
  credenciales_discapacidad: {
    title: "Credencial RND",
    module: "rnd",
    single: true,
    fields: [
      f("activo", "Credencial activa", "checkbox"),
      f("folio", "Número de registro / folio"),
      f("tipo_discapacidad", "Tipo de discapacidad"),
      f("movilidad_reducida", "Movilidad reducida", "checkbox"),
      f("fecha_vencimiento", "Vencimiento", "date"),
      f("frente_r2_key", "Frente o documento completo", "file"),
      f("reverso_r2_key", "Reverso", "file"),
    ],
  },
};
export const anamnesisSections = [
  [
    "identificacion",
    "Identificación y familia",
    [
      "Padres y cuidadores: nombres, parentesco y contacto",
      "Informante y relación con el niño/a",
      "Integrantes del hogar y red de apoyo",
    ],
  ],
  [
    "embarazo",
    "Embarazo y parto",
    [
      "Semanas de gestación y controles prenatales",
      "Tipo de parto y complicaciones",
      "APGAR al minuto y a los cinco minutos",
      "Peso, talla y perímetro cefálico al nacer",
    ],
  ],
  [
    "desarrollo",
    "Desarrollo sensoriomotor",
    [
      "Edad de sostén cefálico, sedestación y gateo",
      "Edad de la marcha y coordinación motora",
      "Control de esfínteres",
      "Alimentación y selectividad alimentaria",
      "Sueño y autonomía diaria",
    ],
  ],
  [
    "lenguaje",
    "Lenguaje y comunicación",
    [
      "Primeras palabras y evolución verbal",
      "Comunicación gestual y alternativas de comunicación",
      "Comprensión del lenguaje",
      "Ecolalias y particularidades comunicativas",
    ],
  ],
  [
    "social",
    "Área social y conducta",
    [
      "Juego e intereses",
      "Contacto visual e interacción social",
      "Procesamiento sensorial",
      "Estereotipias, rutinas y respuesta a cambios",
      "Apoyos que facilitan la participación",
    ],
  ],
  [
    "antecedentes",
    "Antecedentes médicos y familiares",
    [
      "Diagnósticos y fechas",
      "Cirugías, hospitalizaciones y tratamientos",
      "Exámenes: EEG, genéticos y otros",
      "Antecedentes familiares relevantes",
    ],
  ],
  [
    "educacion",
    "Historial educativo",
    [
      "Salas cuna y jardines",
      "Colegios anteriores y motivos de retiro",
      "Adaptación, apoyos PIE / PACI y necesidades actuales",
    ],
  ],
];
