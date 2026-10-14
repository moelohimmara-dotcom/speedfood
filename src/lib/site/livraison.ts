// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Zones desservies par un restaurant : ce qu'on peut affirmer, et seulement cela.
 * Un restaurant sans zone déclarée n'a PAS dit qu'il ne livre pas : on ne prétend rien (« non déclarée »).
 * Frais et délai ne s'affichent que s'ils ont été renseignés par le restaurant.
 */

export interface LigneZoneDesservie {
  communeId: string | null;
  quartierId: string | null;
  fraisGnf: number | null;
  delaiMinutes: number | null;
}

/** La zone que regarde le visiteur : un quartier (avec sa commune) ou une commune entière. */
export interface CibleLivraison {
  niveau: "commune" | "quartier";
  /** Identifiant de la commune ou du quartier visé. */
  id: string;
  /** Commune du quartier visé (égale à `id` pour une commune). */
  communeId: string;
}

export type StatutLivraison =
  | { type: "livre"; fraisGnf: number | null; delaiMinutes: number | null }
  | { type: "partielle" }
  | { type: "non" }
  | { type: "non-declaree" };

export function statutLivraison(
  lignes: LigneZoneDesservie[],
  cible: CibleLivraison,
  communeDuQuartier: ReadonlyMap<string, string>
): StatutLivraison {
  if (lignes.length === 0) return { type: "non-declaree" };

  const quartier = cible.niveau === "quartier" ? lignes.find((l) => l.quartierId === cible.id) : undefined;
  const commune = lignes.find((l) => l.communeId === cible.communeId);
  // Une ligne de quartier est plus précise qu'une ligne de commune entière.
  const ligne = quartier ?? commune;
  if (ligne) return { type: "livre", fraisGnf: ligne.fraisGnf, delaiMinutes: ligne.delaiMinutes };

  if (cible.niveau === "commune" && lignes.some((l) => l.quartierId && communeDuQuartier.get(l.quartierId) === cible.id)) {
    return { type: "partielle" };
  }
  return { type: "non" };
}

const formatGnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

/** « Livraison : 10 000 GNF · environ 45 min » ou « Livraison gratuite » ; vide si rien n'est renseigné. */
export function detailLivraison(fraisGnf: number | null, delaiMinutes: number | null): string {
  const parties: string[] = [];
  if (fraisGnf !== null) parties.push(fraisGnf === 0 ? "gratuite" : formatGnf(fraisGnf));
  if (delaiMinutes !== null) parties.push(`environ ${delaiMinutes} min`);
  return parties.join(" · ");
}

/** Phrase courte pour une carte de restaurant, selon la zone regardée. `null` : on n'affirme rien. */
export function libelleLivraison(statut: StatutLivraison, zoneNom: string): string | null {
  switch (statut.type) {
    case "livre": {
      const detail = detailLivraison(statut.fraisGnf, statut.delaiMinutes);
      return detail ? `Livre à ${zoneNom} · ${detail}` : `Livre à ${zoneNom}`;
    }
    case "partielle":
      return `Livre dans certains quartiers de ${zoneNom}`;
    case "non":
      return `Ne livre pas à ${zoneNom} (retrait possible, selon le restaurant)`;
    case "non-declaree":
      return null;
  }
}
