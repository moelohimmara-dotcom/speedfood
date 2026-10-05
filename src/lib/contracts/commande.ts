import type { ModePaiement, OptionPaiement, StatutPaiement } from "@/lib/paiement/regles";
import type { StatutCommande } from "./statuts";
import type { ErreurApi } from "./erreurs";

export type ModeRetrait = "retrait" | "livraison";

/**
 * Coordonnées client saisies à la commande. Aucun compte requis (ADR-005).
 * L'adresse n'est obligatoire que si mode === "livraison" (TDR.md §5).
 */
export interface ClientCommande {
  nom: string;
  telephone: string;
  adresse: string | null;
}

/**
 * Supplément choisi sur une ligne — instantané au même titre que la ligne
 * elle-même (ADR-006) : nom et prix copiés au moment de l'envoi.
 */
export interface OptionCommande {
  /** Identifiant de l'option au moment de l'envoi — conservé pour traçabilité (`order_item_options.option_id`), mis à NULL si l'option est supprimée depuis. */
  id: string;
  nom: string;
  prix: number;
}

/**
 * Ligne de commande — instantané figé au moment de l'envoi (ADR-006).
 * Le nom et le prix sont copiés depuis MenuItem à l'instant T et ne changent plus
 * même si le plat est modifié ou supprimé ensuite. Ne jamais recalculer une ligne
 * historique à partir du menu courant. `prix` est le prix unitaire total déjà
 * chargé — prix promo du plat (s'il est actif) PLUS la somme des suppléments
 * choisis (`options`) ; `options` n'est là que pour l'affichage détaillé, pas
 * pour un recalcul supplémentaire.
 */
export interface LigneCommande {
  menuItemId: string;
  nom: string;
  prix: number;
  quantite: number;
  options: OptionCommande[];
}

export interface Commande {
  id: string;
  /** Référence courte lisible affichée au client (ex. "SF-4KVB9"), distincte de l'identifiant interne. */
  reference: string;
  /** Jeton opaque et non devinable servant de clé d'accès au suivi. Jamais un identifiant séquentiel. */
  jetonSuivi: string;
  restaurantId: string;
  client: ClientCommande;
  mode: ModeRetrait;
  lignes: LigneCommande[];
  /** Recalculé côté serveur à partir des lignes — ne jamais faire confiance à un total envoyé par le navigateur. */
  sousTotal: number;
  fraisLivraisonEstime: number;
  statut: StatutCommande;
  creeLe: string;
  misAJourLe: string;
}

/** Entrée d'audit d'une transition de statut — TDR.md §6 : chaque transition est historisée. */
export interface EvenementStatutCommande {
  commandeId: string;
  statutPrecedent: StatutCommande | null;
  statutSuivant: StatutCommande;
  acteur: string;
  horodatage: string;
}

// ---------------------------------------------------------------------------
// Bloc 7 — proposition révisée, état dérivé, création de commande et suivi.
// ---------------------------------------------------------------------------

/** Statut d'une proposition révisée (contrainte SQL `order_proposals.statut`). */
export type StatutProposition = "en_attente" | "acceptee" | "refusee" | "expiree";

/** Réponse du client à une proposition révisée. */
export type ReponseProposition = "acceptee" | "refusee";

/** Montants et conditions saisis par le restaurant pour une proposition révisée. */
export interface ValeursProposition {
  nouveauSousTotal: number;
  nouveauxFraisLivraison: number;
  conditionsModifiees: string | null;
}

/**
 * Proposition de prix/frais/conditions révisée, immuable et versionnée
 * (`order_proposals`, une seule version active à la fois). Une nouvelle
 * modification du restaurant crée une nouvelle version ; aucune préparation ni
 * acceptation de la commande n'a lieu tant que la version active n'a pas reçu
 * de réponse du client.
 */
export interface PropositionRevisee {
  id: string;
  commandeId: string;
  version: number;
  nouveauSousTotal: number;
  nouveauxFraisLivraison: number;
  conditionsModifiees: string | null;
  statut: StatutProposition;
  /** Échéance après laquelle la proposition est expirée sans préparation (null = pas d'échéance). */
  expireLe: string | null;
  creeLe: string;
  reponduLe: string | null;
}

/**
 * État dérivé affiché au client et au restaurant.
 * `attente_confirmation_client` n'est PAS un statut de la table `orders`
 * (schéma gelé) : c'est un état calculé = `en_attente` + proposition révisée
 * active en attente de réponse du client.
 */
export type EtatDeriveCommande = StatutCommande | "attente_confirmation_client";

