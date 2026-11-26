import type { PointCarte } from './livraison-suivi.ts';
/**
 * Position du client sur la carte de sa livraison (lot 2). FACULTATIVE : le client la demande lui-même (« Me situer sur la carte »), le téléphone ne la lit que pendant que
 * l'écran de suivi est ouvert, et elle RESTE SUR LE TÉLÉPHONE : aucune position du client n'est envoyée à Speedfood, au restaurant ni au livreur (c'est le lot 3, séparé, qui demanderait un
 * accord distinct). Elle n'est ni conservée ni journalisée. Refus ou panne : on le dit simplement, la carte et le suivi continuent sans.
 * Le module de localisation est injecté : les tests n'ont pas besoin d'un téléphone.
 */
export type ResultatPosition = { genre: 'ok'; point: PointCarte } | { genre: 'refusee' } | { genre: 'indisponible' };
export interface DependancesPosition {
  demanderPermission(): Promise<'accordee' | 'refusee'>;
  lirePosition(): Promise<PointCarte | null>;
}
/** Une lecture de position ne doit jamais bloquer l'écran : au-delà, on la tient pour indisponible. */
export const DELAI_LECTURE_POSITION_MS = 12000;
/** Tant que le client garde sa position affichée, elle est relue à la même cadence que le suivi. */
export const INTERVALLE_POSITION_MS = 15000;
export const MESSAGE_POSITION_LOCALE = 'Votre position reste sur votre téléphone : elle n’est envoyée à personne.';
export const MESSAGE_POSITION_REFUSEE = 'La localisation est refusée pour Speedfood. Vous pouvez l’autoriser dans les réglages du téléphone.';
export const MESSAGE_POSITION_INDISPONIBLE = 'Position introuvable. Activez la localisation du téléphone, puis réessayez.';

const valide = (p: PointCarte | null): p is PointCarte =>
  p !== null && typeof p === 'object' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

function avecDelai<T>(promesse: Promise<T>, delaiMs: number): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const minuterie = setTimeout(() => rejeter(new Error('delai')), delaiMs);
    promesse.then(v => { clearTimeout(minuterie); resoudre(v); }, e => { clearTimeout(minuterie); rejeter(e); });
  });
}

/** Demande l'autorisation (sans bruit si elle est déjà accordée) puis lit la position une fois. Ne lève jamais. */
export async function situerClient(d: DependancesPosition, delaiMs: number = DELAI_LECTURE_POSITION_MS): Promise<ResultatPosition> {
  let permission: 'accordee' | 'refusee';
  try { permission = await avecDelai(d.demanderPermission(), delaiMs); } catch { return { genre: 'indisponible' }; }
  if (permission !== 'accordee') return { genre: 'refusee' };
  try {
    const point = await avecDelai(d.lirePosition(), delaiMs);
    return valide(point) ? { genre: 'ok', point: { latitude: point.latitude, longitude: point.longitude } } : { genre: 'indisponible' };
  } catch { return { genre: 'indisponible' }; }
}

/** Distance à vol d'oiseau en mètres (formule de haversine). */
export function distanceMetres(a: PointCarte, b: PointCarte): number {
  const R = 6371000; const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude); const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** « moins de 50 m », « environ 350 m », « environ 1,2 km » : une précision à la mesure d'une position de téléphone. */
export function texteDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (metres < 50) return 'moins de 50 m';
  const arrondi = Math.round(metres / 10) * 10;
  if (arrondi < 1000) return `environ ${arrondi} m`;
  const km = metres / 1000;
  return `environ ${(km < 10 ? Math.round(km * 10) / 10 : Math.round(km)).toLocaleString('fr-FR')} km`;
}
/** La seule phrase qui compare deux positions : calculée sur le téléphone, jamais envoyée. */
export function phraseDistanceLivreur(vous: PointCarte | null, livreur: PointCarte | null): string | null {
  return vous !== null && livreur !== null ? `Le livreur est à ${texteDistance(distanceMetres(vous, livreur))} de vous.` : null;
}
