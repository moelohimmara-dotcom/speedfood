// Banc de test SQL de la réinitialisation, sur une base en mémoire (PGlite) : AUCUNE connexion à la production.
// Rejoue toutes les migrations, sème des données, puis vérifie : refus des autres rôles et de la session simple, simulation
// exacte, jeton à usage unique, limite horaire, atomicité (une panne en cours de route ne supprime rien) et exécution.
// Usage : dans un dossier temporaire `npm i @electric-sql/pglite`, puis lancer ce fichier avec Node depuis ce dossier
// (ou : NODE_PATH=<dossier>/node_modules node scripts/base/test-reinitialisation.mjs).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table auth.mfa_factors (id uuid default gen_random_uuid(), user_id uuid, status text, factor_type text default 'totp');
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
`);
const D = decodeURIComponent(new URL("../../supabase/migrations", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
for (const f of fs.readdirSync(D).filter((x) => x.endsWith(".sql")).sort()) {
  await db.exec(fs.readFileSync(path.join(D, f), "utf8").replace(/create extension if not exists pgcrypto;?/gi, ""));
}
console.log("migrations rejouees");

const S = "00000000-0000-0000-0000-0000000000a1", O = "00000000-0000-0000-0000-0000000000a2", C = "00000000-0000-0000-0000-0000000000a3", R = "00000000-0000-0000-0000-0000000000a4";
const RID = "10000000-0000-0000-0000-000000000001", MID = "20000000-0000-0000-0000-000000000001", OID = "30000000-0000-0000-0000-000000000001";
await db.exec(`
  insert into auth.users (id, email) values ('${S}','s@x'),('${O}','o@x'),('${C}','c@x'),('${R}','r@x');
  insert into system_admin_memberships (utilisateur_id, role) values ('${S}','super_admin'),('${O}','operations');
  insert into neighborhoods (nom, ordre) values ('Kaloum', 1);
  insert into menu_categories (nom, ordre) values ('Riz', 1);
`);
const quartier = (await db.query("select id from neighborhoods limit 1")).rows[0].id;
const categorie = (await db.query("select id from menu_categories limit 1")).rows[0].id;
await db.exec(`
  insert into restaurants (id, nom, categorie_id, quartier_id) values ('${RID}','Resto A','${categorie}','${quartier}');
  insert into restaurant_memberships (restaurant_id, utilisateur_id, role) values ('${RID}','${R}','owner');
  insert into menu_items (id, restaurant_id, nom, prix) values ('${MID}','${RID}','Plat',1000);
  insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, frais_livraison_estime, statut)
    values ('${OID}','SF-TEST1','jeton-test-1','${RID}','Client','+224600000000','retrait',1000,0,'en_attente');
  insert into order_items (order_id, menu_item_id, nom, prix, quantite) values ('${OID}','${MID}','Plat',1000,1);
  insert into client_profils (utilisateur_id, pseudo, avatar) values ('${C}','Pseudo','riz');
  insert into audit_events (acteur_id, action, cible_type, cible_id) values ('${S}','test','x','1');
`);
let ok = 0, ko = 0;
const verifier = (nom, cond, detail = "") => { if (cond) { ok++; console.log("OK   ", nom); } else { ko++; console.log("ECHEC", nom, detail); } };
const acteur = async (id, aal) => db.exec(`select set_config('request.jwt.claim.sub','${id}',false), set_config('request.jwt.claims','${JSON.stringify({ sub: id, aal })}',false)`);
const essai = async (sql) => { try { return { r: (await db.query(sql)).rows[0] }; } catch (e) { return { e: e.message }; } };
const n = async (t) => Number((await db.query(`select count(*) c from ${t}`)).rows[0].c);

await acteur(O, "aal2");
verifier("operations refusee (simulation)", (await essai("select fn_reinitialisation_simuler()")).e?.includes("Acces refuse"));
await acteur(S, "aal1");
verifier("super admin sans session renforcee refuse", (await essai("select fn_reinitialisation_simuler()")).e?.includes("Acces refuse"));
await acteur(S, "aal2");
const sim = (await essai("select fn_reinitialisation_simuler() as v")).r?.v;
verifier("simulation : comptes exacts", sim?.supprime.restaurants === 1 && sim.supprime.commandes === 1 && sim.supprime.comptes === 3 && sim.conserve.super_administrateurs === 1, JSON.stringify(sim));
verifier("simulation : rien n'est supprime", (await n("restaurants")) === 1 && (await n("auth.users")) === 4);
const jeton = sim.jeton;
verifier("jeton invalide refuse", (await essai(`select fn_reinitialiser_application('00000000-0000-0000-0000-00000000ffff','motif suffisant ok')`)).e?.includes("REFUS:jeton"));
verifier("motif trop court refuse", (await essai(`select fn_reinitialiser_application('${jeton}','court')`)).e?.includes("REFUS:motif"));
await acteur(O, "aal2");
verifier("operations refusee (execution)", (await essai(`select fn_reinitialiser_application('${jeton}','motif suffisant ok')`)).e?.includes("Acces refuse"));
await acteur(S, "aal2");

// Atomicite : une panne en cours de route ne supprime rien et ne consomme pas le jeton.
await db.exec(`create function public.bloque_test() returns trigger language plpgsql as $$ begin raise exception 'PANNE SIMULEE'; end $$;
  create trigger t_panne before delete on client_profils for each statement execute function public.bloque_test();`);
const panne = await essai(`select fn_reinitialiser_application('${jeton}','motif suffisant ok')`);
verifier("panne simulee : erreur remontee", panne.e?.includes("PANNE SIMULEE"), JSON.stringify(panne));
verifier("panne simulee : aucune suppression (transaction)", (await n("restaurants")) === 1 && (await n("orders")) === 1 && (await n("auth.users")) === 4);
verifier("panne simulee : jeton non consomme", (await db.query(`select utilise_le from reinitialisation_jetons where id='${jeton}'`)).rows[0].utilise_le === null);
await db.exec("drop trigger t_panne on client_profils");

const exec = await essai(`select fn_reinitialiser_application('${jeton}','Passage en production reel') as v`);
verifier("execution reussie", exec.r?.v?.restaurants === 1 && exec.r.v.comptes === 3, JSON.stringify(exec));
for (const t of ["restaurants", "menu_items", "orders", "order_items", "client_profils", "restaurant_memberships", "content_pages", "push_subscriptions"]) verifier(`vide : ${t}`, (await n(t)) === 0);
verifier("conserve : super admin + son role", (await n("auth.users")) === 1 && (await n("system_admin_memberships")) === 1);
verifier("conserve : quartiers et categories", (await n("neighborhoods")) === 1 && (await n("menu_categories")) === 1);
verifier("conserve : audit + evenement de reinitialisation", (await n("audit_events")) >= 2 && (await db.query("select 1 from audit_events where action='application.reinitialisation'")).rows.length === 1);
verifier("jeton a usage unique", (await essai(`select fn_reinitialiser_application('${jeton}','Passage en production reel')`)).e?.includes("REFUS:jeton"));
const sim2 = (await essai("select fn_reinitialisation_simuler() as v")).r.v;
verifier("limite d'une reinitialisation par heure", (await essai(`select fn_reinitialiser_application('${sim2.jeton}','Passage en production reel')`)).e?.includes("REFUS:limite"));
console.log(`\n${ok} reussis, ${ko} echecs`);
process.exit(ko ? 1 : 0);
