import type { ApercuCommandeRestaurant } from "./commande";

/**
 * Contrat des routes `/api/v1/restaurant/commandes*` de l'application native (lot D1 : lire, accepter, refuser).
 * Pur : aucun import du site, de Next ni de Supabase.
 */

/**
 * Actions que l'application peut demander dans ce lot : UNIQUEMENT accepter ou refuser. « prete », « terminee » et « annuler » existent dans le service du site
 * mais sont refusées ici (lots suivants). Toute autre valeur est une erreur de validation, sans appel au service.
 */
export const ACTIONS_RESTAURANT_APP = ["accepter", "refuser"] as const;
export type ActionRestaurantApp = (typeof ACTIONS_RESTAURANT_APP)[number];

export function lireActionRestaurantApp(valeur: unknown): ActionRestaurantApp | null {
  return typeof valeur === "string" && (ACTIONS_RESTAURANT_APP as readonly string[]).includes(valeur) ? (valeur as ActionRestaurantApp) : null;
}

/** Pourquoi un compte restaurateur est renvoyé vers le site : la valeur est dans `erreur.champs.securite` d'une réponse 403. */
export const RAISONS_SECURITE_COMPTE = ["mfa", "questions"] as const;
export type RaisonSecuriteCompte = (typeof RAISONS_SECURITE_COMPTE)[number];

/** Message affiché par l'application (le mobile n'a ni l'écran du second facteur ni celui des questions de sécurité). */
export const MESSAGE_SECURITE_SUR_LE_SITE = "Ouvrez Speedfood sur le site pour terminer la sécurité du compte restaurateur.";

/** Une commande telle que l'application la reçoit : l'aperçu de la console, SANS le jeton du reçu (clé de lecture d'un document) ni aucun jeton de suivi. */
export type CommandeRestaurantApi = Omit<ApercuCommandeRestaurant, "jetonRecu"> & {
  paiementVisible: boolean;
  paiementLibelle: string;
  documents: { recu: string | null; facture: string | null };
  /** Lien WhatsApp prérempli, vers le client de la commande seulement : le restaurateur appuie lui-même sur « Envoyer ». */
  lienRecuWhatsApp: string | null;
  lienFactureWhatsApp: string | null;
};

export interface ReponseCommandesRestaurant {
  ok: true;
  restaurant: { id: string; nom: string; ouvert: boolean; accepteCommandes: boolean } | null;
  commandes: CommandeRestaurantApi[];
}
