import {
  Users,
  HeartHandshake,
  School,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import "./audience-purpose.css";

const audiences = [
  {
    icon: Users,
    title: "Padres y Cuidadores",
    text: "Unifica consultas, medicamentos, vacunas, exámenes y documentos desde recién nacidos hasta la etapa escolar en un repositorio seguro.",
  },
  {
    icon: HeartHandshake,
    title: "Familias con Necesidades Específicas",
    text: "Especialmente diseñado para el seguimiento, bitácora y coordinación de niños neurodivergentes, con discapacidad o condiciones de salud.",
  },
  {
    icon: School,
    title: "Profesionales y Equipos Educativos",
    text: "Permite compartir accesos temporales o informes descargables únicamente con las personas que la familia autorice.",
  },
];

export default function AudiencePurpose() {
  return (
    <section
      id="para-quien"
      className="lp-section lp-wrap lp-purpose"
      aria-labelledby="purpose-title"
    >
      <p className="lp-eyebrow">
        <Sparkles size={16} aria-hidden="true" /> ¿PARA QUIÉN ES LUSPACE?
      </p>
      <h2 id="purpose-title">
        Salud, educación y cuidado diario en un solo lugar
      </h2>
      <p className="lp-purpose-lead">
        LuSpace conecta la salud, la educación y el cuidado diario de los niños
        en un solo lugar, bajo el control absoluto de su familia.
      </p>
      <div className="lp-audience-grid">
        {audiences.map(({ icon: Icon, title, text }) => (
          <article className="lp-audience-card" key={title}>
            <span className="lp-audience-icon">
              <Icon size={27} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <aside className="lp-origin" aria-labelledby="origin-title">
        <span className="lp-origin-icon">
          <LockKeyhole size={27} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div>
          <h3 id="origin-title">Un espacio privado para cada familia</h3>
          <p>
            LuSpace nació para acompañar a <strong>Luciano</strong>, pero está
            pensada para acompañar a cada niño y niña en su propio camino. Cada
            familia cuenta con su propio espacio privado y personalizado.
          </p>
        </div>
      </aside>
    </section>
  );
}
