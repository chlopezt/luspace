import {Brand} from './components';
import Theme from './ThemeControl';
import {useStartupLoading} from './StartupScreen';
import {LEGAL_CONTACT,LEGAL_VERSION} from '../shared/legal.js';
import {privacy} from '../shared/legal-content-v1.js';
import {legalTitle,updatedAt,sections} from '../shared/legal-content-v2.js';
import './legal.css';

export default function LegalPage({kind}:{kind:'terms'|'privacy'}) {
  useStartupLoading(false);
  const title=kind==='terms'?legalTitle:'Política de privacidad';
  return <div className="legal-page"><header className="legal-header"><a href="/presentacion" aria-label="Volver al inicio de LuSpace"><Brand/></a><Theme/></header>
    <main className="legal-document"><a href="/">← Volver a LuSpace</a><h1>{title}</h1><p className="muted">Última actualización: {updatedAt}</p>
      <p>Dominio oficial: <a href="https://luspace.cl">https://luspace.cl</a><br/>Contacto legal: <a href={'mailto:'+LEGAL_CONTACT}>{LEGAL_CONTACT}</a></p>
      <nav aria-label="Documentos legales"><a href="/terminos">Términos y condiciones</a><a href="/privacidad">Política de privacidad</a></nav>
      {kind==='terms'?sections.map(section=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map(text=><p key={text}>{text}</p>)}{section.items&&<ul>{section.items.map(([label,text])=><li key={label}><strong>{label}:</strong> {text}</li>)}</ul>}</section>):<>{privacy.map(([heading,text])=><section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}<section><h2>Contacto</h2><p><a href={'mailto:'+LEGAL_CONTACT}>{LEGAL_CONTACT}</a>. No envíes documentos médicos o de identidad por correo sin acordar un canal seguro.</p></section></>}
      <p className="muted legal-version">Versión {LEGAL_VERSION}</p>
    </main></div>;
}
