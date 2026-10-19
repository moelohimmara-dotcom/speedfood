// Tests de concurrence EN ÉCRITURE sur un vrai PostgreSQL 17 (embedded-postgres), toutes les migrations du dépôt rejouées.
// Usage : npm run test:concurrence   (prérequis, une fois : cd supabase/concurrence && npm ci ; télécharge environ 100 Mo). Voir docs/TESTS-CONCURRENCE.md.
// Chaque scénario ouvre plusieurs connexions réellement simultanées (transactions distinctes). Rien ne touche la production.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOSSIER_DONNEES = process.argv[2] || path.join(os.tmpdir(), "speedfood-concurrence-donnees");
const PORT = 54329;
const MOT_DE_PASSE = "essai-local";

let ok = 0, ko = 0;
const resultats = [];
function verifier(nom, condition, detail = "") {
  if (condition) { ok += 1; console.log(`OK    ${nom}${detail ? "  (" + detail + ")" : ""}`); }
  else { ko += 1; console.log(`ECHEC ${nom}${detail ? "\n         " + detail : ""}`); }
  resultats.push({ nom, ok: !!condition, detail });
}

fs.rmSync(DOSSIER_DONNEES, { recursive: true, force: true });
const serveur = new EmbeddedPostgres({ databaseDir: DOSSIER_DONNEES, user: "postgres", password: MOT_DE_PASSE, port: PORT, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-c", "max_connections=400"], onLog: () => {}, onError: () => {} });
await serveur.initialise();
await serveur.start();
await serveur.createDatabase("essai");

const connexion = () => new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: MOT_DE_PASSE, database: "essai" });
const admin = connexion();
await admin.connect();
const q = (sql, params) => admin.query(sql, params);

