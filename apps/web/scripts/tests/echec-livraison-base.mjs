// Simulation sur une COPIE jetable de la base (PGlite en mémoire : les migrations de supabase/migrations rejouées, de faux comptes, aucune donnée réelle, aucun accès à la production) de :
//   1. l'issue d'une commande dont la livraison a échoué (fn_support_resoudre_echec_livraison) : seul le support, seulement sur une commande prête dont la livraison est en échec ;
//   2. le verrou sur l'argent (fn_paiement_garde) : un paiement ne passe de « confirme » à « libere » que si la commande est terminée et sa livraison finie.
// Chaque garde est aussi attaquée par la voie directe (écriture sur la table) : elle doit refuser.
// Usage : npm run test:echec-livraison   (prérequis, une fois : cd supabase/rejeu && npm ci)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { PGlite } = await import(
  pathToFileURL(path.join(racine, "..", "..", "supabase", "rejeu", "node_modules", "@electric-sql", "pglite", "dist", "index.js")).href
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
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const dossierMigrations = path.join(racine, "..", "..", "supabase", "migrations");
const fichiers = fs.readdirSync(dossierMigrations).filter((n) => n.endsWith(".sql")).sort();
for (const f of fichiers) {
  try {
    await db.exec(fs.readFileSync(path.join(dossierMigrations, f), "utf8").replace(/create extension if not exists pgcrypto;?/gi, ""));
  } catch (e) {
    console.log(`ECHEC migration ${f} : ${e.message}`);
    process.exit(1);
  }
}
console.log(`${fichiers.length} migrations rejouées sur la copie jetable\n`);

// ---------------------------------------------------------------- se connecter « en tant que »
const ID = {
  resto: "00000000-0000-4000-8000-0000000000a1",
  user_resto: "00000000-0000-4000-8000-00000000aaaa",
  client: "00000000-0000-4000-8000-00000000cccc",
  admin: "00000000-0000-4000-8000-00000000dddd",
  support: "00000000-0000-4000-8000-00000000eeee",
};
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
    await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false)");
  }
}
/** Écrit avec les droits du compte : renvoie { erreur } ou { touchees }. */
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
/** Comme le serveur : clé de service, sans identité (auth.uid() est nul) et sans passer par la RLS. */
async function serveur(sql, params = []) {
  await db.exec("set role service_role");
  try {
    const r = await db.query(sql, params);
    return { touchees: r.affectedRows ?? r.rows.length, erreur: null };
  } catch (e) {
    return { touchees: 0, erreur: e.message };
  } finally {
    await db.exec("reset role");
  }
}
const un = async (sql, params = []) => (await db.query(sql, params)).rows[0];

// ---------------------------------------------------------------- données de départ
const CAT = "00000000-0000-4000-8000-0000000000c1";
const QUA = "00000000-0000-4000-8000-0000000000d1";
await db.exec(`
  insert into auth.users (id, email) values
    ('${ID.user_resto}', 'resto@test.invalid'), ('${ID.client}', 'client@test.invalid'), ('${ID.admin}', 'admin@test.invalid'), ('${ID.support}', 'support@test.invalid');
  insert into menu_categories (id, nom) values ('${CAT}', 'Cat test');
  insert into neighborhoods (id, nom) values ('${QUA}', 'Quartier test');
  insert into restaurants (id, nom, categorie_id, quartier_id, publie) values ('${ID.resto}', 'RESTO-A', '${CAT}', '${QUA}', true);
  insert into restaurant_memberships (restaurant_id, utilisateur_id, role) values ('${ID.resto}', '${ID.user_resto}', 'owner');
  insert into system_admin_memberships (utilisateur_id, role) values ('${ID.admin}', 'super_admin'), ('${ID.support}', 'support');
`);
let n = 0;
/** Une commande en livraison à l'état voulu, avec sa livraison (ou aucune) et, si demandé, un paiement en ligne confirmé. */
async function commande({ statut, livraison, paiement = false }) {
  n += 1;
  const id = `00000000-0000-4000-8000-0000000f${String(n).padStart(4, "0")}`;
  await db.exec(`insert into orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, client_adresse, mode, sous_total, statut)
    values ('${id}', 'SF-T${String(n).padStart(4, "0")}', 'jeton-${n}', '${ID.resto}', 'Client', '620000001', 'Adresse', 'livraison', 1000, '${statut}')`);
  if (livraison) await db.exec(`insert into livraisons (order_id, restaurant_id, mode, statut) values ('${id}', '${ID.resto}', 'propre', '${livraison}')`);
  if (paiement) {
    await db.exec(`insert into paiements (order_id, restaurant_id, fournisseur, operateur, repas_gnf, frais_livraison_gnf, livraison_par, frais_speedfood_gnf, frais_mobile_gnf, restaurant_gnf, livreur_gnf, speedfood_brut_gnf, reference_interne)
      values ('${id}', '${ID.resto}', 'simulation', 'orange_money', 1000, 0, 'restaurant', 100, 0, 900, 0, 100, 'REF-${String(n).padStart(6, "0")}')`);
    for (const etat of ["en_attente", "confirme"]) await db.exec(`update paiements set etat = '${etat}' where order_id = '${id}'`);
  }
  return id;
}
const statutDe = async (id) => (await un("select statut from orders where id = $1", [id])).statut;
const etatPaiement = async (id) => (await un("select etat from paiements where order_id = $1", [id])).etat;
const issue = (qui, id, vers, motif = "Client injoignable apres deux appels") => ecrire(qui, "select public.fn_support_resoudre_echec_livraison($1, $2, $3)", [id, vers, motif]);

