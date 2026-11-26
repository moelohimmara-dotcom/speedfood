/**
 * Boissons avec et sans alcool : deux familles classées à part dans le menu (voir docs/REGLES-MENUS-ET-PHOTOS.md, section 8).
 * La classe se déduit du nom de la rubrique. Une rubrique inconnue n'est ni l'une ni l'autre (plat, entrée…).
 */

export type ClasseBoisson = "sans-alcool" | "avec-alcool";

export const RUBRIQUES_SANS_ALCOOL: readonly string[] = [
  "Boissons chaudes",
  "Jus et smoothies",
  "Boissons lactées",
  "Sodas et rafraîchissements",
  "Boissons énergisantes",
  "Mocktails",
  "Eaux",
];

export const RUBRIQUES_AVEC_ALCOOL: readonly string[] = ["Bières", "Vins", "Cocktails", "Spiritueux et digestifs"];

export const TITRE_SANS_ALCOOL = "Boissons sans alcool";
export const TITRE_AVEC_ALCOOL = "Boissons avec alcool";
export const AVERTISSEMENT_ALCOOL = "Réservé aux personnes majeures. L'abus d'alcool est dangereux pour la santé, à consommer avec modération.";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const SANS = new Set(RUBRIQUES_SANS_ALCOOL.map(norm));
const AVEC = new Set(RUBRIQUES_AVEC_ALCOOL.map(norm));

/** Classe d'une rubrique de boissons, ou `null` si la rubrique n'est pas une rubrique de boissons. */
export function classeBoisson(nomRubrique: string): ClasseBoisson | null {
  const n = norm(nomRubrique);
  if (AVEC.has(n)) return "avec-alcool";
  if (SANS.has(n)) return "sans-alcool";
  return null;
}

/**
 * Pour chaque rubrique dans l'ordre d'affichage, le titre de groupe à écrire juste avant elle : « Boissons sans alcool » avant la première
 * rubrique sans alcool, « Boissons avec alcool » avant la première rubrique avec alcool, rien ailleurs. Un titre n'est jamais répété.
 */
export function titresDeGroupe(nomsRubriques: string[]): Array<ClasseBoisson | null> {
  const vus = new Set<ClasseBoisson>();
  return nomsRubriques.map((nom) => {
    const c = classeBoisson(nom);
    if (!c || vus.has(c)) return null;
    vus.add(c);
    return c;
  });
}
