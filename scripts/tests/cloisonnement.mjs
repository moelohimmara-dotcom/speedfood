// Tests de cloisonnement entre restaurants, joués sur la VRAIE logique de la base : les migrations de
// supabase/migrations sont rejouées sur une base PostgreSQL jetable (PGlite, en mémoire, sans Docker,
// sans compte, sans toucher à la production), puis on se connecte « en tant que » de faux comptes :
// restaurateur A, restaurateur B, client, administrateur système, visiteur anonyme.
// Les droits sont ceux de Supabase : rôles anon / authenticated, et l'identité du compte lue par
// les policies dans request.jwt.claims (c'est ce que fait PostgREST à chaque requête).
// Usage : npm run test:cloisonnement   (prérequis, une fois : cd supabase/rejeu && npm ci)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { PGlite } = await import(
  pathToFileURL(path.join(racine, "supabase", "rejeu", "node_modules", "@electric-sql", "pglite", "dist", "index.js")).href
).catch(() => {
  console.error("PGlite absent : lancez d'abord  cd supabase/rejeu && npm ci");
  process.exit(1);
});

let echecs = 0;
let reussis = 0;
function verifier(nom, ok, detail = "") {
  if (ok) {
    reussis += 1;
    console.log(`OK    ${nom}`);
  } else {
    echecs += 1;
    console.log(`ECHEC ${nom}${detail ? "\n         " + detail : ""}`);
  }
}

// ---------------------------------------------------------------- base jetable, comme Supabase
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
  -- Supabase accorde par défaut tous les droits sur le schéma public à anon et authenticated : ce sont
  -- les policies RLS (et les REVOKE des migrations) qui restreignent. Sans ceci, on testerait des
  -- « permission denied » au lieu des policies.
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const dossierMigrations = path.join(racine, "supabase", "migrations");
const fichiers = fs.readdirSync(dossierMigrations).filter((n) => n.endsWith(".sql")).sort();
for (const f of fichiers) {
  try {
    await db.exec(fs.readFileSync(path.join(dossierMigrations, f), "utf8").replace(/create extension if not exists pgcrypto;?/gi, ""));
  } catch (e) {
    console.log(`ECHEC migration ${f} : ${e.message}`);
    process.exit(1);
  }
}
console.log(`${fichiers.length} migrations rejouées\n`);

// ---------------------------------------------------------------- se connecter « en tant que »
const ID = {
  resto_a: "00000000-0000-4000-8000-0000000000a1",
  resto_b: "00000000-0000-4000-8000-0000000000b1",
  user_a: "00000000-0000-4000-8000-00000000aaaa",
  user_b: "00000000-0000-4000-8000-00000000bbbb",
  client: "00000000-0000-4000-8000-00000000cccc",
  admin: "00000000-0000-4000-8000-00000000dddd",
  support: "00000000-0000-4000-8000-00000000eeee",
};

/** Exécute `fn` avec les droits du rôle et l'identité donnés, puis rétablit le superutilisateur. */
async function en_tant_que(qui, fn) {
  const role = qui === null ? "anon" : "authenticated";
  const claims = qui === null ? {} : { sub: qui, role: "authenticated", aal: "aal2" };
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false)`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${qui ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    // Retour au contexte « serveur » : sans identité, comme la clé de service (auth.uid() est nul).
    await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Lit : renvoie les lignes visibles, ou une erreur (refus de droits) sous forme d'objet. */
async function lire(qui, sql, params = []) {
  return en_tant_que(qui, async () => {
    try {
      return { lignes: (await db.query(sql, params)).rows };
    } catch (e) {
      return { erreur: e.message, lignes: [] };
    }
  });
}

/** Écrit : renvoie le nombre de lignes touchées (0 si la RLS filtre), ou l'erreur levée. */
async function ecrire(qui, sql, params = []) {
  return en_tant_que(qui, async () => {
    try {
      const r = await db.query(sql, params);
      return { touchees: r.affectedRows ?? r.rows.length, erreur: null };
    } catch (e) {
      return { touchees: 0, erreur: e.message };
    }
  });
}

// ---------------------------------------------------------------- données de départ (superutilisateur : la RLS ne s'applique pas)
const U = (n) => `'${n}'::uuid`;
const CAT = "00000000-0000-4000-8000-0000000000c1";
const QUA = "00000000-0000-4000-8000-0000000000d1";
const RESTO_B2 = "00000000-0000-4000-8000-0000000000b2";
const CMD_A = "00000000-0000-4000-8000-00000000a001";
const CMD_B = "00000000-0000-4000-8000-00000000b001";
const PLAT_A = "00000000-0000-4000-8000-00000000a101";
const PLAT_B = "00000000-0000-4000-8000-00000000b101";
await db.exec(`
  insert into auth.users (id, email) values
    (${U(ID.user_a)}, 'a@test.invalid'), (${U(ID.user_b)}, 'b@test.invalid'), (${U(ID.client)}, 'client@test.invalid'),
    (${U(ID.admin)}, 'admin@test.invalid'), (${U(ID.support)}, 'support@test.invalid');
  insert into menu_categories (id, nom) values ('${CAT}', 'Cat test');
  insert into neighborhoods (id, nom) values ('${QUA}', 'Quartier test');
  insert into restaurants (id, nom, categorie_id, quartier_id, publie) values
    (${U(ID.resto_a)}, 'RESTO-A', '${CAT}', '${QUA}', true),
    (${U(ID.resto_b)}, 'RESTO-B-SECRET', '${CAT}', '${QUA}', true),
    ('${RESTO_B2}', 'RESTO-B2-NONPUBLIE', '${CAT}', '${QUA}', false);
  insert into restaurant_memberships (restaurant_id, utilisateur_id, role) values
    (${U(ID.resto_a)}, ${U(ID.user_a)}, 'owner'), (${U(ID.resto_b)}, ${U(ID.user_b)}, 'owner'),
    ('${RESTO_B2}', ${U(ID.user_b)}, 'owner');
  insert into system_admin_memberships (utilisateur_id, role) values (${U(ID.admin)}, 'super_admin'), (${U(ID.support)}, 'support');
  insert into menu_items (id, restaurant_id, nom, prix) values
    ('${PLAT_A}', ${U(ID.resto_a)}, 'Plat A', 1000),
    ('${PLAT_B}', ${U(ID.resto_b)}, 'Plat B', 2000),
    ('00000000-0000-4000-8000-00000000b201', '${RESTO_B2}', 'Plat B2', 3000);
  insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, client_adresse, mode, sous_total, statut) values
    ('${CMD_A}', 'SF-AAAAA', 'jeton-a', ${U(ID.resto_a)}, 'Client A', '620000001', 'Adresse A', 'livraison', 1000, 'en_attente'),
    ('${CMD_B}', 'SF-BBBBB', 'jeton-b', ${U(ID.resto_b)}, 'Client B', 'B-TEL-620000002', 'Adresse B', 'livraison', 2000, 'acceptee');
  insert into order_items (id, order_id, nom, prix, quantite) values
    ('00000000-0000-4000-8000-00000000a011', '${CMD_A}', 'Plat A', 1000, 1),
    ('00000000-0000-4000-8000-00000000b011', '${CMD_B}', 'Plat B', 2000, 1);
  insert into order_status_events (order_id, statut_suivant, acteur) values
    ('${CMD_A}', 'en_attente', 'systeme'), ('${CMD_B}', 'acceptee', 'systeme');
  insert into order_proposals (order_id, version, nouveau_sous_total) values
    ('${CMD_A}', 1, 900), ('${CMD_B}', 1, 1900);
`);

// Tables privées rattachées à un restaurant : on tente l'insertion sans bloquer si le schéma exige autre chose.
const optionnelles = [
  ["push_subscriptions", (r, u) => `insert into push_subscriptions (restaurant_id, utilisateur_id, endpoint, p256dh, auth) values (${U(r)}, ${U(u)}, 'https://push.invalid/${r}', 'p256dhpublickey', 'authsecret-1234')`],
  ["restaurant_codes_marchand", (r) => `insert into restaurant_codes_marchand (restaurant_id) values (${U(r)})`],
  ["restaurant_identite_documents", (r) => `insert into restaurant_identite_documents (restaurant_id) values (${U(r)})`],
  ["restaurant_scans", (r) => `insert into restaurant_scans (restaurant_id, source) values (${U(r)}, 'affiche')`],
];
const seedsAbsents = [];
for (const [table, sql] of optionnelles) {
  try {
    await db.exec(sql(ID.resto_a, ID.user_a));
    await db.exec(sql(ID.resto_b, ID.user_b));
  } catch (e) {
    seedsAbsents.push(`${table} : ${e.message}`);
  }
}
if (seedsAbsents.length) console.log("Tables non amorcées (à compléter) :\n  " + seedsAbsents.join("\n  ") + "\n");

const nb = async (qui, table, filtre = "true") => (await lire(qui, `select count(*)::int n from public.${table} where ${filtre}`)).lignes[0]?.n ?? "refus";
const B = `restaurant_id = ${U(ID.resto_b)}`;
const A = `restaurant_id = ${U(ID.resto_a)}`;
const VIDE = (n) => n === 0 || n === "refus";

// ---------------------------------------------------------------- 1. lecture : chacun ne voit que ses données
console.log("--- Lecture des données privées d'un restaurant");
const privees = [
  ["orders", A, B],
  ["order_items", `order_id = '${CMD_A}'`, `order_id = '${CMD_B}'`],
  ["order_status_events", `order_id = '${CMD_A}'`, `order_id = '${CMD_B}'`],
  ["order_proposals", `order_id = '${CMD_A}'`, `order_id = '${CMD_B}'`],
];
for (const [t] of optionnelles) if (!seedsAbsents.some((x) => x.startsWith(t + " "))) privees.push([t, A, B]);

for (const [table, filtreA, filtreB] of privees) {
  const proprio = await nb(ID.user_a, table, filtreA);
  verifier(`${table} : le restaurant A voit ses propres lignes (garde-fou contre un test creux)`, typeof proprio === "number" && proprio >= 1, `vu : ${proprio}`);
  const autre = await nb(ID.user_a, table, filtreB);
  verifier(`${table} : le restaurant A ne voit aucune ligne du restaurant B`, VIDE(autre), `vu : ${autre}`);
  const inverse = await nb(ID.user_b, table, filtreA);
  verifier(`${table} : le restaurant B ne voit aucune ligne du restaurant A`, VIDE(inverse), `vu : ${inverse}`);
  const client = await nb(ID.client, table);
  verifier(`${table} : un client connecté ne voit rien`, VIDE(client), `vu : ${client}`);
  const anon = await nb(null, table);
  verifier(`${table} : un visiteur anonyme ne voit rien`, VIDE(anon), `vu : ${anon}`);
}

// ---------------------------------------------------------------- 2. restaurants publiés / non publiés
console.log("\n--- Restaurants et menus");
const noms = async (qui, sql) => (await lire(qui, sql)).lignes.map((l) => l.nom).sort().join("|");
verifier("anonyme : voit les restaurants publiés, pas les non publiés", (await noms(null, "select nom from restaurants")) === "RESTO-A|RESTO-B-SECRET");
verifier("anonyme : voit le menu des restaurants publiés seulement", (await noms(null, "select nom from menu_items")) === "Plat A|Plat B");
verifier("restaurant A : ne voit pas le restaurant non publié de B", !(await noms(ID.user_a, "select nom from restaurants")).includes("B2"));
verifier("restaurant A : ne voit pas le menu non publié de B", !(await noms(ID.user_a, "select nom from menu_items")).includes("Plat B2"));
verifier("restaurant B : voit son restaurant non publié et son menu", (await noms(ID.user_b, "select nom from restaurants")).includes("B2") && (await noms(ID.user_b, "select nom from menu_items")).includes("Plat B2"));
verifier("administrateur système : voit tous les restaurants", (await noms(ID.admin, "select nom from restaurants")).split("|").length === 3);

// ---------------------------------------------------------------- 3. écriture : un restaurant ne touche pas à l'autre
console.log("\n--- Écriture");
const refus = (r) => r.erreur !== null || r.touchees === 0;
const interdit = async (nom, qui, sql, params = []) => {
  const r = await ecrire(qui, sql, params);
  verifier(nom, refus(r), `touchées : ${r.touchees}, erreur : ${r.erreur ?? "aucune"}`);
};
const autorise = async (nom, qui, sql, params = []) => {
  const r = await ecrire(qui, sql, params);
  verifier(nom, r.erreur === null && r.touchees >= 1, `touchées : ${r.touchees}, erreur : ${r.erreur ?? "aucune"}`);
};
await autorise("A modifie son propre plat (garde-fou)", ID.user_a, `update menu_items set prix = 1100 where id = '${PLAT_A}'`);
await interdit("A ne modifie pas le plat de B", ID.user_a, `update menu_items set prix = 1 where id = '${PLAT_B}'`);
await interdit("A ne supprime pas le plat de B", ID.user_a, `delete from menu_items where id = '${PLAT_B}'`);
await interdit("A ne crée pas de plat chez B", ID.user_a, `insert into menu_items (restaurant_id, nom, prix) values (${U(ID.resto_b)}, 'Intrus', 1)`);
await interdit("A ne déplace pas son plat chez B", ID.user_a, `update menu_items set restaurant_id = ${U(ID.resto_b)} where id = '${PLAT_A}'`);
await interdit("A ne modifie pas la commande de B", ID.user_a, `update orders set statut = 'refusee' where id = '${CMD_B}'`);
await interdit("A ne déplace pas sa commande chez B", ID.user_a, `update orders set restaurant_id = ${U(ID.resto_b)} where id = '${CMD_A}'`);
await interdit("A ne supprime pas la commande de B", ID.user_a, `delete from orders where id = '${CMD_B}'`);
await interdit("A n'écrit pas dans l'historique de B", ID.user_a, `insert into order_status_events (order_id, statut_suivant, acteur) values ('${CMD_B}', 'prete', 'intrus')`);
await interdit("A ne propose pas de prix sur une commande de B", ID.user_a, `insert into order_proposals (order_id, version, nouveau_sous_total) values ('${CMD_B}', 2, 1)`);
await interdit("A ne modifie pas la fiche du restaurant B", ID.user_a, `update restaurants set nom = 'Piraté' where id = ${U(ID.resto_b)}`);
await interdit("A ne supprime pas le restaurant B", ID.user_a, `delete from restaurants where id = ${U(ID.resto_b)}`);
await interdit("A ne s'ajoute pas comme membre de B", ID.user_a, `insert into restaurant_memberships (restaurant_id, utilisateur_id, role) values (${U(ID.resto_b)}, ${U(ID.user_a)}, 'owner')`);
await interdit("A ne se donne pas un rôle système", ID.user_a, `insert into system_admin_memberships (utilisateur_id, role) values (${U(ID.user_a)}, 'super_admin')`);
await interdit("un client ne se donne pas un rôle système", ID.client, `insert into system_admin_memberships (utilisateur_id, role) values (${U(ID.client)}, 'super_admin')`);
await interdit("anonyme : aucune écriture sur les commandes", null, `update orders set statut = 'annulee'`);
await interdit("anonyme : aucune création de commande directe", null, `insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total) values ('SF-X', 'x', ${U(ID.resto_a)}, 'X', '1', 'retrait', 1)`);
await interdit("anonyme : aucune écriture sur les restaurants", null, `update restaurants set nom = 'x'`);
await interdit("anonyme : aucune écriture sur le menu", null, `delete from menu_items`);

// ---------------------------------------------------------------- 4. données publiques par conception : seulement pour un restaurant publié
console.log("\n--- Zones de livraison (publiques seulement pour un restaurant publié)");
await db.exec(`
  insert into restaurant_zones_desservies (restaurant_id, neighborhood_id) values (${U(ID.resto_a)}, '${QUA}'), (${U(ID.resto_b)}, '${QUA}'), ('${RESTO_B2}', '${QUA}');