// ---------------------------------------------------------------- 1. issue d'un échec de livraison
console.log("--- Issue d'une commande dont la livraison a échoué");
{
  const c = await commande({ statut: "prete", livraison: "echec" });
  const r = await issue(ID.support, c, "cloturer");
  verifier("support : « clôturer » une commande prête en échec la termine", r.erreur === null && (await statutDe(c)) === "terminee", r.erreur ?? "");
  const ev = await un("select count(*)::int n from order_status_events where order_id = $1 and statut_suivant = 'terminee' and acteur = $2", [c, `support:${ID.support}`]);
  verifier("support : l'événement d'historique porte l'acteur support", ev.n === 1);
  const au = await un("select count(*)::int n from audit_events where cible_id = $1 and action = 'commande.issue_echec_livraison' and motif like 'cloturer : %'", [c]);
  verifier("support : l'action est tracée dans le journal d'audit avec l'issue et le motif", au.n === 1);
}
{
  const c = await commande({ statut: "prete", livraison: "echec" });
  const r = await issue(ID.admin, c, "annuler");
  verifier("super administrateur : « annuler » une commande prête en échec l'annule", r.erreur === null && (await statutDe(c)) === "annulee", r.erreur ?? "");
  const drapeau = await un("select coalesce(current_setting('speedfood.issue_echec_livraison', true), '') as v");
  verifier("l'indicateur interne est remis à « off » après l'annulation", drapeau.v === "off" || drapeau.v === "");
}
for (const [qui, nom] of [[ID.user_resto, "restaurateur"], [ID.client, "client"], [null, "visiteur anonyme"]]) {
  const c = await commande({ statut: "prete", livraison: "echec" });
  const r = await issue(qui, c, "annuler");
  verifier(`${nom} : ne peut pas appeler l'issue`, r.erreur !== null && (await statutDe(c)) === "prete", r.erreur ?? "aucune erreur !");
}
{
  const cas = [
    ["livraison en route", { statut: "prete", livraison: "vers_client" }],
    ["livraison livrée", { statut: "prete", livraison: "livree" }],
    ["livraison annulée", { statut: "prete", livraison: "annulee" }],
    ["aucune livraison", { statut: "prete", livraison: null }],
    ["commande acceptée (pas prête)", { statut: "acceptee", livraison: "echec" }],
    ["commande déjà terminée", { statut: "terminee", livraison: "echec" }],
    ["commande déjà annulée", { statut: "annulee", livraison: "echec" }],
  ];
  for (const [nom, def] of cas) {
    const c = await commande(def);
    const avant = await statutDe(c);
    const r = await issue(ID.support, c, "annuler");
    verifier(`support : refus sur ${nom}`, r.erreur !== null && (await statutDe(c)) === avant, r.erreur ?? "aucune erreur !");
  }
  const c = await commande({ statut: "prete", livraison: "echec" });
  for (const [vers, motif, nom] of [["rembourser", "Motif valable ici", "issue inconnue"], [null, "Motif valable ici", "issue absente"], ["annuler", "abc", "motif trop court"], ["annuler", "", "motif vide"], ["annuler", "x".repeat(501), "motif trop long"]]) {
    const r = await issue(ID.support, c, vers, motif);
    verifier(`support : refus (${nom}), la commande reste prête`, r.erreur !== null && (await statutDe(c)) === "prete", r.erreur ?? "aucune erreur !");
  }
  const inconnue = await issue(ID.support, "00000000-0000-4000-8000-00000000ffff", "annuler");
  verifier("support : refus sur une commande inconnue", inconnue.erreur !== null);
}

