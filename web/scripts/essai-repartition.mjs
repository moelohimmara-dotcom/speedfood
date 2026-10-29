// Essai sur la VRAIE base du poste de répartition (ADR-020) : lectures des commandes des établissements tenus par l'équipe.
//
// Prouve ce que les tests unitaires ne prouvent pas : que les lectures imbriquées (commande → établissement → mode de vente, lignes de commande,
// contact interne) fonctionnent contre la vraie base, que seuls les établissements en mode « speedfood » apparaissent, et que les compteurs du tableau de bord
// sont justes. Crée ses propres données d'essai (marquées « ESSAI », commandes `est_test`) et les SUPPRIME à la fin, même en cas d'échec. Aucun secret affiché.
//
// Usage : node scripts/essai-repartition.mjs
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichierEnv = join(racine, ".env.local");
if (existsSync(fichierEnv)) {
  for (const ligne of readFileSync(fichierEnv, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const tmp = mkdtempSync(join(tmpdir(), "speedfood-repartition-"));
const paquets = { "@supabase/supabase-js": import.meta.resolve("@supabase/supabase-js") };
function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  const contenu = readFileSync(join(racine, rel), "utf8")
    .replace(/import\s+"server-only";?/g, "")
    .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
    .replace(/from\s+"(@supabase\/supabase-js)"/g, (_, nom) => `from "${paquets[nom]}"`)
    .replace(/from\s+"@\/([^"]+?)(?<!\.ts)"/g, (_, chemin) => {
      const relatif = relative(dirname(dest), join(tmp, "src")).split("\\").join("/");
      return `from "${relatif.startsWith(".") ? relatif : "./" + relatif}/${chemin}.ts"`;
    });
  writeFileSync(dest, contenu);
}
for (const f of ["src/lib/system-admin/repartition-lecture.ts", "src/lib/commande/commun.ts", "src/lib/contracts/erreurs.ts", "src/lib/contracts/statuts.ts", "src/lib/contracts/commande.ts", "src/lib/db/admin.ts"]) copier(f);

let ko = 0;
function verifier(nom, ok, detail = "") {
  if (!ok) ko++;
  console.log(`${ok ? "OK   " : "ECHEC"} ${nom}${!ok && detail ? "\n       " + detail : ""}`);
}

