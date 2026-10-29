// Données de TEST pour jouer le parcours de l'espace client avec un VRAI compte client (voir docs/PARCOURS-TEST-CLIENT.md).
//
// Ce script ne crée AUCUN compte : la personne crée d'abord son compte elle-même (page /entrer), puis ce script y attache des commandes d'essai.
// Tout ce qu'il crée est marqué « test » et s'efface avec `nettoyer`. Aucune clé ni aucun mot de passe n'est affiché.
//
//   node scripts/parcours-client-test.mjs creer <e-mail du compte> [--public]
//   node scripts/parcours-client-test.mjs nettoyer
//   node scripts/parcours-client-test.mjs notifier <référence, ex. SF-ESSA2> <statut : acceptee | prete | refusee | annulee | terminee>
//
// `notifier` rejoue ce que fait l'application au changement de statut d'une commande : enregistre la notification du client et envoie le push
// (VAPID_* lues dans .env.local) à ses appareils abonnés. Il ne change PAS le statut de la commande.
//
// `--public` publie le restaurant d'essai (nécessaire pour essayer « Ajouter aux favoris » et « Commander à nouveau »). Il porte le nom
// « ESSAI Parcours client (ne pas commander) » ; faites `nettoyer` dès que l'essai est fini : tant qu'il est publié, il est visible du public.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative } from "node:path";
import { pathToFileURL } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierEnv = join(racine, ".env.local");
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises (.env.local).");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const RESTO = "e7000000-0000-4000-8000-000000000001";
const NOM_RESTO = "ESSAI Parcours client (ne pas commander)";
const [commande, argument, ...options] = process.argv.slice(2);

const echec = (message) => {
  console.error(message);
  process.exit(1);
};
const ok = async (promesse, contexte) => {
  const { data, error } = await promesse;
  if (error) echec(`${contexte} : ${error.message}`);
  return data;
};

async function nettoyer() {
  // Les commandes d'essai (et leurs lignes, avis, notifications) partent avec le restaurant par cascade.
  await ok(db.from("orders").delete().eq("restaurant_id", RESTO), "suppression des commandes");
  await ok(db.from("restaurants").delete().eq("id", RESTO), "suppression du restaurant d'essai");
  const { count } = await db.from("restaurants").select("id", { count: "exact", head: true }).eq("id", RESTO);
  console.log(count === 0 ? "Données d'essai supprimées (restaurant, menu, commandes)." : "Attention : le restaurant d'essai existe encore.");
}

async function trouverUtilisateur(email) {
  const voulu = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) echec(`lecture des comptes : ${error.message}`);
    const trouve = data.users.find((u) => (u.email ?? "").toLowerCase() === voulu);
    if (trouve) return trouve;
    if (data.users.length < 200) break;
  }
  return null;
}

