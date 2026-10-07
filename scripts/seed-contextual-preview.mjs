// Fictitious, local-only data. Never connects to Cloudflare or production.
import { resolve } from "node:path";
import { localEnv } from "../server/local.js";
import { handle } from "../server/api.js";
import { PDFDocument, StandardFonts } from "pdf-lib";
const directory = resolve("../work/contextual-preview-v2");
const env = localEnv(directory);
let cookie = "";
async function call(path, method = "GET", data) {
  const res = await handle(
    new Request("http://127.0.0.1:5180/api/" + path, {
      method,
      headers: {
        origin: "http://127.0.0.1:5180",
        cookie,
        ...(data instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
    env,
  );
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  const body = await res.json();
  if (!res.ok) throw new Error(path + ": " + JSON.stringify(body));
  return body;
}
async function file(child, module, name) {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([595, 842]),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("LuSpace - Documento de demostracion", {
    x: 50,
    y: 760,
    size: 18,
    font,
  });
  page.drawText(name, { x: 50, y: 720, size: 12, font });
  page.drawText("Datos ficticios. No es un documento clinico.", {
    x: 50,
    y: 680,
    size: 12,
    font,
  });
  const data = new FormData();
  data.append(
    "file",
    new Blob([await pdf.save()], { type: "application/pdf" }),
    name,
  );
  return (await call(`files?child=${child}&module=${module}`, "POST", data)).id;
}
try {
  const status = await call("status");
  if (!status.setup) {
    console.log("Vista previa existente conservada: " + directory);
    process.exitCode = 0;
  } else {
    await call("setup", "POST", {
      nombre: "Camila (demostración)",
      familia: "Familia de vista previa",
      correo: "familia@preview.luspace.test",
      password: "VistaPrevia!2026",
    });
    const child = (
      await call("children", "POST", {
        primer_nombre: "Alex",
        apellidos: "Ejemplo",
        fecha_nacimiento: "2020-03-12",
        sexo_referencia: "masculino",
        alergias: "Registro ficticio para revisión visual",
        convivientes: "Ambos padres",
      })
    ).id;
    const a = await file(child, "salud", "Indicaciones-consulta.pdf"),
      b = await file(child, "salud", "Resultado-examen.pdf");
    await call("records/consultas_medicas?child=" + child, "POST", {
      fecha: "2026-10-20T15:00:00Z",
      medico_nombre: "Profesional de demostración",
      especialidad: "Pediatría General / Infantil",
      motivo_consulta: "Control de crecimiento",
      adjuntos_json: [a, b],
    });
    await call("records/registros_crecimiento?child=" + child, "POST", {
      fecha_medicion: "2026-10-06",
      peso_kg: 21,
      talla_cm: 119,
      notas: "Medición ficticia",
      adjuntos_json: [],
    });
    await call("records/medicamentos?child=" + child, "POST", {
      nombre: "Tratamiento de demostración",
      dosis: "Dosis ficticia para revisar la interfaz",
      frecuencia_horas: 24,
      hora_referencia: "2026-10-06T12:00:00Z",
      fecha_inicio: "2026-10-01",
      activo: 1,
      instrucciones_especiales: "No es una indicación médica",
      adjuntos_json: [a],
    });
    await call("records/vacunas?child=" + child, "POST", {
      nombre: "Vacuna de demostración",
      etapa: "Particulares",
      estado: "Pendiente/Próxima",
      fecha_prevista: "2026-10-20",
      notas: "Registro ficticio para revisar el carnet",
      adjuntos_json: [b],
    });
    await call("records/alimentacion?child=" + child, "POST", {
      fecha: "2026-10-06T16:00:00Z",
      via: "Oral",
      tipo_comida: "Almuerzo",
      textura: "Picado",
      cantidad: 80,
      unidad: "%",
      aceptacion: "Buena tolerancia; ambiente tranquilo",
      reacciones: "Sin síntomas observados",
      adjuntos_json: [b],
    });
    await call("records/examenes_medicos?child=" + child, "POST", {
      nombre: "Examen de demostración",
      fecha: "2026-10-05",
      lugar: "Centro ficticio",
      observaciones: "Solo para revisión",
      adjuntos_json: [b],
    });
    const school = await file(child, "escolar", "Apoyos-del-entorno.pdf"),
      plan = await file(child, "escolar", "Plan-PAEC.pdf");
    await call("records/perfiles_escolares?child=" + child, "POST", {
      colegio: "Institución de demostración",
      curso: "1° Básico",
      fortalezas: "Curiosidad y creatividad",
      detonantes: "Ruidos intensos",
      estrategias_autorregulacion: "Pausas en un espacio tranquilo",
      adecuaciones_json: ["Anticipar cambios de rutina"],
      adjuntos_json: [school],
      adecuaciones_adjuntos_json: [plan],
    });
    await call("records/historial_colegios?child=" + child, "POST", {
      establecimiento: "Jardín de demostración",
      periodo_desde: "2024-03-01",
      periodo_hasta: "2025-12-01",
      motivo_retiro: "Cambio de etapa educativa",
      adjuntos_json: [school],
    });
    await call("records/bitacora_escolar_diaria?child=" + child, "POST", {
      fecha: "2026-10-06",
      estado_animo: "tranquilo",
      incidentes: "Jornada ficticia de demostración",
      resolucion: "Pausas y anticipación",
      adjuntos_json: [school],
    });
    const anam = await file(
      child,
      "anamnesis",
      "Antecedentes-del-desarrollo.pdf",
    );
    const current = await call("anamnesis?child=" + child);
    await call("anamnesis?child=" + child, "PUT", {
      version: current.version,
      documento: {
        identificacion: {
          0: "Datos ficticios de vista previa",
          archivos: [anam],
        },
      },
    });
    console.log(
      "Vista previa aislada preparada: " +
        directory +
        "; cuenta familia@preview.luspace.test",
    );
  }
  await call("login", "POST", {
    correo: "familia@preview.luspace.test",
    password: "VistaPrevia!2026",
  });
  const demoUser = await call("me");
  if (
    !(await env.DB.prepare(
      "SELECT usuario_id FROM credenciales_plataforma WHERE usuario_id=?",
    )
      .bind(demoUser.id)
      .first())
  ) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO administradores_plataforma(usuario_id) VALUES(?)",
    )
      .bind(demoUser.id)
      .run();
    await call("platform/enroll", "POST", {
      correo: "admin@preview.luspace.test",
      current_password: "VistaPrevia!2026",
      password: "AdminVista!2026",
    });
  }
} finally {
  env.close();
}
