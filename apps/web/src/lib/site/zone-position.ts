// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * « Utiliser ma position » : rattache une position à une zone Speedfood (commune ou quartier enregistré).
 * Le nom du lieu vient d'un géocodage inverse OpenStreetMap (Nominatim) fait côté serveur ; ici on ne fait que
 * rapprocher ce nom des zones réellement enregistrées. Aucune zone n'est inventée : sans correspondance, le résultat est `null`.
 */

export interface QuartierMin {
  id: string;
  nom: string;
  slug: string;
  /** Autres façons d'écrire le nom (ajoutées depuis la console) : « Kipé » = « Kipe Centre ». */
  nomsAlternatifs?: string[];
  /** Point central approximatif (OpenStreetMap), absent si le lieu n'y est pas nommé. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface CommuneMin {
  id?: string;
  /** Préfecture de la commune (pour choisir la commune la plus proche à l'intérieur d'une préfecture reconnue par son nom). */
  prefectureId?: string;
  villeNom: string;
  nom: string;
  slug: string;
  nomsAlternatifs?: string[];
  latitude?: number | null;
  longitude?: number | null;
  quartiers: QuartierMin[];
}

/** Préfecture ou région : on ne connaît d'elles que leur nom, leur adresse et leur point central. */
export interface ZoneLargeMin {
  id: string;
  nom: string;
  slug: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ZoneTrouvee {
  niveau: "region" | "prefecture" | "commune" | "quartier";
  id: string;
  nom: string;
  slug: string;
  communeNom: string;
  villeNom: string;
}

/** Rectangle englobant la Guinée : au-delà, aucune requête n'est faite (pas de service sollicité pour rien). */
const GUINEE = { latMin: 7.1, latMax: 12.8, lonMin: -15.2, lonMax: -7.6 };

export function positionDansLaGuinee(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= GUINEE.latMin &&
    latitude <= GUINEE.latMax &&
    longitude >= GUINEE.lonMin &&
    longitude <= GUINEE.lonMax
  );
}

/** Trois décimales (environ 100 m) : suffisant pour trouver un quartier, et on ne transmet pas la position exacte. */
export function arrondirCoordonnee(valeur: number): number {
  return Math.round(valeur * 1000) / 1000;
}