async function creer(email, publier) {
  if (!email || !email.includes("@")) echec("Indiquez l'e-mail du compte client créé sur /entrer.");
  const utilisateur = await trouverUtilisateur(email);
  if (!utilisateur) echec("Aucun compte avec cet e-mail : créez d'abord votre compte sur /entrer, puis relancez.");
  const profil = await ok(db.from("client_profils").select("utilisateur_id").eq("utilisateur_id", utilisateur.id).maybeSingle(), "lecture du profil");
  if (!profil) echec("Ce compte n'a pas encore de profil client : connectez-vous une fois et terminez la page « Bienvenue » (pseudo et avatar), puis relancez.");

  await nettoyer(); // repart de zéro : idempotent

  const categorie = (await ok(db.from("menu_categories").select("id").limit(1), "catégorie"))[0];
  const quartier = (await ok(db.from("neighborhoods").select("id").limit(1), "quartier"))[0];
  if (!categorie || !quartier) echec("Aucune catégorie ou aucun quartier dans la base.");

  await ok(
    db.from("restaurants").insert({ id: RESTO, nom: NOM_RESTO, categorie_id: categorie.id, quartier_id: quartier.id, publie: publier, ouvert: true, accepte_commandes: true, livraison_mode: "propre", donnees_demo: true }),
    "création du restaurant d'essai"
  );
  const section = (await ok(db.from("menu_sections").insert({ restaurant_id: RESTO, nom: "Plats d'essai", position: 1 }).select("id"), "section de menu"))[0];

  const plats = await ok(
    db
      .from("menu_items")
      .insert([
        { restaurant_id: RESTO, section_id: section.id, nom: "Riz sauce arachide", prix: 25000, disponible: true },
        { restaurant_id: RESTO, section_id: section.id, nom: "Poulet braisé", prix: 35000, prix_promo: 30000, disponible: true },
        { restaurant_id: RESTO, section_id: section.id, nom: "Jus de gingembre", prix: 5000, disponible: true },
        { restaurant_id: RESTO, section_id: section.id, nom: "Poisson grillé (indisponible)", prix: 40000, disponible: false },
      ])
      .select("id, nom"),
    "plats"
  );
  const plat = (debut) => plats.find((p) => p.nom.startsWith(debut));
  const supplements = await ok(
    db
      .from("menu_item_options")
      .insert([
        { menu_item_id: plat("Poulet").id, nom: "Piment", prix: 500, disponible: true },
        { menu_item_id: plat("Poulet").id, nom: "Frites", prix: 3000, disponible: true },
      ])
      .select("id, nom"),
    "suppléments"
  );
  const piment = supplements.find((s) => s.nom === "Piment");

  const jeton = () => randomBytes(30).toString("base64url"); // 40 caractères, comme les vrais jetons de suivi
  const reference = (n) => `SF-ESSA${n}`;
  const modeles = [
    { n: "1", statuts: ["en_attente", "acceptee", "prete", "terminee"], mode: "retrait", ilYaJours: 2, paiement: { statut: "recu", mode: "orange_money" }, lignes: [[plat("Riz"), 2, null], [plat("Poulet"), 1, piment], [plat("Poisson"), 1, null]], adresse: null, frais: 0 },
    { n: "2", statuts: ["en_attente", "acceptee"], mode: "livraison", ilYaJours: 0, paiement: { statut: "non_demande", mode: null }, lignes: [[plat("Jus"), 3, null]], adresse: "Kaloum, près du marché central (adresse d'essai)", frais: 3000 },
    { n: "3", statuts: ["en_attente", "refusee"], mode: "retrait", ilYaJours: 5, paiement: { statut: "non_demande", mode: null }, lignes: [[plat("Riz"), 1, null]], adresse: null, frais: 0 },
  ];
  for (const m of modeles) {
    const sousTotal = m.lignes.reduce((s, [p, q, o]) => s + q * ((p.nom.startsWith("Poulet") ? 30000 : p.nom.startsWith("Riz") ? 25000 : p.nom.startsWith("Jus") ? 5000 : 40000) + (o ? 500 : 0)), 0);
    const creee = (
      await ok(
        db
          .from("orders")
          .insert({
            reference: reference(m.n),
            jeton_suivi: jeton(),
            restaurant_id: RESTO,
            client_user_id: utilisateur.id,
            client_nom: "Client d'essai",
            client_telephone: "+224620000000",
            client_adresse: m.adresse,
            mode: m.mode,
            sous_total: sousTotal,
            frais_livraison_estime: m.frais,
            statut: "en_attente",
            est_test: true,
            paiement_statut: "non_demande",
          })
          .select("id"),
        "création d'une commande d'essai"
      )
    )[0];
    for (const [p, quantite, option] of m.lignes) {
      const ligne = (await ok(db.from("order_items").insert({ order_id: creee.id, menu_item_id: p.id, nom: p.nom, prix: p.nom.startsWith("Poulet") ? 30000 : p.nom.startsWith("Riz") ? 25000 : p.nom.startsWith("Jus") ? 5000 : 40000, quantite }).select("id"), "ligne de commande"))[0];
      if (option) await ok(db.from("order_item_options").insert({ order_item_id: ligne.id, option_id: option.id, nom: option.nom, prix: 500 }), "supplément de commande");
    }
    for (const statut of m.statuts.slice(1)) await ok(db.from("orders").update({ statut }).eq("id", creee.id), `passage à « ${statut} »`);
    const date = new Date(Date.now() - m.ilYaJours * 86_400_000).toISOString();
    await ok(db.from("orders").update({ cree_le: date, paiement_statut: m.paiement.statut, paiement_mode: m.paiement.mode }).eq("id", creee.id), "date et paiement");
  }

  console.log("Données d'essai créées pour ce compte :");
  console.log(`  - restaurant « ${NOM_RESTO} » (${publier ? "PUBLIÉ : visible du public, pensez à `nettoyer`" : "non publié"})`);
  console.log("  - 3 commandes d'essai : terminée (avec un plat devenu indisponible), en cours (livraison), refusée");
  console.log("À jouer : docs/PARCOURS-TEST-CLIENT.md. Pour tout effacer : node scripts/parcours-client-test.mjs nettoyer");
}