try {
  await q(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text);
    create schema storage;
    create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  const dossierMig = path.join(RACINE, "supabase", "migrations");
  const fichiers = fs.readdirSync(dossierMig).filter((n) => n.endsWith(".sql")).sort();
  for (const f of fichiers) {
    try { await q(fs.readFileSync(path.join(dossierMig, f), "utf8").replace(/create extension if not exists pgcrypto;?/gi, "")); }
    catch (e) { console.log(`ECHEC migration ${f} : ${e.message}`); process.exit(1); }
  }
  console.log(`${fichiers.length} migrations rejouées sur PostgreSQL ${(await q("show server_version")).rows[0].server_version}\n`);

  // ------------------------------------------------------------ données de départ
  const RESTO = "00000000-0000-4000-8000-0000000000a1";
  await q(`
    insert into menu_categories (id, nom) values ('00000000-0000-4000-8000-0000000000c1', 'Cat');
    insert into neighborhoods (id, nom) values ('00000000-0000-4000-8000-0000000000d1', 'Quartier');
    insert into restaurants (id, nom, categorie_id, quartier_id, publie) values ('${RESTO}', 'RESTO', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1', true);`);
  const nouvelleCommande = async (c, statut = "en_attente") => {
    const id = crypto.randomUUID();
    const ref = "SF-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    await c.query(
      `insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut) values ($1,$2,$3,$4,'Client','620000001','retrait',1000,$5)`,
      [id, ref, "j-" + id, RESTO, statut]
    );
    return id;
  };

  // Lance n tâches AU MÊME INSTANT sur n connexions distinctes.
  async function enParallele(n, tache) {
    const clients = await Promise.all(Array.from({ length: n }, async () => { const c = connexion(); await c.connect(); return c; }));
    let depart; const barriere = new Promise((r) => (depart = r));
    const taches = clients.map((c, i) => (async () => { await barriere; try { return { ok: true, valeur: await tache(c, i) }; } catch (e) { return { ok: false, erreur: e }; } })());
    await new Promise((r) => setTimeout(r, 200));
    depart();
    const res = await Promise.all(taches);
    await Promise.all(clients.map((c) => c.end()));
    return res;
  }

  // ------------------------------------------------------------ S1. moyenne des avis (déclencheur de recalcul)
  console.log(`--- S1. avis simultanés sur un même restaurant `);
  for (const N of [10, 30]) {
    await q(`delete from avis; update restaurants set avis_somme = 0, avis_total = 0 where id = '${RESTO}'`);
    const commandes = [];
    for (let i = 0; i < N; i += 1) commandes.push(await nouvelleCommande(admin, "terminee"));
    const res = await enParallele(N, (c, i) => c.query(
      `insert into avis (order_id, cible, auteur, restaurant_id, auteur_utilisateur_id, note) values ($1,'restaurant','client',$2,null,$3)`, [commandes[i], RESTO, (i % 5) + 1]));
    const echecs = res.filter((r) => !r.ok).length;
    const reel = (await q(`select count(*)::int n, coalesce(sum(note),0)::int s from avis where restaurant_id = '${RESTO}' and cible='restaurant'`)).rows[0];
    const agrege = (await q(`select avis_total t, avis_somme s from restaurants where id = '${RESTO}'`)).rows[0];
    verifier(`${N} avis simultanés : le total affiché (${agrege.t}) égale le nombre réel (${reel.n})`, agrege.t === reel.n && agrege.s === reel.s && echecs === 0, `somme affichée ${agrege.s} / réelle ${reel.s} ; insertions échouées ${echecs}`);
  }

  // ------------------------------------------------------------ S2. numéro d'appel au comptoir (algorithme de creation.ts : relire le dernier, +1, 3 essais)
  console.log("\n--- S2. numéros d'appel au comptoir (3 essais comme l'application)");
  for (const N of [5, 10, 25, 50]) {
    await q(`delete from orders where numero_appel is not null`);
    const res = await enParallele(N, async (c) => {
      for (let essai = 0; essai < 3; essai += 1) {
        const d = (await c.query(`select max(numero_appel)::int m from orders where restaurant_id = $1 and (cree_le at time zone 'utc')::date = (now() at time zone 'utc')::date and numero_appel is not null`, [RESTO])).rows[0].m;
        const numero = Number.isInteger(d) && d > 0 ? d + 1 : 1;
        try {
          const id = crypto.randomUUID();
          await c.query(`insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, table_numero, sous_total, statut, numero_appel) values ($1,$2,$3,$4,'Convive','620000001','sur_place','Comptoir',1000,'en_attente',$5)`,
            [id, "SF-" + Math.random().toString(36).slice(2, 7).toUpperCase(), "j-" + id, RESTO, numero]);
          return numero;
        } catch (e) { if (e.code !== "23505") throw e; }
      }
      throw new Error("abandon après 3 collisions");
    });
    const reussies = res.filter((r) => r.ok).length;
    const autre = res.filter((r) => !r.ok && !String(r.erreur?.message).includes("abandon")).map((r) => r.erreur?.message);
    console.log(`        N=${N} : ${reussies} commandes créées, ${N - reussies} abandonnées après 3 essais${autre.length ? ", autres erreurs : " + autre.slice(0, 2).join(" ; ") : ""}`);
    console.log(`        (ancien algorithme, pour mémoire : ${N - reussies} perdue(s) sur ${N})`);
  }

  for (const N of [5, 10, 25, 50, 100]) {
    await q(`delete from orders where numero_appel is not null; delete from numeros_appel_jour`);
    const res = await enParallele(N, async (c) => {
      for (let essai = 0; essai < 3; essai += 1) {
        const numero = (await c.query(`select fn_attribuer_numero_appel($1) as n`, [RESTO])).rows[0].n;
        try {
          const id = crypto.randomUUID();
          await c.query(`insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, table_numero, sous_total, statut, numero_appel) values ($1,$2,$3,$4,'Convive','620000001','sur_place','Comptoir',1000,'en_attente',$5)`,
            [id, "SF-" + Math.random().toString(36).slice(2, 7).toUpperCase(), "j-" + id, RESTO, numero]);
          return numero;
        } catch (e) { if (e.code !== "23505") throw e; }
      }
      throw new Error("abandon après 3 collisions");
    });
    const reussies = res.filter((r) => r.ok).length;
    const numeros = res.filter((r) => r.ok).map((r) => r.valeur);
    const distincts = new Set(numeros).size === numeros.length;
    verifier(`NOUVEAU : ${N} commandes simultanées au comptoir, aucune perdue, tous les numéros différents`, reussies === N && distincts, `${N - reussies} perdue(s), numéros distincts : ${distincts}`);
  }
  // Reprise après des commandes déjà numérotées (avant la mise en place du compteur) : on repart après le plus grand numéro du jour.
  await q(`delete from orders where numero_appel is not null; delete from numeros_appel_jour`);
  for (const n of [1, 2, 7]) { const id = crypto.randomUUID(); await q(`insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, table_numero, sous_total, statut, numero_appel) values ($1,$2,$3,$4,'C','620000001','sur_place','Comptoir',1000,'en_attente',$5)`, [id, "SF-R" + n + "AAA", "j-" + id, RESTO, n]); }
  const suite = (await q(`select fn_attribuer_numero_appel($1) as n`, [RESTO])).rows[0].n;
  verifier("le compteur repart après le plus grand numéro déjà pris dans la journée", suite === 8, `obtenu ${suite}`);

  // ------------------------------------------------------------ S3. ouverture d'une table par plusieurs convives
  console.log("\n--- S3. première ouverture d'une même table par plusieurs convives");
  for (const N of [5, 20]) {
    await q(`delete from table_sessions`);
    const res = await enParallele(N, async (c) => {
      const lire = async () => (await c.query(`select id from table_sessions where restaurant_id=$1 and statut='ouverte' and lower(table_numero)=lower($2)`, [RESTO, "12"])).rows[0]?.id;
      const existante = await lire(); if (existante) return existante;
      try { return (await c.query(`insert into table_sessions (restaurant_id, table_numero) values ($1,'12') returning id`, [RESTO])).rows[0].id; }
      catch (e) { const apres = await lire(); if (apres) return apres; throw e; }
    });
    const ids = new Set(res.filter((r) => r.ok).map((r) => r.valeur));
    const ouvertes = (await q(`select count(*)::int n from table_sessions where statut='ouverte' and lower(table_numero)='12'`)).rows[0].n;
    verifier(`${N} convives scannent en même temps : une seule session, la même pour tous`, res.every((r) => r.ok) && ids.size === 1 && ouvertes === 1, `${ouvertes} session(s) ouverte(s), ${ids.size} identifiant(s) distinct(s), ${res.filter((r) => !r.ok).length} erreur(s)`);
  }

  // ------------------------------------------------------------ S4. deux transitions contradictoires sur la même commande
  console.log("\n--- S4. deux membres traitent la même commande en même temps");
  let incoherences = 0, essais = 30, deuxGagnants = 0;
  for (let t = 0; t < essais; t += 1) {
    const id = await nouvelleCommande(admin, "en_attente");
    const res = await enParallele(2, async (c, i) => { await c.query(`update orders set statut = $1 where id = $2`, [i === 0 ? "acceptee" : "refusee", id]); return i === 0 ? "acceptee" : "refusee"; });
    const gagnants = res.filter((r) => r.ok).length;
    const final = (await q(`select statut from orders where id = $1`, [id])).rows[0].statut;
    if (gagnants === 2) deuxGagnants += 1;
    if (!["acceptee", "refusee"].includes(final)) incoherences += 1;
  }
  verifier(`${essais} courses accepter/refuser : un seul des deux traitements est accepté par la base`, deuxGagnants === 0 && incoherences === 0, `${deuxGagnants} course(s) où les deux ont « réussi » (refusee après acceptee ?), ${incoherences} état(s) incohérent(s)`);

  // ------------------------------------------------------------ S5. rattachement : deux comptes réclament la même commande
  console.log("\n--- S5. rattachement d'une commande sans compte par plusieurs comptes");
  const comptes = [];
  for (let i = 0; i < 10; i += 1) { const u = crypto.randomUUID(); await q(`insert into auth.users (id, email) values ($1,$2)`, [u, `u${i}@test.invalid`]); comptes.push(u); }
  let multiples = 0;
  for (let t = 0; t < 20; t += 1) {
    const id = await nouvelleCommande(admin, "terminee");
    const res = await enParallele(10, (c, i) => c.query(`update orders set client_user_id = $1 where id = $2 and client_user_id is null returning id`, [comptes[i], id]));
    const gagnants = res.filter((r) => r.ok && r.valeur.rowCount === 1).length;
    if (gagnants !== 1) multiples += 1;
  }
  verifier("20 commandes × 10 comptes simultanés : exactement un compte gagne à chaque fois", multiples === 0, `${multiples} course(s) sans gagnant unique`);

  // ------------------------------------------------------------ S6. note d'une même commande posée deux fois en même temps
  console.log("\n--- S6. double envoi d'un avis pour la même commande");
  let doublons = 0, sansGagnant = 0;
  for (let t = 0; t < 20; t += 1) {
    const id = await nouvelleCommande(admin, "terminee");
    const res = await enParallele(2, (c) => c.query(`insert into avis (order_id, cible, auteur, restaurant_id, auteur_utilisateur_id, note) values ($1,'restaurant','client',$2,null,4)`, [id, RESTO]));
    const gagnants = res.filter((r) => r.ok).length;
    if (gagnants > 1) doublons += 1; if (gagnants === 0) sansGagnant += 1;
    const n = (await q(`select count(*)::int n from avis where order_id = $1`, [id])).rows[0].n;
    if (n !== 1) doublons += 1;
  }
  verifier("20 doubles envois : un seul avis par commande, jamais deux", doublons === 0 && sansGagnant === 0, `${doublons} doublon(s), ${sansGagnant} sans aucun avis`);
} finally {
  await admin.end().catch(() => {});
  await serveur.stop().catch(() => {});
}
console.log(`\n${ko === 0 ? "TOUT PASSE" : ko + " ÉCHEC(S)"} : ${ok} contrôles réussis, ${ko} échoués.`);
process.exit(ko === 0 ? 0 : 1);
