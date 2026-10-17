// Pur, sans dépendance externe : testable seul (npm run test:unit). Voir docs/LIVRAISON.md §2.
import { distanceVolOiseauKm, pointValide, type Point } from "./frais";

/**
 * Répartition des courses, à la manière des plateformes : le livreur DISPONIBLE le plus proche du restaurant reçoit
 * l'offre ; s'il refuse ou ne répond pas à temps, elle passe au suivant ; personne d'autre n'est sollicité deux fois
 * pour la même livraison.
 */

export interface CandidatLivreur {
  id: string;
  statut: "hors_ligne" | "disponible" | "en_course";
  latitude: number | null;
  longitude: number | null;
  /** Dernière mise à jour de sa position (ISO). */
  positionLe: string | null;
  /** Fin de sa dernière course (ISO) : à distance égale, celui qui attend depuis le plus longtemps passe d'abord. */
  derniereCourseLe: string | null;
}

export interface OptionsRepartition {
  /** Livreurs déjà sollicités (refus, expiration) pour cette livraison. */
  exclus: ReadonlySet<string>;
  /** Au-delà, un livreur est trop loin du restaurant pour être sollicité. */
  rayonKm: number;
  /** Une position plus vieille que cela n'est plus fiable. */
  positionMaxMinutes: number;
  maintenant: Date;
}

export const OPTIONS_PAR_DEFAUT = { rayonKm: 15, positionMaxMinutes: 10 } as const;

export interface LivreurChoisi {
  livreurId: string;
  distanceKm: number;
}

export function choisirLivreur(candidats: readonly CandidatLivreur[], depart: Point, options: OptionsRepartition): LivreurChoisi | null {
  if (!pointValide(depart)) return null;
  const limiteMs = options.positionMaxMinutes * 60_000;
  const retenus: { livreurId: string; distanceKm: number; inactifDepuis: number }[] = [];
  for (const c of candidats) {
    if (c.statut !== "disponible" || options.exclus.has(c.id)) continue;
    if (c.latitude === null || c.longitude === null || c.positionLe === null) continue;
    const position = { latitude: c.latitude, longitude: c.longitude };
    if (!pointValide(position)) continue;
    const age = options.maintenant.getTime() - new Date(c.positionLe).getTime();
    if (!Number.isFinite(age) || age > limiteMs || age < -60_000) continue;
    const distanceKm = distanceVolOiseauKm(position, depart);
    if (distanceKm > options.rayonKm) continue;
    retenus.push({
      livreurId: c.id,
      distanceKm,
      // Jamais de course : le plus ancien possible (il passe avant ceux qui viennent de finir).
      inactifDepuis: c.derniereCourseLe ? new Date(c.derniereCourseLe).getTime() : 0,
    });
  }
  if (retenus.length === 0) return null;
  retenus.sort((a, b) => {
    // Deux livreurs à moins de 100 m l'un de l'autre sont à égalité : le plus longtemps inactif passe d'abord.
    if (Math.abs(a.distanceKm - b.distanceKm) < 0.1) return a.inactifDepuis - b.inactifDepuis || a.livreurId.localeCompare(b.livreurId);
    return a.distanceKm - b.distanceKm;
  });
  const premier = retenus[0];
  return { livreurId: premier.livreurId, distanceKm: Math.round(premier.distanceKm * 100) / 100 };
}

/** Une offre est expirée à partir de son échéance (l'échéance elle-même est déjà dépassée). */
export function offreExpiree(expireLe: string, maintenant: Date): boolean {
  return new Date(expireLe).getTime() <= maintenant.getTime();
}

export function echeanceOffre(maintenant: Date, delaiSecondes: number): string {
  return new Date(maintenant.getTime() + delaiSecondes * 1000).toISOString();
}
