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

/** Pour une commande : la position fraîche n'est attendue que ce temps-là, puis on se rabat sur la dernière position connue du téléphone. Reste sous `DELAI_LECTURE_POSITION_MS`. */
export const DELAI_POSITION_FRAICHE_MS = 8000;
/** Âge maximal d'une dernière position connue acceptée en repli : au-delà, le client a pu se déplacer, on préfère dire « introuvable ». */
export const AGE_MAX_DERNIERE_POSITION_MS = 10 * 60 * 1000;
/** Une lecture de la dernière position connue est locale et instantanée : sans réponse en 3 s, on la tient pour absente. */
const DELAI_DERNIERE_POSITION_MS = 3000;
/** Les deux lectures que le téléphone sait faire ; injectées pour que les tests n'aient pas besoin d'un téléphone. */
export interface SourceLocalisation {
  positionActuelle(): Promise<PointCarte | null>;
  derniereConnue(ageMaxMs: number): Promise<PointCarte | null>;
}
/**
 * Position fraîche d'abord (au plus `delaiFraicheMs`) ; si elle manque (pas de signal, GPS à froid, service lent, erreur), la dernière position connue du téléphone si elle a moins de `ageMaxMs`.
 * Ne lève jamais : `null` quand ni l'une ni l'autre n'est valable. Une position invalide (hors des bornes) n'est jamais renvoyée.
 */
export async function lirePositionAvecRepli(source: SourceLocalisation, delaiFraicheMs: number = DELAI_POSITION_FRAICHE_MS, ageMaxMs: number = AGE_MAX_DERNIERE_POSITION_MS): Promise<PointCarte | null> {
  try { const p = await avecDelai(source.positionActuelle(), delaiFraicheMs); if (valide(p)) return { latitude: p.latitude, longitude: p.longitude }; } catch { /* repli ci-dessous */ }
  try { const d = await avecDelai(source.derniereConnue(ageMaxMs), DELAI_DERNIERE_POSITION_MS); return valide(d) ? { latitude: d.latitude, longitude: d.longitude } : null; } catch { return null; }
}
/** Lien qui ouvre un point dans l'application de cartes du téléphone (Google Maps si elle est installée, sinon le navigateur) : aucune clé, aucun quota, aucune tuile à charger. */
export const lienCarte = (p: PointCarte): string => `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
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
