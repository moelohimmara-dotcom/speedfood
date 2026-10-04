import "server-only";
import { lireCatalogue, type RestaurantCatalogue } from "@/lib/decouverte/recherche";
import type { PlatPublic } from "@/lib/decouverte/classement";
import { familleDepuisCategorie } from "@/lib/illustrations/automatique";
import type { Illustration } from "@/lib/illustrations/modele";
import { motifPourPlat } from "@/lib/illustrations/automatique";
import { slugQuartier } from "./quartiers";

/**
 * Données de l'accueil et des pages de quartier, lues dans la base publique (restaurants publiés seulement : la RLS le garantit).
 * Rien n'est inventé : un compteur est un vrai décompte, une suggestion est un vrai plat d'un restaurant ouvert.
 */
export type FamilleEnvie = "riz" | "grill" | "fast" | "cafe";
export const FAMILLES_ENVIE: { cle: FamilleEnvie; libelle: string }[] = [
  { cle: "riz", libelle: "Riz et sauces" },
  { cle: "grill", libelle: "Grillades" },
  { cle: "fast", libelle: "Fast-food" },
  { cle: "cafe", libelle: "Café et petit-déjeuner" },
];

export interface SuggestionEnvie {
  famille: FamilleEnvie;
  restaurantId: string;
  restaurantNom: string;
  quartier: string;
  platNom: string;
  prix: number;
  motif: string;
  illustration: Illustration | null;
}

export interface QuartierResume {
  nom: string;
  slug: string;
  restaurants: number;
  ouverts: number;
}

export interface DonneesAccueil {
  erreur: boolean;
  restaurants: RestaurantCatalogue[];
  platsParRestaurant: Map<string, PlatPublic[]>;
  ouverts: RestaurantCatalogue[];
  quartiers: QuartierResume[];
  suggestions: SuggestionEnvie[];
}

const estOuvert = (r: RestaurantCatalogue) => r.ouvert && r.accepteCommandes;

export function resumerQuartiers(restaurants: RestaurantCatalogue[]): QuartierResume[] {
  const parNom = new Map<string, QuartierResume>();
  for (const r of restaurants) {
    if (!r.quartier) continue;
    const q = parNom.get(r.quartier) ?? { nom: r.quartier, slug: slugQuartier(r.quartier), restaurants: 0, ouverts: 0 };
    q.restaurants += 1;
    if (estOuvert(r)) q.ouverts += 1;
    parNom.set(r.quartier, q);
  }
  return [...parNom.values()].sort((a, b) => b.restaurants - a.restaurants || a.nom.localeCompare(b.nom, "fr"));
}

/** Un vrai plat disponible d'un restaurant ouvert, par famille : le premier restaurant (ordre alphabétique) qui en a un. */
export function choisirSuggestions(restaurants: RestaurantCatalogue[], plats: Map<string, PlatPublic[]>): SuggestionEnvie[] {
  const suggestions: SuggestionEnvie[] = [];
  for (const { cle } of FAMILLES_ENVIE) {
    for (const r of restaurants.filter(estOuvert)) {
      if (familleDepuisCategorie(r.categorie) !== cle) continue;
      const plat = (plats.get(r.id) ?? []).find((p) => p.disponible);
      if (!plat) continue;
      suggestions.push({
        famille: cle,
        restaurantId: r.id,
        restaurantNom: r.nom,
        quartier: r.quartier,
        platNom: plat.nom,
        prix: plat.prixPromo ?? plat.prix,
        motif: motifPourPlat(plat.nom),
        illustration: plat.illustration ?? null,
      });
      break;
    }
  }
  return suggestions;
}

export async function lireAccueil(): Promise<DonneesAccueil> {
  const c = await lireCatalogue();
  if (c.erreur) {
    return { erreur: true, restaurants: [], platsParRestaurant: new Map(), ouverts: [], quartiers: [], suggestions: [] };
  }
  return {
    erreur: false,
    restaurants: c.restaurants,
    platsParRestaurant: c.platsParRestaurant,
    ouverts: c.restaurants.filter(estOuvert),
    quartiers: resumerQuartiers(c.restaurants),
    suggestions: choisirSuggestions(c.restaurants, c.platsParRestaurant),
  };
}

export interface DonneesQuartier {
  erreur: boolean;
  quartier: QuartierResume | null;
  restaurants: RestaurantCatalogue[];
  platsParRestaurant: Map<string, PlatPublic[]>;
}

/** Restaurants publiés d'un quartier (par identifiant d'URL). `quartier` est `null` si aucun restaurant publié n'y est rattaché. */
export async function lireQuartier(slug: string): Promise<DonneesQuartier> {
  const c = await lireCatalogue();
  if (c.erreur) {
    return { erreur: true, quartier: null, restaurants: [], platsParRestaurant: new Map() };
  }
  const restaurants = c.restaurants.filter((r) => r.quartier && slugQuartier(r.quartier) === slug);
  const quartier = resumerQuartiers(restaurants)[0] ?? null;
  return { erreur: false, quartier, restaurants, platsParRestaurant: c.platsParRestaurant };
}

/** Un vrai restaurant ouvert et deux de ses plats disponibles, pour le ticket d'exemple (animation « une commande qui voyage »). */
export function ticketExemple(d: DonneesAccueil): { restaurant: string; lignes: { nom: string; prix: number }[] } | null {
  for (const r of d.ouverts) {
    const lignes = (d.platsParRestaurant.get(r.id) ?? [])
      .filter((p) => p.disponible)
      .slice(0, 2)
      .map((p) => ({ nom: p.nom, prix: p.prixPromo ?? p.prix }));
    if (lignes.length > 0) return { restaurant: r.nom, lignes };
  }
  return null;
}
