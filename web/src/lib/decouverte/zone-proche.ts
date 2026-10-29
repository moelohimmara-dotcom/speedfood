/** Quartier le plus proche d'une position GPS (pur, testable) : sert à remplir le champ « quartier » une fois la position trouvée. */

export interface ZoneAvecPoint {
  id: string;
  libelle: string;
  groupe?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const RAYON_TERRE_KM = 6371;
const enRadians = (d: number) => (d * Math.PI) / 180;

/** Distance à vol d'oiseau (haversine), en km. */
export function distanceDroiteKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = enRadians(b.latitude - a.latitude);
  const dLon = enRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(enRadians(a.latitude)) * Math.cos(enRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** La zone dont le centre est le plus proche de la position, si elle est à moins de `maxKm` ; `null` sinon (aucune coordonnée, trop loin). */
export function zoneLaPlusProche(
  position: { latitude: number; longitude: number },
  zones: readonly ZoneAvecPoint[],
  maxKm = 5
): { zone: ZoneAvecPoint; km: number } | null {
  let meilleure: { zone: ZoneAvecPoint; km: number } | null = null;
  for (const z of zones) {
    if (typeof z.latitude !== "number" || typeof z.longitude !== "number") continue;
    const km = distanceDroiteKm(position, { latitude: z.latitude, longitude: z.longitude });
    if (km <= maxKm && (meilleure === null || km < meilleure.km)) meilleure = { zone: z, km };
  }
  return meilleure;
}
