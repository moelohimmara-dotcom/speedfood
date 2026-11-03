import type { ApercuCommandeRestaurant, ValeursProposition } from "./commande";

/**
 * Contrat des routes `/api/v1/restaurant/commandes*` de l'application native (lot D1 : lire, accepter, refuser ; lot D2 : prête, terminée, confirmation du paiement ;
 * lot D3 : annuler, proposer un autre prix).
 * Pur : aucun import du site, de Next ni de Supabase.
 */

/**
 * Actions que l'application peut demander : accepter, refuser, passer prête, terminer, annuler. Toute autre valeur (livraison, valeur inconnue) est une erreur de validation,
 * sans appel au service. Que l'état de la commande permette l'action (annuler : en attente ou acceptée seulement) est décidé par le service du site, jamais ici.
 */
export const ACTIONS_RESTAURANT_APP = ["accepter", "refuser", "prete", "terminee", "annuler"] as const;
export type ActionRestaurantApp = (typeof ACTIONS_RESTAURANT_APP)[number];

export function lireActionRestaurantApp(valeur: unknown): ActionRestaurantApp | null {
  return typeof valeur === "string" && (ACTIONS_RESTAURANT_APP as readonly string[]).includes(valeur) ? (valeur as ActionRestaurantApp) : null;
}

/** Décisions du restaurateur sur un paiement DÉCLARÉ par le client (code marchand) : « recu » le confirme, « non_recu » le conteste. Toute autre valeur est refusée. */
export const DECISIONS_PAIEMENT_APP = ["recu", "non_recu"] as const;
export type DecisionPaiementApp = (typeof DECISIONS_PAIEMENT_APP)[number];

export function lireDecisionPaiementApp(valeur: unknown): DecisionPaiementApp | null {
  return typeof valeur === "string" && (DECISIONS_PAIEMENT_APP as readonly string[]).includes(valeur) ? (valeur as DecisionPaiementApp) : null;
}

/** Bornes d'une proposition de prix : celles de `estMontantGnfEntier` et du formulaire du site (`FormulaireProposition`). */
export const MONTANT_PROPOSITION_MAX_GNF = 10_000_000;
export const CONDITIONS_PROPOSITION_MAX = 500;

export type LectureProposition = { ok: true; valeurs: ValeursProposition } | { ok: false; message: string };

/**
 * Lit les montants et les conditions d'une proposition de prix reçus du réseau. Montants GNF ENTIERS (jamais de flottant, de chaîne, de NaN ni d'Infinity), de 0 à 10 000 000 ;
 * conditions : texte d'au plus 500 caractères une fois rognées, ou absentes. Plus strict que la route du site sur un seul point : des conditions qui ne sont ni un texte ni
 * absentes sont refusées au lieu d'être ignorées. Le service du site revérifie tout (états, verrou de proposition, ancienne valeur identique).
 */
export function lireValeursPropositionApp(corps: { nouveauSousTotal?: unknown; nouveauxFraisLivraison?: unknown; conditionsModifiees?: unknown }): LectureProposition {
  const entier = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= MONTANT_PROPOSITION_MAX_GNF;
  if (!entier(corps.nouveauSousTotal) || !entier(corps.nouveauxFraisLivraison)) {
    return { ok: false, message: "Les montants doivent être des nombres entiers en GNF (0 à 10 000 000)." };
  }
  const conditions = corps.conditionsModifiees;
  if (conditions !== undefined && conditions !== null && typeof conditions !== "string") return { ok: false, message: "Les conditions doivent être un texte." };
  if (typeof conditions === "string" && conditions.trim().length > CONDITIONS_PROPOSITION_MAX) return { ok: false, message: "Les conditions ne peuvent pas dépasser 500 caractères." };
  return { ok: true, valeurs: { nouveauSousTotal: corps.nouveauSousTotal, nouveauxFraisLivraison: corps.nouveauxFraisLivraison, conditionsModifiees: typeof conditions === "string" ? conditions : null } };
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
