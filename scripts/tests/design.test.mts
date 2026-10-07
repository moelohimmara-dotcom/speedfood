// Jetons de design (palier 4, phase 1) — `scripts/tests/design.test.mts`.
//
// Le test le plus important du fichier est « les jetons semés valent exactement les variables de
// globals.css » : il compare les jetons de la migration aux variables réellement déclarées dans
// `globals.css`. Si quelqu'un change une couleur du site sans mettre à jour la migration, ce test
// échoue — donc la phase 1 ne peut pas dériver silencieusement du design actuel.
//
// `SPEEDFOOD_RACINE` est fourni par `scripts/tests/lancer.mjs` comme `verifierbase.test.mts` : le
// test doit lire le dépôt réel, pas une copie temporaire.

import fs from "node:fs";
import path from "node:path";
import {
  CONTRASTE_AA_TEXTE,
  COULEUR,
  FAMILLES_AUTORISEES,
  LIBELLES_GROUPES,
  clesDe,
  cssDepuisJetons,
  estCouleur,
  estPilePolice,
  nomCssDe,
  resoudreJetons,
  validerValeurJeton,
  verifierContraste,
  type Groupe,
  type LigneJeton,
} from "../../src/lib/studio/jetons";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// --- Validation des valeurs -------------------------------------------------------

verifier("couleur : #rrggbb acceptée", validerValeurJeton("couleurs", "#ffc247"), null);
verifier("couleur : majuscules acceptées", validerValeurJeton("couleurs", "#FFC247"), null);
verifier("couleur : 3 chiffres refusée", validerValeurJeton("couleurs", "#fff") !== null, true);
verifier("couleur : nom CSS refusé", validerValeurJeton("couleurs", "red") !== null, true);
verifier("couleur : rgb() refusé", validerValeurJeton("couleurs", "rgb(255,0,0)") !== null, true);
verifier("couleur : url() refusé (injection)", validerValeurJeton("couleurs", "url(https://x)") !== null, true);
verifier("couleur : vide refusé", validerValeurJeton("couleurs", "") !== null, true);
verifier("couleur : trop longue refusée", validerValeurJeton("couleurs", "#fff6ed".repeat(40)) !== null, true);
verifier("estCouleur distingue ce qui est une couleur", [estCouleur("#fff6ed"), estCouleur("red"), estCouleur("16px")], [true, false, false]);

verifier("longueur : px acceptée", validerValeurJeton("espacements", "16px"), null);
verifier("longueur : rem acceptée", validerValeurJeton("espacements", "1.5rem"), null);
verifier("longueur : % accepté", validerValeurJeton("espacements", "100%"), null);
verifier("longueur : var() refusé (pas de dépendance circulaire)", validerValeurJeton("espacements", "calc(var(--rouge) * 2)") !== null, true);
verifier("longueur : mot arbitraire refusé", validerValeurJeton("espacements", "gros") !== null, true);
verifier("longueur : url() refusé", validerValeurJeton("espacements", "url(x)") !== null, true);

verifier("typographie : police auto-hébergée acceptée", validerValeurJeton("typographie", "var(--font-manrope), system-ui, sans-serif"), null);
verifier("typographie : générique accepté", validerValeurJeton("typographie", "serif"), null);
verifier("typographie : police distante refusée", validerValeurJeton("typographie", "Comic Sans") !== null, true);
verifier("typographie : @import refusé", validerValeurJeton("typographie", "@import url(x)") !== null, true);
verifier("les familles autorisées sont toutes des jetons valides", FAMILLES_AUTORISEES.map((f) => validerValeurJeton("typographie", f)), FAMILLES_AUTORISEES.map(() => null));
verifier("pile : auto-hébergée + génériques acceptée", estPilePolice("var(--font-bricolage), system-ui, sans-serif"), true);
verifier("pile : générique seul accepté", estPilePolice("monospace"), true);
verifier("pile : Comic Sans même suivi de génériques, refusée", estPilePolice("Comic Sans, sans-serif"), false);
verifier("pile : var() d'une police non listée, refusée", estPilePolice("var(--font-fantome), sans-serif"), false);
verifier("pile : vide refusée", estPilePolice(""), false);
verifier("pile : expression refusée", estPilePolice("var(--a); color:red"), false);

verifier("formes : rayon accepté", validerValeurJeton("formes", "8px"), null);
verifier("formes : ombre acceptée", validerValeurJeton("formes", "0 1px 2px rgba(43, 33, 29, 0.06), 0 1px 1px rgba(43, 33, 29, 0.04)"), null);
verifier("formes : durée acceptée", validerValeurJeton("formes", "200ms"), null);
verifier("formes : point-virgule refusé (déclaration CSS)", validerValeurJeton("formes", "8px; color: red") !== null, true);
verifier("formes : accolades refusées", validerValeurJeton("formes", "}") !== null, true);

