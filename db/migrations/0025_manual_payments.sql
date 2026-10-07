ALTER TABLE familias ADD COLUMN manual_paid_until TEXT;
ALTER TABLE familias ADD COLUMN manual_access_managed INTEGER NOT NULL DEFAULT 0 CHECK(manual_access_managed IN(0,1));
CREATE TABLE pagos_manuales (
 id TEXT PRIMARY KEY,
 familia_id TEXT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
 tipo TEXT NOT NULL CHECK(tipo IN('transferencia','cortesia')),
 estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','confirmado','rechazado')),
 monto_clp INTEGER NOT NULL CHECK(monto_clp>=0 AND monto_clp<=1000000000),
 fecha_pago TEXT NOT NULL,
 referencia TEXT NOT NULL DEFAULT '',
 notas TEXT NOT NULL DEFAULT '',
 notas_revision TEXT NOT NULL DEFAULT '',
 dias_cortesia INTEGER NOT NULL DEFAULT 0 CHECK(dias_cortesia BETWEEN 0 AND 90),
 cuota_bytes INTEGER NOT NULL DEFAULT 0 CHECK(cuota_bytes BETWEEN 0 AND 10737418240),
 creado_por TEXT NOT NULL REFERENCES usuarios(id),
 revisado_por TEXT REFERENCES usuarios(id),
 creado_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 revisado_at TEXT,
 periodo_inicio TEXT,
 periodo_fin TEXT,
 request_key TEXT NOT NULL,
 UNIQUE(creado_por,request_key),
 CHECK((tipo='transferencia' AND monto_clp>0 AND dias_cortesia=0) OR (tipo='cortesia' AND monto_clp=0 AND dias_cortesia>0))
);
CREATE INDEX pagos_manuales_familia ON pagos_manuales(familia_id,creado_at DESC);
CREATE UNIQUE INDEX pagos_manuales_referencia ON pagos_manuales(familia_id,referencia) WHERE referencia<>'' AND tipo='transferencia' AND estado<>'rechazado';
-- Confirmation, period calculation, access and audit are one atomic SQL operation.
-- No Mercado Pago contract/payment is created or modified by these triggers.
CREATE TRIGGER pagos_manuales_confirmar AFTER UPDATE OF estado ON pagos_manuales
WHEN OLD.estado='pendiente' AND NEW.estado='confirmado' BEGIN
 UPDATE pagos_manuales SET periodo_inicio=CASE
   WHEN julianday((SELECT manual_paid_until FROM familias WHERE id=NEW.familia_id))>julianday('now')
   THEN (SELECT manual_paid_until FROM familias WHERE id=NEW.familia_id)
   ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now') END WHERE id=NEW.id;
 UPDATE pagos_manuales SET periodo_fin=CASE WHEN tipo='cortesia'
   THEN strftime('%Y-%m-%dT%H:%M:%fZ',periodo_inicio,'+'||dias_cortesia||' days')
   ELSE date(periodo_inicio,'start of month','+1 month',printf('+%d days',min(CAST(strftime('%d',periodo_inicio) AS INTEGER),CAST(strftime('%d',date(periodo_inicio,'start of month','+2 months','-1 day')) AS INTEGER))-1))||substr(periodo_inicio,11) END WHERE id=NEW.id;
 UPDATE familias SET manual_paid_until=(SELECT periodo_fin FROM pagos_manuales WHERE id=NEW.id),manual_access_managed=1,
   subscription_status='active',storage_limit_bytes=CASE WHEN NEW.cuota_bytes>0 THEN NEW.cuota_bytes ELSE storage_limit_bytes END WHERE id=NEW.familia_id;
 INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) VALUES(NEW.id||'-confirm',NEW.revisado_por,'CONFIRM_MANUAL_ACCESS',json_object('familia_id',NEW.familia_id,'registro',NEW.id,'tipo',NEW.tipo,'monto_clp',NEW.monto_clp,'motivo',NEW.notas_revision,'hasta',(SELECT periodo_fin FROM pagos_manuales WHERE id=NEW.id)));
END;
CREATE TRIGGER pagos_manuales_rechazar AFTER UPDATE OF estado ON pagos_manuales
WHEN OLD.estado='pendiente' AND NEW.estado='rechazado' BEGIN
 INSERT INTO auditoria_plataforma(id,usuario_id,accion,descripcion) VALUES(NEW.id||'-reject',NEW.revisado_por,'REJECT_MANUAL_PAYMENT',json_object('familia_id',NEW.familia_id,'registro',NEW.id,'motivo',NEW.notas_revision));
END;
