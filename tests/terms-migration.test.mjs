import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('terms-only migration preserves historical declarations and ownership protection',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE familias(id TEXT PRIMARY KEY); CREATE TABLE usuarios(id TEXT PRIMARY KEY,familia_id TEXT REFERENCES familias(id)); CREATE TABLE oauth_google_estados(id TEXT); INSERT INTO familias VALUES('a'),('b'); INSERT INTO usuarios VALUES('u','a');");
    db.exec(readFileSync(new URL('../db/migrations/0027_registration_consent.sql',import.meta.url),'utf8'));
    db.exec("INSERT INTO consentimientos_registro VALUES('old','u','a','v1','correo','2026-10-08',1)");
    const original=db.prepare('SELECT * FROM consentimientos_registro').get();
    db.exec('BEGIN');db.exec(readFileSync(new URL('../db/migrations/0029_registration_terms_only.sql',import.meta.url),'utf8'));db.exec('COMMIT');
    assert.deepEqual(db.prepare("SELECT * FROM consentimientos_registro WHERE id='old'").get(),original);
    db.exec("INSERT INTO consentimientos_registro VALUES('new','u','a','v2','google','2026-10-09',0)");
    assert.throws(()=>db.exec("INSERT INTO consentimientos_registro VALUES('bad','u','b','v3','correo','2026-10-09',0)"),/familia/);
    assert.throws(()=>db.exec("UPDATE consentimientos_registro SET autorizacion_cuidado=0 WHERE id='old'"),/original/);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();}
});