`);
const zonesVues = async (qui) => (await lire(qui, "select restaurant_id from restaurant_zones_desservies")).lignes.map((l) => l.restaurant_id);
verifier("anonyme : voit les zones des restaurants publiés", (await zonesVues(null)).length === 2);
verifier("anonyme : ne voit pas les zones d'un restaurant non publié", !(await zonesVues(null)).includes(RESTO_B2));
verifier("restaurant A : ne voit pas les zones d'un restaurant non publié de B", !(await zonesVues(ID.user_a)).includes(RESTO_B2));
verifier("restaurant B : voit ses zones, publiées ou non", (await zonesVues(ID.user_b)).includes(RESTO_B2));
await interdit("A ne modifie pas les zones de B", ID.user_a, `update restaurant_zones_desservies set frais_gnf = 0 where restaurant_id = ${U(ID.resto_b)}`);
await interdit("A ne supprime pas les zones de B", ID.user_a, `delete from restaurant_zones_desservies where restaurant_id = ${U(ID.resto_b)}`);
await interdit("A ne crée pas de zone chez B", ID.user_a, `insert into restaurant_zones_desservies (restaurant_id, commune_id) values (${U(ID.resto_b)}, null)`);
await interdit("anonyme : aucune écriture sur les zones", null, `delete from restaurant_zones_desservies`);

// ---------------------------------------------------------------- 5. double authentification : le droit disparaît sans session renforcée
console.log("\n--- Double authentification (aal2)");
await db.exec(`insert into auth.mfa_factors (user_id, status) values (${U(ID.user_a)}, 'verified')`);
const lireAal = async (aal) => {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: ID.user_a, role: "authenticated", aal })}', false), set_config('request.jwt.claim.sub', '${ID.user_a}', false)`);
  await db.exec("set role authenticated");
  try {
    return (await db.query(`select count(*)::int n from public.orders where restaurant_id = ${U(ID.resto_a)}`)).rows[0].n;
  } finally {
    await db.exec("reset role");
  }
};
verifier("compte avec 2FA actif en session aal1 (mot de passe seul) : ne voit plus ses commandes", (await lireAal("aal1")) === 0);
verifier("même compte en session aal2 : retrouve ses commandes", (await lireAal("aal2")) >= 1);
await db.exec(`delete from auth.mfa_factors where user_id = ${U(ID.user_a)}`);

// ---------------------------------------------------------------- 6. fonctions SECURITY DEFINER ouvertes aux comptes connectés
// Elles s'exécutent avec les droits du propriétaire de la base : si l'une oublie de vérifier l'appelant,
// elle contourne toute la RLS. Chacune est appelée ici par un restaurateur A (ou un client) avec des
// arguments qui visent le restaurant B ; elle doit refuser, ou ne rien renvoyer de B.
console.log("\n--- Fonctions privilégiées appelées par un mauvais appelant");
const SECRETS = ["RESTO-B-SECRET", "B-TEL-620000002", "Adresse B", "Client B", "b@test.invalid"];
const appel = async (nom, qui, sql) => {
  const r = await ecrire(qui, sql);
  // ecrire() ne renvoie pas les lignes : on relit via lire() pour inspecter le contenu.
  const l = await lire(qui, sql);
  console.log(`        -> ${l.erreur ?? l.lignes.length + " ligne(s) renvoyée(s)"}`);
  const texte = JSON.stringify(l.lignes);
  const fuite = SECRETS.find((x) => texte.includes(x));
  verifier(nom, !fuite, fuite ? `données de B renvoyées : « ${fuite} »` : "");
  return { r, l };
};
await appel("fn_admin_dossier_restaurant(B) par un restaurateur", ID.user_a, `select * from fn_admin_dossier_restaurant(${U(ID.resto_b)})`);
await appel("fn_admin_lister_plats(B) par un restaurateur", ID.user_a, `select * from fn_admin_lister_plats(${U(ID.resto_b)})`);
await appel("fn_lister_membres_restaurant(B) par un restaurateur", ID.user_a, `select * from fn_lister_membres_restaurant(${U(ID.resto_b)})`);
await appel("fn_trouver_utilisateur_par_email par un restaurateur", ID.user_a, `select * from fn_trouver_utilisateur_par_email('b@test.invalid')`);
await appel("fn_trouver_utilisateur_par_email par un client", ID.client, `select * from fn_trouver_utilisateur_par_email('b@test.invalid')`);
await appel("fn_support_lister_commandes par un restaurateur", ID.user_a, `select * from fn_support_lister_commandes(null, null, false, null, ${U(ID.resto_b)})`);
await appel("fn_support_lister_commandes par un client", ID.client, `select * from fn_support_lister_commandes(null, null, false, null, null)`);
await appel("fn_support_reveler_coordonnees(commande de B) par un restaurateur", ID.user_a, `select * from fn_support_reveler_coordonnees('${CMD_B}', 'curiosité')`);
await appel("fn_lister_audit par un restaurateur", ID.user_a, `select * from fn_lister_audit(null, null, 50)`);
await appel("fn_statistiques_application par un restaurateur", ID.user_a, `select * from fn_statistiques_application(30)`);

// Contrôles positifs : les bons appelants, eux, obtiennent bien une réponse (sinon les refus ci-dessus ne prouveraient rien).
const support = await lire(ID.support, `select * from fn_support_lister_commandes(null, null, false, null, null)`);
verifier("contrôle positif : le support liste les commandes", !support.erreur && support.lignes.length === 2, support.erreur ?? `${support.lignes.length} ligne(s)`);
const dossier = await lire(ID.admin, `select * from fn_admin_dossier_restaurant(${U(ID.resto_b)})`);
verifier("contrôle positif : l'administrateur lit le dossier d'un restaurant", !dossier.erreur && dossier.lignes.length >= 1, dossier.erreur ?? `${dossier.lignes.length} ligne(s)`);
const membres = await lire(ID.admin, `select * from fn_lister_membres_restaurant(${U(ID.resto_b)})`);
verifier("contrôle positif : l'administrateur liste les membres d'un restaurant", !membres.erreur && membres.lignes.length >= 1, membres.erreur ?? `${membres.lignes.length} ligne(s)`);

const refuse = async (nom, qui, sql) => {
  const r = await ecrire(qui, sql);
  console.log(`        -> ${r.erreur ?? "aucune erreur, " + r.touchees + " ligne(s)"}`);
  verifier(nom, r.erreur !== null || r.touchees === 0, `touchées : ${r.touchees}, erreur : ${r.erreur ?? "aucune"}`);
};
await refuse("fn_emettre_document sur la commande de B par un restaurateur", ID.user_a, `select fn_emettre_document('${CMD_B}', 'facture')`);
await refuse("fn_emettre_document par un anonyme", null, `select fn_emettre_document('${CMD_A}', 'facture')`);
await refuse("fn_support_changer_statut par un restaurateur", ID.user_a, `select fn_support_changer_statut('${CMD_B}', 'annulee', 'test')`);
await refuse("fn_fusionner_quartiers par un restaurateur", ID.user_a, `select fn_fusionner_quartiers('${QUA}', '${QUA}')`);
await refuse("fn_admin_definir_illustration par un restaurateur", ID.user_a, `select fn_admin_definir_illustration('restaurant', ${U(ID.resto_b)}, '{}'::jsonb)`);
await refuse("fn_preparer_suppression_compte(B) par un restaurateur", ID.user_a, `select fn_preparer_suppression_compte(${U(ID.user_b)}, true, 'test')`);
await refuse("fn_preparer_suppression_compte par un client", ID.client, `select fn_preparer_suppression_compte(${U(ID.user_b)}, true, 'test')`);
await refuse("fn_reinitialisation_simuler par un restaurateur", ID.user_a, `select fn_reinitialisation_simuler()`);
await refuse("fn_reinitialiser_application par un restaurateur", ID.user_a, `select fn_reinitialiser_application('00000000-0000-4000-8000-000000000001'::uuid, 'motif assez long pour passer')`);
await refuse("fn_reinitialiser_application par un administrateur sans jeton valide", ID.admin, `select fn_reinitialiser_application('00000000-0000-4000-8000-000000000001'::uuid, 'motif assez long pour passer')`);
verifier("les données de test sont intactes après ces tentatives", (await db.query("select count(*)::int n from orders")).rows[0].n === 2 && (await nb(ID.admin, "restaurants")) === 3);

// ---------------------------------------------------------------- 6 bis. questions de sécurité (barrière d'application)
console.log("\n--- Questions de sécurité");
const SESSION_OK = "00000000-0000-4000-8000-0000000005e1";
const SESSION_AUTRE = "00000000-0000-4000-8000-0000000005e2";
await db.exec(`
  insert into securite_questions (utilisateur_id, question_1, question_2, sel, empreinte)
    values (${U(ID.user_a)}, 'premier_ecole', 'surnom_enfance', '00112233445566778899aabbccddeeff', '${"ab".repeat(32)}');
  insert into securite_codes_secours (utilisateur_id, empreinte) values (${U(ID.user_a)}, '${"cd".repeat(32)}');
  insert into securite_questions_sessions (session_id, utilisateur_id, valide_jusqu)
    values ('${SESSION_OK}', ${U(ID.user_a)}, now() + interval '1 hour');
`);
for (const t of ["securite_questions", "securite_codes_secours", "securite_questions_sessions"]) {
  for (const [nom, qui] of [["le titulaire", ID.user_a], ["un autre restaurateur", ID.user_b], ["un client", ID.client], ["un administrateur", ID.admin], ["un anonyme", null]]) {
    const n = await nb(qui, t);
    verifier(`${t} : illisible pour ${nom} (seul le serveur à clé de service y accède)`, VIDE(n), `vu : ${n}`);
  }
}
await interdit("le titulaire ne s'écrit pas lui-même une validation de session", ID.user_a, `insert into securite_questions_sessions (session_id, utilisateur_id, valide_jusqu) values ('${SESSION_AUTRE}', ${U(ID.user_a)}, now() + interval '1 day')`);
await interdit("le titulaire ne retire pas lui-même ses questions par l'API", ID.user_a, `delete from securite_questions where utilisateur_id = ${U(ID.user_a)}`);
await interdit("un autre compte ne crée pas de questions pour A par l'API", ID.user_b, `insert into securite_questions (utilisateur_id, question_1, question_2, sel, empreinte) values (${U(ID.user_b)}, 'premier_ecole', 'surnom_enfance', '00112233445566778899aabbccddeeff', '${"ab".repeat(32)}')`);

