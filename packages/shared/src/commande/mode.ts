/** Mode de remise d'une commande et numéro de table, SANS dépendance (testable seul). */

export type ModeCommande = "retrait" | "livraison" | "sur_place";

const FORME_TABLE = /^[A-Za-z0-9 -]{1,10}$/;

/** Numéro de table lu d'un lien ou d'un champ : 1 à 10 lettres, chiffres, espaces ou tirets ; `null` si vide ou invalide. */
export function lireNumeroTable(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const v = brut.replace(/\s+/g, " ").trim();
  return FORME_TABLE.test(v) ? v : null;
}

/** Le mode de la base vers le type : toute valeur inconnue retombe sur le retrait. */
export function versModeCommande(valeur: string): ModeCommande {
  return valeur === "livraison" || valeur === "sur_place" ? valeur : "retrait";
}

/**
 * Le nom du mode TEL QUE LE CLIENT LE LIT, partout (site, appli, suivi, reçu, espace client) : « Livraison », « À emporter » ou « Sur place »
 * (suivi de « · table X » quand la table est connue). « À emporter » est l'affichage de la valeur `retrait` : la valeur du mode ne change pas
 * (réseau, base). Toute valeur inconnue retombe sur « À emporter », comme `versModeCommande`.
 */
export function libelleModeClient(mode: string, table?: string | null): string {
  const m = versModeCommande(mode);
  if (m === "livraison") return "Livraison";
  if (m === "sur_place") {
    const numero = typeof table === "string" ? table.trim() : "";
    return numero ? `Sur place · table ${numero}` : "Sur place";
  }
  return "À emporter";
}
