import {LEGAL_VERSION} from '../shared/legal.js';
import {uid} from './security.js';

export function requireConsent(input) {
  if (input.legal_accepted !== true || input.legal_version !== LEGAL_VERSION)
    throw Object.assign(new Error('Lee y acepta los términos y la política de privacidad.'), {status:400});
  return LEGAL_VERSION;
}
export function consentStatement(db, user, family, version, channel, now = new Date().toISOString()) {
  if (version !== LEGAL_VERSION) throw Object.assign(new Error('Los documentos cambiaron. Revisa y acepta su versión actual.'),{status:400});
  // General terms acceptance must not fabricate a separate sensitive-data declaration.
  return db.prepare('INSERT INTO consentimientos_registro(id,usuario_id,familia_id,version_legal,canal,aceptado_at,autorizacion_cuidado) VALUES(?,?,?,?,?,?,0)').bind(uid(),user,family,version,channel,now);
}

