import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { handle } from "./api.js";
export function localEnv(directory = process.env.LUSPACE_DATA_DIR || ".local") {
  const root = resolve(directory);
  mkdirSync(root, { recursive: true });
  const sqlite = new DatabaseSync(resolve(root, "luspace.sqlite"));
  sqlite.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY)",
  );
  for (const name of ["schema.sql", "0002_security.sql", "0003_audit_ip.sql", "0004_d1_file_storage.sql", "0005_d1_file_chunks.sql", "0006_medical_exams.sql", "0007_profile_access_and_paec.sql", "0008_profile_identity_fields.sql", "0009_family_admin.sql", "0010_platform_admin.sql", "migrations/0011_platform_login.sql", "migrations/0012_family_subscription.sql", "migrations/0013_platform_family_controls.sql", "migrations/0014_r2_verified_files.sql", "migrations/0015_google_login.sql", "migrations/0016_consumption_notifications.sql", "migrations/0017_legacy_inline_file_markers.sql", "migrations/0018_profile_household_hospitalization.sql", "migrations/0019_vaccination_records.sql", "migrations/0020_backup_status.sql"]) {
    if (
      !sqlite
        .prepare("SELECT name FROM schema_migrations WHERE name=?")
        .get(name)
    ) {
      sqlite.exec("BEGIN");
      try {
        sqlite.exec(
          readFileSync(new URL("../db/" + name, import.meta.url), "utf8"),
        );
        sqlite
          .prepare("INSERT INTO schema_migrations(name) VALUES(?)")
          .run(name);
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    }
  }
  const previewMigration='migrations/0021_contextual_files_nutrition.sql';
  if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(previewMigration)){
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../db/'+previewMigration,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(previewMigration);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const careMigration='migrations/0023_sos_urgent_school.sql';
  if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(careMigration)){
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../db/'+careMigration,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(careMigration);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const teamMigration='migrations/0024_therapy_expenses_caregivers.sql';
  if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(teamMigration)){
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../db/'+teamMigration,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(teamMigration);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const manualMigration='migrations/0025_manual_payments.sql';
  if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(manualMigration)){
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../db/'+manualMigration,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(manualMigration);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const mfaMigration='migrations/0026_platform_mfa.sql';
  if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(mfaMigration)){
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../db/'+mfaMigration,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(mfaMigration);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const consentMigration='migrations/0027_registration_consent.sql';
  if(!sqlite.prepare('SELECT name FROM schema_migrations WHERE name=?').get(consentMigration)){
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../db/'+consentMigration,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(consentMigration);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const prepared = (sql, args = []) => ({
    sql,
    args,
    bind(...a) {
      return prepared(sql, a);
    },
    async first() {
      return sqlite.prepare(sql).get(...args) || null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...args) };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...args);
      return { meta: { changes: Number(r.changes) } };
    },
  });
  const DB = {
    prepare: prepared,
    async batch(queries) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = queries.map((q) => ({
          meta: {
            changes: Number(sqlite.prepare(q.sql).run(...q.args).changes),
          },
        }));
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const objectPath = (key) => {
    if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+$/.test(key))
      throw new Error("Invalid object key");
    return resolve(root, "files", ...key.split("/"));
  };
  const FILES = {
    async put(key, data) {
      const p = objectPath(key);
      mkdirSync(resolve(p, ".."), { recursive: true });
      writeFileSync(p, new Uint8Array(data));
    },
    async get(key) {
      const p = objectPath(key);
      return existsSync(p) ? { body: readFileSync(p) } : null;
    },
    async delete(key) {
      const p = objectPath(key);
      if (existsSync(p)) unlinkSync(p);
    },
  };
  return { DB, FILES, LOCAL_DEV: true, LUSPACE_REGISTRATION_ENABLED: "true", close: () => sqlite.close() };
}
export function localApiPlugin() {
  let env;
  return {
    name: "luspace-local-api",
    configureServer(server) {
      env = localEnv();
      server.httpServer?.once("close", () => env.close());
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 11000000) {
              res.statusCode = 413;
              res.end("Archivo demasiado grande");
              return;
            }
            chunks.push(chunk);
          }
          const base = "http://" + req.headers.host;
          const request = new Request(new URL(req.url, base), {
            method: req.method,
            headers: req.headers,
            body: ["GET", "HEAD"].includes(req.method)
              ? undefined
              : Buffer.concat(chunks),
          });
          const response = await handle(request, env);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end("Error de servidor local");
        }
      });
    },
  };
}
