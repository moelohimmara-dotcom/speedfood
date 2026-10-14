import { creerClientPublic } from "@/lib/db/public";
import type { CibleLivraison, LigneZoneDesservie } from "@/lib/site/livraison";
import type { ZoneChoisie, ZoneCommune } from "@/lib/site/zones";

/**
 * Lecture publique des zones desservies (la RLS ne renvoie que celles des restaurants publiés). Une erreur de lecture donne une
 * table vide : on n'affirme alors rien sur la livraison plutôt que d'afficher une information fausse.
 */
export async function lireLivraisonDesRestaurants(restaurantIds: string[]): Promise<Map<string, LigneZoneDesservie[]>> {
  const resultat = new Map<string, LigneZoneDesservie[]>();
  if (restaurantIds.length === 0) return resultat;
  const { data, error } = await creerClientPublic()
    .from("restaurant_zones_desservies")
    .select("restaurant_id, commune_id, neighborhood_id, frais_gnf, delai_minutes")
    .in("restaurant_id", restaurantIds);
  if (error || !data) return resultat;
  for (const l of data) {
    const lignes = resultat.get(l.restaurant_id) ?? [];
    lignes.push({ communeId: l.commune_id, quartierId: l.neighborhood_id, fraisGnf: l.frais_gnf, delaiMinutes: l.delai_minutes });
    resultat.set(l.restaurant_id, lignes);
  }
  return resultat;
}

/** Quartier → commune, pour savoir si une ligne de quartier se trouve dans la commune regardée. */
export function communesDesQuartiers(zones: ZoneCommune[]): Map<string, string> {
  return new Map(zones.flatMap((c) => c.quartiers.map((q) => [q.id, c.id] as const)));
}

/**
 * La zone choisie par le visiteur, exprimée en identifiants (commune ou quartier + sa commune). `null` pour une préfecture ou une
 * région : la livraison se déclare par commune ou quartier, on ne dit rien à l'échelle d'une préfecture entière.
 */
export function cibleDeZone(zone: ZoneChoisie, zones: ZoneCommune[]): CibleLivraison | null {
  if (zone.niveau === "commune") {
    return zones.some((c) => c.id === zone.id) ? { niveau: "commune", id: zone.id, communeId: zone.id } : null;
  }
  if (zone.niveau === "quartier") {
    const c = zones.find((x) => x.quartiers.some((q) => q.id === zone.id));
    return c ? { niveau: "quartier", id: zone.id, communeId: c.id } : null;
  }
  return null;
}
