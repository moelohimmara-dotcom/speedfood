// Génère les icônes de l'application installable (lot B) dans public/icons.
// Usage : node scripts/generer-icones.mjs   (utilise `sharp`, déjà présent via Next.js)
// Le motif est un éclair (vitesse) blanc sur le dégradé de marque ; couleurs = tokens de DESIGN-SYSTEM.md.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SORTIE = new URL("../public/icons/", import.meta.url);
await mkdir(SORTIE, { recursive: true });

// Éclair dessiné dans une boîte de 100 x 100, centré.
const ECLAIR = "M58 6 L22 56 H44 L36 94 L78 40 H55 Z";

// `marge` : part du côté laissée vide autour de l'éclair (la zone sûre « maskable » exige ~20 %).
function icone({ taille, arrondi, marge, fond }) {
  const echelle = (taille * (1 - 2 * marge)) / 100;
  const decalage = taille * marge;
  const fondSvg = fond
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#d4430f"/><stop offset="0.7" stop-color="#b82a20"/></linearGradient></defs>
       <rect width="${taille}" height="${taille}" rx="${arrondi}" fill="url(#g)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
    ${fondSvg}
    <path d="${ECLAIR}" fill="#ffffff" transform="translate(${decalage} ${decalage}) scale(${echelle})"/>
  </svg>`;
}

const fichiers = [
  // Icône standard (coins arrondis intégrés).
  ["icon-192.png", { taille: 192, arrondi: 40, marge: 0.2, fond: true }],
  ["icon-512.png", { taille: 512, arrondi: 108, marge: 0.2, fond: true }],
  // Maskable : plein cadre, Android applique son propre masque (cercle, carré arrondi...).
  ["maskable-512.png", { taille: 512, arrondi: 0, marge: 0.28, fond: true }],
  // iOS : plein cadre, iOS arrondit lui-même.
  ["apple-touch-icon.png", { taille: 180, arrondi: 0, marge: 0.22, fond: true }],
  // Badge de notification Android : blanc sur transparent (Android le teinte).
  ["badge-96.png", { taille: 96, arrondi: 0, marge: 0.1, fond: false }],
];

for (const [nom, options] of fichiers) {
  await sharp(Buffer.from(icone(options))).png().toFile(new URL(nom, SORTIE).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  console.log("ok", nom);
}
