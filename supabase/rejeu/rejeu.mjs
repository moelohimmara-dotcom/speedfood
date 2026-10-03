// Rejoue tous les fichiers de supabase/migrations sur une base PostgreSQL jetable
// (PGlite, en memoire, sans Docker ni compte) et affiche la signature du schema
// public, a comparer avec celle de la production (voir README.md).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const dossierMigrations = path.join(ici, "..", "migrations");
const db = new PGlite();

// Elements fournis par Supabase que la production possede deja.
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
`);

const fichiers = fs.readdirSync(dossierMigrations).filter((f) => f.endsWith(".sql")).sort();
console.log(`${fichiers.length} migrations a rejouer`);

for (const f of fichiers) {
  let sql = fs.readFileSync(path.join(dossierMigrations, f), "utf8");
  // pgcrypto n'existe pas dans PGlite ; gen_random_uuid() est natif depuis PostgreSQL 13.
  sql = sql.replace(/create extension if not exists pgcrypto;?/gi, "");
  try {
    await db.exec(sql);
    console.log(`  OK     ${f}`);
  } catch (erreur) {
    console.log(`  ECHEC  ${f}\n         ${erreur.message}`);
    process.exit(1);
  }
}
console.log(`${fichiers.length}/${fichiers.length} migrations rejouees sans erreur\n`);

const { rows } = await db.query(fs.readFileSync(path.join(ici, "signature.sql"), "utf8"));
console.log("SIGNATURE (a comparer avec la production)");
for (const r of rows) console.log(`${String(r.k).padEnd(12)} ${String(r.n).padStart(4)}  ${r.h}`);
