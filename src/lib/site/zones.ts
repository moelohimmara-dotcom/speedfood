import { cache } from "react";
import { creerClientPublic } from "@/lib/db/public";
import { lireAccueil } from "@/lib/site/accueil";
import { slugQuartier } from "@/lib/site/quartiers";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";

/**
 * Zones de recherche, sur la géographie réellement enregistrée : région → préfecture → commune (ou sous-préfecture) → quartier.
 * Conakry est une région et une préfecture dont les communes ont leurs quartiers ; ailleurs, une commune est une sous-préfecture
 * et son quartier générique « Centre de … » n'est pas listé (il désigne la commune elle-même). Aucun niveau n'est inventé :
 * les décomptes viennent des restaurants publiés, et les zones se comparent par identifiant, jamais par nom.
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
  /** Annonce publique choisie par l'équipe (« Bientôt », « Pilote ») ; null sinon. Les autres statuts restent internes. */
  annonce: "bientot" | "pilote" | null;
  /** Ville de la commune (Conakry) ; vide hors Conakry. */
  villeNom: string;
  prefectureId: string;
  prefectureNom: string;
  regionNom: string;
  nom: string;
  slug: string;
  nomsAlternatifs: string[];
  latitude: number | null;
  longitude: number | null;
  restaurants: number;
  ouverts: number;
  quartiers: ZoneQuartier[];
}

export interface ZonePrefecture {
  id: string;
  nom: string;
  slug: string;
  regionId: string;
  regionNom: string;
  nomsAlternatifs: string[];
  latitude: number | null;
  longitude: number | null;
  restaurants: number;
  ouverts: number;
  communes: ZoneCommune[];
}

export interface ZoneRegion {
  id: string;
  nom: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  restaurants: number;
  ouverts: number;
  prefectures: ZonePrefecture[];
}

export type NiveauZone = "region" | "prefecture" | "commune" | "quartier";

export interface ZoneChoisie {
  niveau: NiveauZone;
  /** Identifiant de la zone choisie, à son niveau. */
  id: string;
  nom: string;
  slug: string;
  /** Commune d'un quartier choisi (vide sinon). */
  communeNom: string;
  /** Ville de la zone choisie (Conakry) ; vide hors Conakry. */
  villeNom: string;
  /** Préfecture et région de la zone (vides aux niveaux qui les contiennent). */
  prefectureNom: string;
  regionNom: string;
}

/** Paramètres d'adresse de l'accueil qui désignent la zone choisie : `?quartier=`, `?commune=`, `?prefecture=` ou `?region=`. */
export interface ParametresZone {
  quartier?: string | string[];
  commune?: string | string[];
  prefecture?: string | string[];
  region?: string | string[];
}

const CLE_ADRESSE: Record<NiveauZone, string> = { quartier: "quartier", commune: "commune", prefecture: "prefecture", region: "region" };

const estOuvert = (r: RestaurantCatalogue) => r.ouvert && r.accepteCommandes;

