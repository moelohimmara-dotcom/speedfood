// Simulation d'une journée de service sur un vrai PostgreSQL 17 jetable (embedded-postgres), toutes les migrations du dépôt rejouées.
// Plusieurs dizaines de connexions simultanées : clients qui commandent en rafale (serveur, clé de service), restaurateurs qui lisent et traitent
// leurs commandes AVEC LEURS DROITS (rôle `authenticated`, sécurité par ligne et par colonne appliquée), clients qui notent. À la fin, on vérifie
// les invariants (aucune commande perdue, numéros d'appel uniques, une seule session par table, moyennes d'avis exactes, isolement entre restaurants).
// Usage : npm run test:simulation   (prérequis, une fois : cd supabase/concurrence && npm ci ; voir docs/TESTS-CONCURRENCE.md). Rien ne touche la production.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOSSIER_DONNEES = path.join(os.tmpdir(), "speedfood-simulation-donnees");
const PORT = 54330;
const MOT_DE_PASSE = "essai-local";
const R = Number(process.env.SIM_RESTAURANTS || 5); // restaurants
const C = Number(process.env.SIM_CLIENTS || 300); // clients
const N = Number(process.env.SIM_COMMANDES || 600); // commandes
const TABLES = 10;
const TRAVAILLEURS = 60;

let ok = 0, ko = 0;
function verifier(nom, condition, detail = "") {
  if (condition) { ok += 1; console.log(`OK    ${nom}${detail ? "  (" + detail + ")" : ""}`); }
  else { ko += 1; console.log(`ECHEC ${nom}${detail ? "\n         " + detail : ""}`); }
}
const percentile = (valeurs, p) => (valeurs.length ? valeurs.slice().sort((a, b) => a - b)[Math.min(valeurs.length - 1, Math.floor(valeurs.length * p))] : 0);
const uuid = () => crypto.randomUUID();
const hasard = (n) => Math.floor(Math.random() * n);

