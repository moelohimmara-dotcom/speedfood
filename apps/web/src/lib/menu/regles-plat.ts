// Pur, sans dépendance : testable seul (npm run test:unit). Mêmes règles que les formulaires du menu de la console web.

export const NOM_PLAT_MAX = 120;
export const DESCRIPTION_PLAT_MAX = 500;
export const NOM_OPTION_MAX = 80;

export interface ValeursPlat {
  nom: string;
  description: string;
  prix: number;
  /** Prix promo : jamais au-dessus du prix normal ; `null` = pas de promo. */
  prixPromo: number | null;
}

export type ResultatValidation<T> = { ok: true; valeurs: T } | { ok: false; erreur: string };

const messagePrix = (max: number) => `Le prix doit être un nombre entier en GNF, entre 0 et ${max.toLocaleString("fr-FR")}.`;

/** Valide un plat : nom, description, prix entier borné, prix promo entier entre 0 et le prix normal. */
export function validerPlat(brut: { nom: unknown; description: unknown; prix: unknown; prixPromo: unknown }, prixPlatMaxGnf: number): ResultatValidation<ValeursPlat> {
  const nom = typeof brut.nom === "string" ? brut.nom.trim() : "";
  const description = typeof brut.description === "string" ? brut.description.trim() : "";
  if (!nom || nom.length > NOM_PLAT_MAX) return { ok: false, erreur: `Le nom du plat est obligatoire (${NOM_PLAT_MAX} caractères maximum).` };
  if (description.length > DESCRIPTION_PLAT_MAX) return { ok: false, erreur: `La description ne peut pas dépasser ${DESCRIPTION_PLAT_MAX} caractères.` };
  const prix = brut.prix;
  if (typeof prix !== "number" || !Number.isInteger(prix) || prix < 0 || prix > prixPlatMaxGnf) return { ok: false, erreur: messagePrix(prixPlatMaxGnf) };
  const promo = brut.prixPromo;
  if (promo === null || promo === undefined) return { ok: true, valeurs: { nom, description, prix, prixPromo: null } };
  if (typeof promo !== "number" || !Number.isInteger(promo) || promo < 0 || promo > prix) {
    return { ok: false, erreur: "Le prix promo doit être un nombre entier en GNF, entre 0 et le prix normal." };
  }
  return { ok: true, valeurs: { nom, description, prix, prixPromo: promo } };
}

/** Valide un supplément : nom (80 caractères au plus) et prix entier borné. */
export function validerOption(brut: { nom: unknown; prix: unknown }, prixPlatMaxGnf: number): ResultatValidation<{ nom: string; prix: number }> {
  const nom = typeof brut.nom === "string" ? brut.nom.trim() : "";
  if (!nom || nom.length > NOM_OPTION_MAX) return { ok: false, erreur: `Le nom du supplément est obligatoire (${NOM_OPTION_MAX} caractères maximum).` };
  const prix = brut.prix;
  if (typeof prix !== "number" || !Number.isInteger(prix) || prix < 0 || prix > prixPlatMaxGnf) return { ok: false, erreur: messagePrix(prixPlatMaxGnf) };
  return { ok: true, valeurs: { nom, prix } };
}
