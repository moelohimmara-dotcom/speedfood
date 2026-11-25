// Rattache les photos de la bibliothèque aux plats du lot de démonstration (menu_items.photo_url), en trois temps séparés :
//   (sans option)  PLAN      : lit le lot, calcule quelle photo va sur quel plat, écrit plan.json et credits.json. Ne modifie RIEN.
//   --envoyer      ENVOI     : envoie dans le bucket `medias` (demo/photos/…) les fichiers du plan. Écrit dans le stockage.
//   --appliquer    ÉCRITURE  : renseigne photo_url des plats du lot qui n'en ont pas encore. Écrit dans la base.
//   --retirer      RETOUR    : remet à vide les photo_url du lot qui pointent vers demo/photos/ (retour arrière).
//   --sans-cc      FILTRE    : (avec le plan ou --appliquer) écarte les photos CC BY / CC BY-SA, qui exigent un crédit public, tant que la page de crédits n'est pas en ligne.
//   --bibliotheque ENVOI COMPLET : avec --envoyer, envoie TOUTES les photos de la bibliothèque (pas seulement celles du plan) ; sans --envoyer,
//                  affiche seulement le décompte (fichiers, taille, fichiers manquants). Ne lit pas la base.
// Environnement : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY (clé de service : à ne jamais enregistrer dans le dépôt ;
// on peut les charger avec `node --env-file=.env.local …` sans les afficher).
// Options : --lot presentation-2026-11  --racine-images <dossier contenant images-banques et images-ia>  --sortie <dossier>
// Jamais d'écrasement : un plat qui a déjà sa propre photo n'est pas touché. Usage :
//   node scripts/demo/photos-demonstration.mjs --racine-images ../../../speedfood
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { creerCopieur } from "../outils/copie-tmp.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : defaut;
};
const drapeau = (nom) => args.includes(nom);

const LOT = option("--lot", "presentation-2026-11");
const RACINE_IMAGES = option("--racine-images", join(racine, "..", "..", ".."));
const SORTIE = option("--sortie", mkdtempSync(join(tmpdir(), "photos-demo-")));
const URL_SUPABASE = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL_SUPABASE || !CLE) {
  console.error("Définir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement (jamais dans le dépôt).");
  process.exit(1);
}
const enTetes = { apikey: CLE, Authorization: `Bearer ${CLE}` };
const BASE_PUBLIQUE = `${URL_SUPABASE}/storage/v1/object/public/medias`;

// Charge le module pur du plan avec ses dépendances (copie temporaire, imports réécrits pour Node).
const tmp = mkdtempSync(join(tmpdir(), "photos-demo-src-"));
const copier = creerCopieur({ tmp, racine, paquets: {} });
for (const f of ["photos", "types-plats", "plan-photos-demo", "bibliotheque-photos", "bibliotheque-banques-lot1", "bibliotheque-banques-lot2", "bibliotheque-banques-lot3", "bibliotheque-banques-lot4", "bibliotheque-banques-lot5", "bibliotheque-banques-pixabay", "bibliotheque-banques-pixabay-2", "bibliotheque-banques-pexels-6"]) {
  copier(`src/lib/menu/${f}.ts`);
}
const { planifierPhotosDemo, creditObligatoire, cheminStockage, DOSSIER_STOCKAGE_DEMO } = await import(pathToFileURL(join(tmp, "src/lib/menu/plan-photos-demo.ts")).href);
const { BIBLIOTHEQUE_PHOTOS } = await import(pathToFileURL(join(tmp, "src/lib/menu/bibliotheque-photos.ts")).href);

async function lire(chemin) {
  const lignes = [];
  for (let debut = 0; ; debut += 1000) {
    const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, { headers: { ...enTetes, Range: `${debut}-${debut + 999}`, "Range-Unit": "items" } });
    if (!r.ok) throw new Error(`Lecture refusée (${r.status}) : ${chemin.split("?")[0]}`);
    const page = await r.json();
    lignes.push(...page);
    if (page.length < 1000) return lignes;
  }
}

/** Dossier d'origine d'un fichier de la bibliothèque : images IA (lot2, lot3, lot4) ou photos de banques. */
function cheminLocal(fichier) {
  const dossier = /^lot[2345]\//.test(fichier) ? "images-ia" : "images-banques";
  return join(RACINE_IMAGES, dossier, fichier);
}

const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Envoie les fichiers dans le bucket `medias` (remplace un fichier déjà présent au même chemin : relance sans danger), 6 à la fois. S'arrête au premier refus. */
async function envoyerFichiers(fichiers) {
  let ok = 0;
  let echec = null;
  const file = [...fichiers];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let f = file.shift(); f && !echec; f = file.shift()) {
        const r = await fetch(`${URL_SUPABASE}/storage/v1/object/medias/${f.chemin.split("/").map(encodeURIComponent).join("/")}`, {
          method: "POST",
          headers: { ...enTetes, "Content-Type": TYPES[extname(f.fichier).toLowerCase()] ?? "application/octet-stream", "x-upsert": "true", "cache-control": "31536000" },
          body: readFileSync(cheminLocal(f.fichier)),
        });
        if (!r.ok) echec = `Envoi refusé (${r.status}) pour ${f.chemin}`;
        else ok++;
      }
    }),
  );
  if (echec) {
    console.error(`${echec} — ${ok} fichiers envoyés avant l'arrêt.`);
    process.exit(1);
  }
  return ok;
}

