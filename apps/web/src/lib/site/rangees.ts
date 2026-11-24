import type { PlatPublic } from "@/lib/decouverte/classement";
import type { RestaurantCatalogue } from "@/lib/decouverte/recherche";
import type { FamilleEnvie } from "./accueil";

/** Fonctions pures de l'accueil (sans lecture de données) : plat représentatif d'une famille et rangées du fil. */

const estOuvert = (r: RestaurantCatalogue) => r.ouvert && r.accepteCommandes;

const MOTS_BOISSON = /\b(jus|eau|soda|boisson|bissap|gingembre|limonade|lait|th[eé]|caf[eé]|cappuccino|nescaf[eé]|smoothie|sirop|bi[eè]re|coca|fanta|sprite)\b/i;
const MOTS_ACCOMPAGNEMENT = /\b(pain suppl[eé]mentaire|suppl[eé]ment|sauce seule|portion de|frites seules)\b/i;

/** Une boisson ne représente pas « Grillades » ou « Riz et sauces » : on la saute, sauf pour la famille café. */
export function platRepresentatif(famille: FamilleEnvie, plats: PlatPublic[]): PlatPublic | undefined {
  const disponibles = plats.filter((p) => p.disponible);
  if (famille === "cafe") return disponibles[0];
  return disponibles.find((p) => !MOTS_BOISSON.test(p.nom) && !MOTS_ACCOMPAGNEMENT.test(p.nom));
}

export interface RangeeAccueil {
  cle: string;
  titre: string;
  /** Identifiant de catégorie pour le lien « Tout voir » (`/restaurants?categorie=`), absent pour la rangée « ouverts ». */
  categorieId: string | null;
  restaurants: RestaurantCatalogue[];
}

const MAX_PAR_RANGEE = 12;
const MIN_PAR_RANGEE = 3;
const MAX_RANGEES_CATEGORIE = 3;

/**
 * Rangées du fil d'accueil : d'abord les restaurants ouverts, puis les catégories les mieux fournies en restaurants ouverts. Une rangée
 * de moins de 3 restaurants n'est pas montrée (une rangée presque vide paraît abandonnée). Fonction pure : aucune lecture.
 */
export function composerRangees(restaurants: RestaurantCatalogue[]): RangeeAccueil[] {
  const ouverts = restaurants.filter(estOuvert);
  const rangees: RangeeAccueil[] = [];
  if (ouverts.length >= MIN_PAR_RANGEE) {
    rangees.push({ cle: "ouverts", titre: "Ouverts en ce moment", categorieId: null, restaurants: ouverts.slice(0, MAX_PAR_RANGEE) });
  }
  const parCategorie = new Map<string, RestaurantCatalogue[]>();
  for (const r of ouverts) {
    if (!r.categorieId || !r.categorie) continue;
    parCategorie.set(r.categorieId, [...(parCategorie.get(r.categorieId) ?? []), r]);
  }
  const categories = [...parCategorie.entries()]
    .filter(([, liste]) => liste.length >= MIN_PAR_RANGEE)
    .sort((a, b) => b[1].length - a[1].length || a[1][0].categorie.localeCompare(b[1][0].categorie, "fr"))
    .slice(0, MAX_RANGEES_CATEGORIE);
  for (const [id, liste] of categories) {
    rangees.push({ cle: `categorie-${id}`, titre: liste[0].categorie, categorieId: id, restaurants: liste.slice(0, MAX_PAR_RANGEE) });
  }
  return rangees;
}