/**
 * Ligne telle qu'envoyée par le navigateur. Seuls l'identifiant du plat, la
 * quantité et les identifiants des suppléments choisis font foi : le nom et
 * le prix (plat comme suppléments) sont systématiquement recalculés côté
 * serveur depuis `menu_items`/`menu_item_options` (TDR.md §6, ADR-006).
 */
export interface LigneCommandeClient {
  menuItemId: string;
  quantite: number;
  optionIds: string[];
}

/**
 * Charge utile de création d'une commande invitée (ADR-005).
 * Aucun prix n'est transmis ni jamais utilisé : le serveur recalcule tout. Seul le
 * sous-total AFFICHÉ au client est envoyé, uniquement pour être comparé au total
 * recalculé : s'il diffère (prix modifié entre l'affichage et l'envoi), la commande
 * est refusée et le client confirme le nouveau total (revue de sécurité, point 8).
 */
export interface CreationCommandePayload {
  /** Clé d'idempotence générée par le navigateur pour une soumission donnée (anti double-envoi réseau). */
  cleIdempotence: string;
  restaurantId: string;
  client: ClientCommande;
  mode: ModeRetrait;
  lignes: LigneCommandeClient[];
  /** Jeton Cloudflare Turnstile (usage unique), exigé seulement si la vérification anti-robot est active. */
  jetonVerification?: string;
  /** Sous-total (GNF, entier) que le client a vu à l'écran ; jamais utilisé comme prix. */
  sousTotalAffiche: number;
  /** Consentement explicite au règlement hors portail et à la confirmation par le restaurant. */
  consentementReglement: boolean;
}

/** Réponse de la création : le jeton de suivi est la clé d'accès du client à `/suivi/[jeton]`. */
export type ResultatCreationCommande =
  | { ok: true; reference: string; jeton: string; idempotent: boolean }
  | { ok: false; erreur: ErreurApi };

/** Réponse uniforme des actions de statut / proposition. */
export type ResultatActionCommande = { ok: true } | { ok: false; erreur: ErreurApi };

/** Supplément affiché (suivi client ou console) — sans identifiant, lecture seule. */
export interface OptionCommandeApercu {
  nom: string;
  prix: number;
}

/** Ligne affichée (suivi client ou console) — instantané figé, sans identifiant de menu. */
export interface LigneCommandeApercu {
  nom: string;
  prix: number;
  quantite: number;
  options: OptionCommandeApercu[];
}

/** Restaurant tel qu'exposé sur la page de suivi (aucune donnée de gestion). */
export interface RestaurantSuivi {
  id: string;
  nom: string;
  horaires: string;
  consignes: string | null;
  ouvert: boolean;
}

/**
 * Vue de suivi publique par jeton — volontairement SANS téléphone ni adresse
 * client (TDR.md §6 : « le suivi client ne révèle aucune donnée personnelle »).
 * Ces champs n'existent tout simplement pas dans ce type.
 */
/** Paiement d'une commande vu par le client : déclaration, confirmation du restaurant, et modes proposés (avec code marchand) une fois la commande acceptée. */
export interface PaiementSuivi {
  statut: StatutPaiement;
  mode: ModePaiement | null;
  reference: string | null;
  declareLe: string | null;
  recuLe: string | null;
  /** Modes proposés au client ; vide tant que le paiement n'est pas ouvert (commande non acceptée) ou déjà confirmé. */
  options: OptionPaiement[];
}

export interface SuiviCommande {
  reference: string;
  statut: StatutCommande;
  etatDerive: EtatDeriveCommande;
  mode: ModeRetrait;
  creeLe: string;
  restaurant: RestaurantSuivi;
  lignes: LigneCommandeApercu[];
  sousTotal: number;
  fraisLivraisonEstime: number;
  propositionActive: PropositionRevisee | null;
  historiqueStatuts: EvenementStatutCommande[];
  paiement: PaiementSuivi;
}

/** Vue d'une commande dans la console restaurant (données client nécessaires à la livraison). */
export interface ApercuCommandeRestaurant {
  id: string;
  reference: string;
  statut: StatutCommande;
  etatDerive: EtatDeriveCommande;
  mode: ModeRetrait;
  clientNom: string;
  clientTelephone: string;
  clientAdresse: string | null;
  sousTotal: number;
  fraisLivraisonEstime: number;
  creeLe: string;
  lignes: LigneCommandeApercu[];
  propositionActive: PropositionRevisee | null;
  paiementStatut: StatutPaiement;
  paiementMode: ModePaiement | null;
  paiementReference: string | null;
  paiementRecuLe: string | null;
  /** Jeton privé du client : sert uniquement à composer le lien du reçu envoyé par le restaurateur. */
  jetonSuivi: string;
}
