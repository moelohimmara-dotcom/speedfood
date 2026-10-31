/**
 * Contrats liés au restaurant (TDR.md §5, ADR-004 : le restaurant est le tenant de sécurité).
 */

export type CategorieRestaurant = "Riz & sauces" | "Grillades" | "Fast-food" | "Petit-déjeuner";

/**
 * Vue publique d'un restaurant — les seuls champs exposables au catalogue non authentifié.
 * Ne jamais inclure de coordonnées privées (téléphone, email du propriétaire) ici.
 */
export interface RestaurantPublic {
  id: string;
  nom: string;
  categorie: CategorieRestaurant;
  quartier: string;
  horaires: string;
  consignes: string | null;
  ouvert: boolean;
  /** true seulement si validé par un administrateur (ADR-010) — jamais visible au catalogue sinon. */
  publie: boolean;
}

/**
 * Vue complète, réservée à la console restaurant authentifiée et au CMS système.
 * Ne jamais renvoyer cette forme à un visiteur non authentifié.
 */
export interface RestaurantAdmin extends RestaurantPublic {
  creeLe: string;
  misAJourLe: string;
  suspenduLe: string | null;
  suspenduMotif: string | null;
}

export type RoleMembership = "owner" | "manager";

/** Relie un compte utilisateur à un restaurant. Ne jamais faire confiance à un restaurant_id fourni par le navigateur. */
export interface RestaurantMembership {
  restaurantId: string;
  utilisateurId: string;
  role: RoleMembership;
  creeLe: string;
}
