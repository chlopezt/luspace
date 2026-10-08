import {Activity, ArrowRight, BookOpen, CalendarDays, Check, FileHeart, Heart, LogIn, ShieldCheck, Stethoscope, Users, LockKeyhole} from 'lucide-react';
import {Brand} from './components';
import './landing.css';
import Testimonials from './Testimonials';
import AudiencePurpose from './AudiencePurpose';
import ThemeControl from './ThemeControl';
import './landing-theme.css';

const features = [
  {icon:FileHeart,title:'Su historia de salud, organizada',text:'Reúne consultas, tratamientos, exámenes y recetas. Encuentra lo que necesitas antes de la próxima consulta.'},
  {icon:Activity,title:'Crecer, un registro a la vez',text:'Visualiza las mediciones de peso y talla y las referencias OMS disponibles. Un apoyo para conversar con su profesional, no un diagnóstico.'},
  {icon:BookOpen,title:'Salud y colegio, conectados',text:'Organiza la bitácora, el perfil de apoyo y los documentos PIE, PACI y PAEC en el mismo espacio familiar.'},
  {icon:Users,title:'Comparte solo lo necesario',text:'Entrega a profesionales un enlace temporal con módulos permitidos, vencimiento y PIN opcional. Revoca el acceso cuando lo necesites.'},
];
export default function Landing() {
  return <div className="lp">
    <a className="lp-skip" href="#contenido">Ir al contenido</a>
    <header className="lp-header"><div className="lp-nav">
      <a href="/presentacion" aria-label="LuSpace, presentación"><Brand /></a>
      <nav aria-label="Navegación pública"><a href="#caracteristicas">Características</a><a href="#precios">Precios</a><a href="#seguridad">Seguridad</a><a href="#preguntas">Preguntas frecuentes</a></nav>
      <div className="lp-actions"><ThemeControl/><a className="lp-login" href="/login"><LogIn size={17}/><span>Iniciar sesión</span></a><a className="lp-button" href="/registro">Probar 14 días gratis <ArrowRight size={16}/></a></div>
    </div></header>
    <main id="contenido">
      <section className="lp-hero lp-wrap">
        <div><p className="lp-eyebrow"><Heart size={15}/> CUIDAR CON MÁS CALMA</p><h1>Todo su cuidado.<br/><span>Un solo espacio.</span></h1><p className="lp-lead">La salud, el colegio y los pequeños avances de tus hijos, organizados en un espacio privado para tu familia.</p><p className="lp-intro">Menos documentos dispersos. Más claridad para acompañar cada etapa y preparar la próxima consulta.</p><a className="lp-button lp-large" href="/registro">Probar 14 días gratis <ArrowRight size={18}/></a><p className="lp-note"><Check size={15}/> Sin tarjeta · Sin cobro automático</p></div>
        <div className="lp-illustration" role="img" aria-label="Ilustración del cuidado conectado: salud, crecimiento y colegio. Datos de ejemplo, no información de pacientes.">
          <div className="lp-orbit"/><div className="lp-preview"><div className="lp-preview-heading"><span className="lp-avatar"><Heart/></span><div><strong>Un espacio para crecer</strong><small>Vista ilustrativa · datos de ejemplo</small></div><ShieldCheck className="lp-teal"/></div><div className="lp-preview-grid"><div><Activity/><small>Crecimiento</small><strong>Cada avance cuenta</strong></div><div><BookOpen/><small>Colegio</small><strong>Apoyos que acompañan</strong></div></div><div className="lp-mini-chart"><span>Evolución, paso a paso</span><svg viewBox="0 0 340 100" aria-hidden="true"><path d="M0 90 Q50 80 85 65 T170 45 T255 30 T340 8" fill="none" stroke="#0d9488" strokeWidth="4"/><path d="M0 90 Q50 80 85 65 T170 45 T255 30 T340 8 L340 100 L0 100Z" fill="#ccfbf1" opacity=".6"/></svg></div><div className="lp-preview-bottom"><CalendarDays/><span>Más preparados para la próxima consulta</span><Check size={18}/></div></div>
          <span className="lp-floating"><LockKeyhole size={17}/> Tu familia, su propio espacio</span>
        </div>
      </section>
      <section id="caracteristicas" className="lp-section lp-wrap"><p className="lp-eyebrow">UN CUIDADO MÁS CONECTADO</p><h2>Lo importante, a mano.</h2><p className="lp-section-intro">Diseñado para las familias y quienes las acompañan, con una interfaz tranquila y fácil de usar.</p><div className="lp-features">{features.map(({icon:Icon,title,text})=><article key={title}><span className="lp-feature-icon"><Icon size={25}/></span><h3>{title}</h3><p>{text}</p></article>)}</div><p className="lp-note">Carnet digital de vacunas con referencia PNI Chile y registros por dosis.</p></section>
      <AudiencePurpose/>
      <section id="seguridad" className="lp-section lp-security"><div className="lp-wrap lp-security-grid"><div><p className="lp-eyebrow"><ShieldCheck size={16}/> PRIVACIDAD DESDE EL INICIO</p><h2>Compartir con confianza.<br/>Sin compartir de más.</h2><p className="lp-section-intro">Cada familia tiene un espacio separado. Tú decides quién puede ver y modificar su información.</p></div><ul><li><Check/> Datos y archivos privados, separados por familia.</li><li><Check/> Roles de administración, edición y solo lectura.</li><li><Check/> Accesos profesionales temporales y revocables.</li><li><Check/> Registro de actividad para revisar qué ocurrió.</li></ul></div></section>
      <Testimonials/>
      <section id="precios" className="lp-section lp-wrap"><p className="lp-eyebrow">EMPIEZA SIN COMPROMISO</p><h2>14 días para conocer LuSpace.</h2><div className="lp-price"><div><span className="lp-price-tag">PRUEBA GRATUITA · SIN COBRO INICIAL</span><h3>Tu espacio familiar</h3><p className="lp-price-number">$0 <span>durante 14 días</span></p><div className="lp-paid-plan"><strong>Después de la prueba</strong><p><b>$4.990</b> mensual + IVA</p><small>Precio en pesos chilenos (CLP). IVA no incluido.</small></div><p>Sin plan gratuito permanente. Sin tarjeta ni renovación automática.</p><p>Los pagos aún no están habilitados. No se cobrará automáticamente al terminar la prueba.</p></div><div><ul><li><Check/> Registro de tu familia y perfiles infantiles</li><li><Check/> Módulos de salud, colegio y documentos</li><li><Check/> 50 MB para tus adjuntos durante la prueba</li><li><Check/> Consulta y descarga de datos al finalizar la prueba</li></ul><a className="lp-button lp-large" href="/registro">Probar 14 días a $0 <ArrowRight size={18}/></a></div></div></section>
      <section id="preguntas" className="lp-section lp-wrap lp-faq"><p className="lp-eyebrow">RESOLVEMOS TUS DUDAS</p><h2>Preguntas frecuentes</h2><details><summary>¿Cómo me registro?</summary><p>Con tu correo y una contraseña de LuSpace. El registro con Google estará disponible al completar su configuración; el formulario indicará cuándo puedes usarlo.</p></details><details><summary>¿Qué pasa al terminar los 14 días?</summary><p>Podrás consultar y descargar tu información. La creación, edición y subida de archivos se bloquearán hasta activar una suscripción. No habrá un cobro automático.</p></details><details><summary>¿Otras familias pueden ver nuestros datos?</summary><p>No. Los accesos se limitan a tu familia y a los profesionales con quienes decidas compartir módulos específicos.</p></details><details><summary>¿LuSpace reemplaza una consulta médica?</summary><p>No. LuSpace ayuda a organizar información; no diagnostica, prescribe ni sustituye la evaluación de un profesional de salud.</p></details><details><summary>¿Puedo usarlo desde mi teléfono?</summary><p>Sí. Puedes acceder desde el navegador del teléfono o del computador, sin instalar una aplicación.</p></details></section>
      <section className="lp-final lp-wrap"><Stethoscope size={30}/><h2>Más claridad para cuidar.<br/>Más tiempo para acompañar.</h2><a className="lp-button lp-large" href="/registro">Probar LuSpace gratis <ArrowRight size={18}/></a></section>
    </main><footer className="lp-footer lp-wrap"><Brand/><p>Un espacio para acompañar a tu familia.</p><a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a><a href="/login">Iniciar sesión</a></footer>
  </div>;
}