const idsRestos = [];
try {
  const importer = (rel) => import(pathToFileURL(join(tmp, rel)).href);
  const { creerClientAdmin } = await importer("src/lib/db/admin.ts");
  const { listerCommandesARepartir, compterCommandesAConfirmer, compterSansTelephoneCommandes } = await importer("src/lib/system-admin/repartition-lecture.ts");
  const db = creerClientAdmin();

  const avant = { aConfirmer: await compterCommandesAConfirmer(), sansTel: await compterSansTelephoneCommandes() };

  const { data: cat } = await db.from("menu_categories").select("id").order("ordre").limit(1).maybeSingle();
  const { data: quartier } = await db.from("neighborhoods").select("id").eq("actif", true).limit(1).maybeSingle();
  if (!cat || !quartier) throw new Error("Catégorie ou quartier introuvable pour l'essai.");

  const creerResto = async (nom, mode) => {
    const { data, error } = await db.from("restaurants").insert({ nom, categorie_id: cat.id, quartier_id: quartier.id, mode_vente: mode, publie: false, donnees_demo: false }).select("id").single();
    if (error || !data) throw new Error(`Création de ${nom} impossible : ${error?.code}`);
    idsRestos.push(data.id);
    return data.id;
  };
  const restoEquipe = await creerResto("ESSAI Répartition (équipe)", "speedfood");
  const restoAutonome = await creerResto("ESSAI Répartition (autonome)", "autonome");

  const creerCommande = async (restaurantId, statut) => {
    const reference = `ES-${randomBytes(3).toString("hex").toUpperCase()}`;
    const { data, error } = await db
      .from("orders")
      .insert({ reference, jeton_suivi: randomBytes(24).toString("hex"), restaurant_id: restaurantId, client_nom: "Essai", client_telephone: "+224622000000", mode: "retrait", sous_total: 35000, statut, est_test: true })
      .select("id, reference")
      .single();
    if (error || !data) throw new Error(`Création de commande impossible : ${error?.code} ${error?.message}`);
    await db.from("order_items").insert({ order_id: data.id, nom: "Plat d'essai", prix: 35000, quantite: 1 });
    return data;
  };
  const cEquipe = await creerCommande(restoEquipe, "en_attente");
  const cEquipePrete = await creerCommande(restoEquipe, "en_attente");
  await db.from("orders").update({ statut: "acceptee" }).eq("id", cEquipePrete.id);
  const cAutonome = await creerCommande(restoAutonome, "en_attente");
  const cTerminee = await creerCommande(restoEquipe, "en_attente");
  await db.from("orders").update({ statut: "refusee" }).eq("id", cTerminee.id);

  const liste = await listerCommandesARepartir();
  const refs = new Set(liste.map((c) => c.reference));
  verifier("une commande en attente d'un établissement tenu par l'équipe apparaît", refs.has(cEquipe.reference));
  verifier("une commande confirmée du même établissement apparaît aussi", refs.has(cEquipePrete.reference));
  verifier("une commande d'un établissement AUTONOME n'apparaît jamais", !refs.has(cAutonome.reference));
  verifier("une commande refusée (terminée) n'apparaît plus", !refs.has(cTerminee.reference));
  const ligne = liste.find((c) => c.reference === cEquipe.reference);
  verifier("la lecture imbriquée rend le nom de l'établissement, les lignes et le montant", ligne?.restaurantNom === "ESSAI Répartition (équipe)" && ligne.lignes.length === 1 && ligne.lignes[0].nom === "Plat d'essai" && ligne.sousTotal === 35000 && ligne.estTest === true, JSON.stringify(ligne));
  verifier("sans contact interne, le numéro à joindre est absent", ligne?.telephoneRestaurant === null);

  const aConfirmer = await compterCommandesAConfirmer();
  verifier("le compteur « à confirmer » compte la commande en attente de l'équipe (et pas celle de l'établissement autonome)", aConfirmer === avant.aConfirmer + 1, `avant ${avant.aConfirmer}, après ${aConfirmer}`);
  const sansTel = await compterSansTelephoneCommandes();
  verifier("l'établissement tenu par l'équipe sans numéro est signalé", sansTel === avant.sansTel + 1, `avant ${avant.sansTel}, après ${sansTel}`);

  await db.from("restaurant_contacts_internes").upsert({ restaurant_id: restoEquipe, telephone_commandes: "+224622000000" });
  const apres = await listerCommandesARepartir();
  verifier("avec un contact interne, le numéro est rendu à l'équipe", apres.find((c) => c.reference === cEquipe.reference)?.telephoneRestaurant === "+224622000000");
  verifier("avec un contact interne, l'établissement n'est plus signalé", (await compterSansTelephoneCommandes()) === avant.sansTel);
} catch (e) {
  ko++;
  console.log(`ECHEC essai interrompu : ${e instanceof Error ? e.message : e}`);
} finally {
  // Nettoyage : les commandes d'essai (suppression en cascade avec l'établissement), puis les établissements d'essai.
  try {
    const { creerClientAdmin } = await import(pathToFileURL(join(tmp, "src/lib/db/admin.ts")).href);
    const db = creerClientAdmin();
    if (idsRestos.length > 0) {
      await db.from("orders").delete().in("restaurant_id", idsRestos);
      await db.from("restaurants").delete().in("id", idsRestos);
    }
    const { count } = await db.from("restaurants").select("id", { count: "exact", head: true }).like("nom", "ESSAI Répartition%");
    verifier("nettoyage : plus aucun établissement d'essai", (count ?? 0) === 0, String(count));
  } catch (e) {
    ko++;
    console.log(`ECHEC nettoyage : ${e instanceof Error ? e.message : e}`);
  }
  rmSync(tmp, { recursive: true, force: true });
}
console.log(ko === 0 ? "\nPoste de répartition vérifié sur la vraie base." : `\n${ko} échec(s).`);
process.exit(ko === 0 ? 0 : 1);
