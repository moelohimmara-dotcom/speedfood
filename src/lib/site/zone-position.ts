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
}

export interface CommuneMin {
  villeNom: string;
  nom: string;
  slug: string;
  quartiers: QuartierMin[];
}

export interface ZoneTrouvee {
  niveau: "commune" | "quartier";
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
    .replace(/\b(commune urbaine de|commune de|quartier de|quartier|district de|prefecture de|ville de)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Champs d'adresse Nominatim, du plus précis au plus large. */
const CHAMPS_PRECIS = ["neighbourhood", "quarter", "suburb", "city_district", "village", "hamlet"];
const CHAMPS_LARGES = ["city_district", "suburb", "municipality", "county", "city", "town", "state_district"];

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
    const candidats = communes.flatMap((c) => c.quartiers.filter((q) => normaliserNom(q.nom) === nom).map((q) => ({ c, q })));
    if (candidats.length === 0) continue;
    const choisi = candidats.find(({ c }) => tous.has(normaliserNom(c.nom))) ?? candidats[0];
    return { niveau: "quartier", id: choisi.q.id, nom: choisi.q.nom, slug: choisi.q.slug, communeNom: choisi.c.nom, villeNom: choisi.c.villeNom };
  }
  for (const nom of larges) {
    const c = communes.find((x) => normaliserNom(x.nom) === nom);
    if (c) return { niveau: "commune", id: "", nom: c.nom, slug: c.slug, communeNom: "", villeNom: c.villeNom };
  }
  return null;
}