// ---------------------------------------------------------------- 2. contre-épreuves : la transition « prête vers annulée » n'existe pas par la voie directe
console.log("\n--- Voie directe : prête vers annulée reste interdite");
{
  const c = await commande({ statut: "prete", livraison: "echec" });
  const parResto = await ecrire(ID.user_resto, "update orders set statut = 'annulee' where id = $1", [c]);
  verifier("restaurateur : écriture directe prête vers annulée refusée (même avec livraison en échec)", (parResto.erreur !== null || parResto.touchees === 0) && (await statutDe(c)) === "prete", parResto.erreur ?? "");
  await db.exec("select set_config('speedfood.issue_echec_livraison', 'on', false)");
  const faux = await ecrire(ID.user_resto, "update orders set statut = 'annulee' where id = $1", [c]);
  verifier("restaurateur : l'indicateur posé à la main ne suffit pas", (faux.erreur !== null || faux.touchees === 0) && (await statutDe(c)) === "prete", faux.erreur ?? "");
  const parServeur = await serveur("update orders set statut = 'annulee' where id = $1", [c]);
  verifier("serveur (clé de service, sans identité) : prête vers annulée refusée même avec l'indicateur à « on »", parServeur.erreur !== null && (await statutDe(c)) === "prete", parServeur.erreur ?? "aucune erreur !");
  await db.exec("select set_config('speedfood.issue_echec_livraison', 'off', false)");
  // Le support n'a AUCUNE écriture directe sur les commandes (la sécurité par lignes filtre : 0 ligne touchée).
  const sans = await commande({ statut: "prete", livraison: "vers_client" });
  await db.exec("select set_config('speedfood.issue_echec_livraison', 'on', false)");
  const parSupport = await ecrire(ID.support, "update orders set statut = 'annulee' where id = $1", [sans]);
  verifier("support avec l'indicateur, voie directe : aucune ligne touchée (pas de droit d'écriture sur les commandes)", (parSupport.erreur !== null || parSupport.touchees === 0) && (await statutDe(sans)) === "prete", parSupport.erreur ?? "");
  // Même si la sécurité par lignes était contournée (superutilisateur portant l'identité du support), le DÉCLENCHEUR refuse : pas de livraison en échec = pas d'annulation.
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: ID.support, role: "authenticated", aal: "aal2" })}', false), set_config('request.jwt.claim.sub', '${ID.support}', false)`);
  let contourne = null;
  try { await db.query("update orders set statut = 'annulee' where id = $1", [sans]); } catch (e) { contourne = e.message; }
  verifier("support qui contournerait la sécurité par lignes, SANS livraison en échec : le déclencheur refuse", contourne !== null && (await statutDe(sans)) === "prete", contourne ?? "aucune erreur !");
  const avecEchec = await commande({ statut: "prete", livraison: "echec" });
  let permis = null;
  try { await db.query("update orders set statut = 'annulee' where id = $1", [avecEchec]); } catch (e) { permis = e.message; }
  verifier("même identité, indicateur à « on » ET livraison en échec : le déclencheur laisse passer (c'est le chemin de la fonction d'issue)", permis === null && (await statutDe(avecEchec)) === "annulee", permis ?? "");
  await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false), set_config('speedfood.issue_echec_livraison', 'off', false)");
  const normale = await commande({ statut: "prete", livraison: "livree" });
  const cloture = await ecrire(ID.user_resto, "update orders set statut = 'terminee' where id = $1", [normale]);
  verifier("restaurateur : prête vers terminée par la voie normale fonctionne toujours", cloture.erreur === null && (await statutDe(normale)) === "terminee", cloture.erreur ?? "");
  const retour = await serveur("update orders set statut = 'acceptee' where id = $1", [normale]);
  verifier("retour en arrière terminée vers acceptée toujours refusé", retour.erreur !== null);
}

