/** Mode de remise d'une commande et numéro de table, SANS dépendance (testable seul). */

export type ModeCommande = "retrait" | "livraison" | "sur_place";

const FORME_TABLE = /^[A-Za-z0-9 -]{1,10}$/;

/** Numéro de table lu d'un lien ou d'un champ : 1 à 10 lettres, chiffres, espaces ou tirets ; `null` si vide ou invalide. */
export function lireNumeroTable(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const v = brut.replace(/\s+/g, " ").trim();
  return FORME_TABLE.test(v) ? v : null;
}

export function libelleMode(mode: ModeCommande, table?: string | null): string {
  if (mode === "livraison") return "Livraison";
  if (mode === "sur_place") return table ? `À table, table ${table}` : "À table";
  return "Retrait sur place";
}

/** Le mode de la base vers le type : toute valeur inconnue retombe sur le retrait. */
export function versModeCommande(valeur: string): ModeCommande {
  return valeur === "livraison" || valeur === "sur_place" ? valeur : "retrait";
}
