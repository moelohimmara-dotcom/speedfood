// Vignettes légères de la bibliothèque de photos de démonstration (voir packages/shared/src/menu/vignette-photo.ts), en deux temps séparés :
//   (sans option)  GÉNÉRATION : réduit chaque photo de la bibliothèque (JPEG de 720 px de large) dans le dossier de sortie et affiche les tailles. N'envoie RIEN, ne lit ni n'écrit la base.
//   --envoyer      ENVOI      : envoie les vignettes dans le bucket `medias` sous demo/vignettes/… (AJOUTE des fichiers, ne touche pas aux photos d'origine ; relance sans danger).
//   --reprise      (avec --envoyer) saute les vignettes déjà servies par le stockage : reprise après un refus de débit (429) sans tout renvoyer.
// Environnement pour --envoyer : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY (clé de service : jamais dans le dépôt ; `node --env-file=.env.local …`).
// Options : --racine-images <dossier contenant images-banques et images-ia>  --sortie <dossier>  --limite <n> (essai sur les n premières)
// Usage : node scripts/demo/vignettes-demonstration.mjs --racine-images ../../../speedfood
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { creerCopieur } from "../outils/copie-tmp.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : defaut;
};
const drapeau = (nom) => args.includes(nom);
const RACINE_IMAGES = option("--racine-images", join(racine, "..", "..", ".."));
const SORTIE = option("--sortie", mkdtempSync(join(tmpdir(), "vignettes-demo-")));
const LIMITE = Number(option("--limite", "0")) || 0;

const tmp = mkdtempSync(join(tmpdir(), "vignettes-demo-src-"));
const copier = creerCopieur({ tmp, racine, paquets: {} });
for (const f of ["photos", "types-plats", "plan-photos-demo", "bibliotheque-photos", "bibliotheque-banques-lot1", "bibliotheque-banques-lot2", "bibliotheque-banques-lot3", "bibliotheque-banques-lot4", "bibliotheque-banques-lot5", "bibliotheque-banques-pixabay", "bibliotheque-banques-pixabay-2", "bibliotheque-banques-pexels-6", "vignette-photo"]) {
  copier(`src/lib/menu/${f}.ts`);
}
const { cheminStockage } = await import(pathToFileURL(join(tmp, "src/lib/menu/plan-photos-demo.ts")).href);
const { BIBLIOTHEQUE_PHOTOS } = await import(pathToFileURL(join(tmp, "src/lib/menu/bibliotheque-photos.ts")).href);
const { cheminVignette, LARGEUR_VIGNETTE } = await import(pathToFileURL(join(tmp, "src/lib/menu/vignette-photo.ts")).href);

/** Dossier d'origine d'un fichier de la bibliothèque : images IA (lot2 à lot7) ou photos de banques (même règle que photos-demonstration.mjs). */
const cheminLocal = (fichier) => join(RACINE_IMAGES, /^lot[234567]\//.test(fichier) ? "images-ia" : "images-banques", fichier);

let fichiers = [...new Map(BIBLIOTHEQUE_PHOTOS.map((p) => [p.fichier, { fichier: p.fichier, chemin: cheminStockage(p.fichier) }])).values()].sort((a, b) => a.chemin.localeCompare(b.chemin));
const absents = fichiers.filter((f) => !existsSync(cheminLocal(f.fichier)));
if (absents.length) {
  console.error(`${absents.length} photo(s) introuvable(s) en local (${absents.slice(0, 5).map((a) => a.fichier).join(", ")}…) : arrêt.`);
  process.exit(1);
}
if (LIMITE) fichiers = fichiers.slice(0, LIMITE);

// Génération : 4 réductions à la fois ; fond blanc pour les PNG détourés (JPEG sans transparence).
const resultats = [];
const file = [...fichiers];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let f = file.shift(); f; f = file.shift()) {
    const cible = cheminVignette(f.chemin);
    if (!cible) throw new Error(`Chemin hors demo/photos/ : ${f.chemin}`);
    const buffer = await sharp(cheminLocal(f.fichier)).rotate().resize({ width: LARGEUR_VIGNETTE, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    const sortie = join(SORTIE, cible);
    mkdirSync(dirname(sortie), { recursive: true });
    writeFileSync(sortie, buffer);
    resultats.push({ cible, octets: buffer.length, origine: statSync(cheminLocal(f.fichier)).size });
  }
}));
const total = resultats.reduce((t, r) => t + r.octets, 0);
const totalOrigine = resultats.reduce((t, r) => t + r.origine, 0);
const tailles = resultats.map((r) => r.octets).sort((a, b) => a - b);
const plus = resultats.reduce((a, b) => (b.octets > a.octets ? b : a));
console.log(`Vignettes générées : ${resultats.length} fichiers dans ${SORTIE}`);
console.log(`Originaux : ${(totalOrigine / 1048576).toFixed(0)} Mo. Vignettes : ${(total / 1048576).toFixed(1)} Mo (médiane ${Math.round(tailles[Math.floor(tailles.length / 2)] / 1024)} Ko, maximum ${Math.round(plus.octets / 1024)} Ko : ${plus.cible}).`);

if (!drapeau("--envoyer")) {
  console.log("Génération seule : ajouter --envoyer pour envoyer ces vignettes dans le bucket medias.");
  process.exit(0);
}

const URL_SUPABASE = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL_SUPABASE || !CLE) {
  console.error("Définir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement (jamais dans le dépôt).");
  process.exit(1);
}
const enTetes = { apikey: CLE, Authorization: `Bearer ${CLE}` };
let ok = 0;
let saute = 0;
let echec = null;
const aEnvoyer = resultats.map((r) => r.cible).sort();
const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chemin = (cible) => cible.split("/").map(encodeURIComponent).join("/");
// Un appel réseau : une coupure de connexion (exception), un refus de débit (429) ou une panne passagère (5xx) sont retentés après une pause croissante, 6 essais au plus.
async function appeler(url, init) {
  let r = null;
  for (let essai = 0; essai < 6; essai++) {
    try {
      r = await fetch(url, init);
      if (r.ok || (r.status !== 429 && r.status < 500)) return r;
    } catch {
      r = null;
    }
    await attendre(2000 * (essai + 1));
  }
  return r;
}
// 3 envois à la fois.
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let cible = aEnvoyer.shift(); cible && !echec; cible = aEnvoyer.shift()) {
    if (drapeau("--reprise")) {
      const deja = await appeler(`${URL_SUPABASE}/storage/v1/object/public/medias/${chemin(cible)}`, { method: "HEAD" });
      if (deja?.ok) { saute++; continue; }
    }
    const r = await appeler(`${URL_SUPABASE}/storage/v1/object/medias/${chemin(cible)}`, {
      method: "POST",
      headers: { ...enTetes, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "31536000" },
      body: readFileSync(join(SORTIE, cible)),
    });
    if (!r?.ok) echec = `Envoi refusé (${r ? r.status : "connexion coupée"}) pour ${cible}`;
    else ok++;
  }
}));
if (echec) {
  console.error(`${echec} : ${ok} vignettes envoyées avant l'arrêt.`);
  process.exit(1);
}
console.log(`Envoi terminé : ${ok} vignettes envoyées${saute ? `, ${saute} déjà présentes (sautées)` : ""}, dans le bucket medias (demo/vignettes/…).`);
