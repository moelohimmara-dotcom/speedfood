/**
 * Affichage du suivi de commande (parité Kotlin, tranche 10.4, `SuiviScreen` et `SuiviViewModel`) : libellé et ton d'état, frise d'étapes, estimation de préparation, message après la réponse du
 * restaurant, relecture automatique. Fonctions pures, sans réseau : les textes sont ceux de l'ancienne appli.
 */
export const STATUTS_FINAUX: ReadonlySet<string> = new Set(['terminee', 'refusee', 'annulee']);
export const estFinal = (statut: string): boolean => STATUTS_FINAUX.has(statut);
/** Relecture toutes les 15 secondes tant que l'écran est ouvert et que la commande n'est pas dans un état final. */
export const DELAI_RELECTURE_MS = 15000;
export const doitRelire = (statut: string): boolean => !estFinal(statut);

/** Libellé lisible d'un état (jamais le mot technique). Une proposition en attente du client prime sur l'état. */
export function libelleStatutSuivi(statut: string, etatDerive: string = statut): string {
  if (etatDerive === 'attente_confirmation_client') return 'Le restaurant propose un changement';
  switch (statut) {
    case 'en_attente': return 'En attente du restaurant';
    case 'acceptee': return 'Acceptée, en préparation';
    case 'prete': return 'Prête';
    case 'terminee': return 'Terminée';
    case 'refusee': return 'Refusée par le restaurant';
    case 'annulee': return 'Annulée';
    default: return 'Statut en cours de mise à jour';
  }
}
export type TonStatut = 'succes' | 'neutre' | 'danger';
export function tonStatut(statut: string): TonStatut {
  if (statut === 'refusee' || statut === 'annulee') return 'danger';
  return statut === 'acceptee' || statut === 'prete' || statut === 'terminee' ? 'succes' : 'neutre';
}

export const ETAPES_SUIVI: ReadonlyArray<{ statut: string; libelle: string }> = [
  { statut: 'en_attente', libelle: 'Envoyée' }, { statut: 'acceptee', libelle: 'Acceptée' }, { statut: 'prete', libelle: 'Prête' }, { statut: 'terminee', libelle: 'Terminée' },
];
/** Étape en cours (0 à 3, un état inconnu vaut 0) ; `null` pour une commande refusée ou annulée : aucune frise. */
export function etapeActuelle(statut: string): number | null {
  if (statut === 'refusee' || statut === 'annulee') return null;
  return Math.max(0, ETAPES_SUIVI.findIndex(e => e.statut === statut));
}

/** HH:MM en heure de Conakry (GMT, sans changement d'heure), comme l'ancienne appli ; vide si la date est absente ou illisible. */
export function heureLisible(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || iso.trim() === '') return '';
  const t = Date.parse(iso); if (!Number.isFinite(t)) return '';
  const reste = Math.floor(t / 1000) % 86400; const r = reste < 0 ? reste + 86400 : reste;
  return `${String(Math.floor(r / 3600)).padStart(2, '0')}:${String(Math.floor((r % 3600) / 60)).padStart(2, '0')}`;
}
/** « Prête vers 14:05 (estimation du restaurant) » une fois estimée ; avant la réponse du restaurant, son délai habituel s'il en déclare un ; sinon rien. */
export function previsionPreparation(s: { statut: string; pretEstimeeLe: string | null; delaiPreparationMinutes: number | null }): string | null {
  const heure = heureLisible(s.pretEstimeeLe);
  if (heure !== '') return `Prête vers ${heure} (estimation du restaurant)`;
  if (s.statut === 'en_attente' && s.delaiPreparationMinutes !== null) return `Délai habituel de préparation : environ ${s.delaiPreparationMinutes} min`;
  return null;
}
/** Une fois le restaurant répondu (et tant que ce n'est pas fini), modifier ou annuler passe par l'assistance. */
export function messageRestaurantARepondu(statut: string): string | null {
  return statut === 'en_attente' || estFinal(statut) ? null : 'Le restaurant a répondu : pour modifier ou annuler cette commande, appelez l’assistance Speedfood.';
}