async function etatQuestions(qui, claims) {
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false), set_config('request.jwt.claim.sub', '${qui ?? ""}', false)`);
  await db.exec(`set role ${qui === null ? "anon" : "authenticated"}`);
  try {
    return (await db.query("select fn_questions_etat() as e")).rows[0].e;
  } catch (e) {
    return { erreur: e.message };
  } finally {
    await db.exec("reset role");
  }
}
const e1 = await etatQuestions(ID.user_a, { sub: ID.user_a, role: "authenticated", aal: "aal1", session_id: SESSION_AUTRE });
verifier("session qui n'a pas répondu : les questions sont requises", e1.active === true && e1.requise === true, JSON.stringify(e1));
verifier("l'état ne contient ni sel ni empreinte", !JSON.stringify(e1).includes("empreinte") && !JSON.stringify(e1).includes("sel") && !JSON.stringify(e1).includes("abab"), JSON.stringify(e1));
const e2 = await etatQuestions(ID.user_a, { sub: ID.user_a, role: "authenticated", aal: "aal1", session_id: SESSION_OK });
verifier("session qui a répondu : plus requises", e2.active === true && e2.requise === false, JSON.stringify(e2));
const e3 = await etatQuestions(ID.user_a, { sub: ID.user_a, role: "authenticated", aal: "aal1" });
verifier("jeton sans identifiant de session : requises", e3.requise === true, JSON.stringify(e3));
const e4 = await etatQuestions(ID.user_a, { sub: ID.user_a, role: "authenticated", aal: "aal2", session_id: SESSION_AUTRE });
verifier("session renforcée par l'application d'authentification : les questions ne sont pas redemandées", e4.requise === false, JSON.stringify(e4));
const e5 = await etatQuestions(ID.user_b, { sub: ID.user_b, role: "authenticated", aal: "aal1", session_id: SESSION_OK });
verifier("un autre compte n'hérite pas de la validation d'une session qui n'est pas la sienne", e5.active === false && e5.requise === false, JSON.stringify(e5));
await db.exec(`update securite_questions_sessions set valide_jusqu = now() - interval '1 minute' where session_id = '${SESSION_OK}'`);
const e6 = await etatQuestions(ID.user_a, { sub: ID.user_a, role: "authenticated", aal: "aal1", session_id: SESSION_OK });
verifier("validation expirée : de nouveau requises", e6.requise === true, JSON.stringify(e6));
const e7 = await etatQuestions(null, {});
verifier("anonyme : fonction non exécutable", !!e7.erreur, JSON.stringify(e7));

// ---------------------------------------------------------------- 6 ter. livraison (réglages, mode du restaurant, colonnes de la commande)
console.log("\n--- Livraison");
const nbReglages = async (qui) => (await lire(qui, "select count(*)::int n from parametres_livraison")).lignes[0]?.n ?? "refus";
verifier("réglages de livraison : lisibles par le super administrateur", (await nbReglages(ID.admin)) === 1);
verifier("réglages de livraison : illisibles pour un restaurateur", VIDE(await nbReglages(ID.user_a)));
verifier("réglages de livraison : illisibles pour le support", VIDE(await nbReglages(ID.support)));
verifier("réglages de livraison : illisibles pour un client", VIDE(await nbReglages(ID.client)));
verifier("réglages de livraison : illisibles pour un anonyme", VIDE(await nbReglages(null)));
await autorise("le super administrateur modifie les réglages de livraison", ID.admin, `update parametres_livraison set base_gnf = 6000 where id = true`);
await interdit("un restaurateur ne modifie pas les réglages de livraison", ID.user_a, `update parametres_livraison set base_gnf = 1 where id = true`);
await interdit("le support ne modifie pas les réglages de livraison", ID.support, `update parametres_livraison set base_gnf = 1 where id = true`);
await interdit("personne ne supprime les réglages de livraison", ID.admin, `delete from parametres_livraison`);
await interdit("des frais négatifs sont refusés par la base", ID.admin, `update parametres_livraison set base_gnf = -5 where id = true`);
await interdit("un rayon nul est refusé par la base", ID.admin, `update parametres_livraison set rayon_max_km = 0 where id = true`);

await autorise("A choisit le mode de livraison de son restaurant", ID.user_a, `update restaurants set livraison_mode = 'aucune' where id = ${U(ID.resto_a)}`);
await interdit("A ne change pas le mode de livraison du restaurant de B", ID.user_a, `update restaurants set livraison_mode = 'aucune' where id = ${U(ID.resto_b)}`);
await interdit("un mode de livraison inconnu est refusé", ID.user_a, `update restaurants set livraison_mode = 'drone' where id = ${U(ID.resto_a)}`);

await interdit("A ne modifie pas la distance de livraison d'une commande", ID.user_a, `update orders set livraison_distance_m = 1 where id = '${CMD_A}'`);
await interdit("A ne modifie pas la destination d'une commande", ID.user_a, `update orders set livraison_latitude = 9.5, livraison_longitude = -13.7 where id = '${CMD_A}'`);
await interdit("A ne rend pas gratuite la livraison d'une commande", ID.user_a, `update orders set livraison_gratuite = true where id = '${CMD_A}'`);
await autorise("A change toujours le statut de sa commande (garde-fou)", ID.user_a, `update orders set statut = 'refusee' where id = '${CMD_A}'`);

// ---------------------------------------------------------------- 6 quater. livreurs, livraisons, offres, codes de remise
console.log("\n--- Livreurs et livraisons");
const U_LIV = "00000000-0000-4000-8000-00000000f001";
const U_LIV2 = "00000000-0000-4000-8000-00000000f002";
const LIVREUR_1 = "00000000-0000-4000-8000-0000000000f1";
const LIVREUR_2 = "00000000-0000-4000-8000-0000000000f2";
const LIVRAISON_A = "00000000-0000-4000-8000-0000000001a1";
const LIVRAISON_B = "00000000-0000-4000-8000-0000000001b1";
await db.exec(`
  insert into auth.users (id, email) values (${U(U_LIV)}, 'livreur1@test.invalid'), (${U(U_LIV2)}, 'livreur2@test.invalid');
  insert into livreurs (id, utilisateur_id, nom, statut, latitude, longitude, position_le) values
    (${U(LIVREUR_1)}, ${U(U_LIV)}, 'Livreur Un', 'en_course', 9.5, -13.7, now()),
    (${U(LIVREUR_2)}, ${U(U_LIV2)}, 'Livreur Deux', 'disponible', 9.6, -13.6, now());
  insert into livraisons (id, order_id, restaurant_id, mode, statut, livreur_id) values
    (${U(LIVRAISON_A)}, '${CMD_A}', ${U(ID.resto_a)}, 'speedfood', 'assignee', ${U(LIVREUR_1)}),
    (${U(LIVRAISON_B)}, '${CMD_B}', ${U(ID.resto_b)}, 'speedfood', 'offre_envoyee', null);
  insert into livraison_codes (livraison_id, code) values (${U(LIVRAISON_A)}, '4821'), (${U(LIVRAISON_B)}, '9034');
  insert into livraison_offres (livraison_id, livreur_id, expire_le) values
    (${U(LIVRAISON_B)}, ${U(LIVREUR_2)}, now() + interval '1 minute');
`);
const nbL = (qui, table) => nb(qui, table);
verifier("livraisons : le restaurant A voit la sienne, pas celle de B", (await nbL(ID.user_a, "livraisons")) === 1 && VIDE(await nb(ID.user_a, "livraisons", `restaurant_id = ${U(ID.resto_b)}`)));
verifier("livraisons : le restaurant B voit la sienne seulement", (await nbL(ID.user_b, "livraisons")) === 1 && VIDE(await nb(ID.user_b, "livraisons", `restaurant_id = ${U(ID.resto_a)}`)));
verifier("livraisons : le livreur 1 voit sa course seulement", (await nbL(U_LIV, "livraisons")) === 1);
verifier("livraisons : le livreur 2 (sans course) n'en voit aucune", VIDE(await nbL(U_LIV2, "livraisons")));
verifier("livraisons : le super administrateur et le support voient tout", (await nbL(ID.admin, "livraisons")) === 2 && (await nbL(ID.support, "livraisons")) === 2);
verifier("livraisons : un client et un anonyme ne voient rien", VIDE(await nbL(ID.client, "livraisons")) && VIDE(await nbL(null, "livraisons")));

verifier("livreurs : le restaurant A voit SON livreur, pas l'autre", (await nbL(ID.user_a, "livreurs")) === 1 && (await nb(ID.user_a, "livreurs", `id = ${U(LIVREUR_1)}`)) === 1);
verifier("livreurs : le restaurant B ne voit aucun livreur affecté (sa course est encore sans livreur)", VIDE(await nbL(ID.user_b, "livreurs")));
verifier("livreurs : un livreur ne voit que sa propre fiche", (await nbL(U_LIV, "livreurs")) === 1 && (await nbL(U_LIV2, "livreurs")) === 1);
verifier("livreurs : l'exploitation voit tous les livreurs", (await nbL(ID.admin, "livreurs")) === 2 && (await nbL(ID.support, "livreurs")) === 2);
verifier("livreurs : un client et un anonyme ne voient rien", VIDE(await nbL(ID.client, "livreurs")) && VIDE(await nbL(null, "livreurs")));

verifier("offres : le livreur 2 voit son offre", (await nbL(U_LIV2, "livraison_offres")) === 1);
verifier("offres : le livreur 1 ne voit pas l'offre du livreur 2", VIDE(await nbL(U_LIV, "livraison_offres")));
verifier("offres : un restaurant ne voit aucune offre (le dispatch ne le regarde pas)", VIDE(await nbL(ID.user_a, "livraison_offres")) && VIDE(await nbL(ID.user_b, "livraison_offres")));
verifier("offres : l'exploitation les voit", (await nbL(ID.admin, "livraison_offres")) === 1);

for (const [nom, qui] of [["le restaurant A", ID.user_a], ["le restaurant B", ID.user_b], ["le livreur 1", U_LIV], ["le livreur 2", U_LIV2], ["le super administrateur", ID.admin], ["le support", ID.support], ["un client", ID.client], ["un anonyme", null]]) {
  verifier(`codes de remise : illisibles pour ${nom}`, VIDE(await nbL(qui, "livraison_codes")));
}

await interdit("A ne modifie pas le statut d'une livraison par l'API", ID.user_a, `update livraisons set statut = 'livree' where id = ${U(LIVRAISON_A)}`);
await interdit("A ne crée pas de livraison par l'API", ID.user_a, `insert into livraisons (order_id, restaurant_id, mode) values ('${CMD_A}', ${U(ID.resto_a)}, 'propre')`);
await interdit("le livreur ne marque pas sa course livrée par l'API (le code est exigé côté serveur)", U_LIV, `update livraisons set statut = 'livree' where id = ${U(LIVRAISON_A)}`);
await interdit("le livreur n'accepte pas une offre par l'API", U_LIV2, `update livraison_offres set statut = 'acceptee' where livreur_id = ${U(LIVREUR_2)}`);
await interdit("le livreur ne déplace pas sa position par l'API", U_LIV, `update livreurs set latitude = 0.5 where id = ${U(LIVREUR_1)}`);
await interdit("le livreur ne se met pas disponible par l'API", U_LIV, `update livreurs set statut = 'disponible' where id = ${U(LIVREUR_1)}`);
await interdit("personne ne crée de livreur par l'API", ID.admin, `insert into livreurs (nom) values ('Intrus')`);
await interdit("le support ne modifie pas une livraison par l'API", ID.support, `update livraisons set statut = 'annulee' where id = ${U(LIVRAISON_B)}`);
await interdit("personne ne lit ni n'écrit le code par l'API", ID.admin, `update livraison_codes set code = '0000'`);
await interdit("un code à 3 chiffres est refusé par la base", ID.admin, `insert into livraison_codes (livraison_id, code) values (${U(LIVRAISON_A)}, '123')`);


// ---------------------------------------------------------------- 6 quinquies. cycle des livreurs, liens d'activation, dossiers
console.log("\n--- Fiches livreurs : liens et dossiers");
await db.exec(`
  insert into livreur_invitations (livreur_id, empreinte, expire_le) values (${U(LIVREUR_1)}, '${"a1".repeat(32)}', now() + interval '7 days');
  insert into livreur_dossiers (livreur_id, piece_type, piece_numero, urgence_nom, urgence_telephone) values (${U(LIVREUR_1)}, 'carte_identite', 'AB12345', 'Proche Un', '+224622000009');
`);
for (const [nom, qui] of [["le super administrateur", ID.admin], ["le support", ID.support], ["le livreur lui-même", U_LIV], ["un restaurateur", ID.user_a], ["un client", ID.client], ["un anonyme", null]]) {
  verifier(`liens d'activation : illisibles pour ${nom}`, VIDE(await nb(qui, "livreur_invitations")));
}
verifier("dossiers : lisibles par le super administrateur seulement", (await nb(ID.admin, "livreur_dossiers")) === 1);
for (const [nom, qui] of [["le support", ID.support], ["le livreur lui-même", U_LIV], ["un restaurateur", ID.user_a], ["un client", ID.client], ["un anonyme", null]]) {
  verifier(`dossiers : illisibles pour ${nom}`, VIDE(await nb(qui, "livreur_dossiers")));
}
await interdit("personne n'écrit un lien d'activation par l'API", ID.admin, `insert into livreur_invitations (livreur_id, empreinte, expire_le) values (${U(LIVREUR_2)}, '${"b2".repeat(32)}', now())`);
await interdit("le livreur ne modifie pas son dossier par l'API", U_LIV, `update livreur_dossiers set piece_numero = 'ZZ99999' where livreur_id = ${U(LIVREUR_1)}`);
await interdit("le livreur ne s'approuve pas lui-même par l'API", U_LIV, `update livreurs set cycle = 'actif' where id = ${U(LIVREUR_1)}`);
await interdit("une empreinte de la mauvaise longueur est refusée", ID.admin, `insert into livreur_invitations (livreur_id, empreinte, expire_le) values (${U(LIVREUR_2)}, 'court', now())`);
await db.exec(`insert into livreurs (nom, telephone, cycle) values ('Tel Un', '+224622555001', 'invite')`);
const doublon = await ecrire(ID.admin, `select 1`);
verifier("deux fiches non archivées ne partagent pas un téléphone (base)", await (async () => { try { await db.exec(`insert into livreurs (nom, telephone, cycle) values ('Tel Deux', '+224622555001', 'candidat')`); return false; } catch { return true; } })() && doublon.erreur === null);
await db.exec(`update livreurs set cycle = 'archive' where telephone = '+224622555001'`);
verifier("un téléphone d'une fiche archivée peut être réutilisé", await (async () => { try { await db.exec(`insert into livreurs (nom, telephone, cycle) values ('Tel Trois', '+224622555001', 'invite')`); return true; } catch { return false; } })());
await db.exec(`delete from livreurs where telephone = '+224622555001'`);

// ---------------------------------------------------------------- 6 sexies. notation : avis, agrégats, classement
console.log("\n--- Notation");
await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false)");
const AVIS_RESTO = "00000000-0000-4000-8000-0000000002a1";
const AVIS_LIVREUR = "00000000-0000-4000-8000-0000000002a2";
const AVIS_CLIENT_PAR_RESTO = "00000000-0000-4000-8000-0000000002a3";
const AVIS_CLIENT_PAR_LIVREUR = "00000000-0000-4000-8000-0000000002a4";
await db.exec(`
  insert into avis (id, order_id, cible, auteur, restaurant_id, auteur_utilisateur_id, note, etiquettes, commentaire, prenom_affiche)
    values ('${AVIS_RESTO}', '${CMD_A}', 'restaurant', 'client', ${U(ID.resto_a)}, ${U(ID.client)}, 5, '{plat_chaud}', 'Très bon', 'Awa');
  insert into avis (id, order_id, cible, auteur, restaurant_id, livreur_id, auteur_utilisateur_id, note)
    values ('${AVIS_LIVREUR}', '${CMD_A}', 'livreur', 'client', ${U(ID.resto_a)}, ${U(LIVREUR_1)}, ${U(ID.client)}, 4);
  insert into avis (id, order_id, cible, auteur, restaurant_id, auteur_utilisateur_id, note, etiquettes)
    values ('${AVIS_CLIENT_PAR_RESTO}', '${CMD_A}', 'client', 'restaurant', ${U(ID.resto_a)}, ${U(ID.user_a)}, 2, '{injoignable}');
  insert into avis (id, order_id, cible, auteur, restaurant_id, livreur_id, auteur_utilisateur_id, note)
    values ('${AVIS_CLIENT_PAR_LIVREUR}', '${CMD_A}', 'client', 'livreur', ${U(ID.resto_a)}, ${U(LIVREUR_1)}, ${U(U_LIV)}, 3);
`);
const nbA = (qui, filtre = "true") => nb(qui, "avis", filtre);
verifier("avis : illisibles pour un anonyme", VIDE(await nbA(null)));
verifier("avis : le client voit ses propres notes (restaurant, livreur), pas celles que des tiers ont mises sur lui", (await nbA(ID.client)) === 2 && VIDE(await nbA(ID.client, "cible = 'client'")));
verifier("avis : le restaurant A voit l'avis public qui le concerne et la note qu'il a écrite", (await nbA(ID.user_a)) === 2 && (await nbA(ID.user_a, "cible = 'restaurant'")) === 1);
verifier("avis : le restaurant A ne voit ni la note du livreur sur le client ni la note du client sur le livreur", VIDE(await nbA(ID.user_a, "cible = 'livreur'")));
verifier("avis : le restaurant B ne voit rien d'un autre restaurant", VIDE(await nbA(ID.user_b)));
verifier("avis : le livreur voit la note qui le concerne et celle qu'il a écrite", (await nbA(U_LIV)) === 2 && (await nbA(U_LIV, "cible = 'livreur'")) === 1);
verifier("avis : un autre livreur ne voit rien", VIDE(await nbA(U_LIV2)));
verifier("avis : l'exploitation voit tout", (await nbA(ID.admin)) === 4 && (await nbA(ID.support)) === 4);
verifier("signalements : illisibles hors exploitation", VIDE(await nb(ID.user_a, "avis_signalements")) && VIDE(await nb(ID.client, "avis_signalements")) && VIDE(await nb(null, "avis_signalements")));

