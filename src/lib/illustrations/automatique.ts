import { PALETTES, initiales, type Illustration } from "./modele";

/**
 * Choix automatique d'une illustration à partir d'un nom : sert aux données de démonstration et au bouton « Revenir à
 * l'illustration automatique » de la console. Fonctions pures, sans accès base.
 */

const sansAccent = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mots du nom d'un plat -> motif. Le premier qui correspond l'emporte ; l'ordre va du plus précis au plus général. */
const REGLES_PLAT: [RegExp, string][] = [
  [/brochette|kebab|oden|souvlaki/, "brochettes"],
  [/shawarma|dürüm|durum|kebab roll/, "shawarma"],
  [/riz.*(sauce|feuille|arachide|gras|poulet|poisson|viande)|(sauce|feuille|arachide).*riz|jollof/, "riz-sauce"],
  [/riz/, "riz-blanc"],
  [/poisson|capitaine|machoiron|thiof|silure/, "poisson-tropical"],
  [/crevette|gambas/, "crevette"],
  [/crabe|langouste|homard/, "crabe"],
  [/poulet|poule|volaille|aile|cuisse/, "poulet"],
  [/boeuf|steak|escalope|cote|entrecote/, "boeuf"],
  [/agneau|mouton|chevre|viande|grillade|ribs/, "viande"],
  [/sauce|ragout|mafe|gombo|feuille|kansiye|soupe de/, "sauce"],
  [/soupe|bouillon|potage/, "soupe"],
  [/burger|hamburger|cheese/, "burger"],
  [/frite|chips/, "frites"],
  [/sandwich|panini|tacos|wrap/, "sandwich"],
  [/pizza/, "pizza"],
  [/salade/, "salade"],
  [/omelette|oeuf/, "oeuf"],
  [/alloco|plantain|banane/, "banane"],
  [/igname|patate|manioc|attieke/, "patate-douce"],
  [/mais|epi/, "mais"],
  [/arachide|cacahuete/, "arachide"],
  [/piment/, "piment"],
  [/croissant|viennoiserie|chocolatine|pain au chocolat|brioche/, "croissant"],
  [/pain|baguette|tartine|toast/, "pain"],
  [/tarte/, "tarte"],
  [/gateau|cake|brownie|fondant/, "gateau"],
  [/patisserie|beignet|donut|cookie|muffin|cupcake/, "patisserie"],
  [/glace|sorbet|milkshake|creme/, "glace"],
  [/the glace|bubble/, "the-glace"],
  [/the|infusion|menthe/, "the"],
  [/cafe|expresso|espresso|cappuccino|latte|nescafe/, "cafe"],
  [/jus|bissap|gingembre|bouye|smoothie|citronnade|limonade/, "jus"],
  [/coco/, "coco"],
  [/mangue/, "mangue"],
  [/ananas/, "ananas"],
  [/cocktail|mojito|punch/, "cocktail"],
  [/soda|coca|fanta|sprite|eau|boisson|biere|malta/, "boisson"],
];

export function motifPourPlat(nom: string): string {
  const n = sansAccent(nom);
  for (const [regle, motif] of REGLES_PLAT) {
    if (regle.test(n)) return motif;
  }
  return "couvert";
}

/** Famille d'un restaurant d'après le nom de sa catégorie (« Riz & sauces », « Grillades »…). */
export function familleDepuisCategorie(categorie: string): keyof typeof PALETTES {
  const c = sansAccent(categorie);
  if (/riz|sauce|traditionnel|local/.test(c)) return "riz";
  if (/grill|braise|rotisserie/.test(c)) return "grill";
  if (/fast|burger|snack|sandwich|pizza/.test(c)) return "fast";
  if (/cafe|the|boulanger|patisserie|petit/.test(c)) return "cafe";
  return "defaut";
}

const MOTIF_FAMILLE: Record<string, string> = { riz: "riz-sauce", grill: "poisson-tropical", fast: "burger", cafe: "cafe", defaut: "couvert" };

export function illustrationPlat(nom: string, famille: keyof typeof PALETTES = "defaut"): Illustration {
  return { style: "pastille", motif: motifPourPlat(nom), ...PALETTES[famille], texte: "", genere: true };
}

export function illustrationLogo(nom: string, famille: keyof typeof PALETTES = "defaut"): Illustration {
  const p = PALETTES[famille];
  return { style: "monogramme", motif: MOTIF_FAMILLE[famille], fond: p.forme, forme: "#fff6ed", accent: p.accent, texte: initiales(nom), genere: true };
}

export function illustrationCouverture(famille: keyof typeof PALETTES = "defaut"): Illustration {
  return { style: "affiche", motif: MOTIF_FAMILLE[famille], ...PALETTES[famille], texte: "", genere: true };
}
