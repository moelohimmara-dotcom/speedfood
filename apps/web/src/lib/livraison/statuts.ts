// Pur, sans dépendance : testable seul (npm run test:unit). Voir docs/LIVRAISON.md §2.

/**
 * Statuts d'une livraison et règles de transition, séparés de ceux de la commande (comme chez les plateformes de livraison).
 *
 * `speedfood` : un livreur Speedfood est affecté par répartition (offre, acceptation, délai) :
 *   a_assigner → offre_envoyee → assignee → vers_restaurant → recuperee → vers_client → livree
 * `propre` : le restaurant livre avec son personnel, sans répartition :
 *   assignee → vers_client → livree
 */

export const STATUTS_LIVRAISON = [
  "a_assigner",
  "offre_envoyee",
  "assignee",
  "vers_restaurant",
  "recuperee",
  "vers_client",
  "livree",
  "echec",
  "annulee",
] as const;
export type StatutLivraison = (typeof STATUTS_LIVRAISON)[number];

export type ModeLivraison = "propre" | "speedfood";
export type ActeurLivraison = "restaurant" | "livreur" | "admin" | "systeme";

export const STATUTS_FINAUX: readonly StatutLivraison[] = ["livree", "echec", "annulee"];

export function estStatutLivraison(valeur: string): valeur is StatutLivraison {
  return (STATUTS_LIVRAISON as readonly string[]).includes(valeur);
}

export function estFinal(statut: StatutLivraison): boolean {
  return STATUTS_FINAUX.includes(statut);
}

/**
 * Le restaurant peut-il terminer la COMMANDE ? Pas tant qu'une livraison de cette commande est encore ouverte : la commande se clôt avec la remise (code du client saisi par le livreur,
 * voir `avancerLivraison`), jamais à la main. Une commande sans livraison (retrait, sur place) ou dont toutes les livraisons sont finales n'est pas concernée. Un statut inconnu compte comme
 * ouvert : dans le doute on ne clôt pas.
 */
export function livraisonBloqueLaCloture(statutsDesLivraisons: readonly string[]): boolean {
  return statutsDesLivraisons.some((s) => !(estStatutLivraison(s) && estFinal(s)));
}
export const MESSAGE_LIVRAISON_OUVERTE =
  "La livraison de cette commande n'est pas terminée : la commande se clôt avec la remise au client, grâce au code de remise. Si la livraison ne peut pas aboutir, contactez l'assistance Speedfood.";

/**
 * « Livraison non aboutie » déclarée par le restaurant qui livre lui-même (mode « propre », livreur parti) : le motif est choisi dans cette liste, jamais écrit à la main. Le restaurant ne tranche
 * pas la suite (remboursement ou clôture de la commande) : la livraison passe à « echec » et l'assistance Speedfood reprend. Dans le mode « speedfood », seule l'exploitation ou le livreur
 * peut déclarer un échec (`acteurPeut`).
 */
export const MOTIFS_ECHEC_RESTAURANT = {
  injoignable: "Client injoignable",
  adresse: "Adresse introuvable",
  refus: "Le client a refusé la commande",
  autre: "Autre problème",
} as const;
export type MotifEchecRestaurant = keyof typeof MOTIFS_ECHEC_RESTAURANT;

export function motifEchecRestaurantValide(valeur: unknown): valeur is MotifEchecRestaurant {
  return typeof valeur === "string" && Object.prototype.hasOwnProperty.call(MOTIFS_ECHEC_RESTAURANT, valeur);
}

/**
 * Issue d'une commande dont la livraison a échoué, décidée par l'assistance (fonction de base `fn_support_resoudre_echec_livraison`, migration 20261122120000) :
 * « cloturer » termine la commande (le restaurant est payé : le paiement en ligne est libéré), « annuler » l'annule (le client est remboursé).
 */
export const ISSUES_ECHEC_LIVRAISON = {
  cloturer: "Clôturer la commande : le restaurant est payé",
  annuler: "Annuler la commande : le client est remboursé",
} as const;
export type IssueEchecLivraison = keyof typeof ISSUES_ECHEC_LIVRAISON;

export function issueEchecLivraisonValide(valeur: unknown): valeur is IssueEchecLivraison {
  return typeof valeur === "string" && Object.prototype.hasOwnProperty.call(ISSUES_ECHEC_LIVRAISON, valeur);
}

/** Une commande attend une issue seulement si elle est « prete » et que sa livraison est en « echec » (la base le revérifie). */
export function echecLivraisonResoluble(statutCommande: string, statutLivraison: string | null | undefined): boolean {
  return statutCommande === "prete" && statutLivraison === "echec";
}