// ---------------------------------------------------------------- 3. verrou sur l'argent
console.log("\n--- Verrou sur l'argent : confirmé vers libéré");
{
  const liberer = (c) => serveur("update paiements set etat = 'libere' where order_id = $1", [c]);
  const cas = [
    ["commande prête, livraison en route", { statut: "prete", livraison: "vers_client" }, false],
    ["commande prête sans livraison", { statut: "prete", livraison: null }, false],
    ["commande acceptée", { statut: "acceptee", livraison: null }, false],
    ["commande annulée", { statut: "annulee", livraison: null }, false],
    ["commande terminée mais livraison encore en route (contournement)", { statut: "terminee", livraison: "vers_client" }, false],
    ["commande terminée, livraison à répartir", { statut: "terminee", livraison: "a_assigner" }, false],
    ["commande terminée, livraison livrée", { statut: "terminee", livraison: "livree" }, true],
    ["commande terminée, livraison en échec (clôturée par le support)", { statut: "terminee", livraison: "echec" }, true],
    ["commande terminée, livraison annulée", { statut: "terminee", livraison: "annulee" }, true],
    ["retrait : commande terminée sans livraison", { statut: "terminee", livraison: null }, true],
  ];
  for (const [nom, def, autorise] of cas) {
    const c = await commande({ ...def, paiement: true });
    const r = await liberer(c);
    const etat = await etatPaiement(c);
    verifier(`${autorise ? "libération permise" : "libération REFUSÉE"} : ${nom}`, autorise ? r.erreur === null && etat === "libere" : r.erreur !== null && etat === "confirme", r.erreur ?? `état ${etat}`);
  }
  // Le chemin de litige (décision humaine) n'est pas verrouillé : un paiement en litige peut être libéré par la décision.
  const l = await commande({ statut: "prete", livraison: "echec", paiement: true });
  await db.exec(`update paiements set etat = 'en_litige' where order_id = '${l}'`);
  const decision = await serveur("update paiements set etat = 'libere' where order_id = $1", [l]);
  verifier("litige : la décision de libérer (en_litige vers libere) reste possible, hors verrou", decision.erreur === null && (await etatPaiement(l)) === "libere", decision.erreur ?? "");
  // Remboursement et passage en litige ne sont pas gênés.
  const r1 = await commande({ statut: "prete", livraison: "echec", paiement: true });
  const rem = await serveur("update paiements set etat = 'rembourse', rembourse_gnf = 1000 where order_id = $1", [r1]);
  verifier("remboursement d'un paiement confirmé sur une commande prête en échec : permis", rem.erreur === null && (await etatPaiement(r1)) === "rembourse", rem.erreur ?? "");
  const r2 = await commande({ statut: "prete", livraison: "echec", paiement: true });
  const lit = await serveur("update paiements set etat = 'en_litige' where order_id = $1", [r2]);
  verifier("passage en litige d'un paiement confirmé : permis", lit.erreur === null && (await etatPaiement(r2)) === "en_litige", lit.erreur ?? "");
  // Un restaurateur ne touche jamais aux paiements.
  const p = await commande({ statut: "terminee", livraison: "livree", paiement: true });
  const parResto = await ecrire(ID.user_resto, "update paiements set etat = 'libere' where order_id = $1", [p]);
  verifier("restaurateur : aucune écriture sur un paiement", (parResto.erreur !== null || parResto.touchees === 0) && (await etatPaiement(p)) === "confirme", parResto.erreur ?? "");
}

console.log(`\n${echecs === 0 ? "ISSUE D'ÉCHEC ET VERROU VÉRIFIÉS" : "ÉCHEC"} : ${reussis} contrôles réussis, ${echecs} en échec.`);
process.exit(echecs === 0 ? 0 : 1);
