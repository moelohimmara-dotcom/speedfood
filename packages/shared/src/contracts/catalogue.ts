/**
 * Restaurant public. Les champs après `statutMisAJourLe` sont FACULTATIFS et additifs (parité avec l'ancienne appli, tranche 10.1) : un client plus ancien les ignore,
 * un serveur plus ancien ne les envoie pas. `note` est la note moyenne au dixième, `null` tant qu'aucun avis n'existe (jamais une note inventée).
 * Les adresses d'images ne sont transmises qu'en HTTPS. `consignes` et `moyensPaiement` ne sortent que dans la réponse du menu (fiche), pas dans la liste.
 */
export interface RestaurantPublic {
  id: string; nom: string; lieu: string; categorie: string;
  ouvert: boolean; accepteCommandes: boolean; statutMisAJourLe: string | null;
  photoUrl?: string | null; logoUrl?: string | null;
  note?: number | null; avisTotal?: number;
  /** Vrai si au moins un plat disponible est en promotion (prix promo inférieur au prix normal). Sert à la section « Offres » de l'accueil. */
  aDesPromos?: boolean;
  horaires?: string | null; consignes?: string | null; moyensPaiement?: string[];
}
/** Supplément facultatif d'un plat (par exemple « Piment »). Seuls les suppléments disponibles sont transmis. `prixGnf` est un montant entier ≥ 0. */
export interface OptionPlatPublic { id: string; nom: string; prixGnf: number }
/** Section du menu, dans l'ordre d'affichage (`position` croissante). */
export interface SectionMenuPublic { id: string; nom: string; position: number }
/**
 * Plat. `prixGnf` reste le prix PAYÉ (promo comprise). `prixNormalGnf` est le prix hors promo : supérieur à `prixGnf` seulement en cas de promo.
 * Le serveur recalcule toujours le prix à la commande : ces champs ne servent qu'à l'affichage.
 */
export interface PlatCataloguePublic {
  id: string; nom: string; description: string; prixGnf: number;
  disponibilite: 'disponible' | 'epuise' | 'a_confirmer'; confirmeLe: string | null;
  prixNormalGnf?: number; photoUrl?: string | null; sectionId?: string | null; options?: OptionPlatPublic[];
}
export interface PageRestaurants { restaurants: RestaurantPublic[]; suivant: string | null; luLe: string }
export interface PageMenu { restaurant: RestaurantPublic; plats: PlatCataloguePublic[]; suivant: string | null; luLe: string; sections?: SectionMenuPublic[] }
/** Quartier proposé pour la livraison : `libelle` = « Quartier, Commune » ; `id` est le `quartierId` attendu par l'estimation et la création de commande. */
export interface QuartierPublic { id: string; libelle: string }
export interface ListeQuartiers { quartiers: QuartierPublic[]; luLe: string }
