/**
 * Dates affichées au client : « 18 nov. à 14:30 », heure de Conakry (UTC, sans heure d'été), sans secondes ni fuseau de l'appareil.
 * Calcul direct, sans `Intl` : les fuseaux nommés ne sont pas garantis sur tous les moteurs d'un téléphone d'entrée de gamme.
 */
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function dateLisible(valeur: string | number | Date): string {
  const d = new Date(valeur);
  if (!Number.isFinite(d.getTime())) return 'date inconnue';
  const deux = (n: number) => String(n).padStart(2, '0');
  return d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()] + ' à ' + deux(d.getUTCHours()) + ':' + deux(d.getUTCMinutes());
}
