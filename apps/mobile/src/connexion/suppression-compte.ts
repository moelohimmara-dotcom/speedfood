/**
 * Suppression du compte (parité Kotlin, lot 1, ligne A8) : droit à l'effacement, IRRÉVERSIBLE. Le mot SUPPRIMER doit être écrit par la personne (le serveur le revérifie et refuse
 * les comptes professionnels). Un seul essai, jamais de relance : `refus` = rien n'a été supprimé ; `incertain` = la suppression a pu être faite, on ne le présente jamais comme un succès.
 */
export const MOT_CONFIRMATION = 'SUPPRIMER';

/** Même tolérance que le serveur : espaces autour et casse ignorés, mais le mot entier, rien d'autre. */
export function confirmationSuppressionValide(valeur: unknown): boolean {
  return typeof valeur === 'string' && valeur.trim().toUpperCase() === MOT_CONFIRMATION;
}

export class ErreurSuppressionCompte extends Error {
  readonly genre: 'refus' | 'incertain';
  constructor(genre: 'refus' | 'incertain', message: string) { super(message); this.name = 'ErreurSuppressionCompte'; this.genre = genre; }
}
