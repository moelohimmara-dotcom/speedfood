// Extrait du catalogue d'icônes libres les seuls motifs de restauration utilisés par Speedfood et écrit
// src/lib/illustrations/icones.generated.ts. Les icônes sont figées dans le dépôt : rien n'est chargé depuis Internet
// à l'exécution, et aucun SVG fourni par un utilisateur n'est jamais accepté (voir docs/specs/2026-10-04-...).
//
// Sources (licence MIT, mention dans docs/LICENCES-ICONES.md) :
//   Fluent Emoji Flat, Microsoft  : https://github.com/microsoft/fluentui-emoji
//   Tabler Icons, Paweł Kuna      : https://github.com/tabler/tabler-icons
// Usage : dans un dossier temporaire, `npm i @iconify-json/fluent-emoji-flat @iconify-json/tabler`, puis
//   node scripts/illustrations/extraire-icones.mjs <dossier-contenant-node_modules>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2];
if (!base) {
  console.error("Indiquez le dossier qui contient node_modules.");
  process.exit(1);
}
const lire = (p) => JSON.parse(fs.readFileSync(path.join(base, "node_modules/@iconify-json", p, "icons.json"), "utf8"));
const fluent = lire("fluent-emoji-flat");
const tabler = lire("tabler");

/** Identifiant Speedfood (français) -> [bibliothèque, nom de l'icône]. */
const MOTIFS = {
  "riz-blanc": ["f", "cooked-rice"], "riz-sauce": ["f", "curry-rice"], sauce: ["f", "pot-of-food"], ragout: ["f", "shallow-pan-of-food"],
  poulet: ["f", "poultry-leg"], viande: ["f", "meat-on-bone"], boeuf: ["f", "cut-of-meat"], brochettes: ["f", "oden"],
  poisson: ["f", "fish"], "poisson-tropical": ["f", "tropical-fish"], crevette: ["f", "fried-shrimp"], crabe: ["f", "crab"],
  burger: ["f", "hamburger"], frites: ["f", "french-fries"], sandwich: ["f", "sandwich"], shawarma: ["f", "stuffed-flatbread"],
  galette: ["f", "flatbread"], pizza: ["f", "pizza"], salade: ["f", "green-salad"], oeuf: ["f", "egg"], soupe: ["f", "steaming-bowl"],
  bol: ["f", "bowl-with-spoon"], emporter: ["f", "takeout-box"], couvert: ["f", "fork-and-knife-with-plate"],
  cafe: ["f", "hot-beverage"], the: ["f", "teapot"], "the-glace": ["f", "bubble-tea"], jus: ["f", "cup-with-straw"],
  boisson: ["f", "beverage-box"], cocktail: ["f", "tropical-drink"], croissant: ["f", "croissant"], pain: ["f", "baguette-bread"],
  patisserie: ["f", "cupcake"], tarte: ["f", "pie"], gateau: ["f", "shortcake"], glace: ["f", "ice-cream"],
  banane: ["f", "banana"], coco: ["f", "coconut"], mangue: ["f", "mango"], ananas: ["f", "pineapple"], piment: ["f", "hot-pepper"],
  "pomme-de-terre": ["f", "potato"], mais: ["f", "ear-of-corn"], arachide: ["f", "peanuts"], "patate-douce": ["f", "roasted-sweet-potato"],
  // traits monochromes (couleur = couleur du texte), pour les pastilles et les logos
  "trait-grill": ["t", "grill"], "trait-toque": ["t", "chef-hat"], "trait-livraison": ["t", "bike"], "trait-baguettes": ["t", "bowl-chopsticks"],
  "trait-pain": ["t", "bread"], "trait-cafe": ["t", "coffee"], "trait-poisson": ["t", "fish"], "trait-burger": ["t", "burger"],
};

const sortie = {};
const manquants = [];
for (const [id, [lib, nom]] of Object.entries(MOTIFS)) {
  const jeu = lib === "f" ? fluent : tabler;
  const icone = jeu.icons[nom];
  if (!icone) {
    manquants.push(`${id} (${nom})`);
    continue;
  }
  // Garde-fous : ces icônes sont des données de confiance figées, mais on refuse tout ce qui pourrait exécuter du code.
  if (/<script|foreignObject|\son[a-z]+\s*=|javascript:|<image|href=/i.test(icone.body)) {
    throw new Error(`Icône refusée (contenu actif) : ${nom}`);
  }
  sortie[id] = { v: jeu.width ?? 32, t: lib === "t", c: icone.body };
}
if (manquants.length) {
  console.error("Icônes introuvables :", manquants.join(", "));
  process.exit(1);
}

const ici = path.dirname(fileURLToPath(import.meta.url));
const cible = path.join(ici, "..", "..", "src", "lib", "illustrations", "icones.generated.ts");
const entete = `// FICHIER GÉNÉRÉ par scripts/illustrations/extraire-icones.mjs : ne pas modifier à la main.
// Icônes : Fluent Emoji Flat (Microsoft, MIT) et Tabler Icons (MIT). Voir docs/LICENCES-ICONES.md.
// v = côté de la grille de dessin, t = trait monochrome (hérite de la couleur du texte), c = corps du dessin.
`;
fs.writeFileSync(
  cible,
  `${entete}export const ICONES: Record<string, { v: number; t: boolean; c: string }> = ${JSON.stringify(sortie, null, 1)};\n\nexport type MotifIcone = keyof typeof ICONES;\n`,
);
console.log(`${Object.keys(sortie).length} motifs écrits dans ${path.relative(process.cwd(), cible)}`);