await interdit("le client ne modifie pas sa note par l'API (le serveur applique la fenêtre de 24 h)", ID.client, `update avis set note = 1 where id = '${AVIS_RESTO}'`);
await interdit("le restaurant ne se répond pas par l'API", ID.user_a, `update avis set reponse_texte = 'Merci' where id = '${AVIS_RESTO}'`);
await interdit("personne ne crée d'avis par l'API", ID.client, `insert into avis (order_id, cible, auteur, restaurant_id, note) values ('${CMD_B}', 'restaurant', 'client', ${U(ID.resto_b)}, 5)`);
await interdit("le restaurant ne supprime pas un avis par l'API", ID.user_a, `delete from avis where id = '${AVIS_RESTO}'`);
verifier("base : un restaurant ne peut pas noter un restaurant", await (async () => { try { await db.exec(`insert into avis (order_id, cible, auteur, restaurant_id, note) values ('${CMD_B}', 'restaurant', 'restaurant', ${U(ID.resto_b)}, 5)`); return false; } catch { return true; } })());
verifier("base : un commentaire libre sur un client est refusé", await (async () => { try { await db.exec(`insert into avis (order_id, cible, auteur, restaurant_id, note, commentaire) values ('${CMD_B}', 'client', 'restaurant', ${U(ID.resto_b)}, 2, 'Il ment')`); return false; } catch { return true; } })());
verifier("base : une note hors 1 à 5 est refusée", await (async () => { try { await db.exec(`insert into avis (order_id, cible, auteur, restaurant_id, note) values ('${CMD_B}', 'restaurant', 'client', ${U(ID.resto_b)}, 6)`); return false; } catch { return true; } })());
verifier("base : une seule note par commande, cible et auteur", await (async () => { try { await db.exec(`insert into avis (order_id, cible, auteur, restaurant_id, note) values ('${CMD_A}', 'restaurant', 'client', ${U(ID.resto_a)}, 3)`); return false; } catch { return true; } })());

// agrégats du restaurant, recalculés par la base
const agregat = async () => (await db.query(`select avis_somme, avis_total from restaurants where id = ${U(ID.resto_a)}`)).rows[0];
verifier("agrégat : l'avis public compte (somme 5, total 1) ; les notes du livreur et du client ne comptent pas", JSON.stringify(await agregat()) === JSON.stringify({ avis_somme: 5, avis_total: 1 }));
await db.exec(`update avis set statut = 'commentaire_masque' where id = '${AVIS_RESTO}'`);
verifier("agrégat : masquer un commentaire garde la note", (await agregat()).avis_total === 1);
await db.exec(`update avis set statut = 'annule' where id = '${AVIS_RESTO}'`);
verifier("agrégat : une note annulée sort du calcul", (await agregat()).avis_total === 0);
await db.exec(`update avis set statut = 'publie', est_test = true where id = '${AVIS_RESTO}'`);
verifier("agrégat : un avis de commande de test ne compte pas", (await agregat()).avis_total === 0);
await db.exec(`update avis set est_test = false where id = '${AVIS_RESTO}'`);
verifier("agrégat : retour à la normale", JSON.stringify(await agregat()) === JSON.stringify({ avis_somme: 5, avis_total: 1 }));
await interdit("un restaurateur ne fixe pas ses propres notes", ID.user_a, `update restaurants set avis_somme = 500, avis_total = 100 where id = ${U(ID.resto_a)}`);
verifier("les agrégats n'ont pas bougé", JSON.stringify(await agregat()) === JSON.stringify({ avis_somme: 5, avis_total: 1 }));

// fréquentation : réservée au serveur
for (const [nom, qui] of [["un restaurateur", ID.user_a], ["l'administrateur", ID.admin], ["un anonyme", null]]) {
  const r = await lire(qui, "select * from fn_frequentation_restaurants(30)");
  verifier(`fn_frequentation_restaurants : non exécutable par ${nom}`, !!r.erreur);
}

// réglages du classement
const nbReglagesClassement = (qui) => nb(qui, "parametres_classement");
verifier("réglages du classement : lisibles par le super administrateur seulement", (await nbReglagesClassement(ID.admin)) === 1 && VIDE(await nbReglagesClassement(ID.user_a)) && VIDE(await nbReglagesClassement(ID.support)) && VIDE(await nbReglagesClassement(null)));
await autorise("le super administrateur règle les poids (somme 100)", ID.admin, `update parametres_classement set poids_note = 40, poids_prix = 30, poids_frequentation = 30 where id = true`);
await interdit("des poids dont la somme n'est pas 100 sont refusés", ID.admin, `update parametres_classement set poids_note = 80 where id = true`);
await interdit("un restaurateur ne règle pas le classement", ID.user_a, `update parametres_classement set poids_note = 0, poids_prix = 0, poids_frequentation = 100 where id = true`);

// ---------------------------------------------------------------- 7. gardes structurelles : une régression future est signalée ici
console.log("\n--- Gardes structurelles");
const sansRls = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows;
verifier("toutes les tables du schéma public ont la RLS activée", sansRls.length === 0, sansRls.map((r) => r.relname).join(", "));

// ---------------------------------------------------------------- aide au choix : gamme, demandes, réglages
console.log("\n--- Aide au choix");
await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false)");
await interdit("un restaurateur ne fixe pas lui-même la gamme validée de son restaurant", ID.user_a, `update restaurants set gamme_validee = 'premium' where id = ${U(ID.resto_a)}`);
await autorise("l'administrateur système fixe la gamme validée", ID.admin, `update restaurants set gamme_validee = 'haut_de_gamme' where id = ${U(ID.resto_a)}`);
verifier("la gamme validée est enregistrée", (await db.query(`select gamme_validee from restaurants where id = ${U(ID.resto_a)}`)).rows[0].gamme_validee === "haut_de_gamme");
await interdit("une gamme inconnue est refusée par la base", ID.admin, `update restaurants set gamme_validee = 'luxe' where id = ${U(ID.resto_a)}`);

await db.exec(`insert into gamme_demandes (restaurant_id, gamme_demandee, motif, demande_par) values (${U(ID.resto_a)}, 'premium', 'Cadre et service haut de gamme malgré des plats abordables', ${U(ID.user_a)})`);
verifier("demandes de gamme : le restaurant A voit la sienne", (await nb(ID.user_a, "gamme_demandes")) === 1);
verifier("demandes de gamme : le restaurant B ne voit rien", VIDE(await nb(ID.user_b, "gamme_demandes")));
verifier("demandes de gamme : un client et un anonyme ne voient rien", VIDE(await nb(ID.client, "gamme_demandes")) && VIDE(await nb(null, "gamme_demandes")));
verifier("demandes de gamme : l'exploitation voit tout", (await nb(ID.admin, "gamme_demandes")) === 1 && (await nb(ID.support, "gamme_demandes")) === 1);
await interdit("un restaurateur n'écrit pas de demande par l'API (le serveur vérifie)", ID.user_a, `insert into gamme_demandes (restaurant_id, gamme_demandee, motif) values (${U(ID.resto_a)}, 'economique', 'Un motif assez long pour passer')`);
await interdit("un restaurateur n'accepte pas sa propre demande", ID.user_a, `update gamme_demandes set statut = 'acceptee' where restaurant_id = ${U(ID.resto_a)}`);
verifier("base : une seule demande en attente par restaurant", await (async () => { try { await db.exec(`insert into gamme_demandes (restaurant_id, gamme_demandee, motif) values (${U(ID.resto_a)}, 'economique', 'Une deuxième demande en attente')`); return false; } catch { return true; } })());
verifier("base : un motif trop court est refusé", await (async () => { try { await db.exec(`insert into gamme_demandes (restaurant_id, gamme_demandee, motif, statut) values (${U(ID.resto_b)}, 'economique', 'court', 'refusee')`); return false; } catch { return true; } })());

const nbAide = (qui) => nb(qui, "parametres_aide_choix");
verifier("réglages de l'aide au choix : lisibles par le super administrateur seulement", (await nbAide(ID.admin)) === 1 && VIDE(await nbAide(ID.user_a)) && VIDE(await nbAide(ID.support)) && VIDE(await nbAide(null)));
await autorise("le super administrateur règle les seuils", ID.admin, `update parametres_aide_choix set seuil_economique_gnf = 20000, seuil_intermediaire_gnf = 45000, seuil_haut_de_gamme_gnf = 90000 where id = true`);
await interdit("des seuils non croissants sont refusés", ID.admin, `update parametres_aide_choix set seuil_economique_gnf = 95000 where id = true`);
await interdit("un restaurateur ne règle pas l'aide au choix", ID.user_a, `update parametres_aide_choix set nb_propositions = 10 where id = true`);

// ---------------------------------------------------------------- commande sur place : sessions de table, numéro d'appel
console.log("\n--- Commande sur place");
await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false)");
const SESS_A = "00000000-0000-4000-8000-0000000003a1";
await db.exec(`insert into table_sessions (id, restaurant_id, table_numero) values ('${SESS_A}', ${U(ID.resto_a)}, 'A1')`);
verifier("sessions de table : le restaurant A voit la sienne", (await nb(ID.user_a, "table_sessions")) === 1);
verifier("sessions de table : le restaurant B ne voit rien", VIDE(await nb(ID.user_b, "table_sessions")));
verifier("sessions de table : un client et un anonyme ne voient rien", VIDE(await nb(ID.client, "table_sessions")) && VIDE(await nb(null, "table_sessions")));
verifier("sessions de table : l'exploitation voit tout", (await nb(ID.admin, "table_sessions")) === 1 && (await nb(ID.support, "table_sessions")) === 1);
await interdit("un restaurateur ne crée pas de session par l'API (le serveur vérifie)", ID.user_a, `insert into table_sessions (restaurant_id, table_numero) values (${U(ID.resto_a)}, 'Z9')`);
await interdit("un restaurateur ne modifie pas une session par l'API", ID.user_a, `update table_sessions set statut = 'payee', cloturee_le = now() where id = '${SESS_A}'`);
verifier("base : une seule session ouverte par table, casse ignorée", await (async () => { try { await db.exec(`insert into table_sessions (restaurant_id, table_numero) values (${U(ID.resto_a)}, 'a1')`); return false; } catch { return true; } })());
verifier("base : deux restaurants peuvent avoir la même table", await (async () => { try { await db.exec(`insert into table_sessions (restaurant_id, table_numero) values (${U(ID.resto_b)}, 'A1')`); return true; } catch { return false; } })());
verifier("base : une session ouverte ne peut pas être « clôturée » sans date", await (async () => { try { await db.exec(`update table_sessions set statut = 'payee' where id = '${SESS_A}'`); return false; } catch { return true; } })());
await db.exec(`update table_sessions set statut = 'payee', cloturee_le = now(), paiement_mode = 'especes' where id = '${SESS_A}'`);
verifier("base : après clôture, la table peut s'ouvrir de nouveau", await (async () => { try { await db.exec(`insert into table_sessions (restaurant_id, table_numero) values (${U(ID.resto_a)}, 'A1')`); return true; } catch { return false; } })());
verifier("base : un mode de règlement inconnu est refusé", await (async () => { try { await db.exec(`update table_sessions set paiement_mode = 'carte' where id = '${SESS_A}'`); return false; } catch { return true; } })());

await interdit("un restaurateur ne change pas le numéro d'appel d'une commande", ID.user_a, `update orders set numero_appel = 7 where id = '${CMD_A}'`);
await interdit("un restaurateur ne rattache pas une commande à une session", ID.user_a, `update orders set session_id = '${SESS_A}' where id = '${CMD_A}'`);
await interdit("un restaurateur ne change pas le numéro de table d'une commande", ID.user_a, `update orders set table_numero = '99' where id = '${CMD_A}'`);
await db.exec(`update orders set numero_appel = 5 where id = '${CMD_A}'`);
verifier("base : le numéro d'appel est unique par restaurant et par jour", await (async () => { try { await db.exec(`insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut, numero_appel) values ('SF-DOUBL', 'jeton-doubl', ${U(ID.resto_a)}, 'X', '620000009', 'sur_place', 1000, 'en_attente', 5)`); return false; } catch { return true; } })());

await interdit("un restaurateur ne s'attribue pas la saisie d'une commande", ID.user_a, `update orders set saisie_par = '${ID.user_a}' where id = '${CMD_A}'`);
await db.exec(`update orders set saisie_par = '${ID.user_a}' where id = '${CMD_A}'`);
verifier("base : saisie_par désigne le compte du membre qui a saisi", (await db.query(`select saisie_par from orders where id = '${CMD_A}'`)).rows[0].saisie_par === ID.user_a);
// Parcours d'une commande servie : « acceptée » ne passe PAS directement à « terminée » (défaut trouvé à la clôture d'une table, 18 octobre 2026).
await db.exec(`insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, table_numero, sous_total, statut) values ('SF-TRANS', 'jeton-trans', ${U(ID.resto_a)}, 'T', '', 'sur_place', '9', 1000, 'acceptee')`);
verifier("base : « acceptée » ne passe pas directement à « terminée »", await (async () => { try { await db.exec(`update orders set statut = 'terminee' where reference = 'SF-TRANS'`); return false; } catch { return true; } })());
verifier("base : « acceptée » puis « prête » puis « terminée » passe", await (async () => { try { await db.exec(`update orders set statut = 'prete' where reference = 'SF-TRANS'`); await db.exec(`update orders set statut = 'terminee' where reference = 'SF-TRANS'`); return true; } catch { return false; } })());
await autorise("un restaurateur règle son service sur place", ID.user_a, `update restaurants set service_table = 'comptoir', table_sans_compte = true, table_validation = 'toutes' where id = ${U(ID.resto_a)}`);
await interdit("un restaurateur ne règle pas le service d'un autre restaurant", ID.user_b, `update restaurants set table_sans_compte = true where id = ${U(ID.resto_a)}`);
await interdit("une valeur de service inconnue est refusée par la base", ID.user_a, `update restaurants set service_table = 'terrasse' where id = ${U(ID.resto_a)}`);
await interdit("une validation inconnue est refusée par la base", ID.user_a, `update restaurants set table_validation = 'parfois' where id = ${U(ID.resto_a)}`);

