import {Heart, BookOpen, ChartNoAxesColumnIncreasing, ShieldCheck, Sparkle} from 'lucide-react';
import {Brand} from './components';
import './auth-welcome.css';

export default function AuthWelcome(){
  return <aside className="auth-welcome" aria-label="Bienvenida a LuSpace">
    <a className="welcome-brand" href="/presentacion" aria-label="LuSpace, volver al inicio"><Brand/></a>
    <div className="welcome-copy">
      <span className="welcome-badge">Bienvenido a LuSpace</span>
      <h2>Un espacio para <br className="welcome-title-break"/>cada <span>etapa de</span> <em>su desarrollo</em></h2>
      <p>Acompañamos a las familias y profesionales en el bienestar, aprendizaje y crecimiento de cada niño o niña.</p>
      <div className="welcome-features">
        <div><Heart/><span><strong>Salud</strong><small>Seguimiento integral</small></span></div>
        <div><BookOpen/><span><strong>Escolar</strong><small>Apoyo en el aprendizaje</small></span></div>
        <div><ChartNoAxesColumnIncreasing/><span><strong>Anamnesis</strong><small>Información organizada</small></span></div>
        <div><ShieldCheck/><span><strong>Credencial RND</strong><small>Gestión simple</small></span></div>
      </div>
    </div>
    <p className="welcome-signature">Juntos por su futuro</p>
    <img className="welcome-child" src="/brand/login-boy-v2.webp" alt="" width="640" height="960" decoding="async"/>
    <img className="welcome-rocket" src="/brand/login-rocket.webp" alt="" width="240" height="240" decoding="async"/>
    <Sparkle className="welcome-spark welcome-spark-one" aria-hidden="true"/><Sparkle className="welcome-spark welcome-spark-two" aria-hidden="true"/>
  </aside>;
}
