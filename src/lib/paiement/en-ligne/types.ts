/**
 * Paiement en ligne par Speedfood : types communs (voir docs/PAIEMENT-ARCHITECTURE.md).
 *
 * Tout est SANS dépendance : ce fichier et ses voisins `machine`, `repartition`, `ecritures`, `litiges`, `signature` se testent seuls.
 * Les montants sont des ENTIERS en GNF, jamais des flottants.
 */

export const OPERATEURS = ["orange_money", "mtn_momo"] as const;
export type OperateurMobile = (typeof OPERATEURS)[number];

export const ETATS_PAIEMENT = ["cree", "en_attente", "confirme", "libere", "echoue", "expire", "annule", "rembourse", "en_litige"] as const;
export type EtatPaiement = (typeof ETATS_PAIEMENT)[number];

export const EVENEMENTS_PAIEMENT = [
  "demander",
  "annuler",
  "notification_succes",
  "notification_echec",
  "notification_annulation",
  "expiration",
  "liberer",
  "remboursement_total",
  "ouvrir_litige",
  "clore_litige_liberer",
  "clore_litige_rembourser",
] as const;
export type EvenementPaiement = (typeof EVENEMENTS_PAIEMENT)[number];

export function estOperateur(valeur: unknown): valeur is OperateurMobile {
  return typeof valeur === "string" && (OPERATEURS as readonly string[]).includes(valeur);
}

export function estEtatPaiement(valeur: unknown): valeur is EtatPaiement {
  return typeof valeur === "string" && (ETATS_PAIEMENT as readonly string[]).includes(valeur);
}

/** Montant en GNF valide : entier sûr, positif ou nul. */
export function estMontantGnf(valeur: unknown): valeur is number {
  return typeof valeur === "number" && Number.isSafeInteger(valeur) && valeur >= 0;
}
