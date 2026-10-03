// Preuve de restauration : rejoue les migrations sur une base jetable (PGlite, en mémoire, sans
// Docker ni compte), y recharge un export produit par exporter.mjs, puis compare le nombre de
// lignes de chaque table avec le manifeste et vérifie des liens d'intégrité.
// Usage : npm run export:verifier -- [dossier-d-export]   (par défaut, le plus récent)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { PGlite } = await import(
  pathToFileURL(path.join(racine, "supabase", "rejeu", "node_modules", "@electric-sql", "pglite", "dist", "index.js")).href
).catch(() => {
  console.error("PGlite absent : lancez d'abord  cd supabase/rejeu && npm install");
  process.exit(1);
});

const dossierExports = path.join(os.homedir(), "speedfood-exports");
const argument = process.argv[2];
let export_ = argument ? path.resolve(argument) : null;
if (!export_) {
  const noms = fs.existsSync(dossierExports)
    ? fs.readdirSync(dossierExports).filter((n) => /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(n)).sort()
    : [];
  if (noms.length === 0) {
    console.error("Aucun export trouvé : lancez d'abord  npm run export:donnees");
    process.exit(1);
  }
  export_ = path.join(dossierExports, noms[noms.length - 1]);
}
const manifeste = JSON.parse(fs.readFileSync(path.join(export_, "manifeste.json"), "utf8"));
console.log(`Export vérifié : ${path.basename(export_)}  (${Object.keys(manifeste.tables).length} tables)`);

let echecs = 0;
const verifier = (nom, ok, detail = "") => {
  console.log(`  ${ok ? "OK    " : "ECHEC "} ${nom}${detail ? "  " + detail : ""}`);
  if (!ok) echecs += 1;
};

// 1. Intégrité des fichiers exportés (empreintes du manifeste).
for (const [table, infos] of Object.entries(manifeste.tables)) {
  const contenu = fs.readFileSync(path.join(export_, "tables", `${table}.json`), "utf8");
  verifier(`empreinte ${table}`, createHash("sha256").update(contenu).digest("hex") === infos.sha256);
}
for (const [chemin, empreinte] of Object.entries(manifeste.fichiers.empreintes)) {
  const octets = fs.readFileSync(path.join(export_, "stockage", ...chemin.split("/")));
  verifier(`empreinte fichier ${chemin}`, createHash("sha256").update(octets).digest("hex") === empreinte);
}

// 2. Base jetable : migrations, puis chargement des données.
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text);
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
`);
const dossierMigrations = path.join(racine, "supabase", "migrations");
for (const f of fs.readdirSync(dossierMigrations).filter((n) => n.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(dossierMigrations, f), "utf8").replace(/create extension if not exists pgcrypto;?/gi, ""));
}
verifier("migrations rejouées", true, `${manifeste.migrations.length} fichiers dans l'export, ${fs.readdirSync(dossierMigrations).filter((n) => n.endsWith(".sql")).length} dans le dépôt`);

// Les comptes d'authentification sont recréés (identifiant et email) pour les clés étrangères.
const comptes = JSON.parse(fs.readFileSync(path.join(export_, "comptes.json"), "utf8"));
for (const c of comptes) await db.query("insert into auth.users (id, email) values ($1, $2)", [c.id, c.email]);

await db.exec("set session_replication_role = replica"); // ordre de chargement indifférent
// Les migrations insèrent des lignes de départ (réglages, catégories, quartiers) : on repart de tables
// vides pour que le résultat ne dépende que de l'export.
for (const table of Object.keys(manifeste.tables)) {
  await db.query(`delete from public.${JSON.stringify(table)}`);
}
for (const table of Object.keys(manifeste.tables)) {
  const lignes = JSON.parse(fs.readFileSync(path.join(export_, "tables", `${table}.json`), "utf8"));
  if (lignes.length === 0) continue;
  await db.query(`insert into public.${JSON.stringify(table)} select * from jsonb_populate_recordset(null::public.${JSON.stringify(table)}, $1::jsonb)`, [JSON.stringify(lignes)]);
}
await db.exec("set session_replication_role = origin");

// 3. Comparaison des comptes de lignes.
for (const [table, infos] of Object.entries(manifeste.tables)) {
  const { rows } = await db.query(`select count(*)::int as n from public.${JSON.stringify(table)}`);
  verifier(`lignes ${table}`, rows[0].n === infos.lignes, `${rows[0].n} / ${infos.lignes}`);
}

// 4. Liens d'intégrité : rien ne doit pointer dans le vide.
const controles = [
  ["lignes de commande sans commande", "select count(*)::int n from order_items i left join orders o on o.id = i.order_id where o.id is null"],
  ["commandes sans restaurant", "select count(*)::int n from orders o left join restaurants r on r.id = o.restaurant_id where r.id is null"],
  ["plats sans restaurant", "select count(*)::int n from menu_items m left join restaurants r on r.id = m.restaurant_id where r.id is null"],
  ["propositions sans commande", "select count(*)::int n from order_proposals p left join orders o on o.id = p.order_id where o.id is null"],
];
for (const [nom, sql] of controles) {
  const { rows } = await db.query(sql);
  verifier(nom, rows[0].n === 0, `${rows[0].n}`);
}

console.log(echecs === 0 ? "\nRESTAURATION VÉRIFIÉE : l'export se recharge entièrement." : `\n${echecs} échec(s) : l'export n'est pas fiable.`);
process.exit(echecs === 0 ? 0 : 1);