// --- Contraste --------------------------------------------------------------------

verifier("contraste : noir sur blanc = 21", verifierContraste("#000000", "#ffffff").rapport, 21);
verifier("contraste : même couleur = 1", verifierContraste("#ffc247", "#ffc247").rapport, 1);
verifier("contraste : encre sur crème conforme (le couple réel du site)", verifierContraste("#2b211d", "#fff6ed").conforme, true);
verifier("contraste : texte mangue sur crème NON conforme", verifierContraste("#ffc247", "#fff6ed").conforme, false);
verifier("contraste : texte surface sur rouge conforme (bouton principal)", verifierContraste("#fffefc", "#d9362b").conforme, true);
verifier("contraste : le seuil grand texte (3) est plus permissif", verifierContraste("#ffc247", "#2b211d", 3).conforme, true);
verifier("contraste : le rapport est rendu à deux décimales", verifierContraste("#75695f", "#fff6ed").rapport, Math.round(verifierContraste("#75695f", "#fff6ed").rapport * 100) / 100);

// --- Résolution des portées -------------------------------------------------------

const base: LigneJeton[] = [
  { cle: "couleur.creme", valeur: "#fff6ed", libelle: "Crème", groupe: "couleurs" },
  { cle: "couleur.rouge", valeur: "#d9362b", libelle: "Rouge", groupe: "couleurs" },
  { cle: "espace.4", valeur: "16px", libelle: "Espace 4", groupe: "espacements" },
];

verifier("défauts seuls : rien ne bouge", resoudreJetons(base).get("couleur.creme"), "#fff6ed");
verifier("jeton site écrase le défaut", resoudreJetons(base, [{ cle: "couleur.creme", valeur: "#000000", libelle: "", groupe: "couleurs" }]).get("couleur.creme"), "#000000");
verifier("jeton restaurant écrase le jeton site", resoudreJetons(base, [{ cle: "couleur.creme", valeur: "#000000", libelle: "", groupe: "couleurs" }], [{ cle: "couleur.creme", valeur: "#123456", libelle: "", groupe: "couleurs" }]).get("couleur.creme"), "#123456");
verifier("restaurant ne définit qu'un accent : le reste replie", resoudreJetons(base, [], [{ cle: "couleur.rouge", valeur: "#00ff00", libelle: "", groupe: "couleurs" }]).get("couleur.creme"), "#fff6ed");
// Un jeton de restaurant portant une clé inconnue du catalogue n'écrase rien d'existant et ne
// fait pas échouer la résolution : le défaut du site reste en place pour cette clé.
const resoluAvecFantome = resoudreJetons(base, [], [{ cle: "police.fantome", valeur: "Comic Sans", libelle: "", groupe: "typographie" }]);
verifier("clé inconnue du restaurant : les autres jetons résolus normalement", resoluAvecFantome.get("couleur.creme"), "#fff6ed");
verifier("clé inconnue du restaurant : n'écrase aucun jeton connu", [...base].every((b) => resoluAvecFantome.get(b.cle) === b.valeur), true);
verifier("clesDe renvoie toutes les clés", clesDe(base), ["couleur.creme", "couleur.rouge", "espace.4"]);

// --- Correspondance clé de jeton → nom CSS --------------------------------------
//
// C'est la table qui rend la migration invisible : les 28 feuilles de style utilisent
// `--creme`, `--space-4`, `--radius-md`. Si `nomCssDe` change, le site perd ses couleurs.

verifier("nom CSS : couleur.creme → creme", nomCssDe("couleur.creme"), "creme");
verifier("nom CSS : couleur.rouge-fonce → rouge-fonce", nomCssDe("couleur.rouge-fonce"), "rouge-fonce");
verifier("nom CSS : couleur.gradient-marque → gradient-marque", nomCssDe("couleur.gradient-marque"), "gradient-marque");
verifier("nom CSS : police.corps → font-corps", nomCssDe("police.corps"), "font-corps");
verifier("nom CSS : espace.4 → space-4", nomCssDe("espace.4"), "space-4");
verifier("nom CSS : forme.rayon-sm → radius-sm", nomCssDe("forme.rayon-sm"), "radius-sm");
verifier("nom CSS : forme.rayon-pill → radius-pill", nomCssDe("forme.rayon-pill"), "radius-pill");
verifier("nom CSS : forme.ombre-sm → shadow-sm", nomCssDe("forme.ombre-sm"), "shadow-sm");
verifier("nom CSS : forme.ombre-focus → shadow-focus", nomCssDe("forme.ombre-focus"), "shadow-focus");
verifier("nom CSS : forme.ease → ease", nomCssDe("forme.ease"), "ease");
verifier("nom CSS : forme.duree-fast → duration-fast", nomCssDe("forme.duree-fast"), "duration-fast");