const ouvertes = (await db.query(`
  select tablename, policyname, cmd from pg_policies
  where schemaname = 'public' and (qual is null or qual = 'true') and (with_check is null or with_check = 'true')
  order by 1, 2`)).rows;
const lecturePubliqueAttendue = new Set(["menu_categories", "neighborhoods"]);
const inattendues = ouvertes.filter((p) => !(p.cmd === "SELECT" && lecturePubliqueAttendue.has(p.tablename)));
verifier("aucune policy ouverte à tous, sauf la taxonomie publique (catégories, quartiers)", inattendues.length === 0, inattendues.map((p) => `${p.tablename}.${p.policyname} (${p.cmd})`).join(", "));

const definerAnon = (await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')`)).rows;
verifier("aucune fonction privilégiée n'est exécutable par un visiteur anonyme", definerAnon.length === 0, definerAnon.map((r) => r.proname).join(", "));

// Liste de référence : toute NOUVELLE fonction privilégiée ouverte aux comptes connectés doit être ajoutée ici
// en connaissance de cause (et testée dans la section précédente), sinon ce contrôle échoue.
const definerConnu = new Set([
  "fn_admin_definir_illustration", "fn_admin_dossier_restaurant", "fn_admin_lister_plats", "fn_creer_restaurant_et_owner",
  "fn_emettre_document", "fn_est_admin_systeme", "fn_est_membre_restaurant", "fn_fusionner_quartiers", "fn_lister_audit",
  "fn_lister_membres_restaurant", "fn_preparer_suppression_compte", "fn_questions_etat", "fn_est_ce_mon_livreur", "fn_mon_restaurant_a_ce_livreur",
  "fn_statistiques_application", "fn_support_changer_statut", "fn_support_commandes_par_heure", "fn_support_compter_commandes",
  "fn_support_lister_commandes", "fn_support_reveler_coordonnees", "fn_support_serie_commandes", "fn_trouver_utilisateur_par_email",
  "fn_quarts_prendre", "fn_quarts_liberer",
]);
const definerAuth = (await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')`)).rows.map((r) => r.proname);
const nouvelles = definerAuth.filter((n) => !definerConnu.has(n));
verifier("aucune nouvelle fonction privilégiée n'est apparue sans être déclarée et testée ici", nouvelles.length === 0, nouvelles.join(", "));

// ---------------------------------------------------------------- 7. revue du 19 octobre 2026 : jeton de suivi, réinitialisation, avis
console.log("\n--- Jeton de suivi, réinitialisation, avis (revue du 19 octobre 2026)");
const colOrders = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='orders'`)).rows.map((r) => r.column_name);
const jetonLisible = (await db.query(`select has_column_privilege('authenticated','public.orders','jeton_suivi','select') a, has_column_privilege('anon','public.orders','jeton_suivi','select') b`)).rows[0];
verifier("jeton_suivi n'est lisible ni par un compte connecté ni par un visiteur", !jetonLisible.a && !jetonLisible.b);
const colsSansDroit = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='orders' and column_name <> 'jeton_suivi' and not has_column_privilege('authenticated','public.orders',column_name,'select')`)).rows.map((r) => r.column_name);
verifier("toute autre colonne de orders reste lisible par la console (une nouvelle colonne ne casse pas les lectures)", colsSansDroit.length === 0, colsSansDroit.join(", "));
verifier("orders a bien une colonne jeton_recu distincte du jeton de suivi", colOrders.includes("jeton_recu") && colOrders.includes("jeton_suivi"));
const lectJeton = await lire(ID.user_a, `select jeton_suivi from orders where id = '${CMD_A}'`);
verifier("un restaurateur ne peut pas lire le jeton de suivi de SA commande", lectJeton.erreur !== null, lectJeton.erreur ?? "lu");
const lectTout = await lire(ID.user_a, `select * from orders where id = '${CMD_A}'`);
verifier("select * sur orders par un restaurateur est refusé (le code liste ses colonnes)", lectTout.erreur !== null, lectTout.erreur ?? "lu");
const lectRecu = await lire(ID.user_a, `select id, reference, jeton_recu from orders where id = '${CMD_A}'`);
verifier("contrôle positif : un restaurateur lit le jeton de reçu de sa commande", !lectRecu.erreur && lectRecu.lignes.length === 1 && String(lectRecu.lignes[0].jeton_recu).length === 64, lectRecu.erreur ?? "");
const lectRecuB = await lire(ID.user_a, `select jeton_recu from orders where id = '${CMD_B}'`);
verifier("un restaurateur ne lit pas le jeton de reçu de la commande d'un AUTRE restaurant", !lectRecuB.erreur && lectRecuB.lignes.length === 0, lectRecuB.erreur ?? `${lectRecuB.lignes.length} ligne(s)`);
const lectAnon = await lire(null, `select id from orders`);
verifier("un visiteur anonyme ne lit aucune commande", lectAnon.erreur !== null || lectAnon.lignes.length === 0);
const jetonsRecu = (await db.query(`select count(*)::int n, count(distinct jeton_recu)::int d from orders`)).rows[0];
verifier("les jetons de reçu sont tous distincts", jetonsRecu.n === jetonsRecu.d);
const reinit = (await db.query(`select has_function_privilege('authenticated','public.fn_reinitialiser_application(uuid,text)','execute') a, has_function_privilege('authenticated','public.fn_reinitialisation_simuler()','execute') b`)).rows[0];
verifier("la réinitialisation de l'application n'est plus exécutable par un compte connecté", !reinit.a && !reinit.b);
const avisCol = await lire(ID.user_a, `select auteur_utilisateur_id from avis`);
verifier("un restaurateur ne lit pas l'auteur d'un avis", avisCol.erreur !== null, avisCol.erreur ?? "lu");
const avisOrder = await lire(ID.user_a, `select order_id from avis`);
verifier("un restaurateur ne lit pas la commande d'un avis", avisOrder.erreur !== null, avisOrder.erreur ?? "lu");
await refuse("un restaurateur ne peut pas remplacer le jeton de reçu de sa commande", ID.user_a, `update orders set jeton_recu = 'a' where id = '${CMD_A}'`);
const recuIntact = (await db.query(`select length(jeton_recu)::int n from orders where id = '${CMD_A}'`)).rows[0].n;
verifier("le jeton de reçu est resté intact après la tentative", recuIntact === 64, `longueur ${recuIntact}`);
await refuse("un restaurateur ne peut toujours pas remplacer le jeton de suivi", ID.user_a, `update orders set jeton_suivi = 'x' where id = '${CMD_A}'`);
const avisOk = await lire(ID.user_a, `select note, cible, statut, commentaire from avis`);
verifier("contrôle positif : un restaurateur lit toujours la note et le commentaire des avis qui le concernent", !avisOk.erreur, avisOk.erreur ?? "");

// ---------------------------------------------------------------- 8. paiement en ligne (lot P2)
console.log("\n--- Paiement en ligne");
const PAY_A = "00000000-0000-4000-8000-0000000002a1";
const PAY_B = "00000000-0000-4000-8000-0000000002b1";
const CMD_C = "00000000-0000-4000-8000-00000000a0c1";
const CMD_D = "00000000-0000-4000-8000-00000000a0d1";
const CMD_E = "00000000-0000-4000-8000-00000000a0e1";
const CMD_F = "00000000-0000-4000-8000-00000000a0f1";
const G_A = "00000000-0000-4000-8000-0000000003a1";
const LITIGE_A = "00000000-0000-4000-8000-0000000004a1";
await db.exec(`
  insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, client_adresse, mode, sous_total, statut) values
    ('${CMD_C}', 'SF-CCCCC', 'jeton-c', ${U(ID.resto_a)}, 'Client C', '620000003', 'Adresse C', 'retrait', 25000, 'acceptee'),
    ('${CMD_D}', 'SF-DDDDD', 'jeton-d', ${U(ID.resto_a)}, 'Client D', '620000004', 'Adresse D', 'retrait', 25000, 'acceptee'),
    ('${CMD_E}', 'SF-EEEEE', 'jeton-e', ${U(ID.resto_a)}, 'Client E', '620000005', 'Adresse E', 'retrait', 25000, 'acceptee'),
    ('${CMD_F}', 'SF-FFFFF', 'jeton-f', ${U(ID.resto_a)}, 'Client F', '620000006', 'Adresse F', 'retrait', 25000, 'acceptee');
  insert into paiements (id, order_id, restaurant_id, fournisseur, operateur, repas_gnf, frais_livraison_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne) values
    (${U(PAY_A)}, '${CMD_A}', ${U(ID.resto_a)}, 'simulation', 'orange_money', 25000, 5000, 'livreur_independant', 1000, 450, 24000, 5000, 1000, 'SF-PAY-AAAAAA'),
    (${U(PAY_B)}, '${CMD_B}', ${U(ID.resto_b)}, 'simulation', 'mtn_momo', 25000, 0, 'aucune', 1000, 425, 24000, 0, 1000, 'SF-PAY-BBBBBB');
  insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values
    (${U(PAY_A)}, ${U(G_A)}, 'encaissement', 'fonds_operateur', 'debit', 30000),
    (${U(PAY_A)}, ${U(G_A)}, 'encaissement', 'fonds_a_liberer', 'credit', 30000);
  insert into comptes_versement (proprietaire_type, restaurant_id, operateur, numero, titulaire_nom, verifie_le) values
    ('restaurant', ${U(ID.resto_a)}, 'orange_money', '+224620000001', 'Resto A', now());
  insert into comptes_versement (proprietaire_type, livreur_id, operateur, numero, titulaire_nom, verifie_le) values
    ('livreur', ${U(LIVREUR_1)}, 'mtn_momo', '+224660000001', 'Livreur Un', now());
  insert into paiement_versements (paiement_id, beneficiaire_type, restaurant_id, operateur, numero_masque, montant_gnf, reference_interne) values
    (${U(PAY_A)}, 'restaurant', ${U(ID.resto_a)}, 'orange_money', '+224 6** *** *01', 24000, 'SF-VER-RESTAA'),
    (${U(PAY_B)}, 'restaurant', ${U(ID.resto_b)}, 'mtn_momo', '+224 6** *** *02', 24000, 'SF-VER-RESTAB');
  insert into paiement_versements (paiement_id, beneficiaire_type, livreur_id, operateur, numero_masque, montant_gnf, reference_interne) values
    (${U(PAY_A)}, 'livreur', ${U(LIVREUR_1)}, 'mtn_momo', '+224 6** *** *01', 5000, 'SF-VER-LIVRA1');
  insert into litiges_paiement (id, paiement_id, ouvert_par, situation) values (${U(LITIGE_A)}, ${U(PAY_A)}, 'client', 'client_injoignable');
`);

// Lectures : chacun ne voit que ce qui le concerne.
verifier("paiements : le restaurant A voit le sien, pas celui de B", (await nb(ID.user_a, "paiements")) === 1 && VIDE(await nb(ID.user_a, "paiements", `restaurant_id = ${U(ID.resto_b)}`)));
verifier("paiements : le restaurant B voit le sien, pas celui de A", (await nb(ID.user_b, "paiements")) === 1 && VIDE(await nb(ID.user_b, "paiements", `restaurant_id = ${U(ID.resto_a)}`)));
verifier("paiements : l'exploitation voit tout", (await nb(ID.admin, "paiements")) === 2 && (await nb(ID.support, "paiements")) === 2);
verifier("paiements : un client, un livreur et un anonyme ne voient rien", VIDE(await nb(ID.client, "paiements")) && VIDE(await nb(U_LIV, "paiements")) && VIDE(await nb(null, "paiements")));
verifier("versements : le restaurant A ne voit que le sien", (await nb(ID.user_a, "paiement_versements")) === 1 && VIDE(await nb(ID.user_a, "paiement_versements", `restaurant_id = ${U(ID.resto_b)}`)));
verifier("versements : le livreur 1 voit seulement son versement", (await nb(U_LIV, "paiement_versements")) === 1 && (await nb(U_LIV, "paiement_versements", "beneficiaire_type = 'livreur'")) === 1);
verifier("versements : le livreur 2 (sans versement) n'en voit aucun", VIDE(await nb(U_LIV2, "paiement_versements")));
verifier("versements : l'exploitation voit tout, un client et un anonyme rien", (await nb(ID.admin, "paiement_versements")) === 3 && (await nb(ID.support, "paiement_versements")) === 3 && VIDE(await nb(ID.client, "paiement_versements")) && VIDE(await nb(null, "paiement_versements")));
verifier("litiges : le restaurant A voit le sien, B rien", (await nb(ID.user_a, "litiges_paiement")) === 1 && VIDE(await nb(ID.user_b, "litiges_paiement")));
verifier("litiges : un client et un anonyme ne voient rien", VIDE(await nb(ID.client, "litiges_paiement")) && VIDE(await nb(null, "litiges_paiement")));
for (const table of ["paiement_ecritures", "paiement_evenements", "comptes_versement", "parametres_paiement"]) {
  verifier(`${table} : le super administrateur la lit`, (await nb(ID.admin, table)) >= 1 || table === "paiement_evenements");
  for (const [nom, qui] of [["restaurant", ID.user_a], ["support", ID.support], ["livreur", U_LIV], ["client", ID.client], ["anonyme", null]]) {
    verifier(`${table} : illisible pour ${nom}`, VIDE(await nb(qui, table)));
  }
}
const colonnes = await lire(ID.admin, "select numero from comptes_versement");
verifier("comptes de versement : seul le super administrateur lit les numéros", colonnes.lignes.length === 2);

// Écritures par l'API : refusées à tous, administrateur compris (tout passe par le serveur).
await interdit("A ne modifie pas l'état de son paiement", ID.user_a, `update paiements set etat = 'libere' where id = ${U(PAY_A)}`);
await interdit("A ne crée pas de paiement", ID.user_a, `insert into paiements (order_id, restaurant_id, fournisseur, operateur, repas_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne) values ('${CMD_C}', ${U(ID.resto_a)}, 'simulation', 'orange_money', 100, 'aucune', 0, 0, 100, 0, 0, 'SF-PAY-XXXXXX')`);
await interdit("A ne supprime pas son paiement", ID.user_a, `delete from paiements where id = ${U(PAY_A)}`);
await interdit("A ne marque pas un versement comme confirmé", ID.user_a, `update paiement_versements set etat = 'confirme' where restaurant_id = ${U(ID.resto_a)}`);
await interdit("le livreur ne marque pas son versement comme confirmé", U_LIV, `update paiement_versements set etat = 'confirme' where livreur_id = ${U(LIVREUR_1)}`);
await interdit("le super administrateur n'écrit pas non plus par l'API (écritures serveur seulement)", ID.admin, `update paiements set etat = 'libere' where id = ${U(PAY_A)}`);
await interdit("personne n'écrit dans le livre de comptes par l'API", ID.admin, `insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_A)}, gen_random_uuid(), 'x-x-x', 'fonds_operateur', 'debit', 1)`);
await interdit("personne ne change les réglages de paiement par l'API", ID.admin, `update parametres_paiement set paiement_en_ligne_actif = true`);
await interdit("un anonyme n'écrit rien", null, `update paiements set etat = 'libere'`);

