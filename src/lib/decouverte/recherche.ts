import "server-only";
import { creerClientPublic } from "@/lib/db/public";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import {
  classerResultats,
  type FiltresDecouverte,
  type PlatPublic,
  type ResultatClasse,
  type RestaurantClassable,
} from "./classement";

/**
 * Recherche publique : restaurants publiés (la RLS de lecture publique ne
 * renvoie déjà que ceux-là), leurs plats, classement explicable.
 *
 * Volumes du pilote : le filtrage par texte se fait ici, sans accents ni
 * casse (la base ne les ignore pas sans extension dédiée), sur au plus
 * LIMITE_RESTAURANTS_LUS restaurants et LIMITE_PLATS_LUS plats. À revoir
 * (extension `unaccent` ou index trigramme, côté base) bien avant d'approcher
 * ces plafonds.
 */
const LIMITE_RESTAURANTS_LUS = 500;
const LIMITE_PLATS_LUS = 2000;
export const LIMITE_RESULTATS_AFFICHES = 60;

export interface RestaurantCatalogue extends RestaurantClassable {
  couleurAccent: string | null;
  categorie: string;
  quartier: string;
}

export interface RechercheCatalogue {
  q: string;
  categorie?: string;
  quartier?: string;
  filtres: FiltresDecouverte;
}

export interface ResultatRecherche {
  resultats: ResultatClasse<RestaurantCatalogue>[];
  fraicheurHeures: number;
  maintenant: Date;
  erreur: boolean;
}

export async function rechercherCatalogue(recherche: RechercheCatalogue): Promise<ResultatRecherche> {
  const supabase = creerClientPublic();
  const maintenant = new Date();
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();

  let requete = supabase
    .from("restaurants")
    .select(
      "id, nom, horaires, ouvert, accepte_commandes, photo_url, logo_url, couleur_accent, menu_categories(nom), neighborhoods(nom)"
    )
    .order("nom")
    .limit(LIMITE_RESTAURANTS_LUS);
  if (recherche.categorie) requete = requete.eq("categorie_id", recherche.categorie);
  if (recherche.quartier) requete = requete.eq("quartier_id", recherche.quartier);

  const [{ data: restaurantsBruts, error: erreurRestaurants }, { data: platsBruts, error: erreurPlats }] =
    await Promise.all([
      requete,
      supabase
        .from("menu_items")
        .select("id, restaurant_id, nom, prix, prix_promo, disponible, disponibilite_confirmee_le")
        .is("archive_le", null)
        .limit(LIMITE_PLATS_LUS),
    ]);

  if (erreurRestaurants || erreurPlats) {
    return { resultats: [], fraicheurHeures: disponibiliteFraicheurHeures, maintenant, erreur: true };
  }

  const restaurants: RestaurantCatalogue[] = (restaurantsBruts ?? []).map((r) => ({
    id: r.id,
    nom: r.nom,
    horaires: r.horaires,
    ouvert: r.ouvert,
    accepteCommandes: r.accepte_commandes,
    photoUrl: r.photo_url,
    logoUrl: r.logo_url,
    couleurAccent: r.couleur_accent,
    categorie: r.menu_categories?.nom ?? "",
    quartier: r.neighborhoods?.nom ?? "",
  }));

  const platsParRestaurant = new Map<string, PlatPublic[]>();
  for (const p of platsBruts ?? []) {
    const liste = platsParRestaurant.get(p.restaurant_id) ?? [];
    liste.push({
      id: p.id,
      nom: p.nom,
      prix: p.prix,
      prixPromo: p.prix_promo,
      disponible: p.disponible,
      confirmeLe: p.disponibilite_confirmee_le,
    });
    platsParRestaurant.set(p.restaurant_id, liste);
  }

  const resultats = classerResultats({
    terme: recherche.q,
    restaurants,
    platsParRestaurant,
    fraicheurHeures: disponibiliteFraicheurHeures,
    maintenant,
    filtres: recherche.filtres,
  }).slice(0, LIMITE_RESULTATS_AFFICHES);

  return { resultats, fraicheurHeures: disponibiliteFraicheurHeures, maintenant, erreur: false };
}
