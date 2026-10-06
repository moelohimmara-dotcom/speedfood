import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { appliquerMigration, etatTable, retirerCommentaires, tablesAttendues } from "../verifier-base-sql";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}
const extraire = (sql: string) => tablesAttendues([{ nom: "1.sql", sql }]);

verifier("create table simple", extraire("create table restaurants (\n id uuid);"), ["restaurants"]);
verifier("casse et espaces", extraire("CREATE   TABLE\n  Commandes(id int);"), ["commandes"]);
verifier("if not exists + public.", extraire("create table if not exists public.reinitialisation_jetons (x int);"), ["reinitialisation_jetons"]);
verifier("nom entre guillemets", extraire('create table "public"."ma_table" (x int);'), ["ma_table"]);
verifier("autre schéma ignoré", extraire("create table auth.intrus (x int); create table storage.y (x int);"), []);
verifier("commentaire -- ignoré", extraire("-- create table fantome (x int);\ncreate table vraie (x int);"), ["vraie"]);
verifier("commentaire bloc ignoré", extraire("/* create table fantome (x int); */ create table vraie (x int);"), ["vraie"]);
verifier("create table dans un commentaire de fin de ligne", extraire("select 1; -- puis create table plus_tard"), []);
verifier("drop table retire", extraire("create table a (x int); drop table if exists public.a;"), []);
verifier("rename to renomme", extraire("create table a (x int); alter table only public.a rename to b;"), ["b"]);
verifier("rename de colonne sans effet", extraire("create table a (x int); alter table a rename column x to y;"), ["a"]);
verifier("create table as / like reconnu", extraire("create table copie as select 1;"), ["copie"]);
verifier("create index non compté", extraire("create index idx on a(x); create unique index i2 on b(y);"), []);
verifier("ordre des fichiers par nom", tablesAttendues([{ nom: "2.sql", sql: "drop table a;" }, { nom: "1.sql", sql: "create table a (x int);" }]), []);
verifier("unlogged", extraire("create unlogged table tampon (x int);"), ["tampon"]);
verifier("retirerCommentaires", retirerCommentaires("a -- b\nc /* d */ e").replace(/\s+/g, " ").trim(), "a c e");
const ensemble = new Set<string>(["x"]);
appliquerMigration(ensemble, "drop table y;");
verifier("drop d'une table inconnue sans effet", [...ensemble], ["x"]);

verifier("état : pas d'erreur = présente", etatTable(null), "presente");
verifier("état : PGRST205 = absente", etatTable({ code: "PGRST205" }), "absente");
verifier("état : 42P01 = absente", etatTable({ code: "42P01" }), "absente");
verifier("état : permission refusée = présente", etatTable({ code: "42501" }), "presente");
verifier("état : erreur réseau = inconnu", etatTable({ code: "" }), "inconnu");
verifier("état : exception = inconnu", etatTable({ code: "EXCEPTION" }), "inconnu");

// Sur les vraies migrations du dépôt.
const racine = process.env.SPEEDFOOD_RACINE;
if (racine) {
  const dossier = join(racine, "supabase", "migrations");
  const fichiers = readdirSync(dossier).filter((n) => n.endsWith(".sql")).map((nom) => ({ nom, sql: readFileSync(join(dossier, nom), "utf8") }));
  const tables = tablesAttendues(fichiers);
  for (const t of ["restaurants", "orders", "fonctionnalites", "contenu_emplacements", "content_pages", "reinitialisation_jetons", "client_profils"]) {
    verifier(`dépôt : ${t} attendue`, tables.includes(t), true);
  }
  verifier("dépôt : aucun nom vide ou qualifié", tables.filter((t) => !/^[a-z_][a-z0-9_]*$/.test(t)), []);
}

if (ko > 0) {
  console.log(`\n${ko} test(s) de la vérification de base en échec.`);
  process.exit(1);
}
console.log("\nTous les tests de la vérification de base passent.");
