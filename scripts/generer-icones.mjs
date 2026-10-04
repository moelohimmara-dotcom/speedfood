// Génère les icônes de l'application installable (lot B) dans public/icons, à partir du logo officiel
// `public/logo-speedfood.webp` (1024 x 1024, fond crème). On en extrait l'emblème (burger ailé et vapeur).
// Usage : node scripts/generer-icones.mjs   (utilise `sharp`, déjà présent via Next.js)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const LOGO = fileURLToPath(new URL("../public/logo-speedfood.webp", import.meta.url));
const SORTIE = fileURLToPath(new URL("../public/icons/", import.meta.url));
await mkdir(SORTIE, { recursive: true });

// Emblème seul (sans le texte du logo) : carré de 380 px centré sur le burger ailé, mesuré sur l'image source.
const EMBLEME = { left: 280, top: 235, width: 380, height: 380 };
const FOND = { r: 243, g: 242, b: 224, alpha: 1 }; // crème du logo

// `part` : fraction de l'icône occupée par ce carré (le reste est du fond crème).
// Maskable : Android applique son propre masque, donc l'emblème doit tenir dans les 80 % centraux.
const fichiers = [
  ["icon-192.png", 192, 0.94],
  ["icon-512.png", 512, 0.94],
  ["maskable-512.png", 512, 0.72],
  ["apple-touch-icon.png", 180, 0.84],
];

for (const [nom, taille, part] of fichiers) {
  const interieur = Math.round(taille * part);
  const marge = Math.floor((taille - interieur) / 2);
  const emb = await sharp(LOGO).extract(EMBLEME).resize(interieur, interieur).png().toBuffer();
  await sharp({ create: { width: taille, height: taille, channels: 4, background: FOND } })
    .composite([{ input: emb, left: marge, top: marge }])
    .png()
    .toFile(SORTIE + nom);
  console.log("ok", nom);
}

// Badge de notification Android : silhouette blanche sur fond transparent (Android la teinte).
// L'opacité vient de la « distance » au fond crème : plus un pixel est foncé, plus il est opaque.
{
  const { data, info } = await sharp(LOGO)
    .extract(EMBLEME)
    .resize(96, 96)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4, 255);
  for (let i = 0; i < data.length; i++) {
    rgba[i * 4 + 3] = Math.max(0, Math.min(255, (235 - data[i]) * 3));
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(SORTIE + "badge-96.png");
  console.log("ok badge-96.png");
}
