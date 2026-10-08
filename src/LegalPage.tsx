import {Brand} from './components';
import Theme from './ThemeControl';
import {LEGAL_CONTACT,LEGAL_VERSION} from '../shared/legal.js';
import {terms,privacy} from '../shared/legal-content-v1.js';
import './legal.css';

export default function LegalPage({kind}:{kind:'terms'|'privacy'}) {
  const title=kind==='terms'?'Términos y condiciones':'Política de privacidad';
  return <div className="legal-page"><header className="legal-header"><a href="/presentacion" aria-label="Volver al inicio de LuSpace"><Brand/></a><Theme/></header>
    <main className="legal-document"><a href="/registro">← Volver al registro</a><h1>{title}</h1><p className="muted">Versión {LEGAL_VERSION} · 8 de octubre de 2026</p>
      <aside className="legal-draft">Versión inicial pendiente de revisión legal. El correo de contacto aún no está habilitado; consulta su estado al final de esta página.</aside>
      <nav aria-label="Documentos legales"><a href="/terminos">Términos y condiciones</a><a href="/privacidad">Política de privacidad</a></nav>
      {(kind==='terms'?terms:privacy).map(([heading,text])=><section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
      <section><h2>Contacto</h2><p>Correo previsto: <a href={'mailto:'+LEGAL_CONTACT}>{LEGAL_CONTACT}</a>. Este buzón está pendiente de habilitación y aún no recibe solicitudes. No envíes documentos médicos o de identidad por correo sin acordar un canal seguro.</p></section>
    </main></div>;
}