// Envoi complet : toute la bibliothèque, sans lire la base (les menus de démonstration changent à chaque rechargement du lot).
if (drapeau("--bibliotheque")) {
  const fichiers = [...new Map(BIBLIOTHEQUE_PHOTOS.map((p) => [p.fichier, { fichier: p.fichier, chemin: cheminStockage(p.fichier) }])).values()].sort((a, b) => a.chemin.localeCompare(b.chemin));
  const absents = fichiers.filter((f) => !existsSync(cheminLocal(f.fichier)));
  const octets = fichiers.filter((f) => existsSync(cheminLocal(f.fichier))).reduce((t, f) => t + statSync(cheminLocal(f.fichier)).size, 0);
  console.log(`Bibliothèque : ${fichiers.length} fichiers, ${(octets / 1048576).toFixed(0)} Mo, ${absents.length} introuvables en local${absents.length ? " (" + absents.slice(0, 5).map((a) => a.fichier).join(", ") + "…)" : ""}.`);
  if (!drapeau("--envoyer")) {
    console.log("Décompte seul : ajouter --envoyer pour envoyer ces fichiers dans le bucket medias.");
  } else if (absents.length) {
    console.error("Envoi annulé : des fichiers de la bibliothèque manquent en local.");
    process.exit(1);
  } else {
    const ok = await envoyerFichiers(fichiers);
    console.log(`Envoi terminé : ${ok} fichiers dans le bucket medias (${DOSSIER_STOCKAGE_DEMO}/…).`);
  }
  process.exit(0);
}

const restaurants = await lire(`restaurants?demo_lot=eq.${encodeURIComponent(LOT)}&select=id,nom`);
if (restaurants.length === 0) {
  console.error(`Aucun restaurant dans le lot « ${LOT} » : rien à faire.`);
  process.exit(1);
}
const ids = restaurants.map((r) => r.id);
const plats = [];
for (let i = 0; i < ids.length; i += 20) {
  plats.push(...(await lire(`menu_items?restaurant_id=in.(${ids.slice(i, i + 20).join(",")})&archive_le=is.null&select=id,restaurant_id,nom,photo_url,cree_le&order=cree_le.asc,nom.asc`)));
}
const parResto = new Map(ids.map((id) => [id, []]));
for (const p of plats) if (!p.photo_url) parResto.get(p.restaurant_id)?.push({ id: p.id, nom: p.nom });
// --sans-cc : écarte les photos qui exigent un crédit (CC BY, CC BY-SA) tant que la page de crédits n'est pas en ligne ; d'autres photos les remplacent.
const bibliotheque = drapeau("--sans-cc") ? BIBLIOTHEQUE_PHOTOS.filter((p) => !(p.source === "banque" && creditObligatoire(p.licence))) : BIBLIOTHEQUE_PHOTOS;
const plan = planifierPhotosDemo([...parResto].map(([id, ps]) => ({ id, plats: ps })), bibliotheque, BASE_PUBLIQUE);

mkdirSync(SORTIE, { recursive: true });
writeFileSync(join(SORTIE, "plan.json"), JSON.stringify(plan, null, 1));
writeFileSync(join(SORTIE, "credits.json"), JSON.stringify(plan.credits, null, 1));
const manquants = plan.fichiers.filter((f) => !existsSync(cheminLocal(f.fichier)));
const s = plan.statistiques;
console.log(`Lot ${LOT} : ${restaurants.length} restaurants, ${plats.length} plats (${s.plats} sans photo propre).`);
console.log(`Plan : ${s.avecPhoto} plats avec photo (${s.parSource.banque} banques, ${s.parSource.ia} IA), ${s.sansPhoto} sans photo, ${plan.fichiers.length} fichiers à héberger.`);
console.log(`Crédits : ${plan.credits.length} photos, dont ${plan.credits.filter((c) => c.obligatoire).length} à créditer obligatoirement (CC BY, CC BY-SA).`);
console.log(`Fichiers du plan introuvables en local : ${manquants.length}${manquants.length ? " (" + manquants.slice(0, 5).map((m) => m.fichier).join(", ") + "…)" : ""}`);
console.log(`Écrit dans ${SORTIE} : plan.json, credits.json`);

if (drapeau("--envoyer")) {
  if (manquants.length) {
    console.error("Envoi annulé : des fichiers du plan manquent en local.");
    process.exit(1);
  }
  const ok = await envoyerFichiers(plan.fichiers);
  console.log(`Envoi terminé : ${ok} fichiers dans le bucket medias (${DOSSIER_STOCKAGE_DEMO}/…).`);
}

async function modifier(platId, photoUrl, garde) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/menu_items?id=eq.${platId}&${garde}`, {
    method: "PATCH",
    headers: { ...enTetes, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ photo_url: photoUrl }),
  });
  if (!r.ok) throw new Error(`Écriture refusée (${r.status}) pour le plat ${platId}`);
}

async function enParallele(taches, nb = 8) {
  const file = [...taches];
  await Promise.all(Array.from({ length: nb }, async () => { for (let t = file.shift(); t; t = file.shift()) await t(); }));
}

if (drapeau("--appliquer")) {
  // Garde : seulement les plats qui n'ont pas de photo (jamais d'écrasement d'une photo propre au restaurant).
  await enParallele(plan.lignes.map((l) => () => modifier(l.platId, l.url, "photo_url=is.null")));
  console.log(`Écriture terminée : ${plan.lignes.length} plats mis à jour.`);
}

if (drapeau("--retirer")) {
  const motif = `${BASE_PUBLIQUE}/${DOSSIER_STOCKAGE_DEMO}/`;
  const aRetirer = plats.filter((p) => p.photo_url && p.photo_url.startsWith(motif));
  await enParallele(aRetirer.map((p) => () => modifier(p.id, null, `photo_url=like.${encodeURIComponent(motif)}*`)));
  console.log(`Retour arrière terminé : ${aRetirer.length} plats remis sans photo.`);
}
