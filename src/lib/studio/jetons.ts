/**
 * Jetons de design (palier 4, phase 1) — le design devient une donnée.
 *
 * Module PUR : aucun import serveur, testé par `scripts/tests/design.test.mts`. Le rôle de ce
 * fichier est de définir ce qu'un jeton est, ce qu'il peut contenir, et comment une portée
 * l'emporte sur l'autre. Rien n'est lu en base ici : la résolution est une fonction pure, ce
 * qui la rend testable sans Supabase et exécutable dans le rendu comme dans le test.
 *
 * Pourquoi des jetons et pas du CSS libre : un bloc ne stocke jamais une valeur brute, seulement
 * une clé (`couleur.creme`). Changer la définition de la clé change le site entier d'un coup, et
 * deux pages ne peuvent pas diverger parce que l'une a été éditée à la main. C'est le modèle
 * `theme.json` de WordPress, et c'est ce qui permet à la propriétaire de changer l'identité
 * visuelle sans demander d'aide.
 *
 * Le contraste WCAG est vérifié à l'enregistrement, pas ici : il faut les deux couleurs d'un
 * couple, donc l'appelant connaît le contexte.
 */

import { contraste } from "../illustrations/modele";

export type Portee = "site" | "restaurant";
export type Groupe = "couleurs" | "typographie" | "espacements" | "formes";

export interface LigneJeton {
  cle: string;
  valeur: string;
  libelle: string;
  groupe: Groupe;
}

/** Une couleur est un hexadécimal à six chiffres. Le même motif que `COULEUR` ailleurs dans le code. */
export const COULEUR = /^#[0-9A-Fa-f]{6}$/;

/** Longueur CSS : uniquement des unités absolues. Ni `calc`, ni `var()`, ni expression. */
const LONGUEUR = /^-?\d+(\.\d+)?(px|rem|em|%)?$/;

/** Rayon ou ombre : suite de nombres et d'unités, séparés par des espaces. */
const MESURE = /^[-0-9.,\s()%a-zA-Z]+$/;

/** Nom de famille CSS. `var(--x)` est accepté (les polices du site sont des variables next/font),
 *  mais aucune adresse, aucun `@import`, aucune URL : la CSP l'interdit et une police distante ne
 *  doit pas pouvoir être imposée par un éditeur. */