// Règles de la base, jouées côté serveur (contexte sans identité, comme la clé de service).
async function serveur(nom, sql, doitEchouer) {
  let erreur = null;
  try {
    await db.exec(sql);
  } catch (e) {
    erreur = e.message;
    await db.exec("rollback").catch(() => {});
  }
  verifier(nom, doitEchouer ? erreur !== null : erreur === null, erreur ?? "aucune erreur");
}
const nouveauPaiement = (id, order, extra = "") =>
  `insert into paiements (id, order_id, restaurant_id, fournisseur, operateur, repas_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne ${extra ? ", " + extra.split("|")[0] : ""}) values (${U(id)}, '${order}', ${U(ID.resto_a)}, 'simulation', 'orange_money', 25000, 'aucune', 1000, 375, 24000, 0, 1000, 'SF-${id.slice(-8)}' ${extra ? ", " + extra.split("|")[1] : ""})`;
const PAY_C = "00000000-0000-4000-8000-0000000002c1";
const PAY_D = "00000000-0000-4000-8000-0000000002d1";
const PAY_E = "00000000-0000-4000-8000-0000000002e1";
const PAY_F = "00000000-0000-4000-8000-0000000002f1";

const reglages = (await db.query("select paiement_en_ligne_actif, fournisseur from parametres_paiement")).rows[0];
verifier("réglages : le paiement en ligne est ÉTEINT par défaut, fournisseur de simulation", reglages.paiement_en_ligne_actif === false && reglages.fournisseur === "simulation");
await serveur("réglages : un seul enregistrement possible", `insert into parametres_paiement (id) values (false)`, true);

await serveur("paiement : une répartition dont la somme n'égale pas le total est refusée", `insert into paiements (order_id, restaurant_id, fournisseur, operateur, repas_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne) values ('${CMD_C}', ${U(ID.resto_a)}, 'simulation', 'orange_money', 25000, 'aucune', 1000, 375, 24001, 0, 1000, 'SF-PAY-SOMME1')`, true);
await serveur("paiement : un montant négatif est refusé", `insert into paiements (order_id, restaurant_id, fournisseur, operateur, repas_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne) values ('${CMD_C}', ${U(ID.resto_a)}, 'simulation', 'orange_money', -5, 'aucune', 0, 0, -5, 0, 0, 'SF-PAY-NEGAT1')`, true);
await serveur("paiement : on ne naît qu'à l'état « cree »", nouveauPaiement(PAY_C, CMD_C, "etat|'confirme'"), true);
await serveur("paiement : création valide acceptée", nouveauPaiement(PAY_C, CMD_C), false);
await serveur("paiement : une commande n'a qu'UN paiement en ligne", nouveauPaiement(PAY_D, CMD_C), true);
await serveur("paiement : les montants ne se modifient pas", `update paiements set repas_gnf = 1000, restaurant_gnf = -23000 where id = ${U(PAY_C)}`, true);
await serveur("paiement : la répartition ne se modifie pas", `update paiements set restaurant_gnf = 23000, speedfood_brut_gnf = 2000 where id = ${U(PAY_C)}`, true);
await serveur("paiement : la référence interne ne se modifie pas", `update paiements set reference_interne = 'SF-AUTRE-XXXX' where id = ${U(PAY_C)}`, true);
await serveur("paiement : transition interdite cree → libere", `update paiements set etat = 'libere' where id = ${U(PAY_C)}`, true);
await serveur("paiement : transition interdite cree → confirme", `update paiements set etat = 'confirme' where id = ${U(PAY_C)}`, true);
await serveur("paiement : cree → en_attente → confirme → libere acceptés dans l'ordre", `update paiements set etat = 'en_attente' where id = ${U(PAY_C)}; update paiements set etat = 'confirme', reference_externe = 'EXT-C' where id = ${U(PAY_C)}; update paiements set etat = 'libere' where id = ${U(PAY_C)}`, false);
await serveur("paiement : libere → en_attente refusé (pas de retour en arrière)", `update paiements set etat = 'en_attente' where id = ${U(PAY_C)}`, true);
await serveur("paiement : la référence du prestataire, une fois posée, ne change pas", `update paiements set reference_externe = 'EXT-AUTRE' where id = ${U(PAY_C)}`, true);
await serveur("paiement : un remboursement ne diminue pas", `update paiements set rembourse_gnf = 5000 where id = ${U(PAY_C)}; update paiements set rembourse_gnf = 1000 where id = ${U(PAY_C)}`, true);
await serveur("paiement : un remboursement ne dépasse pas le total", `update paiements set rembourse_gnf = 25001 where id = ${U(PAY_C)}`, true);
await serveur("paiement : un succès tardif après expiration est possible (expire → confirme)", `${nouveauPaiement(PAY_D, CMD_D)}; update paiements set etat = 'en_attente' where id = ${U(PAY_D)}; update paiements set etat = 'expire' where id = ${U(PAY_D)}; update paiements set etat = 'confirme' where id = ${U(PAY_D)}`, false);

// Livre de comptes.
await serveur("livre : deux groupes distincts, chacun déséquilibré, sont refusés", `begin; insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_C)}, gen_random_uuid(), 'liberation', 'fonds_a_liberer', 'debit', 25000), (${U(PAY_C)}, gen_random_uuid(), 'liberation', 'a_verser_restaurant', 'credit', 25000); commit;`, true); // deux groupes différents : chacun déséquilibré
await serveur("livre : deux lignes d'un même groupe, équilibrées, sont acceptées", `begin; insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_C)}, '00000000-0000-4000-8000-0000000003c1', 'encaissement', 'fonds_operateur', 'debit', 25000), (${U(PAY_C)}, '00000000-0000-4000-8000-0000000003c1', 'encaissement', 'fonds_a_liberer', 'credit', 25000); commit;`, false);
await serveur("livre : un groupe déséquilibré fait échouer la validation", `begin; insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_C)}, '00000000-0000-4000-8000-0000000003c2', 'liberation', 'fonds_a_liberer', 'debit', 25000), (${U(PAY_C)}, '00000000-0000-4000-8000-0000000003c2', 'liberation', 'a_verser_restaurant', 'credit', 24999); commit;`, true);
await serveur("livre : le même événement ne s'écrit pas deux fois (idempotence)", `begin; insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_C)}, '00000000-0000-4000-8000-0000000003c3', 'encaissement', 'fonds_operateur', 'debit', 25000), (${U(PAY_C)}, '00000000-0000-4000-8000-0000000003c3', 'encaissement', 'fonds_a_liberer', 'credit', 25000); commit;`, true);
await serveur("livre : un montant nul est refusé", `insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_C)}, gen_random_uuid(), 'zero-zero', 'fonds_operateur', 'debit', 0)`, true);
await serveur("livre : un compte inconnu est refusé", `insert into paiement_ecritures (paiement_id, groupe_id, cle_idempotence, compte, sens, montant_gnf) values (${U(PAY_C)}, gen_random_uuid(), 'inconnu-x', 'caisse_noire', 'debit', 10)`, true);
await serveur("livre : en ajout seul, aucune modification", `update paiement_ecritures set montant_gnf = 1 where paiement_id = ${U(PAY_A)}`, true);
await serveur("livre : en ajout seul, aucune suppression directe", `delete from paiement_ecritures where paiement_id = ${U(PAY_A)}`, true);

// Versements, notifications.
await serveur("versement : un seul par bénéficiaire et par paiement", `insert into paiement_versements (paiement_id, beneficiaire_type, restaurant_id, operateur, numero_masque, montant_gnf, reference_interne) values (${U(PAY_A)}, 'restaurant', ${U(ID.resto_a)}, 'orange_money', '+224 6** *** *01', 1000, 'SF-VER-DOUBLE')`, true);
await serveur("versement : un bénéficiaire restaurant ne porte pas de livreur", `insert into paiement_versements (paiement_id, beneficiaire_type, restaurant_id, livreur_id, operateur, numero_masque, montant_gnf, reference_interne) values (${U(PAY_C)}, 'restaurant', ${U(ID.resto_a)}, ${U(LIVREUR_1)}, 'orange_money', '+224 6** *** *01', 1000, 'SF-VER-MIXTE1')`, true);
await serveur("versement : un montant nul est refusé", `insert into paiement_versements (paiement_id, beneficiaire_type, restaurant_id, operateur, numero_masque, montant_gnf, reference_interne) values (${U(PAY_C)}, 'restaurant', ${U(ID.resto_a)}, 'orange_money', '+224 6** *** *01', 0, 'SF-VER-ZERO01')`, true);
await serveur("notification : première réception acceptée", `insert into paiement_evenements (fournisseur, identifiant_evenement, reference_externe, etat_recu, montant_gnf, resultat) values ('simulation', 'evt-1', 'EXT-C', 'succes', 25000, 'applique')`, false);
await serveur("notification : un rejeu du même identifiant est refusé (idempotence)", `insert into paiement_evenements (fournisseur, identifiant_evenement, reference_externe, etat_recu, montant_gnf, resultat) values ('simulation', 'evt-1', 'EXT-C', 'succes', 25000, 'applique')`, true);
await serveur("notification : le même identifiant chez un autre fournisseur est un autre événement", `insert into paiement_evenements (fournisseur, identifiant_evenement, reference_externe, etat_recu, montant_gnf, resultat) values ('chapchap', 'evt-1', 'EXT-X', 'succes', 25000, 'applique')`, false);

// Comptes de versement.
await serveur("compte de versement : un numéro invalide est refusé", `insert into comptes_versement (proprietaire_type, restaurant_id, operateur, numero) values ('restaurant', ${U(ID.resto_b)}, 'orange_money', '12ab')`, true);
await serveur("compte de versement : un compte sans propriétaire cohérent est refusé", `insert into comptes_versement (proprietaire_type, restaurant_id, livreur_id, operateur, numero) values ('restaurant', ${U(ID.resto_b)}, ${U(LIVREUR_2)}, 'orange_money', '+224620000009')`, true);
await serveur("compte de versement : un seul compte actif par restaurant", `insert into comptes_versement (proprietaire_type, restaurant_id, operateur, numero) values ('restaurant', ${U(ID.resto_a)}, 'mtn_momo', '+224660000009')`, true);

// Commande : nouveau mode de paiement.
await serveur("commande : le mode de paiement « speedfood » est accepté", `update orders set paiement_mode = 'speedfood' where id = '${CMD_E}'`, false);
await serveur("commande : un mode inconnu reste refusé", `update orders set paiement_mode = 'bitcoin' where id = '${CMD_E}'`, true);

// Argent réel : jamais supprimé, même en cascade ; une simulation, oui (réinitialisation de démonstration).
await serveur("argent réel : un paiement reçu d'un prestataire réel est créé et confirmé", `
  insert into paiements (id, order_id, restaurant_id, fournisseur, operateur, repas_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne)
    values (${U(PAY_E)}, '${CMD_E}', ${U(ID.resto_a)}, 'chapchap', 'orange_money', 25000, 'aucune', 1000, 375, 24000, 0, 1000, 'SF-REEL-EEEEEE');
  update paiements set etat = 'en_attente' where id = ${U(PAY_E)};
  update paiements set etat = 'confirme', reference_externe = 'EXT-REEL' where id = ${U(PAY_E)}`, false);
await serveur("argent réel : on ne le supprime pas en supprimant la commande", `delete from orders where id = '${CMD_E}'`, true);
const toujoursLa = (await db.query(`select count(*)::int n from paiements where id = ${U(PAY_E)}`)).rows[0].n;
verifier("argent réel : le paiement est toujours là après la tentative", toujoursLa === 1, `lignes : ${toujoursLa}`);
await serveur("argent réel : directement non plus", `delete from paiements where id = ${U(PAY_E)}`, true);
await serveur("simulation : une simulation confirmée disparaît avec sa commande, livre compris (démonstration)", `delete from orders where id = '${CMD_C}'`, false);
const restes = (await db.query(`select (select count(*)::int from paiements where id = ${U(PAY_C)}) p, (select count(*)::int from paiement_ecritures where paiement_id = ${U(PAY_C)}) e`)).rows[0];
verifier("simulation : paiement et écritures supprimés en cascade", restes.p === 0 && restes.e === 0, JSON.stringify(restes));
await serveur("argent non reçu : un paiement réel resté « en attente » peut être supprimé avec sa commande", `
  insert into paiements (id, order_id, restaurant_id, fournisseur, operateur, repas_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne)
    values (${U(PAY_F)}, '${CMD_F}', ${U(ID.resto_a)}, 'chapchap', 'mtn_momo', 25000, 'aucune', 1000, 425, 24000, 0, 1000, 'SF-REEL-FFFFFF');
  update paiements set etat = 'en_attente' where id = ${U(PAY_F)};
  delete from orders where id = '${CMD_F}'`, false);

// ---------------------------------------------------------------- 9. paiement en ligne : pas de confirmation manuelle (durcissement du 21 octobre 2026)
console.log("\n--- Paiement en ligne : confirmation manuelle interdite en base");
const CMD_G = "00000000-0000-4000-8000-00000000a0g1".replace("g", "9");
const CMD_H = "00000000-0000-4000-8000-00000000a0h1".replace("h", "8");
await db.exec(`
  insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, client_adresse, mode, sous_total, statut, paiement_mode, paiement_statut) values
    ('${CMD_G}', 'SF-GGGGG', 'jeton-g', ${U(ID.resto_a)}, 'Client G', '620000007', 'Adresse G', 'retrait', 25000, 'acceptee', 'speedfood', 'non_demande'),
    ('${CMD_H}', 'SF-HHHHH', 'jeton-h', ${U(ID.resto_a)}, 'Client H', '620000008', 'Adresse H', 'retrait', 25000, 'acceptee', null, 'non_demande');
`);
await interdit("restaurateur : ne marque pas « reçu » une commande payée en ligne", ID.user_a, `update orders set paiement_statut = 'recu' where id = '${CMD_G}'`);
await interdit("restaurateur : ne conteste pas non plus (« non reçu ») une commande payée en ligne", ID.user_a, `update orders set paiement_statut = 'non_recu' where id = '${CMD_G}'`);
await interdit("restaurateur : ne se fabrique pas un paiement en ligne en changeant le mode", ID.user_a, `update orders set paiement_mode = 'speedfood' where id = '${CMD_H}'`);
await autorise("contrôle positif : le restaurateur confirme toujours un paiement classique", ID.user_a, `update orders set paiement_statut = 'recu' where id = '${CMD_H}'`);
const enLigneIntact = (await db.query(`select paiement_statut from orders where id = '${CMD_G}'`)).rows[0].paiement_statut;
verifier("la commande payée en ligne n'a pas bougé après les tentatives", enLigneIntact === "non_demande", enLigneIntact);
await serveur("le serveur (sans identité) fait évoluer le statut d'un paiement en ligne", `update orders set paiement_statut = 'recu' where id = '${CMD_G}'`, false);
const recuLe = (await db.query(`select paiement_recu_le is not null as ok from orders where id = '${CMD_G}'`)).rows[0].ok;
verifier("la date de réception est posée par la base à la confirmation du serveur", recuLe === true);