/** Message français fixe pour un refus de la base (aucun texte technique n'est affiché). */
export function messageRefusIssueEchec(messageBase: string): string {
  if (/Acces refuse/i.test(messageBase)) return "Cette action est réservée au support Speedfood.";
  if (/doit etre prete|n'est pas en echec|introuvable/i.test(messageBase)) return "Cette commande n'attend plus d'issue : rechargez la page.";
  if (/Motif invalide/i.test(messageBase)) return "Le motif doit faire entre 5 et 500 caractères.";
  return "Impossible d'appliquer l'issue. Réessayez dans un instant.";
}

/** Transitions de base du mode « speedfood ». */
const TRANSITIONS_SPEEDFOOD: Record<StatutLivraison, readonly StatutLivraison[]> = {
  a_assigner: ["offre_envoyee", "assignee", "annulee"],
  offre_envoyee: ["assignee", "a_assigner", "annulee"],
  assignee: ["vers_restaurant", "a_assigner", "annulee"],
  vers_restaurant: ["recuperee", "a_assigner", "annulee"],
  recuperee: ["vers_client", "echec"],
  vers_client: ["livree", "echec"],
  livree: [],
  echec: [],
  annulee: [],
};

/** Transitions du mode « propre » : pas de répartition, le personnel du restaurant part directement chez le client. */
const TRANSITIONS_PROPRE: Record<StatutLivraison, readonly StatutLivraison[]> = {
  a_assigner: ["assignee", "annulee"],
  offre_envoyee: ["annulee"],
  assignee: ["vers_client", "annulee"],
  vers_restaurant: ["annulee"],
  recuperee: ["vers_client", "echec"],
  vers_client: ["livree", "echec"],
  livree: [],
  echec: [],
  annulee: [],
};

export function transitionLivraisonAutorisee(de: StatutLivraison, vers: StatutLivraison, mode: ModeLivraison): boolean {
  return (mode === "propre" ? TRANSITIONS_PROPRE : TRANSITIONS_SPEEDFOOD)[de].includes(vers);
}

/**
 * Qui peut provoquer quelle transition. Le restaurant ne répartit pas : il ne fait avancer que sa propre livraison
 * (mode « propre ») et peut annuler ; le livreur fait avancer SA course ; l'exploitation peut tout reprendre en main ;
 * le système gère les offres (envoi, expiration).
 */
export function acteurPeut(acteur: ActeurLivraison, de: StatutLivraison, vers: StatutLivraison, mode: ModeLivraison): boolean {
  if (!transitionLivraisonAutorisee(de, vers, mode)) return false;
  switch (acteur) {
    case "admin":
      return true;
    case "systeme":
      return (
        (de === "a_assigner" && (vers === "offre_envoyee" || vers === "assignee")) ||
        (de === "offre_envoyee" && (vers === "assignee" || vers === "a_assigner"))
      );
    case "restaurant":
      return mode === "propre" || vers === "annulee";
    case "livreur":
      // Groupe Speedfood : toute la chaîne. Livraison par le personnel du restaurant (livreur du registre) : départ, remise avec le code, échec.
      return mode === "speedfood" ? ["vers_restaurant", "recuperee", "vers_client", "livree", "echec"].includes(vers) : ["vers_client", "livree", "echec"].includes(vers);
  }
}

const LIBELLES: Record<StatutLivraison, string> = {
  a_assigner: "Recherche d'un livreur",
  offre_envoyee: "Livreur sollicité",
  assignee: "Livreur trouvé",
  vers_restaurant: "Le livreur va au restaurant",
  recuperee: "Commande récupérée",
  vers_client: "En route vers vous",
  livree: "Livrée",
  echec: "Livraison non aboutie",
  annulee: "Livraison annulée",
};

const LIBELLES_PROPRE: Partial<Record<StatutLivraison, string>> = {
  a_assigner: "Livraison à organiser",
  assignee: "Prête à partir",
  vers_client: "En route vers vous",
};

/** Libellé pour le client ; le restaurant qui livre lui-même a ses propres mots. */
export function libelleLivraison(statut: StatutLivraison, mode: ModeLivraison): string {
  return (mode === "propre" ? LIBELLES_PROPRE[statut] : undefined) ?? LIBELLES[statut];
}

/** Étape (0 à 5) pour une barre de progression : 0 = pas encore de livreur, 5 = livrée. */
export function etapeLivraison(statut: StatutLivraison): number {
  switch (statut) {
    case "a_assigner":
    case "offre_envoyee":
      return 0;
    case "assignee":
      return 1;
    case "vers_restaurant":
      return 2;
    case "recuperee":
      return 3;
    case "vers_client":
      return 4;
    case "livree":
      return 5;
    default:
      return 0;
  }
}