async function notifier(refCommande, statut) {
  if (!refCommande || !statut) echec("Usage : notifier <référence> <statut>");
  const cible = await ok(db.from("orders").select("id, restaurant_id").eq("reference", refCommande).eq("restaurant_id", RESTO).maybeSingle(), "lecture de la commande");
  if (!cible) echec("Commande d'essai introuvable (seules celles du restaurant d'essai sont acceptées).");

  // Copie des modules serveur dans un dossier temporaire (suffixes .ts, alias @/, sans « server-only »), comme les autres scripts d'essai.
  const tmp = mkdtempSync(join(tmpdir(), "speedfood-notif-"));
  const paquets = { "@supabase/supabase-js": import.meta.resolve("@supabase/supabase-js") };
  const copier = (rel) => {
    const dest = join(tmp, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(
      dest,
      readFileSync(join(racine, rel), "utf8")
        .replace(/import\s+"server-only";?/g, "")
        .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
        .replace(/from\s+"(@supabase\/supabase-js)"/g, (_, nom) => `from "${paquets[nom]}"`)
        .replace(/from\s+"@\/([^"]+?)(?<!\.ts)"/g, (_, chemin) => {
          const relatif = relative(dirname(dest), join(tmp, "src")).split("\\").join("/");
          return `from "${relatif.startsWith(".") ? relatif : "./" + relatif}/${chemin}.ts"`;
        })
    );
  };
  for (const f of ["src/lib/client/notifications.ts", "src/lib/client/notifications-regles.ts", "src/lib/push/envoi.ts", "src/lib/push/vapid.ts", "src/lib/db/admin.ts"]) copier(f);
  try {
    const { signalerChangementCommande } = await import(pathToFileURL(join(tmp, "src/lib/client/notifications.ts")).href);
    await signalerChangementCommande(cible.id, statut);
    const { data: lignes } = await db.from("client_notifications").select("type, lue_le").eq("order_id", cible.id);
    const { data: appareils } = await db.from("client_push_subscriptions").select("id").limit(10);
    console.log(`Notification « ${statut} » traitée pour ${refCommande}. Notifications de cette commande : ${(lignes ?? []).map((l) => `${l.type}${l.lue_le ? " (lue)" : ""}`).join(", ") || "aucune (préférence coupée, aucun appareil abonné, ou déjà envoyée)"}. Appareils abonnés au total : ${(appareils ?? []).length}.`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (commande === "notifier") await notifier(argument, options[0]);
else if (commande === "creer") await creer(argument, options.includes("--public") || argument === "--public");
else if (commande === "nettoyer") await nettoyer();
else echec("Usage : node scripts/parcours-client-test.mjs creer <e-mail> [--public]   |   nettoyer   |   notifier <référence> <statut>");