/** Sans accents ni casse, sans préfixes administratifs (« Commune de Ratoma » = « Ratoma »). */
export function normaliserNom(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(commune urbaine de|commune de|quartier de|quartier|district de|prefecture de|ville de|region de|region|prefecture)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nom et noms alternatifs d'une zone, normalisés. */
function nomsDe(zone: { nom: string; nomsAlternatifs?: string[] }): string[] {
  return [zone.nom, ...(zone.nomsAlternatifs ?? [])].map(normaliserNom).filter((n) => n !== "");
}

/** Champs d'adresse Nominatim, du plus précis au plus large. */
const CHAMPS_PRECIS = ["neighbourhood", "quarter", "suburb", "city_district", "village", "hamlet"];
const CHAMPS_LARGES = ["city_district", "suburb", "municipality", "county", "city", "town", "village", "hamlet", "state_district"];

function valeurs(adresse: Record<string, unknown>, champs: string[]): string[] {
  return champs
    .map((c) => adresse[c])
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map(normaliserNom)
    .filter((v) => v !== "");
}

/**
 * Zone enregistrée correspondant à l'adresse renvoyée par le géocodage : un quartier si son nom apparaît dans l'adresse
 * (avec sa commune si elle y figure aussi, pour départager deux quartiers de même nom), sinon une commune. `null` sinon.
 */
export function correspondreZone(adresse: Record<string, unknown>, communes: CommuneMin[]): ZoneTrouvee | null {
  const precis = valeurs(adresse, CHAMPS_PRECIS);
  const larges = valeurs(adresse, CHAMPS_LARGES);
  const tous = new Set([...precis, ...larges]);

  for (const nom of precis) {
    const candidats = communes.flatMap((c) => c.quartiers.filter((q) => nomsDe(q).includes(nom)).map((q) => ({ c, q })));
    if (candidats.length === 0) continue;
    const choisi = candidats.find(({ c }) => nomsDe(c).some((n) => tous.has(n))) ?? candidats[0];
    return { niveau: "quartier", id: choisi.q.id, nom: choisi.q.nom, slug: choisi.q.slug, communeNom: choisi.c.nom, villeNom: choisi.c.villeNom };
  }
  for (const nom of larges) {
    const c = communes.find((x) => nomsDe(x).includes(nom));
    if (c) return { niveau: "commune", id: "", nom: c.nom, slug: c.slug, communeNom: "", villeNom: c.villeNom };
  }
  return null;
}

/** Distance en kilomètres entre deux points (formule de haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Un quartier dont le point central est plus loin que cela n'est pas retenu : mieux vaut la commune que le mauvais quartier. */
export const RAYON_QUARTIER_KM = 1.2;
/** Au-delà, la position n'est rattachée à aucune commune connue (les sous-préfectures de l'intérieur du pays sont grandes). */
export const RAYON_COMMUNE_KM = 40;

/**
 * Zone enregistrée la plus proche d'une position, d'après les points centraux : le quartier le plus proche s'il est à moins de
 * `RAYON_QUARTIER_KM`, sinon la commune la plus proche à moins de `RAYON_COMMUNE_KM`, sinon `null`. Repli du rapprochement par nom,
 * et seule voie quand le service de cartographie ne répond pas.
 */
export function zoneLaPlusProche(latitude: number, longitude: number, communes: CommuneMin[]): ZoneTrouvee | null {
  let meilleurQuartier: { d: number; c: CommuneMin; q: QuartierMin } | null = null;
  for (const c of communes) {
    for (const q of c.quartiers) {
      if (typeof q.latitude !== "number" || typeof q.longitude !== "number") continue;
      const d = distanceKm(latitude, longitude, q.latitude, q.longitude);
      if (!meilleurQuartier || d < meilleurQuartier.d) meilleurQuartier = { d, c, q };
    }
  }
  if (meilleurQuartier && meilleurQuartier.d <= RAYON_QUARTIER_KM) {
    const { c, q } = meilleurQuartier;
    return { niveau: "quartier", id: q.id, nom: q.nom, slug: q.slug, communeNom: c.nom, villeNom: c.villeNom };
  }
  let meilleureCommune: { d: number; c: CommuneMin } | null = null;
  for (const c of communes) {
    if (typeof c.latitude !== "number" || typeof c.longitude !== "number") continue;
    const d = distanceKm(latitude, longitude, c.latitude, c.longitude);
    if (!meilleureCommune || d < meilleureCommune.d) meilleureCommune = { d, c };
  }
  if (meilleureCommune && meilleureCommune.d <= RAYON_COMMUNE_KM) {
    const { c } = meilleureCommune;
    return { niveau: "commune", id: "", nom: c.nom, slug: c.slug, communeNom: "", villeNom: c.villeNom };
  }
  return null;
}

/** Champs d'adresse Nominatim qui peuvent désigner une préfecture ou une région. */
const CHAMPS_PREFECTURE = ["county", "state_district", "city", "town", "municipality"];
const CHAMPS_REGION = ["state", "region"];

function correspondreLarge(adresse: Record<string, unknown>, champs: string[], zones: ZoneLargeMin[]): ZoneLargeMin | null {
  for (const nom of valeurs(adresse, champs)) {
    const z = zones.find((x) => normaliserNom(x.nom) === nom);
    if (z) return z;
  }
  return null;
}

/**
 * Zone d'une position, à l'échelle du pays, de la plus précise à la plus large :
 * 1. le quartier ou la commune reconnus par leur nom dans l'adresse OpenStreetMap ;
 * 2. la préfecture reconnue par son nom : la commune la plus proche à l'intérieur de cette préfecture, sinon la préfecture ;
 * 3. à défaut d'adresse exploitable, le quartier (à moins de 1,2 km) ou la commune (à moins de 40 km) dont le point est le plus proche ;
 * 4. la région reconnue par son nom ; sinon `null`.
 * Aucune zone n'est inventée.
 */
export function zoneDeLaPosition(
  latitude: number,
  longitude: number,
  adresse: Record<string, unknown> | null,
  communes: CommuneMin[],
  prefectures: ZoneLargeMin[],
  regions: ZoneLargeMin[]
): ZoneTrouvee | null {
  const parNom = adresse ? correspondreZone(adresse, communes) : null;
  if (parNom) return parNom;

  const prefecture = adresse ? correspondreLarge(adresse, CHAMPS_PREFECTURE, prefectures) : null;
  if (prefecture) {
    const dedans = communes.filter((c) => c.prefectureId === prefecture.id);
    const proche = zoneLaPlusProche(latitude, longitude, dedans);
    if (proche) return proche;
    return { niveau: "prefecture", id: prefecture.id, nom: prefecture.nom, slug: prefecture.slug, communeNom: "", villeNom: "" };
  }

  const parProximite = zoneLaPlusProche(latitude, longitude, communes);
  if (parProximite) return parProximite;

  const region = adresse ? correspondreLarge(adresse, CHAMPS_REGION, regions) : null;
  return region ? { niveau: "region", id: region.id, nom: region.nom, slug: region.slug, communeNom: "", villeNom: "" } : null;
}
