import { enum as enumeration, literal, optional, refine, regex, strictObject, string, union, type output } from "zod/mini";

/**
 * Réglages communs à tous les blocs des pages du Studio (« mode mixte », palier 3, tâche 8). Module PUR.
 *
 * Chaque bloc porte un objet `reglages` facultatif, strict, dont TOUS les champs sont des énumérations fermées : jamais de
 * valeur libre, jamais de CSS en ligne, jamais de couleur libre. Le rendu ne produit que des NOMS DE CLASSES (feuille
 * `src/app/studio-blocs.css`) : compatible avec la CSP actuelle et sans aucun `style=` construit depuis des données.
 * Absent ou vide = comportement d'avant les réglages (aucun changement visuel pour les pages déjà enregistrées).
 */

export const ESPACES = [0, 8, 16, 32, 64, 96] as const;
export const ALIGNEMENTS = ["gauche", "centre", "droite"] as const;
export const LARGEURS = ["etroite", "normale", "large", "pleine"] as const;
export const CODES_FOND = ["aucun", "creme", "surface", "mangue", "rouge", "encre"] as const;
export const VISIBILITES = ["tous", "mobile", "bureau"] as const;

/** Une ancre : lettre minuscule, puis lettres minuscules, chiffres ou tirets (40 caractères au plus). */
export const MOTIF_ANCRE = /^[a-z][a-z0-9-]{0,39}$/;
/** Identifiants déjà posés par le cadre du site (lien d'évitement, etc.) : refusés comme ancres. */
export const ANCRES_RESERVEES = ["contenu", "main", "root", "etape-panneau"] as const;

/**
 * Fonds autorisés : jeton de couleur du fond et jeton du texte (correspondance FIXE vers `globals.css`). Le texte est
 * choisi pour que chaque couple respecte le contraste AA (4,5:1) : un test unitaire le calcule depuis les valeurs réelles
 * des jetons ET vérifie que la feuille de style applique exactement ces couples.
 */
export const FONDS: Record<(typeof CODES_FOND)[number], { fond: string; texte: string } | null> = {
  aucun: null,
  creme: { fond: "--creme", texte: "--encre" },
  surface: { fond: "--surface", texte: "--encre" },
  mangue: { fond: "--mangue", texte: "--encre" },
  rouge: { fond: "--rouge", texte: "--surface" },
  encre: { fond: "--encre", texte: "--surface" },
};

const espace = union([literal(0), literal(8), literal(16), literal(32), literal(64), literal(96)]);

export const schemaReglages = strictObject({
  espaceHaut: optional(espace),
  espaceBas: optional(espace),
  alignement: optional(enumeration(ALIGNEMENTS)),
  largeur: optional(enumeration(LARGEURS)),
  fond: optional(enumeration(CODES_FOND)),
  visibilite: optional(enumeration(VISIBILITES)),
  ancre: optional(
    string().check(
      regex(MOTIF_ANCRE),
      refine((valeur) => !(ANCRES_RESERVEES as readonly string[]).includes(valeur))
    )
  ),
});

export type Reglages = output<typeof schemaReglages>;

/** Clés des réglages, dans l'ordre d'affichage de l'éditeur. */
export const CLES_REGLAGES = ["espaceHaut", "espaceBas", "alignement", "largeur", "fond", "visibilite", "ancre"] as const;

/**
 * Réglages tels que saisis dans l'éditeur -> réglages à enregistrer : une valeur vide (« Par défaut ») est retirée, un
 * objet sans aucun réglage disparaît. Les valeurs INVALIDES sont gardées telles quelles (la validation les signale : rien
 * n'est retiré en silence).
 */
export function normaliserReglages(valeur: unknown): Record<string, unknown> | undefined {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return undefined;
  const resultat: Record<string, unknown> = {};
  for (const cle of Object.keys(valeur)) {
    const v = (valeur as Record<string, unknown>)[cle];
    if (v === undefined || v === null || v === "") continue;
    resultat[cle] = v;
  }
  return Object.keys(resultat).length > 0 ? resultat : undefined;
}

/**
 * Noms de classes (feuille `studio-blocs.css`) pour des réglages VALIDÉS. Aucune valeur n'est recopiée : chaque classe
 * est choisie dans une table fermée. `modeEdition` : la visibilité n'est pas appliquée (le bloc doit rester éditable).
 */