const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Hiérarchie complète avec décomptes de restaurants publiés et ouverts. Vide si la lecture échoue. */
export const lireHierarchieZones = cache(async (): Promise<ZoneRegion[]> => {
  const supabase = creerClientPublic();
  const [regionsR, prefsR, communesR, quartiersR, accueil] = await Promise.all([
    supabase.from("regions").select("id, nom, slug, latitude, longitude").eq("actif", true).order("nom"),
    supabase.from("prefectures").select("id, nom, slug, region_id, latitude, longitude").eq("actif", true).order("nom"),
    supabase.from("communes").select("id, nom, slug, prefecture_id, noms_alternatifs, latitude, longitude, statut_lancement, villes(nom)").eq("actif", true).order("nom"),
    supabase.from("neighborhoods").select("id, nom, commune_id, noms_alternatifs, latitude, longitude").eq("actif", true).eq("generique", false).order("nom"),
    lireAccueil(),
  ]);
  if (regionsR.error || prefsR.error || communesR.error || quartiersR.error) return [];
  const regions = regionsR.data ?? [];
  const prefs = prefsR.data ?? [];
  const communes = communesR.data ?? [];
  const quartiers = quartiersR.data ?? [];

  const compter = (filtre: (r: RestaurantCatalogue) => boolean) => {
    const liste = accueil.restaurants.filter(filtre);
    return { restaurants: liste.length, ouverts: liste.filter(estOuvert).length };
  };

  const regionDe = new Map(regions.map((r) => [r.id, r]));
  const prefDe = new Map(prefs.map((p) => [p.id, p]));

  const communesZone: ZoneCommune[] = communes
    .filter((c) => c.prefecture_id && prefDe.has(c.prefecture_id))
    .map((c) => {
      const pref = prefDe.get(c.prefecture_id as string)!;
      const ville = Array.isArray(c.villes) ? c.villes[0]?.nom : c.villes?.nom;
      return {
        id: c.id,
        annonce: (c.statut_lancement === "bientot" ? "bientot" : c.statut_lancement === "pilote" ? "pilote" : null) as "bientot" | "pilote" | null,
        villeNom: ville ?? "",
        prefectureId: pref.id,
        prefectureNom: pref.nom,
        regionNom: regionDe.get(pref.region_id)?.nom ?? "",
        nom: c.nom,
        slug: c.slug,
        nomsAlternatifs: c.noms_alternatifs ?? [],
        latitude: c.latitude,
        longitude: c.longitude,
        ...compter((r) => r.communeId === c.id),
        quartiers: quartiers
          .filter((q) => q.commune_id === c.id)
          .map((q) => ({
            id: q.id,
            nom: q.nom,
            slug: slugQuartier(q.nom),
            nomsAlternatifs: q.noms_alternatifs ?? [],
            latitude: q.latitude,
            longitude: q.longitude,
            ...compter((r) => r.quartierId === q.id),
          }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
      };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return regions.map((r) => ({
    id: r.id,
    nom: r.nom,
    slug: r.slug,
    latitude: r.latitude,
    longitude: r.longitude,
    ...compter((x) => x.regionId === r.id),
    prefectures: prefs
      .filter((p) => p.region_id === r.id)
      .map((p) => ({
        id: p.id,
        nom: p.nom,
        slug: p.slug,
        regionId: r.id,
        regionNom: r.nom,
        nomsAlternatifs: [],
        latitude: p.latitude,
        longitude: p.longitude,
        ...compter((x) => x.prefectureId === p.id),
        communes: communesZone.filter((c) => c.prefectureId === p.id),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  }));
});

/** Toutes les communes (et leurs quartiers), à plat. Liste vide si la lecture échoue. */
export const lireZones = cache(async (): Promise<ZoneCommune[]> => {
  const hierarchie = await lireHierarchieZones();
  return hierarchie.flatMap((r) => r.prefectures.flatMap((p) => p.communes)).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
});

/**
 * Zone demandée par l'adresse, validée contre les zones connues : un paramètre inconnu ou fantaisiste donne `null`
 * (jamais une zone inventée). Le niveau le plus précis prime : quartier, puis commune, préfecture, région.
 */
export function resoudreZone(params: ParametresZone, hierarchie: ZoneRegion[]): ZoneChoisie | null {
  const quartierSlug = premier(params.quartier)?.slice(0, 80);
  const communeSlug = premier(params.commune)?.slice(0, 80);
  const prefectureSlug = premier(params.prefecture)?.slice(0, 80);
  const regionSlug = premier(params.region)?.slice(0, 80);

  if (quartierSlug) {
    for (const region of hierarchie) {
      for (const pref of region.prefectures) {
        for (const commune of pref.communes) {
          const q = commune.quartiers.find((x) => x.slug === quartierSlug);
          if (q) {
            return { niveau: "quartier", id: q.id, nom: q.nom, slug: q.slug, communeNom: commune.nom, villeNom: commune.villeNom, prefectureNom: pref.nom, regionNom: region.nom };
          }
        }
      }
    }
  }
  if (communeSlug) {
    for (const region of hierarchie) {
      for (const pref of region.prefectures) {
        const c = pref.communes.find((x) => x.slug === communeSlug);
        if (c) {
          return { niveau: "commune", id: c.id, nom: c.nom, slug: c.slug, communeNom: "", villeNom: c.villeNom, prefectureNom: pref.nom, regionNom: region.nom };
        }
      }
    }
  }
  if (prefectureSlug) {
    for (const region of hierarchie) {
      const p = region.prefectures.find((x) => x.slug === prefectureSlug);
      if (p) return { niveau: "prefecture", id: p.id, nom: p.nom, slug: p.slug, communeNom: "", villeNom: "", prefectureNom: "", regionNom: region.nom };
    }
  }
  if (regionSlug) {
    const r = hierarchie.find((x) => x.slug === regionSlug);
    if (r) return { niveau: "region", id: r.id, nom: r.nom, slug: r.slug, communeNom: "", villeNom: "", prefectureNom: "", regionNom: "" };
  }
  return null;
}

/** Où se trouve la zone, en une ligne (« Coléah Cité · Matam, Conakry », « Kolia · préfecture de Boffa »). */
export function descriptionZone(zone: ZoneChoisie): string {
  switch (zone.niveau) {
    case "quartier":
      return `${zone.nom} · ${zone.communeNom}${zone.villeNom ? `, ${zone.villeNom}` : zone.prefectureNom ? `, ${zone.prefectureNom}` : ""}`;
    case "commune":
      return zone.villeNom ? `${zone.nom} · ${zone.villeNom}` : `${zone.nom} · préfecture de ${zone.prefectureNom}`;
    case "prefecture":
      return `Préfecture de ${zone.nom} · région de ${zone.regionNom}`;
    case "region":
      return `Région de ${zone.nom}`;
  }
}

/** Restaurants d'une zone, comparés par identifiant ; sans zone, tous. */
export function restaurantsDeLaZone(restaurants: RestaurantCatalogue[], zone: ZoneChoisie | null): RestaurantCatalogue[] {
  if (!zone) return restaurants;
  switch (zone.niveau) {
    case "quartier":
      return restaurants.filter((r) => r.quartierId === zone.id);
    case "commune":
      return restaurants.filter((r) => r.communeId === zone.id);
    case "prefecture":
      return restaurants.filter((r) => r.prefectureId === zone.id);
    case "region":
      return restaurants.filter((r) => r.regionId === zone.id);
  }
}

/** Adresse de l'accueil pour une zone (ancre sur la section des résultats). */
export function lienZone(zone: Pick<ZoneChoisie, "niveau" | "slug">): string {
  return `/?${CLE_ADRESSE[zone.niveau]}=${encodeURIComponent(zone.slug)}#zone`;
}

/** Adresse du catalogue filtré sur la zone. */
export function lienRestaurantsZone(zone: Pick<ZoneChoisie, "niveau" | "id" | "slug">): string {
  return zone.niveau === "quartier"
    ? `/restaurants?quartier=${encodeURIComponent(zone.id)}`
    : `/restaurants?${CLE_ADRESSE[zone.niveau]}=${encodeURIComponent(zone.slug)}`;
}