const FAMILLE_POLICE = /^[a-zA-Z0-9\s,'"()-]+$/;

export const CONTRASTE_AA_TEXTE = 4.5;
export const CONTRASTE_AA_LARGE = 3;
export const CONTRASTE_AAA_TEXTE = 7;

/** Une valeur est-elle de la couleur ? Sert à choisir la règle de validation et le contrôleur. */
export function estCouleur(valeur: string): boolean {
  return COULEUR.test(valeur.trim());
}

/** Familles de polices autorisées : celles que `next/font` auto-héberge déjà, plus les génériques. */
/**
 * Familles autorisées : celles que `next/font` auto-héberge (variables CSS déclarées dans
 * `layout.tsx`) et les génériques du navigateur. Une famille ne peut être choisie que seule ou
 * suivie d'une liste de repli made in CSS (génériques, autres familles autorisées) : c'est ce que
 * produit `layout.tsx` et ce que produit une feuille de style, rien de plus.
 */
export const FAMILLES_AUTORISEES: readonly string[] = [
  "var(--font-manrope)",
  "var(--font-bricolage)",
  "var(--font-barlow)",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
];

/** Une pile de polices est valide si son PREMIER choix est autorisé et que les suivants sont des
 *  génériques. `var(--font-manrope), system-ui, sans-serif` passe ; `Comic Sans, serif` non. */
export function estPilePolice(valeur: string): boolean {
  const morceaux = valeur.split(",").map((m) => m.trim()).filter(Boolean);
  if (morceaux.length === 0) return false;
  const premiereAutorisee = FAMILLES_AUTORISEES.includes(morceaux[0]);
  const resteGenerique = morceaux.slice(1).every((m) => ["system-ui", "sans-serif", "serif", "monospace", "cursive", "fantasy"].includes(m));
  return premiereAutorisee && resteGenerique;
}

/**
 * Valide une valeur pour un type de jeton. Renvoie `null` si la valeur est acceptable, sinon un
 * message en français prêt à afficher. Un message ici vaut mieux qu'un refus muet : la
 * propriétaire voit pourquoi la couleur est refusée au lieu de croire à un bug.
 */
export function validerValeurJeton(groupe: Groupe, valeur: string): string | null {
  const v = valeur.trim();
  if (v.length === 0) return "La valeur ne peut pas être vide.";
  if (v.length > 200) return "La valeur ne peut pas dépasser 200 caractères.";

  if (groupe === "couleurs") {
    // Seule exception tolérée : le dégradé de marque, qui n'est pas une couleur mais un dégradé
    // figé. Il est listé comme jeton pour rester modifiable d'un seul endroit, mais il n'est pas
    // éditable par l'écran de design (une couleur, oui ; reconstruire un dégradé à la main, non).
    return COULEUR.test(v) ? null : "Une couleur s'écrit #rrggbb, par exemple #ffc247.";
  }
  if (groupe === "typographie") {
    if (!FAMILLE_POLICE.test(v)) return "Nom de police invalide.";
    if (estPilePolice(v)) return null;
    return "Police non disponible. Choisissez une police du site (Manrope, Bricolage, Barlow) ou une police système, suivie de ses replis.";
  }
  if (groupe === "espacements") {
    return LONGUEUR.test(v) ? null : "Une longueur s'écrit 16px, 1.5rem ou 100%.";
  }
  // formes : rayons, ombres, courbes, durées
  return MESURE.test(v) ? null : "Valeur de forme invalide (rayon, ombre, durée).";
}

/**
 * Verdict de contraste pour un couple fond/texte. `seuilAA` à 4,5 pour du texte courant ; 3 pour
 * un texte large (titres de 24 px et plus, ou 18,66 px en gras). Renvoie aussi le rapport exact
 * pour que l'interface puisse l'afficher — « 3,8 : 1, il manque un peu » aide plus qu'un refus sec.
 */
export function verifierContraste(fond: string, texte: string, seuilAA = CONTRASTE_AA_TEXTE): { rapport: number; conforme: boolean; seuil: number } {
  const rapport = Math.round(contraste(fond.trim(), texte.trim()) * 100) / 100;
  return { rapport, conforme: rapport >= seuilAA, seuil: seuilAA };
}

/**
 * Résolution : le jeton restaurant écrase le jeton site, sinon le défaut du code.
 *
 * L'ordre des paramètres est volontairement « du plus prioritaire au moins prioritaire » pour que
 * l'appelant puisse passer des résultats déjà lus de la base, dans l'ordre où il les a lus, sans
 * avoir à les fusionner. C'est la seule façon simple de rester pur et testable.
 */
export function resoudreJetons<T extends LigneJeton>(
  defauts: readonly T[],
  site: readonly T[] = [],
  restaurant: readonly T[] = []
): Map<string, string> {
  const resolus = new Map<string, string>();
  for (const d of defauts) resolus.set(d.cle, d.valeur);
  for (const s of site) resolus.set(s.cle, s.valeur);
  for (const r of restaurant) resolus.set(r.cle, r.valeur);
  return resolus;
}

/** Un restaurant qui définit seulement « accent » ne change que l'accent : tout le reste replie. */
/** Clés d'un ensemble, dans l'ordre d'entrée. Petit utilitaire, purely functional. */
export function clesDe(base: readonly LigneJeton[]): string[] {
  return base.map((j) => j.cle);
}

/**
 * Correspondance « clé de jeton → nom de variable CSS ». Les 28 feuilles de style existantes
 * utilisent `--creme`, `--space-4`, `--radius-md` : ce sont ces noms, pas les clés de jeton, qui
 * doivent apparaître dans le CSS généré. C'est ce qui rend la migration invisible — aucune feuille
 * de style n'a besoin d'être touchée.
 *
 * Deux seules exceptions, traitées ici parce que leur nom CSS ne se déduit pas du préfixe :
 * `couleur.gradient-marque` → `--gradient-marque` (et non `--couleur-gradient-marque`), et le
 * dégradé n'est pas une couleur donc n'est pas validé comme telle.
 *
 * Les clés inconnues passent en minuscules : un jeton ajouté après coup fonctionne sans qu'on ait
 * à tenir cette table à jour ligne par ligne.
 */
const NOMS_CSS_SPECIAUX: Readonly<Record<string, string>> = {
  "couleur.gradient-marque": "gradient-marque",
  "forme.rayon-pill": "radius-pill",
  "forme.ombre-focus": "shadow-focus",
  "forme.duree-fast": "duration-fast",
  "forme.duree-base": "duration-base",
};

/** Un `couleur.x` → `--x`, un `espace.1` → `--space-1`, un `forme.rayon-sm` → `--radius-sm`. */
export function nomCssDe(cle: string): string {
  if (NOMS_CSS_SPECIAUX[cle]) return NOMS_CSS_SPECIAUX[cle];
  const [prefixe, ...reste] = cle.split(".");
  const suffixe = reste.join(".");
  const base =
    prefixe === "espace"
      ? "space-" + suffixe
      : prefixe === "police"
        ? "font-" + suffixe
        : prefixe === "forme"
          ? suffixe.startsWith("rayon-")
            ? "radius-" + suffixe.slice(6)
            : suffixe.startsWith("ombre-")
              ? "shadow-" + suffixe.slice(6)
              : suffixe
          : suffixe;
  return base.toLowerCase();
}

/**
 * Le bloc CSS `:root { --nom: valeur; }`. Chaque valeur a été validée avant d'arriver ici, mais
 * un garde-fou reste : une valeur contenant `;`, `{` ou `}` ne peut pas fermer la déclaration ni
 * ouvrir une règle. On ne fait pas confiance au fait qu'on « a déjà validé ».
 */
export function cssDepuisJetons(jetons: ReadonlyMap<string, string>): string {
  const lignes: string[] = [":root {"];

  for (const [cle, valeur] of jetons) {
    if (/[;{}<>]/.test(valeur)) continue; // Valeur refusée en amont ; on n'émet rien de douteux.
    lignes.push(`  --${nomCssDe(cle)}: ${valeur};`);
  }

  // Les alias de globals.css:27-30 (couleur-riz → rouge, etc.) sont dérivés, pas éditables :
  // les reconstruire ici garantit qu'un changement de « couleur.rouge » se répercute partout.
  const c = (cle: string) => jetons.get(cle);
  if (c("couleur.rouge") && c("couleur.orange") && c("couleur.mangue") && c("couleur.encre")) {
    lignes.push(`  --couleur-riz: ${c("couleur.rouge")};`);
    lignes.push(`  --couleur-grill: ${c("couleur.orange")};`);
    lignes.push(`  --couleur-fast: ${c("couleur.mangue")};`);
    lignes.push(`  --couleur-cafe: ${c("couleur.encre")};`);
  }

  lignes.push("}");
  return lignes.join("\n");
}

/** Libellés des groupes, dans l'ordre d'affichage. */
export const LIBELLES_GROUPES: Readonly<Record<Groupe, string>> = {
  couleurs: "Couleurs",
  typographie: "Typographie",
  espacements: "Espacements",
  formes: "Formes",
};

/**
 * Un changement de jeton, tel qu'affiché dans le panneau « Historique ».
 *
 * Déclaré ici, dans le module PUR, et pas dans `jetons-actions` : ce dernier commence par
 * `import "server-only"`, qu'un composant client ne peut pas importer. Le type devant être lu
 * des deux côtés, il vit à côté de `Groupe`, lui aussi partagé.
 */
export interface EntreeHistorique {
  id: string;
  cle: string;
  libelle: string;
  groupe: Groupe;
  valeurAvant: string | null;
  valeurApres: string;
  action: "creation" | "modification" | "suppression";
  creeLe: string;
}
