// Pur, sans dépendance serveur : testable seul (npm run test:unit).

/**
 * Règles de saisie d'un plat par l'équipe Speedfood (catalogue géré par l'équipe, ADR-020). Mêmes bornes que la base et que la console
 * restaurateur : nom de 1 à 120 caractères, description de 500 au plus, prix entier en GNF, prix promo jamais supérieur au prix normal.
 */

export interface PlatSaisi {
  nom: string;
  description: string;
  prix: number;
  prixPromo: number | null;
}

export type ResultatPlat = { ok: true; plat: PlatSaisi } | { ok: false; erreur: string };

/**
 * « 25000 », « 25 000 », « 25.000 » : des chiffres, ou des groupes de trois chiffres séparés par un espace (y compris insécable), un point ou une
 * virgule. Toute autre forme est refusée : « 1000,50 » ne devient JAMAIS 100 050 (le franc guinéen n'a pas de décimales et une erreur de prix ne doit
 * pas passer en silence).
 */
function lireMontantGnf(brut: unknown): number | null | "invalide" {
  const texte = String(brut ?? "").trim();
  if (texte === "") return null;
  if (/^\d{1,9}$/.test(texte)) return Number(texte);
  if (/^\d{1,3}([\s  .,]\d{3}){1,2}$/.test(texte)) return Number(texte.replace(/[\s  .,]/g, ""));
  return "invalide";
}

export function validerPlat(
  brut: { nom: unknown; description: unknown; prix: unknown; prixPromo: unknown },
  prixMaxGnf: number
): ResultatPlat {
  const nom = String(brut.nom ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (nom.length < 1 || nom.length > 120) return { ok: false, erreur: "Le nom du plat est obligatoire (120 caractères maximum)." };

  const description = String(brut.description ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (description.length > 500) return { ok: false, erreur: "La description ne peut pas dépasser 500 caractères." };

  const prix = lireMontantGnf(brut.prix);
  if (prix === null || prix === "invalide" || prix > prixMaxGnf) {
    return { ok: false, erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixMaxGnf.toLocaleString("fr-FR")}.` };
  }

  const prixPromo = lireMontantGnf(brut.prixPromo);
  if (prixPromo === "invalide" || (prixPromo !== null && prixPromo > prix)) {
    return { ok: false, erreur: "Le prix promo doit être un nombre entier en GNF, entre 0 et le prix normal." };
  }

  return { ok: true, plat: { nom, description, prix, prixPromo } };
}