fs.rmSync(DOSSIER_DONNEES, { recursive: true, force: true });
const serveur = new EmbeddedPostgres({ databaseDir: DOSSIER_DONNEES, user: "postgres", password: MOT_DE_PASSE, port: PORT, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-c", "max_connections=300"], onLog: () => {}, onError: () => {} });
await serveur.initialise();
await serveur.start();
await serveur.createDatabase("simulation");
const nouveauClient = () => new pg.Client({ host: "localhost", port: PORT, user: "postgres", password: MOT_DE_PASSE, database: "simulation" });
const admin = nouveauClient();
await admin.connect();
const q = (sql, params) => admin.query(sql, params);
let pool = [];

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
  console.log(`${fichiers.length} migrations rejouées. Simulation : ${R} restaurants, ${C} clients, ${N} commandes, ${TRAVAILLEURS} connexions simultanées\n`);

  // ------------------------------------------------------------ données de départ
  const CAT = uuid(), QUA = uuid();
  await q(`insert into menu_categories (id, nom) values ($1,'Cat')`, [CAT]);
  await q(`insert into neighborhoods (id, nom) values ($1,'Quartier')`, [QUA]);
  const restos = [];
  for (let i = 0; i < R; i += 1) {
    const r = { id: uuid(), proprio: uuid(), equipier: uuid(), plats: [] };
    await q(`insert into auth.users (id, email) values ($1,$2),($3,$4)`, [r.proprio, `p${i}@test.invalid`, r.equipier, `e${i}@test.invalid`]);
    await q(`insert into restaurants (id, nom, categorie_id, quartier_id, publie) values ($1,$2,$3,$4,true)`, [r.id, `RESTO-${i}`, CAT, QUA]);
    await q(`insert into restaurant_memberships (restaurant_id, utilisateur_id, role) values ($1,$2,'owner'),($1,$3,'manager')`, [r.id, r.proprio, r.equipier]);
    for (let p = 0; p < 8; p += 1) { const id = uuid(); await q(`insert into menu_items (id, restaurant_id, nom, prix) values ($1,$2,$3,$4)`, [id, r.id, `Plat ${p}`, (5 + hasard(20)) * 1000]); r.plats.push(id); }
    restos.push(r);
  }
  const clients = Array.from({ length: C }, () => uuid());
  for (let i = 0; i < C; i += 1) await q(`insert into auth.users (id, email) values ($1,$2)`, [clients[i], `c${i}@test.invalid`]);

  pool = await Promise.all(Array.from({ length: TRAVAILLEURS }, async () => { const c = nouveauClient(); await c.connect(); return c; }));
  /** Exécute `fn(client)` dans une transaction avec les droits d'un compte connecté (comme PostgREST). */
  async function enTantQue(c, uid, fn) {
    await c.query("begin");
    try {
      await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid]);
      await c.query("set local role authenticated");
      const r = await fn(c);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    }
  }
  async function enRafale(taches, concurrence = TRAVAILLEURS) {
    const durees = [], erreurs = [];
    let suivante = 0;
    const debut = performance.now();
    await Promise.all(Array.from({ length: Math.min(concurrence, pool.length) }, async (_, w) => {
      const c = pool[w];
      while (true) {
        const i = suivante++;
        if (i >= taches.length) return;
        const t = performance.now();
        try { await taches[i](c, i); } catch (e) { erreurs.push(e); }
        durees.push(performance.now() - t);
      }
    }));
    return { durees, erreurs, secondes: (performance.now() - debut) / 1000 };
  }

  // ------------------------------------------------------------ phase 1 : commandes en rafale + consoles qui lisent en parallèle
  console.log("--- Phase 1 : commandes en rafale (retrait, livraison, à table, comptoir) pendant que les restaurateurs consultent");
  const commandesCreees = [];
  let sequence = 0; // références uniques dans la simulation (l'application, elle, tire au hasard et réessaie)
  const modes = ["retrait", "livraison", "table", "comptoir"];
  const creations = Array.from({ length: N }, () => async (c) => {
    const resto = restos[hasard(R)], mode = modes[hasard(4)], client = clients[hasard(C)];
    const id = uuid(), ref = `SF-${(sequence++).toString(36).toUpperCase().padStart(5, "0")}`, jeton = "j-" + id;
    let sessionId = null, numeroAppel = null, table = null, modeDb = "retrait";
    if (mode === "livraison") modeDb = "livraison";
    if (mode === "table" || mode === "comptoir") modeDb = "sur_place";
    if (mode === "table") {
      table = String(1 + hasard(TABLES));
      const lire = async () => (await c.query(`select id from table_sessions where restaurant_id=$1 and statut='ouverte' and lower(table_numero)=lower($2)`, [resto.id, table])).rows[0]?.id;
      sessionId = await lire();
      if (!sessionId) {
        try { sessionId = (await c.query(`insert into table_sessions (restaurant_id, table_numero) values ($1,$2) returning id`, [resto.id, table])).rows[0].id; }
        catch { sessionId = await lire(); }
      }
    }
    if (mode === "comptoir") { table = "Comptoir"; numeroAppel = (await c.query(`select fn_attribuer_numero_appel($1) n`, [resto.id])).rows[0].n; }
    const nbLignes = 1 + hasard(4);
    let sousTotal = 0; const lignes = [];
    for (let l = 0; l < nbLignes; l += 1) { const prix = (5 + hasard(20)) * 1000, qte = 1 + hasard(3); sousTotal += prix * qte; lignes.push([uuid(), id, `Plat ${l}`, prix, qte]); }
    await c.query("begin");
    try {
      await c.query(`insert into orders (id, reference, jeton_suivi, restaurant_id, client_user_id, client_nom, client_telephone, client_adresse, mode, table_numero, session_id, numero_appel, sous_total, statut)
        values ($1,$2,$3,$4,$5,'Client','620000001',$6,$7,$8,$9,$10,$11,'en_attente')`, [id, ref, jeton, resto.id, client, mode === "livraison" ? "Adresse de livraison 12" : null, modeDb, table, sessionId, numeroAppel, sousTotal]);
      for (const l of lignes) await c.query(`insert into order_items (id, order_id, nom, prix, quantite) values ($1,$2,$3,$4,$5)`, l);
      await c.query("commit");
    } catch (e) { await c.query("rollback").catch(() => {}); throw e; }
    commandesCreees.push({ id, restaurant: resto.id, mode, sousTotal });
  });

  // Les consoles des restaurateurs interrogent pendant la rafale : même colonnes que `src/lib/commande/requetes.ts`, avec leurs droits.
  const COLONNES_CONSOLE = "id, reference, client_nom, client_telephone, client_adresse, mode, table_numero, sous_total, frais_livraison_estime, statut, cree_le, est_test, jeton_recu, paiement_statut, paiement_mode, paiement_reference, paiement_recu_le";
  let fuites = 0, erreursConsole = 0, lecturesConsole = 0, refusJeton = 0, selectEtoileRefuse = 0;
  const lecteurs = restos.map((resto, i) => (async () => {
    const c = nouveauClient(); await c.connect();
    try {
      while (!fini) {
        try {
          const r = await enTantQue(c, resto.proprio, (cl) => cl.query(`select ${COLONNES_CONSOLE} from orders where restaurant_id = $1 order by cree_le desc limit 50`, [resto.id]));
          lecturesConsole += 1;
          const autres = await enTantQue(c, resto.proprio, (cl) => cl.query(`select id from orders where restaurant_id <> $1 limit 5`, [resto.id]));
          if (autres.rows.length > 0 || r.rows.some((x) => x.reference == null)) fuites += 1;
          try { await enTantQue(c, resto.proprio, (cl) => cl.query(`select jeton_suivi from orders where restaurant_id = $1 limit 1`, [resto.id])); fuites += 1; } catch { refusJeton += 1; }
          try { await enTantQue(c, resto.proprio, (cl) => cl.query(`select * from orders where restaurant_id = $1 limit 1`, [resto.id])); fuites += 1; } catch { selectEtoileRefuse += 1; }
        } catch { erreursConsole += 1; }
        await new Promise((res) => setTimeout(res, 40));
      }
    } finally { await c.end(); }
  })());
  let fini = false;
  const p1 = await enRafale(creations);
  fini = true;
  await Promise.all(lecteurs);

  const total = (await q(`select count(*)::int n from orders`)).rows[0].n;
  verifier(`${N} commandes créées en ${p1.secondes.toFixed(1)} s (${(N / p1.secondes).toFixed(0)}/s), p95 ${percentile(p1.durees, 0.95).toFixed(0)} ms, aucune perdue`, total === N && p1.erreurs.length === 0, `${total} en base, ${p1.erreurs.length} erreur(s)${p1.erreurs[0] ? " : " + p1.erreurs[0].message : ""}`);
  const doublonsAppel = (await q(`select count(*)::int n from (select restaurant_id, numero_appel from orders where numero_appel is not null group by 1,2 having count(*) > 1) d`)).rows[0].n;
  verifier("numéros d'appel uniques par restaurant et par jour", doublonsAppel === 0, `${doublonsAppel} doublon(s)`);
  const sessionsOuvertes = (await q(`select count(*)::int n from (select restaurant_id, lower(table_numero) from table_sessions where statut='ouverte' group by 1,2 having count(*) > 1) d`)).rows[0].n;
  verifier("une seule session ouverte par table", sessionsOuvertes === 0, `${sessionsOuvertes} table(s) en double`);
  const sansSession = (await q(`select count(*)::int n from orders where mode='sur_place' and numero_appel is null and session_id is null`)).rows[0].n;
  verifier("toute commande à table est rattachée à une session", sansSession === 0, `${sansSession} orpheline(s)`);
  verifier(`consoles des restaurateurs pendant la rafale : ${lecturesConsole} lectures, aucune erreur`, erreursConsole === 0 && lecturesConsole > 0, `${erreursConsole} erreur(s)`);
  verifier("isolement entre restaurants sous charge : aucune ligne d'un autre restaurant lue", fuites === 0, `${fuites} fuite(s)`);
  verifier("le jeton de suivi est refusé à chaque lecture par un restaurateur", refusJeton > 0 && fuites === 0, `${refusJeton} refus`);
  verifier("`select *` sur les commandes est refusé à chaque lecture par un restaurateur", selectEtoileRefuse > 0, `${selectEtoileRefuse} refus`);

  // ------------------------------------------------------------ phase 2 : traitement par deux membres en même temps
  console.log("\n--- Phase 2 : le propriétaire et l'équipier traitent les mêmes commandes en même temps");
  const chaine = ["acceptee", "prete", "terminee"];
  let refusLegitimes = 0, illegaux = 0;
  const traitements = [];
  for (const cmd of commandesCreees) {
    const resto = restos.find((r) => r.id === cmd.restaurant);
    for (const membre of [resto.proprio, resto.equipier]) {
      traitements.push(async (c) => {
        for (const etape of chaine) {
          try { await enTantQue(c, membre, (cl) => cl.query(`update orders set statut = $1 where id = $2 and restaurant_id = $3`, [etape, cmd.id, resto.id])); }
          catch (e) { if (/transition|statut|invalide|change/i.test(e.message)) refusLegitimes += 1; else illegaux += 1; }
        }
      });
    }
  }
  const p2 = await enRafale(traitements);
  const etats = (await q(`select statut, count(*)::int n from orders group by statut`)).rows;
  const hors = etats.filter((e) => !["en_attente", ...chaine].includes(e.statut));
  const termine = etats.find((e) => e.statut === "terminee")?.n ?? 0;
  verifier(`${traitements.length} traitements concurrents en ${p2.secondes.toFixed(1)} s, p95 ${percentile(p2.durees, 0.95).toFixed(0)} ms : aucun état hors chaîne`, hors.length === 0 && illegaux === 0, `états : ${JSON.stringify(etats)} ; ${refusLegitimes} refus de transition (attendus), ${illegaux} erreur(s) inattendue(s)`);
  verifier("la grande majorité des commandes arrive au bout de la chaîne", termine >= N * 0.9, `${termine}/${N} terminées`);

  // ------------------------------------------------------------ phase 3 : avis en rafale
  console.log("\n--- Phase 3 : les clients notent en même temps");
  const terminees = (await q(`select id, restaurant_id, client_user_id from orders where statut='terminee'`)).rows;
  const notes = terminees.map((o) => async (c) => {
    await c.query(`insert into avis (order_id, cible, auteur, restaurant_id, auteur_utilisateur_id, note) values ($1,'restaurant','client',$2,$3,$4)`, [o.id, o.restaurant_id, o.client_user_id, 1 + hasard(5)]);
  });
  const p3 = await enRafale(notes);
  const faux = (await q(`select r.id from restaurants r left join (select restaurant_id, count(*)::int t, coalesce(sum(note),0)::int s from avis where cible='restaurant' and statut in ('publie','commentaire_masque') and not est_test group by 1) a on a.restaurant_id = r.id where r.avis_total <> coalesce(a.t,0) or r.avis_somme <> coalesce(a.s,0)`)).rows;
  verifier(`${notes.length} avis simultanés en ${p3.secondes.toFixed(1)} s : moyennes exactes pour les ${R} restaurants`, p3.erreurs.length === 0 && faux.length === 0, `${p3.erreurs.length} erreur(s), ${faux.length} restaurant(s) au total faux`);

  // ------------------------------------------------------------ phase 4 : isolement des autres rôles
  console.log("\n--- Phase 4 : clients et visiteurs anonymes");
  const c0 = pool[0];
  const lectureClient = await enTantQue(c0, clients[0], (cl) => cl.query(`select count(*)::int n from orders`));
  verifier("un client connecté ne lit aucune commande directement", lectureClient.rows[0].n === 0, `${lectureClient.rows[0].n} lue(s)`);
  await c0.query("begin");
  let anonOk = false;
  try { await c0.query("set local role anon"); await c0.query("select id from orders limit 1"); } catch { anonOk = true; } finally { await c0.query("rollback"); }
  verifier("un visiteur anonyme ne lit aucune commande", anonOk);
  const avisDirect = await enTantQue(c0, restos[0].proprio, (cl) => cl.query(`select count(*)::int n from avis`));
  verifier("un restaurateur ne voit que les avis de SON restaurant", avisDirect.rows[0].n === (await q(`select count(*)::int n from avis where restaurant_id = $1`, [restos[0].id])).rows[0].n);

  // ------------------------------------------------------------ phase 5 : une salle pleine derrière UNE adresse (Wi-Fi du restaurant, ou réseau mobile partagé)
  console.log("\n--- Phase 5 : limites de débit réelles (fn_limiter_debit) pour une salle pleine derrière une seule adresse IP");
  const source = fs.readFileSync(path.join(RACINE, "apps", "web", "src", "lib", "securite", "limitation-debit.ts"), "utf8");
  const regle = (nom) => { const m = source.match(new RegExp(`nom: "${nom}",\\s*max: (\\d+),\\s*fenetreSecondes: (\\d+)`)); if (!m) throw new Error("règle introuvable : " + nom); return { max: Number(m[1]), fenetre: Number(m[2]) }; };
  const passe = async (nom, cle, n) => { const r = regle(nom); let ok_ = 0; for (let i = 0; i < n; i += 1) if ((await q(`select fn_limiter_debit($1,$2,$3) as ok`, [`${nom}:${cle}`, r.fenetre, r.max])).rows[0].ok === true) ok_ += 1; return { ok: ok_, max: r.max, fenetre: r.fenetre }; };
  const convives = 40;
  // Commande à table avec la clé du QR vérifiée : plafond d'adresse large + plafond PAR TABLE (12 tables dans la salle).
  let passes = 0;
  const regleIpTable = regle("commande-ip-table"), regleTable = regle("commande-table");
  for (let i = 0; i < convives; i += 1) {
    const table = `table-${i % 12}`;
    const a = (await q(`select fn_limiter_debit($1,$2,$3) as ok`, ["commande-ip-table:wifi-salle", regleIpTable.fenetre, regleIpTable.max])).rows[0].ok;
    const b = (await q(`select fn_limiter_debit($1,$2,$3) as ok`, [`commande-table:resto:${table}`, regleTable.fenetre, regleTable.max])).rows[0].ok;
    if (a === true && b === true) passes += 1;
  }
  console.log(`        ${convives} convives à table (clé du QR vérifiée, 12 tables) derrière la même adresse en 10 min : ${passes} passent (plafond adresse ${regleIpTable.max}, plafond par table ${regleTable.max})`);
  verifier(`SALLE PLEINE : ${convives} convives à table sur le même Wi-Fi peuvent tous commander`, passes === convives, `seuls ${passes}/${convives} passent`);
  const cmdIp = await passe("commande-ip", "reseau-mobile-partage", convives);
  console.log(`        pour mémoire, sans clé de table (retrait, livraison) : ${convives} clients derrière une même adresse mobile partagée en 10 min : ${cmdIp.ok} passent (plafond ${cmdIp.max}) ; les autres garde-fous (anti-robot, téléphone, restaurant) restent`);
  verifier("réseau mobile partagé : au moins 30 commandes ordinaires par 10 min et par adresse", cmdIp.ok >= 30, `${cmdIp.ok} passent`);
  const appels = await passe("appel-table-ip", "wifi-salle", 50);
  console.log(`        50 appels au serveur / demandes d'addition depuis la même adresse : ${appels.ok} passent (plafond ${appels.max})`);
  verifier("SALLE PLEINE : 50 appels au serveur ou demandes d'addition depuis le même Wi-Fi passent", appels.ok === 50, `seuls ${appels.ok}/50 passent`);
  const restoLimite = await passe("commande-resto", "restaurant-plein", 100);
  console.log(`        100 commandes en 10 min pour un même restaurant : ${restoLimite.ok} passent (plafond ${restoLimite.max})`);
  const notes_ip = await passe("notation-ip", "wifi-salle", 40);
  console.log(`        40 convives notent depuis la même adresse en 1 h : ${notes_ip.ok} passent (plafond ${notes_ip.max})`);

  // ------------------------------------------------------------ phase 6 : rafale de scans du QR
  console.log("\n--- Phase 6 : rafale de scans du QR d'un restaurant (fn_compter_scan)");
  const codeCourt = (await q(`select code_court from restaurants where id = $1`, [restos[0].id])).rows[0].code_court;
  const avantScans = (await q(`select count(*)::int n from restaurant_scans`)).rows[0].n;
  const scans = Array.from({ length: 2000 }, () => async (c) => { await c.query(`select fn_compter_scan($1,'qr')`, [codeCourt]); });
  const p6 = await enRafale(scans);
  const apresScans = (await q(`select coalesce(sum(nb),0)::int n, count(*)::int lignes from restaurant_scans where restaurant_id = $1`, [restos[0].id])).rows[0];
  verifier(`2000 scans simultanés en ${p6.secondes.toFixed(1)} s : aucun perdu, une seule ligne par jour et par source`, p6.erreurs.length === 0 && apresScans.n >= 2000 && apresScans.lignes <= 3, `compteur ${apresScans.n}, ${apresScans.lignes} ligne(s), ${p6.erreurs.length} erreur(s), p95 ${percentile(p6.durees, 0.95).toFixed(0)} ms`);
  void avantScans;

  // ------------------------------------------------------------ phase 7 : un même compte crée plusieurs restaurants en même temps
  console.log("\n--- Phase 7 : un compte neuf appelle fn_creer_restaurant_et_owner 10 fois en même temps");
  const nouveau = uuid();
  await q(`insert into auth.users (id, email) values ($1,$2)`, [nouveau, "nouveau@test.invalid"]);
  const creations2 = Array.from({ length: 10 }, () => async (c) => { await enTantQue(c, nouveau, (cl) => cl.query(`select fn_creer_restaurant_et_owner('Restaurant zélé', $1, $2)`, [CAT, QUA])); });
  await enRafale(creations2, 10);
  const possedes = (await q(`select count(*)::int n from restaurant_memberships where utilisateur_id = $1`, [nouveau])).rows[0].n;
  verifier("un compte ne peut créer qu'un seul restaurant, même par appels simultanés", possedes === 1, `${possedes} restaurant(s) créé(s) pour ce compte`);
} finally {
  await Promise.all(pool.map((c) => c.end().catch(() => {})));
  await admin.end().catch(() => {});
  await serveur.stop().catch(() => {});
}
console.log(`\n${ko === 0 ? "SIMULATION RÉUSSIE" : ko + " ÉCHEC(S)"} : ${ok} contrôles réussis, ${ko} échoués.`);
process.exit(ko === 0 ? 0 : 1);