// ---------------------------------------------------------------- 10. livreurs du restaurant (lot 1 du module livreurs, 21 octobre 2026)
console.log("\n--- Livreurs du restaurant");
const RLA1 = "00000000-0000-4000-8000-0000000000f3";
const RLB1 = "00000000-0000-4000-8000-0000000000f4";
const LIV_H = "00000000-0000-4000-8000-0000000001c1";
await db.exec(`
  insert into livreurs (id, nom, telephone, cycle, origine, restaurant_id) values
    (${U(RLA1)}, 'Livreur du resto A', '+224622700001', 'actif', 'restaurant', ${U(ID.resto_a)}),
    (${U(RLB1)}, 'Livreur du resto B', '+224622700002', 'actif', 'restaurant', ${U(ID.resto_b)});
  insert into livraisons (id, order_id, restaurant_id, mode, statut) values (${U(LIV_H)}, '${CMD_H}', ${U(ID.resto_a)}, 'propre', 'assignee');
`);
verifier("livreurs du restaurant : A voit le sien (en plus de celui qui a déjà livré pour lui), pas celui de B", (await nb(ID.user_a, "livreurs", `id = ${U(RLA1)}`)) === 1 && VIDE(await nb(ID.user_a, "livreurs", `id = ${U(RLB1)}`)));
verifier("livreurs du restaurant : B voit le sien, pas celui de A", (await nb(ID.user_b, "livreurs", `id = ${U(RLB1)}`)) === 1 && VIDE(await nb(ID.user_b, "livreurs", `id = ${U(RLA1)}`)));
verifier("livreurs du restaurant : un client, un anonyme et un livreur du groupe ne les voient pas", VIDE(await nb(ID.client, "livreurs", `restaurant_id is not null`)) && VIDE(await nb(null, "livreurs", `restaurant_id is not null`)) && VIDE(await nb(U_LIV, "livreurs", `restaurant_id is not null`)));
verifier("livreurs du restaurant : l'exploitation les voit", (await nb(ID.admin, "livreurs", `restaurant_id is not null`)) === 2);
await interdit("le restaurateur ne crée pas de livreur par l'API (écriture par le serveur seulement)", ID.user_a, `insert into livreurs (nom, cycle, origine, restaurant_id) values ('Intrus', 'actif', 'restaurant', ${U(ID.resto_a)})`);
await interdit("le restaurateur ne modifie pas son livreur par l'API", ID.user_a, `update livreurs set nom = 'Autre' where id = ${U(RLA1)}`);
await interdit("le restaurateur ne touche pas au livreur d'un autre restaurant", ID.user_a, `update livreurs set cycle = 'archive' where id = ${U(RLB1)}`);
await serveur("base : un livreur de restaurant doit avoir un restaurant, un autre non (cohérence)", `insert into livreurs (nom, origine) values ('Sans resto', 'restaurant')`, true);
await serveur("base : un livreur du groupe ne porte pas de restaurant", `insert into livreurs (nom, origine, restaurant_id) values ('Faux groupe', 'exploitation', ${U(ID.resto_a)})`, true);
await serveur("base : le rattachement d'un livreur ne se modifie pas (restaurant)", `update livreurs set restaurant_id = ${U(ID.resto_b)} where id = ${U(RLA1)}`, true);
await serveur("base : le rattachement d'un livreur ne se modifie pas (origine)", `update livreurs set origine = 'exploitation', restaurant_id = null where id = ${U(RLA1)}`, true);
await serveur("base : le même téléphone, deux fois dans le même restaurant, est refusé", `insert into livreurs (nom, telephone, cycle, origine, restaurant_id) values ('Doublon', '+224622700001', 'actif', 'restaurant', ${U(ID.resto_a)})`, true);
await serveur("base : le même téléphone dans un AUTRE restaurant est accepté (une personne livre pour deux)", `insert into livreurs (nom, telephone, cycle, origine, restaurant_id) values ('Même personne', '+224622700001', 'actif', 'restaurant', ${U(ID.resto_b)})`, false);
await serveur("base : ce téléphone peut aussi exister dans le groupe Speedfood (portées distinctes)", `insert into livreurs (nom, telephone, cycle) values ('Groupe', '+224622700001', 'candidat')`, false);
await serveur("base : après archivage, le téléphone se réutilise dans le même restaurant", `update livreurs set cycle = 'archive' where id = ${U(RLA1)}; insert into livreurs (nom, telephone, cycle, origine, restaurant_id) values ('Retour', '+224622700001', 'actif', 'restaurant', ${U(ID.resto_a)})`, false);
await serveur("affectation : un livreur de A sur la livraison de B est refusé par la base", `update livraisons set livreur_id = ${U(RLA1)} where id = ${U(LIVRAISON_B)}`, true);
await serveur("affectation : un livreur de B sur la livraison de A est refusé aussi", `update livraisons set livreur_id = ${U(RLB1)} where id = ${U(LIV_H)}`, true);
await serveur("affectation : un livreur de A sur la livraison de A est accepté", `update livraisons set livreur_id = ${U(RLA1)} where id = ${U(LIV_H)}`, false);
await serveur("affectation : un livreur du groupe Speedfood reste affectable partout (inchangé)", `update livraisons set livreur_id = ${U(LIVREUR_2)} where id = ${U(LIVRAISON_B)}`, false);
await serveur("affectation : retirer le livreur reste possible", `update livraisons set livreur_id = null where id = ${U(LIV_H)}`, false);
verifier("les livreurs du groupe ne sont pas concernés : leur restaurant et leur origine sont inchangés", (await db.query(`select count(*)::int n from livreurs where id in (${U(LIVREUR_1)}, ${U(LIVREUR_2)}) and restaurant_id is null and origine = 'exploitation'`)).rows[0].n === 2);

// ---------------------------------------------------------------- 11. espace client : restaurants favoris
console.log("\n--- Favoris du client");
await db.exec(`
  insert into client_favoris (utilisateur_id, restaurant_id) values
    (${U(ID.client)}, ${U(ID.resto_a)}), (${U(ID.client)}, ${U(ID.resto_b)}), (${U(ID.user_a)}, ${U(ID.resto_b)});
`);
verifier("favoris : le client lit les siens (2), pas ceux des autres", (await nb(ID.client, "client_favoris")) === 2 && VIDE(await nb(ID.client, "client_favoris", `utilisateur_id = ${U(ID.user_a)}`)));
verifier("favoris : un autre compte ne voit que les siens", (await nb(ID.user_a, "client_favoris")) === 1 && VIDE(await nb(ID.user_b, "client_favoris")));
verifier("favoris : un anonyme ne lit rien", VIDE(await nb(null, "client_favoris")));
verifier("favoris : l'exploitation n'a pas de passe-droit en lecture (écran du client seulement)", VIDE(await nb(ID.admin, "client_favoris")));
await interdit("favoris : le client n'ajoute pas par l'API (écriture par le serveur)", ID.client, `insert into client_favoris (utilisateur_id, restaurant_id) values (${U(ID.client)}, ${U(RESTO_B2)})`);
await interdit("favoris : le client ne supprime pas par l'API", ID.client, `delete from client_favoris where utilisateur_id = ${U(ID.client)}`);
await interdit("favoris : on n'ajoute jamais pour un autre compte", ID.client, `insert into client_favoris (utilisateur_id, restaurant_id) values (${U(ID.user_b)}, ${U(ID.resto_a)})`);
await serveur("favoris : un même restaurant deux fois est refusé", `insert into client_favoris (utilisateur_id, restaurant_id) values (${U(ID.client)}, ${U(ID.resto_a)})`, true);
await db.exec(`insert into restaurants (nom, categorie_id, quartier_id, publie) select 'Fav ' || g, '${CAT}', '${QUA}', false from generate_series(1, 100) g`);
await serveur("favoris : jusqu'à 100 restaurants par compte", `insert into client_favoris (utilisateur_id, restaurant_id) select ${U(ID.user_b)}, id from restaurants where nom like 'Fav %' limit 100`, false);
await serveur("favoris : le 101e est refusé par la base", `insert into client_favoris (utilisateur_id, restaurant_id) values (${U(ID.user_b)}, ${U(ID.resto_a)})`, true);
await serveur("favoris : supprimer un restaurant supprime les favoris qui le visent", `delete from restaurants where id = ${U(RESTO_B2)}`, false);
verifier("favoris : après suppression du compte, ses favoris disparaissent (cascade)", await (async () => { await db.exec(`delete from auth.users where id = ${U(ID.user_a)}`).catch(() => {}); return (await db.query(`select count(*)::int n from client_favoris where utilisateur_id = ${U(ID.user_a)}`)).rows[0].n === 0; })());

// ---------------------------------------------------------------- 12. espace client : adresses et préférences
console.log("\n--- Adresses et préférences du client");
await db.exec(`
  insert into client_adresses (utilisateur_id, libelle, adresse, par_defaut) values
    (${U(ID.client)}, 'Maison', 'Kaloum, près du marché', true), (${U(ID.client)}, 'Travail', 'Ratoma, avenue de la République', false),
    (${U(ID.user_b)}, 'Bureau', 'Dixinn, rue du port', true);
`);
verifier("adresses : le client lit les siennes (2), pas celles des autres", (await nb(ID.client, "client_adresses")) === 2 && VIDE(await nb(ID.client, "client_adresses", `utilisateur_id = ${U(ID.user_b)}`)));
verifier("adresses : un autre compte ne voit que les siennes ; un anonyme et l'exploitation rien", (await nb(ID.user_b, "client_adresses")) === 1 && VIDE(await nb(null, "client_adresses")) && VIDE(await nb(ID.admin, "client_adresses")));
await interdit("adresses : le client n'écrit pas par l'API", ID.client, `insert into client_adresses (utilisateur_id, libelle, adresse) values (${U(ID.client)}, 'Autre', 'Quelque part, Conakry')`);
await interdit("adresses : le client ne modifie ni ne supprime par l'API", ID.client, `update client_adresses set adresse = 'Ailleurs, Conakry' where utilisateur_id = ${U(ID.client)}`);
await interdit("adresses : on ne lit ni ne modifie celle d'un autre", ID.user_a, `delete from client_adresses where utilisateur_id = ${U(ID.client)}`);
await serveur("adresses : une seule adresse par défaut par compte", `insert into client_adresses (utilisateur_id, libelle, adresse, par_defaut) values (${U(ID.client)}, 'Autre', 'Matoto, route du niger', true)`, true);
await serveur("adresses : libellé trop court ou adresse trop courte refusés", `insert into client_adresses (utilisateur_id, libelle, adresse) values (${U(ID.client)}, 'X', 'abcde')`, true);
await serveur("adresses : jusqu'à cinq par compte", `insert into client_adresses (utilisateur_id, libelle, adresse) values (${U(ID.client)}, 'Ami 1', 'Matoto, chez un ami'), (${U(ID.client)}, 'Ami 2', 'Matam, chez un ami'), (${U(ID.client)}, 'Ami 3', 'Dubréka, chez un ami')`, false);
await serveur("adresses : la sixième est refusée par la base", `insert into client_adresses (utilisateur_id, libelle, adresse) values (${U(ID.client)}, 'Ami 4', 'Coyah, chez un ami')`, true);
await db.exec(`insert into client_profils (utilisateur_id, pseudo, avatar) values (${U(ID.client)}, 'ClientTest', 'burger') on conflict do nothing`);
await autorise("préférences : le client règle son mode préféré et ses notifications (policy habituelle du profil)", ID.client, `update client_profils set mode_prefere = 'livraison', notifications_commande = false where utilisateur_id = ${U(ID.client)}`);
await interdit("préférences : un mode inconnu est refusé", ID.client, `update client_profils set mode_prefere = 'drone' where utilisateur_id = ${U(ID.client)}`);
await interdit("préférences : on ne touche pas au profil d'un autre", ID.user_a, `update client_profils set mode_prefere = 'retrait' where utilisateur_id = ${U(ID.client)}`);

