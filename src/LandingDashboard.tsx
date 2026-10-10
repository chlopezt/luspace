import {Activity,BookOpen,CalendarDays,Check,Heart,FileHeart,ShieldCheck} from 'lucide-react';

export default function LandingDashboard(){
 return <div className="lp-dashboard">
  <aside className="lp-dashboard-nav" aria-hidden="true"><img src="/brand/luspace-horizontal.png" alt="" width="2172" height="724"/><span><Heart/>Inicio</span><span><Activity/>Salud</span><span><BookOpen/>Escolar</span><span><FileHeart/>Anamnesis</span><span><ShieldCheck/>Credencial RND</span></aside>
  <div className="lp-dashboard-body"><div className="lp-preview-heading"><div><strong>¡Hola, Familia!</strong><small>Vista demostrativa · datos ficticios</small></div><span className="lp-demo-profile"><Heart size={16}/>Tu espacio</span></div>
   <div className="lp-dashboard-grid">
    <div className="lp-demo-card lp-demo-blue"><CalendarDays/><small>Próximas citas</small><strong>Pediatría</strong><span>Control de ejemplo · 10:00</span></div>
    <div className="lp-demo-card lp-demo-purple"><BookOpen/><small>Hoy en el colegio</small><strong>Actividades del día</strong><span>Materiales y recordatorios</span></div>
    <div className="lp-demo-card lp-demo-warm"><FileHeart/><small>Último registro</small><strong>Notas de evolución</strong><span>Cada pequeño avance cuenta</span></div>
    <div className="lp-demo-card lp-demo-mint"><Activity/><small>Crecimiento</small><strong>Evolución, paso a paso</strong><div className="lp-mini-chart"><svg viewBox="0 0 340 100" aria-hidden="true"><path className="lp-curve-area" d="M0 90 Q50 80 85 65 T170 45 T255 30 T340 8 L340 100 L0 100Z" fill="#ccfbf1" opacity=".6"/><path className="lp-curve-line" pathLength="1" d="M0 90 Q50 80 85 65 T170 45 T255 30 T340 8" fill="none" stroke="#0d9488" strokeWidth="4"/></svg></div></div>
   </div><div className="lp-preview-bottom"><Check size={16}/><span>Salud y colegio, en un mismo espacio</span></div>
  </div>
 </div>;
}
