/**
 * Règles pures de la file d'événements de commande : clé d'idempotence, délais de reprise, abandon.
 * Aucun accès réseau ni base : testables sans environnement. La tâche planifiée tourne toutes les
 * 5 minutes, donc les délais sont en minutes, jamais en secondes.
 */

/** Délais avant chaque nouvel essai, en secondes : 1 min, 5 min, 15 min, 1 h, 4 h. */
export const DELAIS_REPRISE_SECONDES: readonly number[] = [60, 300, 900, 3600, 14400];

/** Après ce nombre d'essais infructueux, l'événement est abandonné (la console restaurateur, qui surveille en continu, reste le filet). */
export const ESSAIS_MAX = 5;

/** Clé unique d'un événement : un même fait ne s'écrit qu'une fois, même si la création est rejouée. */
export function cleEvenement(commandeId: string, type: string): string {
  return `${commandeId}:${type}`;
}

/** Heure de la prochaine tentative après `essais` échecs (le premier échec attend le premier délai). */
export function prochaineTentative(essais: number, aPartirDe: Date): Date {
  const delai = DELAIS_REPRISE_SECONDES[Math.min(Math.max(essais, 0), DELAIS_REPRISE_SECONDES.length - 1)];
  return new Date(aPartirDe.getTime() + delai * 1000);
}

/** Vrai quand le nombre d'essais atteint le plafond : on abandonne et on le dit dans les journaux. */
export function estAbandonne(essais: number): boolean {
  return essais >= ESSAIS_MAX;
}
