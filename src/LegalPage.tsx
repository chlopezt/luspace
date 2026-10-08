import {Brand} from './components';
import Theme from './ThemeControl';
import {useStartupLoading} from './StartupScreen';
import {LEGAL_CONTACT,LEGAL_VERSION} from '../shared/legal.js';
import {updatedAt,termsSections,privacySections} from '../shared/legal-content-v3.js';
import './legal.css';

export default function LegalPage({kind}:{kind:'terms'|'privacy'}) {
  useStartupLoading(false);
  const title=kind==='terms'?'Términos y condiciones':'Política de privacidad';
  const sections: {title:string;paragraphs?:string[];items?:string[][]}[]=kind==='terms'?termsSections:privacySections;
  return <div className="legal-page"><header className="legal-header"><a href="/presentacion" aria-label="Volver al inicio de LuSpace"><Brand/></a><Theme/></header>
    <main className="legal-document"><a href="/">← Volver a LuSpace</a><h1>{title}</h1><p className="muted">Última actualización: {updatedAt}</p>
      <p>Dominio oficial: <a href="https://luspace.cl">https://luspace.cl</a><br/>Contacto legal: <a href={'mailto:'+LEGAL_CONTACT}>{LEGAL_CONTACT}</a></p>
      <nav aria-label="Documentos legales"><a href="/terminos">Términos y condiciones</a><a href="/privacidad">Política de privacidad</a></nav>
      {sections.map(section=><section key={section.title}><h2>{section.title}</h2>{section.paragraphs?.map(text=><p key={text}>{text}</p>)}{section.items&&<ul>{section.items.map(([label,text])=><li key={label}><strong>{label}:</strong> {text}</li>)}</ul>}</section>)}
      <p className="muted legal-version">Versión {LEGAL_VERSION}</p>
    </main></div>;
}
