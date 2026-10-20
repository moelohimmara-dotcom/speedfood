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