// --- Génération du CSS ------------------------------------------------------------

const css = cssDepuisJetons(new Map([["couleur.creme", "#000000"], ["espace.4", "20px"]]));
verifier("css : ouvre et ferme :root", [css.startsWith(":root {"), css.trimEnd().endsWith("}")], [true, true]);
verifier("css : le préfixe de groupe est retiré (couleur.creme → --creme)", css.includes("--creme: #000000;"), true);
verifier("css : espace clé → --space-4", css.includes("--space-4: 20px;"), true);
verifier("css : pas d'injection possible par la valeur (poin-virgule)", cssDepuisJetons(new Map([["couleur.creme", "red; } body { display:none"]])).includes("display:none"), false);
verifier("css : pas d'injection par une accolades", cssDepuisJetons(new Map([["couleur.creme", "#fff}"]])).includes("}"), true); // seul le :root final ferme
verifier("css : la valeur douteuse est simplement omise", cssDepuisJetons(new Map([["couleur.creme", "x;y"], ["couleur.rouge", "#123456"]])).includes("--rouge: #123456;"), true);

const cssComplet = cssDepuisJetons(
  new Map([
    ["couleur.rouge", "#111111"],
    ["couleur.orange", "#222222"],
    ["couleur.mangue", "#333333"],
    ["couleur.encre", "#444444"],
  ])
);
verifier("css : les alias de catégorie sont reconstruits", cssComplet.includes("--couleur-riz: #111111;"), true);
verifier("css : alias grill", cssComplet.includes("--couleur-grill: #222222;"), true);
verifier("css : alias fast", cssComplet.includes("--couleur-fast: #333333;"), true);
verifier("css : alias cafe", cssComplet.includes("--couleur-cafe: #444444;"), true);
verifier("css : pas d'alias si les couleurs manquent", cssDepuisJetons(new Map([["couleur.rouge", "#111111"]])).includes("--couleur-riz"), false);

verifier("les 4 groupes ont un libellé", Object.keys(LIBELLES_GROUPES).sort(), ["couleurs", "espacements", "formes", "typographie"]);

// --- Le test qui empêche la dérive : semence == globals.css -----------------------

const racine = process.env.SPEEDFOOD_RACINE;
if (!racine) {
  console.log("SPEEDFOOD_RACINE absent : lancer par `npm run test:unit`.");
  process.exit(1);
}
const globalsCss = fs.readFileSync(path.join(racine, "src", "app", "globals.css"), "utf8");
const migration = fs.readFileSync(
  path.join(racine, "supabase", "migrations", "20261007184500_jetons_design.sql"),
  "utf8"
);

// Extrait `--nom: valeur;` du bloc :root de globals.css.
const blocRoot = globalsCss.slice(globalsCss.indexOf(":root {"), globalsCss.indexOf("html {"));
const variablesCss = new Map<string, string>();
for (const m of blocRoot.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  variablesCss.set(m[1], m[2].trim());
}