// ---------------------------------------------------------------- 13. espace client : notifications de suivi
console.log("\n--- Notifications du client");
await db.exec(`
  insert into client_push_subscriptions (utilisateur_id, endpoint, p256dh, auth) values
    (${U(ID.client)}, 'https://fcm.googleapis.com/fcm/send/abcdefghij1', 'p256dh-cle-de-test-1', 'auth-cle-test-1'),
    (${U(ID.user_b)}, 'https://fcm.googleapis.com/fcm/send/abcdefghij2', 'p256dh-cle-de-test-2', 'auth-cle-test-2');
  insert into client_notifications (utilisateur_id, order_id, type) values
    (${U(ID.client)}, '${CMD_A}', 'acceptee'), (${U(ID.user_b)}, '${CMD_B}', 'prete');
`);
verifier("abonnements push : le client lit les siens seulement", (await nb(ID.client, "client_push_subscriptions")) === 1 && (await nb(ID.user_b, "client_push_subscriptions")) === 1);
verifier("abonnements push : un anonyme et l'exploitation n'en lisent aucun (les clés de chiffrement restent au serveur)", VIDE(await nb(null, "client_push_subscriptions")) && VIDE(await nb(ID.admin, "client_push_subscriptions")));
verifier("notifications : chacun lit les siennes, pas celles des autres", (await nb(ID.client, "client_notifications")) === 1 && (await nb(ID.user_b, "client_notifications")) === 1 && VIDE(await nb(ID.user_a, "client_notifications")) && VIDE(await nb(null, "client_notifications")));
await interdit("abonnements push : pas d'écriture par l'API", ID.client, `insert into client_push_subscriptions (utilisateur_id, endpoint, p256dh, auth) values (${U(ID.client)}, 'https://fcm.googleapis.com/fcm/send/zzzzzzzzzz', 'p256dh-cle-de-test-3', 'auth-cle-test-3')`);
await interdit("abonnements push : pas de suppression par l'API", ID.client, `delete from client_push_subscriptions where utilisateur_id = ${U(ID.client)}`);
await interdit("notifications : pas d'écriture ni de marquage « lue » par l'API", ID.client, `update client_notifications set lue_le = now() where utilisateur_id = ${U(ID.client)}`);
await serveur("abonnements push : un point d'accès non sécurisé est refusé", `insert into client_push_subscriptions (utilisateur_id, endpoint, p256dh, auth) values (${U(ID.client)}, 'http://exemple.test/push/abcdefghij', 'p256dh-cle-de-test-4', 'auth-cle-test-4')`, true);
await serveur("abonnements push : un même appareil deux fois est refusé", `insert into client_push_subscriptions (utilisateur_id, endpoint, p256dh, auth) values (${U(ID.user_b)}, 'https://fcm.googleapis.com/fcm/send/abcdefghij1', 'p256dh-cle-de-test-5', 'auth-cle-test-5')`, true);
await serveur("abonnements push : jusqu'à cinq appareils par compte", `insert into client_push_subscriptions (utilisateur_id, endpoint, p256dh, auth) select ${U(ID.client)}, 'https://fcm.googleapis.com/fcm/send/appareil-' || g, 'p256dh-cle-de-test-6', 'auth-cle-test-6' from generate_series(1, 4) g`, false);
await serveur("abonnements push : le sixième est refusé par la base", `insert into client_push_subscriptions (utilisateur_id, endpoint, p256dh, auth) values (${U(ID.client)}, 'https://fcm.googleapis.com/fcm/send/appareil-6', 'p256dh-cle-de-test-7', 'auth-cle-test-7')`, true);
await serveur("notifications : la même étape d'une commande n'est notifiée qu'une fois", `insert into client_notifications (utilisateur_id, order_id, type) values (${U(ID.client)}, '${CMD_A}', 'acceptee')`, true);
await serveur("notifications : une autre étape de la même commande est acceptée", `insert into client_notifications (utilisateur_id, order_id, type) values (${U(ID.client)}, '${CMD_A}', 'prete')`, false);
await serveur("notifications : un type inconnu est refusé", `insert into client_notifications (utilisateur_id, order_id, type) values (${U(ID.client)}, '${CMD_A}', 'piratage')`, true);

// ---------------------------------------------------------------- demandes de partenariat (page « Devenir partenaire »)
console.log("--- Demandes de partenariat");
await serveur("partenariat : le serveur enregistre une demande valide", `insert into partenariat_demandes (forme, organisation, nom_contact, contact_type, contact, message) values ('investir', 'Fonds Kaloum', 'Aïssatou Diallo', 'email', 'aissatou@exemple.org', 'Nous souhaitons financer du matériel pour dix restaurants.')`, false);
verifier("partenariat : aucun compte ne lit les demandes (anonyme, client, restaurateur, exploitation)", VIDE(await nb(null, "partenariat_demandes")) && VIDE(await nb(ID.client, "partenariat_demandes")) && VIDE(await nb(ID.user_a, "partenariat_demandes")) && VIDE(await nb(ID.admin, "partenariat_demandes")));
await interdit("partenariat : pas d'écriture par l'API (anonyme)", null, `insert into partenariat_demandes (forme, organisation, nom_contact, contact_type, contact, message) values ('investir', 'Robot', 'Robot', 'email', 'robot@exemple.org', 'Message automatique de plus de vingt caractères.')`);
await interdit("partenariat : pas d'écriture par l'API (compte connecté)", ID.client, `insert into partenariat_demandes (forme, organisation, nom_contact, contact_type, contact, message) values ('investir', 'Robot', 'Robot', 'email', 'robot@exemple.org', 'Message automatique de plus de vingt caractères.')`);
await interdit("partenariat : pas de changement de statut par l'API", ID.admin, `update partenariat_demandes set statut = 'classee'`);
await interdit("partenariat : pas de suppression par l'API", ID.admin, `delete from partenariat_demandes`);
await serveur("partenariat : une forme inconnue est refusée par la base", `insert into partenariat_demandes (forme, organisation, nom_contact, contact_type, contact, message) values ('restaurant', 'Chez Awa', 'Awa', 'email', 'awa@exemple.org', 'Je tiens un restaurant et je veux commander.')`, true);
await serveur("partenariat : un message trop court est refusé par la base", `insert into partenariat_demandes (forme, organisation, nom_contact, contact_type, contact, message) values ('soutenir', 'Association', 'Moussa', 'email', 'moussa@exemple.org', 'Bonjour')`, true);
await serveur("partenariat : un statut inconnu est refusé par la base", `update partenariat_demandes set statut = 'archivee'`, true);
await serveur("partenariat : le serveur peut changer le statut", `update partenariat_demandes set statut = 'en_cours'`, false);

// ---------------------------------------------------------------- modèle « Speedfood intermédiaire » (ADR-020)
console.log("--- Mode de vente et référencement");
const modeDefaut = (await db.query(`select mode_vente from restaurants where id = ${U(ID.resto_a)}`)).rows[0].mode_vente;
verifier("un restaurant existant reste en mode « autonome » par défaut", modeDefaut === "autonome", modeDefaut);
await interdit("un restaurateur ne peut pas passer son restaurant en mode « speedfood »", ID.user_a, `update restaurants set mode_vente = 'speedfood' where id = ${U(ID.resto_a)}`);
await serveur("une valeur de mode de vente inconnue est refusée par la base", `update restaurants set mode_vente = 'revendeur' where id = ${U(ID.resto_a)}`, true);
await autorise("un administrateur système peut changer le mode de vente", ID.admin, `update restaurants set mode_vente = 'speedfood' where id = ${U(ID.resto_a)}`);
await serveur("remise du restaurant de test en mode « autonome »", `update restaurants set mode_vente = 'autonome' where id = ${U(ID.resto_a)}`, false);
const creationOuverte = (await db.query(`select has_function_privilege('authenticated','public.fn_creer_restaurant_et_owner(text,uuid,uuid)','execute') a`)).rows[0].a;
verifier("la création libre d'un établissement n'est plus exécutable par un compte connecté", !creationOuverte);

await serveur("référencement : le serveur enregistre une demande valide", `insert into referencement_demandes (type_etablissement, organisation, commune, quartier, latitude, longitude, responsable_prenom, responsable_nom, contact_email, contact_telephone) values ('restaurant', 'Chez Awa', 'Kaloum', 'Almamya', 9.5092, -13.7122, 'Awa', 'Diallo', 'awa@exemple.org', '+224622000000')`, false);
verifier("référencement : aucun compte ne lit les demandes", VIDE(await nb(null, "referencement_demandes")) && VIDE(await nb(ID.client, "referencement_demandes")) && VIDE(await nb(ID.user_a, "referencement_demandes")) && VIDE(await nb(ID.admin, "referencement_demandes")));
await interdit("référencement : pas d'écriture par l'API (compte connecté)", ID.client, `insert into referencement_demandes (type_etablissement, organisation, commune, quartier, responsable_prenom, responsable_nom, contact_email, contact_telephone) values ('restaurant', 'Robot', 'Kaloum', 'Almamya', 'R', 'R', 'robot@exemple.org', '+224622000001')`);
await interdit("référencement : pas d'écriture par l'API (anonyme)", null, `insert into referencement_demandes (type_etablissement, organisation, commune, quartier, responsable_prenom, responsable_nom, contact_email, contact_telephone) values ('restaurant', 'Robot', 'Kaloum', 'Almamya', 'R', 'R', 'robot@exemple.org', '+224622000001')`);
await interdit("référencement : pas de changement de statut par l'API", ID.admin, `update referencement_demandes set statut = 'accord'`);
await serveur("référencement : un type d'établissement inconnu est refusé", `insert into referencement_demandes (type_etablissement, organisation, commune, quartier, responsable_prenom, responsable_nom, contact_email, contact_telephone) values ('garage', 'Chez Awa', 'Kaloum', 'Almamya', 'A', 'D', 'awa@exemple.org', '+224622000000')`, true);
await serveur("référencement : des coordonnées GPS à moitié remplies sont refusées", `insert into referencement_demandes (type_etablissement, organisation, commune, quartier, latitude, responsable_prenom, responsable_nom, contact_email, contact_telephone) values ('restaurant', 'Chez Awa', 'Kaloum', 'Almamya', 9.5, 'A', 'D', 'awa@exemple.org', '+224622000000')`, true);
await serveur("référencement : un statut inconnu est refusé", `update referencement_demandes set statut = 'archivee'`, true);
await serveur("référencement : une demande peut être rattachée à l'établissement créé", `update referencement_demandes set statut = 'creee', restaurant_id = ${U(ID.resto_a)}`, false);

await serveur("contact interne : le serveur enregistre le téléphone des commandes d'un établissement", `insert into restaurant_contacts_internes (restaurant_id, telephone_commandes) values (${U(ID.resto_a)}, '+224622000000')`, false);
verifier("contact interne : aucun compte ne lit le téléphone (anonyme, client, restaurateur du même établissement, exploitation)", VIDE(await nb(null, "restaurant_contacts_internes")) && VIDE(await nb(ID.client, "restaurant_contacts_internes")) && VIDE(await nb(ID.user_a, "restaurant_contacts_internes")) && VIDE(await nb(ID.admin, "restaurant_contacts_internes")));
await interdit("contact interne : pas d'écriture par l'API", ID.user_a, `update restaurant_contacts_internes set telephone_commandes = '+224699999999'`);
await serveur("contact interne : un numéro trop court est refusé", `update restaurant_contacts_internes set telephone_commandes = '123'`, true);
await serveur("contact interne : un seul numéro par établissement", `insert into restaurant_contacts_internes (restaurant_id, telephone_commandes) values (${U(ID.resto_a)}, '+224622000001')`, true);

// ---------------------------------------------------------------- L2 : quarts et affectation des opérateurs
console.log("--- Quarts et affectation des opérateurs");
const rlsQuarts = (await db.query(`select relrowsecurity from pg_class where oid = 'public.affectations_operateurs'::regclass`)).rows[0]?.relrowsecurity;
verifier("affectations : la table existe et la RLS est active", rlsQuarts === true);
await db.exec(`update restaurants set mode_vente = 'speedfood' where id = ${U(ID.resto_a)}`);
await interdit("affectations : un restaurateur ne lit aucune affectation", ID.user_a, `select * from affectations_operateurs`);
await interdit("affectations : un client ne lit aucune affectation", ID.client, `select * from affectations_operateurs`);
await interdit("affectations : un anonyme ne lit aucune affectation", null, `select * from affectations_operateurs`);
await interdit("affectations : pas d'écriture par l'API (compte connecté)", ID.support, `insert into affectations_operateurs (restaurant_id, operateur_id) values (${U(ID.resto_a)}, ${U(ID.support)})`);
await interdit("affectations : pas d'écriture par l'API (anonyme)", null, `insert into affectations_operateurs (restaurant_id, operateur_id) values (${U(ID.resto_a)}, ${U(ID.support)})`);
await interdit("affectations : pas de modification par l'API", ID.admin, `update affectations_operateurs set operateur_id = ${U(ID.admin)}`);
await interdit("affectations : pas de suppression par l'API", ID.admin, `delete from affectations_operateurs`);
const appelQuarts = async (qui, sql) => {
  const r = await en_tant_que(qui, async () => {
    try { await db.query(sql); return null; } catch (e) { return e.message; }
  });
  return r;
};
verifier("affectations : le support prend un établissement", (await appelQuarts(ID.support, `select fn_quarts_prendre(${U(ID.resto_a)}, null, ${U(ID.support)})`)) === null);
verifier("affectations : la prise est enregistrée", (await db.query(`select count(*)::int n from affectations_operateurs where restaurant_id = ${U(ID.resto_a)} and operateur_id = ${U(ID.support)} and libere_le is null`)).rows[0].n === 1);
verifier("affectations : le support lit les affectations", (await nb(ID.support, "affectations_operateurs")) === 1);
verifier("affectations : le super administrateur lit les affectations", (await nb(ID.admin, "affectations_operateurs")) === 1);
verifier("affectations : un restaurateur ne lit aucune affectation", VIDE(await nb(ID.user_a, "affectations_operateurs")));
verifier("affectations : un client ne lit aucune affectation", VIDE(await nb(ID.client, "affectations_operateurs")));
verifier("affectations : un anonyme ne lit aucune affectation", VIDE(await nb(null, "affectations_operateurs")));
verifier("affectations : un restaurateur ne peut pas prendre un établissement", (await appelQuarts(ID.user_a, `select fn_quarts_prendre(${U(ID.resto_a)}, null, ${U(ID.user_a)})`)) !== null);
verifier("affectations : un établissement déjà pris par un autre est refusé", (await appelQuarts(ID.admin, `select fn_quarts_prendre(${U(ID.resto_a)}, null, ${U(ID.admin)})`)) !== null);
verifier("affectations : un établissement qui n'est pas tenu par l'équipe est refusé", (await appelQuarts(ID.support, `select fn_quarts_prendre(${U(ID.resto_b)}, null, ${U(ID.support)})`)) !== null);
verifier("affectations : le support libère un établissement", (await appelQuarts(ID.support, `select fn_quarts_liberer(${U(ID.resto_a)}, ${U(ID.support)})`)) === null);
verifier("affectations : l'établissement libéré n'a plus de titulaire", (await db.query(`select count(*)::int n from affectations_operateurs where restaurant_id = ${U(ID.resto_a)} and libere_le is null`)).rows[0].n === 0);
const liberationSansTitre = await en_tant_que(ID.support, async () => {
  const r = await db.query(`select fn_quarts_liberer(${U(ID.resto_a)}, ${U(ID.support)})`);
  return r.rows[0].fn_quarts_liberer;
});
verifier("affectations : libérer un établissement qu'on ne tient pas renvoie false", liberationSansTitre === false);
await db.exec(`insert into affectations_operateurs (restaurant_id, operateur_id) values (${U(ID.resto_a)}, ${U(ID.support)})`);
verifier("affectations : un établissement ne peut avoir qu'un seul titulaire actif", (await (async () => {
  try { await db.exec(`insert into affectations_operateurs (restaurant_id, operateur_id) values (${U(ID.resto_a)}, ${U(ID.admin)})`); return false; }
  catch { return true; }
})()));

console.log(echecs === 0 ? `\nCLOISONNEMENT VÉRIFIÉ : ${reussis} contrôles réussis.` : `\n${echecs} échec(s) sur ${reussis + echecs}.`);
process.exit(echecs === 0 ? 0 : 1);
