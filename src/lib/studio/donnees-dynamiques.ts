import "server-only";
import { cache } from "react";
import { lireCatalogue, type CatalogueLu, type RestaurantCatalogue } from "@/lib/decouverte/recherche";
import type { PlatPublic } from "@/lib/decouverte/classement";
import { etatRestaurant } from "@/lib/disponibilite/etat";
import type { PageBlocs } from "./registre";

/**
 * Données des blocs dynamiques d'une page (cartes et listes de restaurants), lues à CHAQUE affichage par la couche de
 * lecture publique existante (`lireCatalogue`, client anonyme) : la RLS de la base ne laisse passer que les restaurants
 * PUBLIÉS et NON SUSPENDUS, donc un restaurant dépublié ou suspendu n'apparaît jamais, quoi que contienne la page. Rien
 * n'est mis en cache ici (le cache de la page ne contient que son JSON : `lecture.ts` ne touche jamais à ces données).
 *
 * Coût, regroupé : une lecture du catalogue = 2 requêtes (restaurants, plats) + la lecture des paramètres de
 * l'application, PARTAGÉE par tous les blocs de la requête (mémoïsation `cache` de React) ; la catégorie est filtrée en
 * mémoire, seul un quartier demande une lecture de plus (une par quartier distinct). Zéro bloc dynamique : zéro requête.
 */

export interface RestaurantAvecPlats {
  restaurant: RestaurantCatalogue;
  plats: PlatPublic[];
}

/** Données par INDEX de bloc de la page. Un bloc absent de la table (lecture en échec, rien à montrer) ne rend rien. */
export type DonneesDynamiques = Map<number, RestaurantAvecPlats[]>;

// `cache` mémoïse par arguments PRIMITIFS, pour la durée d'une requête (jamais entre deux requêtes).
const catalogueDuQuartier = cache(async (quartierId: string): Promise<CatalogueLu> => lireCatalogue(quartierId ? { quartier: quartierId } : {}));

async function lireSansEchec(quartierId: string): Promise<CatalogueLu | null> {
  try {
    const catalogue = await catalogueDuQuartier(quartierId);
    return catalogue.erreur ? null : catalogue;
  } catch {
    // Une panne de lecture ne doit jamais empêcher le rendu du reste de la page (message sans donnée personnelle).
    console.error("studio_bloc_dynamique_lecture_indisponible");
    return null;
  }
}

const RANG_ETAT = { ouvert: 0, pause: 1, ferme: 2 } as const;

export async function chargerDonneesDynamiques(page: PageBlocs): Promise<DonneesDynamiques> {
  const donnees: DonneesDynamiques = new Map();
  const demandes = page.content.flatMap((bloc, index) => (bloc.type === "CarteRestaurant" || bloc.type === "ListeRestaurants" ? [{ bloc, index }] : []));
  if (demandes.length === 0) return donnees;

  // Lectures lancées ensemble (une par quartier distinct) ; les blocs sans quartier partagent la même.
  const quartiers = [...new Set(demandes.map(({ bloc }) => (bloc.type === "ListeRestaurants" ? (bloc.props.quartierId ?? "") : "")))];
  const lues = new Map(await Promise.all(quartiers.map(async (q) => [q, await lireSansEchec(q)] as const)));

  for (const { bloc, index } of demandes) {
    if (bloc.type === "CarteRestaurant") {
      const catalogue = lues.get("");
      const restaurant = catalogue?.restaurants.find((r) => r.id.toLowerCase() === bloc.props.restaurantId.toLowerCase());
      if (catalogue && restaurant) donnees.set(index, [{ restaurant, plats: catalogue.platsParRestaurant.get(restaurant.id) ?? [] }]);
      continue;
    }
    const catalogue = lues.get(bloc.props.quartierId ?? "");
    if (!catalogue) continue;
    const categorie = bloc.props.categorieId?.toLowerCase();
    const choisis = catalogue.restaurants
      .filter((r) => !categorie || r.categorieId?.toLowerCase() === categorie)
      .filter((r) => bloc.props.filtre === "tous" || etatRestaurant(r) === "ouvert")
      // Ouverts aux commandes d'abord, puis en pause, puis fermés ; à égalité, ordre alphabétique (comme /restaurants).
      .sort((a, b) => RANG_ETAT[etatRestaurant(a)] - RANG_ETAT[etatRestaurant(b)] || a.nom.localeCompare(b.nom, "fr"))
      .slice(0, bloc.props.nombre);
    if (choisis.length > 0) donnees.set(index, choisis.map((restaurant) => ({ restaurant, plats: catalogue.platsParRestaurant.get(restaurant.id) ?? [] })));
  }
  return donnees;
}
