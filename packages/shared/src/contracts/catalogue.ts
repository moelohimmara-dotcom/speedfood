export interface RestaurantPublic {
  id: string; nom: string; lieu: string; categorie: string;
  ouvert: boolean; accepteCommandes: boolean; statutMisAJourLe: string | null;
}
export interface PlatCataloguePublic {
  id: string; nom: string; description: string; prixGnf: number;
  disponibilite: 'disponible' | 'epuise' | 'a_confirmer'; confirmeLe: string | null;
}
export interface PageRestaurants { restaurants: RestaurantPublic[]; suivant: string | null; luLe: string }
export interface PageMenu { restaurant: RestaurantPublic; plats: PlatCataloguePublic[]; suivant: string | null; luLe: string }
/** Quartier proposé pour la livraison : `libelle` = « Quartier, Commune » ; `id` est le `quartierId` attendu par l'estimation et la création de commande. */
export interface QuartierPublic { id: string; libelle: string }
export interface ListeQuartiers { quartiers: QuartierPublic[]; luLe: string }
