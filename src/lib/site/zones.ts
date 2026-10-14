import { cache } from "react";
import { creerClientPublic } from "@/lib/db/public";
import { lireAccueil } from "@/lib/site/accueil";
import { slugQuartier } from "@/lib/site/quartiers";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";

/**
 * Zones de recherche de l'accueil, construites sur la géographie réellement enregistrée : commune → quartier.
 * Aucun niveau inventé (région, préfecture, sous-préfecture : absents de la base à ce jour) et aucun comptage supposé :
 * les décomptes viennent des restaurants publiés.
 */

export interface ZoneQuartier {
  id: string;
  nom: string;
  slug: string;
  nomsAlternatifs: string[];
  latitude: number | null;
  longitude: number | null;
  restaurants: number;
  ouverts: number;
}

export interface ZoneCommune {
  id: string;
  /** Ville de la commune (Conakry). */
  villeNom: string;
  nom: string;
  slug: string;
  nomsAlternatifs: string[];
  latitude: number | null;
  longitude: number | null;
  restaurants: number;
  ouverts: number;
  quartiers: ZoneQuartier[];
}

export interface ZoneChoisie {
  niveau: "commune" | "quartier";
  /** Identifiant du quartier choisi (vide pour une commune). */
  id: string;
  nom: string;
  slug: string;
  /** Commune d'un quartier choisi (vide pour une commune). */
  communeNom: string;
  /** Ville de la zone choisie. */
  villeNom: string;
}

/** Paramètres d'adresse de l'accueil qui désignent la zone choisie : `?commune=slug` ou `?quartier=slug`. */
export interface ParametresZone {
  commune?: string | string[];
  quartier?: string | string[];
}

const estOuvert = (r: RestaurantCatalogue) => r.ouvert && r.accepteCommandes;

const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Communes et quartiers actifs, avec le nombre de restaurants publiés et ouverts. Liste vide si la lecture échoue. */
export const lireZones = cache(async (): Promise<ZoneCommune[]> => {
  const supabase = creerClientPublic();
  const [{ data: communes, error: erreurCommunes }, { data: quartiers, error: erreurQuartiers }, accueil] = await Promise.all([
    supabase.from("communes").select("id, nom, noms_alternatifs, latitude, longitude, villes(nom)").eq("actif", true).order("nom"),
    supabase.from("neighborhoods").select("id, nom, commune_id, noms_alternatifs, latitude, longitude").eq("actif", true).order("nom"),
    lireAccueil(),
  ]);
  if (erreurCommunes || erreurQuartiers || !communes || !quartiers) return [];

  const compter = (filtre: (r: RestaurantCatalogue) => boolean) => {
    const liste = accueil.restaurants.filter(filtre);
    return { restaurants: liste.length, ouverts: liste.filter(estOuvert).length };
  };

  return communes
    .map((c) => ({
      id: c.id,
      villeNom: (Array.isArray(c.villes) ? c.villes[0]?.nom : c.villes?.nom) ?? "",
      nom: c.nom,
      slug: slugQuartier(c.nom),
      nomsAlternatifs: c.noms_alternatifs ?? [],
      latitude: c.latitude,
      longitude: c.longitude,
      ...compter((r) => r.communeNom === c.nom),
      quartiers: quartiers
        .filter((q) => q.commune_id === c.id)
        .map((q) => ({ id: q.id, nom: q.nom, slug: slugQuartier(q.nom), nomsAlternatifs: q.noms_alternatifs ?? [], latitude: q.latitude, longitude: q.longitude, ...compter((r) => r.communeNom === c.nom && r.quartier === q.nom) }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
});

/**
 * Zone demandée par l'adresse, validée contre les zones connues : un paramètre inconnu ou fantaisiste donne `null`
 * (jamais une zone inventée). Un quartier prime sur une commune si les deux sont présents.
 */
export function resoudreZone(params: ParametresZone, zones: ZoneCommune[]): ZoneChoisie | null {
  const quartierSlug = premier(params.quartier)?.slice(0, 80);
  if (quartierSlug) {
    for (const commune of zones) {
      const q = commune.quartiers.find((x) => x.slug === quartierSlug);
      if (q) return { niveau: "quartier", id: q.id, nom: q.nom, slug: q.slug, communeNom: commune.nom, villeNom: commune.villeNom };
    }
  }
  const communeSlug = premier(params.commune)?.slice(0, 80);
  if (communeSlug) {
    const c = zones.find((x) => x.slug === communeSlug);
    if (c) return { niveau: "commune", id: "", nom: c.nom, slug: c.slug, communeNom: "", villeNom: c.villeNom };
  }
  return null;
}

/** Restaurants d'une zone ; sans zone, tous. */
export function restaurantsDeLaZone(restaurants: RestaurantCatalogue[], zone: ZoneChoisie | null): RestaurantCatalogue[] {
  if (!zone) return restaurants;
  if (zone.niveau === "commune") return restaurants.filter((r) => r.communeNom === zone.nom);
  return restaurants.filter((r) => r.quartier === zone.nom && r.communeNom === zone.communeNom);
}

/** Adresse de l'accueil pour une zone (ancre sur la section des résultats). */
export function lienZone(zone: Pick<ZoneChoisie, "niveau" | "slug">): string {
  const cle = zone.niveau === "commune" ? "commune" : "quartier";
  return `/?${cle}=${encodeURIComponent(zone.slug)}#zone`;
}

/** Adresse du catalogue filtré sur la zone (quartier : identifiant ; commune : nom d'adresse, filtré par la page des restaurants). */
export function lienRestaurantsZone(zone: Pick<ZoneChoisie, "niveau" | "id" | "slug">): string {
  return zone.niveau === "quartier"
    ? `/restaurants?quartier=${encodeURIComponent(zone.id)}`
    : `/restaurants?commune=${encodeURIComponent(zone.slug)}`;
}