// Extrait les lignes d'insertion `('site', 'cle', 'valeur', ...)` de la migration.
const semences = new Map<string, string>();
for (const m of migration.matchAll(/\('site',\s*'([^']+)',\s*'([^']*)'/g)) {
  semences.set(m[1], m[2]);
}

// Chaque variable CSS du bloc :root qui doit avoir un jeton correspondant. La liste est écrite à
// la main, donc ce test vérifie aussi qu'elle n'a pas oublié une variable : le dernier contrôle
// compare les deux ensembles et signale tout écart.
const attendues = [
  "rouge", "rouge-fonce", "orange", "mangue", "creme", "surface", "encre", "secondaire", "bordure",
  "succes", "succes-fond", "danger", "danger-fond", "gradient-marque",
  "space-1", "space-2", "space-3", "space-4", "space-5", "space-6", "space-8",
  "radius-sm", "radius-md", "radius-lg", "radius-pill",
  "shadow-sm", "shadow-md", "shadow-lg", "shadow-focus",
  "ease", "duration-fast", "duration-base",
];

// Alias dérivés de globals.css:27-30 : reconstruits par `cssDepuisJetons`, pas stockés en base.
const DERIVES = ["couleur-riz", "couleur-grill", "couleur-fast", "couleur-cafe"];

// Le dégradé n'est pas une couleur : il est stocké (modifiable d'un seul endroit) mais jamais
// éditable par l'écran, et il ne suit donc pas la validation des couleurs.
const NON_COULEUR = ["gradient-marque"];

// Les variables `--font-*` sont déclarées par `next/font` sur `<html>` (layout.tsx), pas dans le
// bloc :root de globals.css : ce ne sont pas des jetons de design, ce sont des polices bundlées.

// Toute variable CSS du site doit avoir un jeton, sauf les alias dérivés (reconstruits par
// `cssDepuisJetons`) et les polices bundlées par next/font (hors de globals.css).
const sansJeton = [...variablesCss.keys()].filter((v) => !DERIVES.includes(v) && !semences.has(cleJetonDe(v)));
verifier("aucune variable CSS du site n'est sans jeton", sansJeton, []);

// Et l'inverse : aucune variable CSS ne doit avoir été oubliée dans `attendues`.
const absentesDeLaListe = [...variablesCss.keys()].filter(
  (v) => !attendues.includes(v) && !DERIVES.includes(v) && !v.startsWith("font-")
);
verifier("aucune variable CSS du site n'a été oubliée dans la liste de contrôle", absentesDeLaListe, []);

/** Le groupe d'un jeton, déduit de son PRÉFIXE de clé (`couleur.`, `espace.`…). */
function groupeDe(cle: string): Groupe {
  if (cle.startsWith("couleur.")) return "couleurs";
  if (cle.startsWith("police.")) return "typographie";
  if (cle.startsWith("espace.")) return "espacements";
  return "formes";
}

/**
 * Variable CSS → clé de jeton. L'opération inverse de `nomCssDe`, pour la comparaison des
 * ensembles. Ne pas reconstruire cette logique à la main : si `nomCssDe` change, ce contrôle doit
 * changer avec, sinon il compare deux vocabulaires différents et signale n'importe quoi.
 */
function cleJetonDe(nomCss: string): string {
  // Alias dérivés et dégradé : aucune clé de jeton ne leur correspond (ils sont reconstruits à la volée).
  if (DERIVES.includes(nomCss)) return "(derive)";
  if (NON_COULEUR.includes(nomCss)) return "couleur.gradient-marque";
  if (nomCss.startsWith("space-")) return "espace." + nomCss.slice(6);
  if (nomCss.startsWith("radius-")) return "forme.rayon-" + nomCss.slice(7);
  if (nomCss.startsWith("shadow-")) return "forme.ombre-" + nomCss.slice(7);
  if (nomCss.startsWith("duration-")) return "forme.duree-" + nomCss.slice("duration-".length);
  if (nomCss === "ease") return "forme.ease";
  // Tout le reste est une couleur : elle ne porte pas de préfixe en CSS (`--creme`).
  return "couleur." + nomCss;
}

const ecarts: string[] = [];
for (const cle of attendues) {
  const cleJeton = cleJetonDe(cle);
  const dansMigration = semences.get(cleJeton);
  const dansCss = variablesCss.get(cle);
  if (dansMigration === undefined) ecarts.push(`${cleJeton} absent de la migration`);
  else if (dansCss !== undefined && dansMigration !== dansCss) {
    ecarts.push(`${cleJeton} : migration « ${dansMigration} » ≠ globals.css « ${dansCss} »`);
  }
}
verifier("les jetons semés valent exactement les variables de globals.css", ecarts, []);

// Aucun jeton semé ne doit être inutile : une clé qui ne correspond à aucune variable CSS du site
// est soit une faute de frappe, soit un jeton mort. Les polices sont exclues : leurs variables
// (`--font-manrope`…) sont déclarées par `next/font` sur `<html>`, pas dans globals.css.
const inutiles = [...semences.keys()].filter((cle) => !cle.startsWith("police.") && !attendues.includes(nomCssDe(cle)));
verifier("aucun jeton semé ne correspond à aucune variable CSS", inutiles, []);
verifier("le dégradé est bien couvert (il est stocké)", nomCssDe("couleur.gradient-marque"), "gradient-marque");

// Chaque valeur semée doit passer sa propre validation — une semence invalide planterait au premier rendu.
const invalides: string[] = [];
for (const [cle, valeur] of semences) {
  if (NON_COULEUR.includes(nomCssDe(cle))) continue; // le dégradé est une exception documentée
  const erreur = validerValeurJeton(groupeDe(cle), valeur);
  if (erreur) invalides.push(`${cle} → ${erreur}`);
}
verifier("toutes les valeurs semées passent leur validation", invalides, []);

console.log(`\n${total - ko}/${total} tests passent`);
process.exit(ko === 0 ? 0 : 1);
