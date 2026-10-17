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

// ---------------------------------------------------------------- 7. gardes structurelles : une régression future est signalée ici
console.log("\n--- Gardes structurelles");
const sansRls = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows;
verifier("toutes les tables du schéma public ont la RLS activée", sansRls.length === 0, sansRls.map((r) => r.relname).join(", "));

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
  "fn_lister_membres_restaurant", "fn_preparer_suppression_compte", "fn_questions_etat", "fn_est_ce_mon_livreur", "fn_mon_restaurant_a_ce_livreur", "fn_reinitialisation_simuler", "fn_reinitialiser_application",
  "fn_statistiques_application", "fn_support_changer_statut", "fn_support_commandes_par_heure", "fn_support_compter_commandes",
  "fn_support_lister_commandes", "fn_support_reveler_coordonnees", "fn_support_serie_commandes", "fn_trouver_utilisateur_par_email",
]);
const definerAuth = (await db.query(`
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')`)).rows.map((r) => r.proname);
const nouvelles = definerAuth.filter((n) => !definerConnu.has(n));
verifier("aucune nouvelle fonction privilégiée n'est apparue sans être déclarée et testée ici", nouvelles.length === 0, nouvelles.join(", "));

console.log(echecs === 0 ? `\nCLOISONNEMENT VÉRIFIÉ : ${reussis} contrôles réussis.` : `\n${echecs} échec(s) sur ${reussis + echecs} contrôles.`);
process.exit(echecs === 0 ? 0 : 1);
