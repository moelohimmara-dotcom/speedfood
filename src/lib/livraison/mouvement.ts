// Pur, sans dépendance : testable seul (npm run test:unit). Déplacement des livreurs de démonstration.
import { distanceVolOiseauKm, pointValide, type Point } from "./frais";

/**
 * Vitesse de la démonstration : un trajet de 3 km dure environ une minute et demie au lieu d'un quart d'heure. Les positions sont
 * vraies (le livreur de démonstration « roule » vraiment vers sa cible), seul le temps est accéléré.
 */
export const VITESSE_DEMO_KMH = 120;
/** En dessous de cette distance (km), le livreur est considéré comme arrivé. */
export const SEUIL_ARRIVEE_KM = 0.05;
/** Plafond d'un pas de calcul : une page restée fermée ne fait pas « téléporter » le livreur d'un coup. */
export const PAS_MAX_SECONDES = 30;

export interface ResultatPas {
  position: Point;
  arrive: boolean;
  /** Distance restante après le pas, en km. */
  resteKm: number;
}

/**
 * Avance de `ecoule` secondes depuis `de` vers `vers`, à `vitesseKmh`. Ligne droite (la démonstration ne suit pas les routes) ;
 * s'arrête exactement sur la cible, ne la dépasse jamais.
 */
export function pasVers(de: Point, vers: Point, vitesseKmh: number, ecouleSecondes: number): ResultatPas {
  if (!pointValide(de) || !pointValide(vers) || !Number.isFinite(vitesseKmh) || vitesseKmh <= 0) {
    return { position: de, arrive: false, resteKm: Number.NaN };
  }
  const dt = Math.min(Math.max(0, ecouleSecondes), PAS_MAX_SECONDES);
  const reste = distanceVolOiseauKm(de, vers);
  if (reste <= SEUIL_ARRIVEE_KM) return { position: { ...vers }, arrive: true, resteKm: 0 };
  const parcourable = (vitesseKmh * dt) / 3600;
  if (parcourable >= reste - SEUIL_ARRIVEE_KM) return { position: { ...vers }, arrive: true, resteKm: 0 };
  const f = parcourable / reste;
  return {
    position: {
      latitude: de.latitude + (vers.latitude - de.latitude) * f,
      longitude: de.longitude + (vers.longitude - de.longitude) * f,
    },
    arrive: false,
    resteKm: reste - parcourable,
  };
}

/** Heure d'arrivée estimée, en minutes, à la vitesse RÉELLE (pas celle de la démonstration). */
export function minutesRestantes(resteKm: number, vitesseMoyenneKmh: number): number {
  if (!Number.isFinite(resteKm) || resteKm < 0 || !Number.isFinite(vitesseMoyenneKmh) || vitesseMoyenneKmh <= 0) return 0;
  return Math.max(1, Math.ceil((resteKm / vitesseMoyenneKmh) * 60));
}
