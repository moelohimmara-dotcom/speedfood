// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/LIVRAISON.md.

/**
 * Calcul des frais de livraison, à la manière des plateformes de livraison de repas :
 * base + prix au kilomètre, minimum, gratuité à partir d'un montant, rayon maximal.
 * Montants en GNF ENTIERS, jamais de flottant. Le calcul se fait côté serveur uniquement.
 */

export interface ReglagesLivraison {
  /** Frais de départ, en GNF. */
  baseGnf: number;
  /** Prix du kilomètre, en GNF. */
  prixKmGnf: number;
  /** Minimum facturé, en GNF (jamais en dessous, sauf gratuité). */
  minimumGnf: number;
  /** Commande de ce montant (hors livraison) ou plus : livraison offerte. `null` = jamais. */
  gratuitDesGnf: number | null;
  /** Au-delà de cette distance (km), le restaurant ne livre pas. */
  rayonMaxKm: number;
  /** Arrondi au multiple supérieur, en GNF (500 par défaut : les pièces et billets courants). */
  arrondiGnf: number;
}

export const REGLAGES_PAR_DEFAUT: ReglagesLivraison = {
  baseGnf: 5000,
  prixKmGnf: 2000,
  minimumGnf: 8000,
  gratuitDesGnf: null,
  rayonMaxKm: 10,
  arrondiGnf: 500,
};

export interface Point {
  latitude: number;
  longitude: number;
}

const RAYON_TERRE_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function pointValide(p: Point | null | undefined): p is Point {
  return (
    !!p &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    p.latitude >= -90 &&
    p.latitude <= 90 &&
    p.longitude >= -180 &&
    p.longitude <= 180
  );
}

/** Distance à vol d'oiseau entre deux points, en kilomètres (formule de haversine). */
export function distanceVolOiseauKm(a: Point, b: Point): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Coefficient qui transforme une distance à vol d'oiseau en distance de route probable en ville. */
export const COEFFICIENT_URBAIN = 1.3;

/** Distance de route estimée quand le service d'itinéraires est indisponible. */
export function distanceRouteEstimeeKm(a: Point, b: Point): number {
  return distanceVolOiseauKm(a, b) * COEFFICIENT_URBAIN;
}

export type ResultatFrais =
  | { ok: true; fraisGnf: number; distanceKm: number; gratuite: boolean }
  | { ok: false; raison: "hors_rayon"; distanceKm: number; rayonMaxKm: number }
  | { ok: false; raison: "reglages_invalides" };

function entierPositif(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/** Les réglages saisis dans la console sont revérifiés ici : un montant négatif ou à virgule ne produit jamais de frais. */
export function reglagesValides(r: ReglagesLivraison): boolean {
  return (
    entierPositif(r.baseGnf) &&
    entierPositif(r.prixKmGnf) &&
    entierPositif(r.minimumGnf) &&
    (r.gratuitDesGnf === null || entierPositif(r.gratuitDesGnf)) &&
    Number.isFinite(r.rayonMaxKm) &&
    r.rayonMaxKm > 0 &&
    r.rayonMaxKm <= 200 &&
    Number.isInteger(r.arrondiGnf) &&
    r.arrondiGnf >= 1 &&
    r.arrondiGnf <= 10000
  );
}

/**
 * Frais d'une livraison de `distanceKm` pour une commande de `sousTotalGnf` (hors livraison).
 * `max(minimum, base + prix_km × distance)`, arrondi au multiple supérieur ; offerte à partir du seuil de gratuité ;
 * refusée au-delà du rayon maximal.
 */
export function calculerFraisLivraison(distanceKm: number, sousTotalGnf: number, reglages: ReglagesLivraison): ResultatFrais {
  if (!reglagesValides(reglages) || !Number.isFinite(distanceKm) || distanceKm < 0 || !entierPositif(sousTotalGnf)) {
    return { ok: false, raison: "reglages_invalides" };
  }
  const distance = Math.round(distanceKm * 100) / 100;
  if (distance > reglages.rayonMaxKm) {
    return { ok: false, raison: "hors_rayon", distanceKm: distance, rayonMaxKm: reglages.rayonMaxKm };
  }
  if (reglages.gratuitDesGnf !== null && sousTotalGnf >= reglages.gratuitDesGnf) {
    return { ok: true, fraisGnf: 0, distanceKm: distance, gratuite: true };
  }
  const brut = reglages.baseGnf + reglages.prixKmGnf * distance;
  const arrondi = Math.ceil(Math.round(brut * 100) / 100 / reglages.arrondiGnf) * reglages.arrondiGnf;
  return { ok: true, fraisGnf: Math.max(reglages.minimumGnf, arrondi), distanceKm: distance, gratuite: false };
}

/** Phrase de lecture des frais pour le client. */
export function libelleFrais(r: Extract<ResultatFrais, { ok: true }>): string {
  const km = r.distanceKm.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (r.gratuite) return `Livraison offerte (${km} km)`;
  return `Livraison : ${r.fraisGnf.toLocaleString("fr-FR")} GNF (${km} km)`;
}

/** Durée estimée du trajet, en minutes, à partir d'une vitesse moyenne ; au moins une minute. */
export function dureeEstimeeMinutes(distanceKm: number, vitesseMoyenneKmh: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(vitesseMoyenneKmh) || vitesseMoyenneKmh <= 0) return 0;
  return Math.max(1, Math.ceil((distanceKm / vitesseMoyenneKmh) * 60));
}
