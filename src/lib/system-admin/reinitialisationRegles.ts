/**
 * Règles pures de la demande de réinitialisation (testées dans scripts/tests). La phrase doit être recopiée telle
 * quelle : seul l'espace autour est toléré, jamais la casse.
 */
export const PHRASE_REINITIALISATION = "REINITIALISER SPEEDFOOD";
export const MOTIF_MIN = 10;
export const MOTIF_MAX = 500;
export const UUID_JETON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DemandeReinitialisation {
  phrase: string;
  motif: string;
  compris: boolean;
  jeton: string;
}

/** Retourne le message d'erreur à afficher, ou `null` si la demande est recevable. */
export function validerDemande(d: DemandeReinitialisation): string | null {
  if (!UUID_JETON.test(d.jeton)) return "Étape expirée : recommencez par le calcul de ce qui sera supprimé.";
  if (d.phrase.trim() !== PHRASE_REINITIALISATION) return `Recopiez exactement la phrase « ${PHRASE_REINITIALISATION} ».`;
  const motif = d.motif.trim();
  if (motif.length < MOTIF_MIN) return `Indiquez un motif d'au moins ${MOTIF_MIN} caractères.`;
  if (motif.length > MOTIF_MAX) return `Le motif ne peut pas dépasser ${MOTIF_MAX} caractères.`;
  if (!d.compris) return "Cochez la case pour confirmer que vous avez compris que c'est irréversible.";
  return null;
}