export function classesReglages(reglages: Reglages | undefined, modeEdition = false): string[] {
  if (!reglages) return [];
  const classes: string[] = [];
  if (reglages.espaceHaut !== undefined && (ESPACES as readonly number[]).includes(reglages.espaceHaut)) classes.push(`sb-eh-${reglages.espaceHaut}`);
  if (reglages.espaceBas !== undefined && (ESPACES as readonly number[]).includes(reglages.espaceBas)) classes.push(`sb-eb-${reglages.espaceBas}`);
  if (reglages.alignement && (ALIGNEMENTS as readonly string[]).includes(reglages.alignement)) classes.push(`sb-al-${reglages.alignement}`);
  if (reglages.largeur && (LARGEURS as readonly string[]).includes(reglages.largeur)) classes.push(`sb-l-${reglages.largeur}`);
  if (reglages.fond && reglages.fond !== "aucun" && (CODES_FOND as readonly string[]).includes(reglages.fond)) classes.push(`sb-fond sb-fond-${reglages.fond}`);
  if (!modeEdition && reglages.visibilite && reglages.visibilite !== "tous" && (VISIBILITES as readonly string[]).includes(reglages.visibilite)) {
    classes.push(`sb-vis-${reglages.visibilite}`);
  }
  return classes;
}

/** Libellés (français) des options de l'éditeur, par réglage. `""` = « Par défaut » (le réglage est retiré). */
export const OPTIONS_REGLAGES: Record<
  Exclude<(typeof CLES_REGLAGES)[number], "ancre">,
  { libelle: string; aide: string; options: readonly { valeur: string; libelle: string }[] }
> = {
  espaceHaut: {
    libelle: "Espace au-dessus",
    aide: "Distance entre ce bloc et le précédent.",
    options: [
      { valeur: "", libelle: "Par défaut" },
      { valeur: "0", libelle: "Aucun" },
      { valeur: "8", libelle: "Très petit (8 px)" },
      { valeur: "16", libelle: "Petit (16 px)" },
      { valeur: "32", libelle: "Moyen (32 px)" },
      { valeur: "64", libelle: "Grand (64 px)" },
      { valeur: "96", libelle: "Très grand (96 px)" },
    ],
  },
  espaceBas: {
    libelle: "Espace en dessous",
    aide: "Distance entre ce bloc et le suivant.",
    options: [
      { valeur: "", libelle: "Par défaut" },
      { valeur: "0", libelle: "Aucun" },
      { valeur: "8", libelle: "Très petit (8 px)" },
      { valeur: "16", libelle: "Petit (16 px)" },
      { valeur: "32", libelle: "Moyen (32 px)" },
      { valeur: "64", libelle: "Grand (64 px)" },
      { valeur: "96", libelle: "Très grand (96 px)" },
    ],
  },
  alignement: {
    libelle: "Alignement",
    aide: "Place le contenu du bloc à gauche, au centre ou à droite.",
    options: [
      { valeur: "", libelle: "Par défaut" },
      { valeur: "gauche", libelle: "À gauche" },
      { valeur: "centre", libelle: "Centré" },
      { valeur: "droite", libelle: "À droite" },
    ],
  },
  largeur: {
    libelle: "Largeur",
    aide: "Largeur maximale du bloc dans la page.",
    options: [
      { valeur: "", libelle: "Par défaut" },
      { valeur: "etroite", libelle: "Étroite" },
      { valeur: "normale", libelle: "Normale" },
      { valeur: "large", libelle: "Large" },
      { valeur: "pleine", libelle: "Pleine largeur" },
    ],
  },
  fond: {
    libelle: "Fond",
    aide: "Couleur du fond du bloc ; la couleur du texte s'adapte toute seule.",
    options: [
      { valeur: "", libelle: "Par défaut (sans fond)" },
      { valeur: "creme", libelle: "Crème" },
      { valeur: "surface", libelle: "Blanc cassé" },
      { valeur: "mangue", libelle: "Mangue (jaune)" },
      { valeur: "rouge", libelle: "Rouge" },
      { valeur: "encre", libelle: "Encre (foncé)" },
    ],
  },
  visibilite: {
    libelle: "Afficher sur",
    aide: "Un bloc masqué n'est ni vu ni lu sur l'autre type d'écran.",
    options: [
      { valeur: "", libelle: "Par défaut (tous les écrans)" },
      { valeur: "mobile", libelle: "Téléphone seulement" },
      { valeur: "bureau", libelle: "Ordinateur seulement" },
    ],
  },
};

export const LIBELLE_ANCRE = {
  libelle: "Ancre (lien interne)",
  aide: "Lettres minuscules, chiffres et tirets, en commençant par une lettre (ex. « questions »). Permet un lien vers ce bloc : /p/ma-page#questions. Une ancre ne peut servir qu'une fois dans la page.",
} as const;
