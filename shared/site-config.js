export const defaultSiteConfig = {
  hero_title: 'Todo su cuidado. Un solo espacio.',
  hero_subtitle: 'La salud, el colegio y los pequeños avances de tus hijos, organizados en un espacio privado para tu familia.',
  registration_cta: 'Probar 14 días gratis',
  faqs: [
    {question:'¿Cómo me registro?',answer:'Con Google o con tu correo y una contraseña de LuSpace.'},
    {question:'¿Qué pasa al terminar los 14 días?',answer:'Podrás consultar y descargar tu información. Para seguir creando, editando y subiendo archivos debes activar tu acceso. No habrá un cobro automático.'},
    {question:'¿Otras familias pueden ver nuestros datos?',answer:'No. Los accesos se limitan a tu familia y a los profesionales con quienes decidas compartir módulos específicos.'},
    {question:'¿LuSpace reemplaza una consulta médica?',answer:'No. LuSpace organiza información; no diagnostica, prescribe ni sustituye una evaluación profesional.'},
    {question:'¿Puedo usarlo desde mi teléfono?',answer:'Sí, desde el navegador del teléfono o del computador.'},
  ],
  banner: {enabled:false,type:'info',text:''},
  contact: {email:'contacto@luspace.cl',whatsapp:'',instagram:'',facebook:'',linkedin:''},
};
const invalid = message => {throw Object.assign(new Error(message),{status:400});};
function plain(value,max,required=false) {
  if(typeof value!=='string'||value.length>max||/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid('Usa texto simple dentro del límite indicado.');
  const result=value.trim(); if(required&&!result)invalid('Completa los campos obligatorios.'); return result;
}
export function validateSiteConfig(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('Configuración inválida.');
  if(!Array.isArray(value.faqs)||value.faqs.length>30)invalid('Puedes registrar hasta 30 preguntas frecuentes.');
  if(typeof value.banner?.enabled!=='boolean'||!['info','warning','promotion'].includes(value.banner.type))invalid('Banner inválido.');
  const contact=value.contact||{};
  const email=plain(contact.email,254,true);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))invalid('Correo de contacto inválido.');
  const whatsapp=plain(contact.whatsapp,16);if(whatsapp&&!/^\+?[1-9]\d{7,14}$/.test(whatsapp))invalid('WhatsApp: usa código de país y números, por ejemplo +56912345678.');
  const socials={};for(const key of ['instagram','facebook','linkedin']) {
    const url=plain(contact[key],500);if(url){try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)invalid('Los enlaces deben usar HTTPS sin credenciales.');}catch{invalid('Enlace de red social inválido.');}}
    socials[key]=url;
  }
  return {
    hero_title:plain(value.hero_title,140,true),hero_subtitle:plain(value.hero_subtitle,500,true),registration_cta:plain(value.registration_cta,70,true),
    faqs:value.faqs.map(item=>({question:plain(item?.question,180,true),answer:plain(item?.answer,1500,true)})),
    banner:{enabled:value.banner.enabled,type:value.banner.type,text:plain(value.banner.text,300,value.banner.enabled)},
    contact:{email,whatsapp,...socials},
  };
}
