import { estMontantGnf } from "./types";

/**
 * Litiges d'un paiement en ligne : décisions AUTOMATIQUES par règles objectives, avec une porte de sortie vers un humain
 * (voir docs/STRATEGIE-PAIEMENT.md §7). Le moteur dit « je ne sais pas » plutôt que de décider hors règle.
 *
 * Toutes les valeurs de seuil sont des valeurs de SIMULATION, réglables ; aucune n'est une décision définitive.
 */

export type Situation =
  | "restaurant_refuse_ou_annule"
  | "livreur_ne_livre_pas"
  | "client_injoignable"
  | "plat_manquant_ou_errone"
  | "contestation_apres_liberation";

export interface ReglesLitiges {
  /** Plafond du remboursement partiel automatique, en pour-mille du repas (300 = 30 %). */
  plafondRemboursementAutoPourMille: number;
  /** Au-delà de ce montant de remboursement demandé, un humain décide. */
  seuilHumainGnf: number;
}

export const REGLES_LITIGES_SIMULATION: ReglesLitiges = { plafondRemboursementAutoPourMille: 300, seuilHumainGnf: 50_000 };

export interface ContexteLitige {
  situation: Situation;
  repasGnf: number;
  fraisLivraisonGnf: number;
  /** Montant demandé par le client pour un plat manquant ou erroné. */
  montantDemandeGnf?: number;
  /** Le livreur a-t-il récupéré la commande au restaurant ? */
  commandeRecupereeParLivreur?: boolean;
  /** Le client a-t-il fourni une preuve (photo) ? */
  preuveFournie?: boolean;
}

export type TypeDecision = "rembourser_total" | "rembourser_partiel" | "aucun_remboursement" | "humain";

export interface Decision {
  decision: TypeDecision;
  /** Argent rendu au client. */
  remboursementClientGnf: number;
  /** Le restaurant est-il payé de sa part du repas ? */
  restaurantPaye: boolean;
  /** Le livreur est-il payé de ses frais de livraison ? */
  livreurPaye: boolean;
  /** Part du remboursement qui reste à la charge de Speedfood (argent payé à un tiers alors que le client est remboursé). */
  perteSpeedfoodGnf: number;
  /** Identifiant de la règle appliquée, pour la journalisation. */
  regle: string;
}

const HUMAIN = (regle: string): Decision => ({ decision: "humain", remboursementClientGnf: 0, restaurantPaye: false, livreurPaye: false, perteSpeedfoodGnf: 0, regle });

export function decider(c: ContexteLitige, regles: ReglesLitiges = REGLES_LITIGES_SIMULATION): Decision {
  if (!estMontantGnf(c.repasGnf) || !estMontantGnf(c.fraisLivraisonGnf) || c.repasGnf <= 0) return HUMAIN("donnees_invalides");
  const total = c.repasGnf + c.fraisLivraisonGnf;

  switch (c.situation) {
    case "restaurant_refuse_ou_annule":
      // Rien n'a été préparé ou livré : le client récupère tout, personne n'est payé.
      return { decision: "rembourser_total", remboursementClientGnf: total, restaurantPaye: false, livreurPaye: false, perteSpeedfoodGnf: 0, regle: "restaurant_refuse_ou_annule" };

    case "livreur_ne_livre_pas": {
      // Le client récupère tout. Si le livreur avait récupéré la commande, le restaurant a fait son travail : il reste payé, à la
      // charge de Speedfood (le client est déjà remboursé). Le livreur n'est pas payé.
      const recuperee = c.commandeRecupereeParLivreur === true;
      return {
        decision: "rembourser_total",
        remboursementClientGnf: total,
        restaurantPaye: recuperee,
        livreurPaye: false,
        perteSpeedfoodGnf: recuperee ? c.repasGnf : 0,
        regle: recuperee ? "livreur_ne_livre_pas_apres_recuperation" : "livreur_ne_livre_pas_avant_recuperation",
      };
    }

    case "client_injoignable":
      // Le client est responsable : pas de remboursement, le restaurant et le livreur sont payés.
      return { decision: "aucun_remboursement", remboursementClientGnf: 0, restaurantPaye: true, livreurPaye: true, perteSpeedfoodGnf: 0, regle: "client_injoignable" };

    case "plat_manquant_ou_errone": {
      const demande = c.montantDemandeGnf;
      if (!estMontantGnf(demande) || demande === 0) return HUMAIN("montant_demande_invalide");
      if (demande > c.repasGnf) return HUMAIN("montant_demande_superieur_au_repas");
      if (demande > regles.seuilHumainGnf) return HUMAIN("montant_demande_au_dessus_du_seuil");
      const plafond = Math.floor((c.repasGnf * regles.plafondRemboursementAutoPourMille) / 1000);
      if (demande > plafond) return HUMAIN("montant_demande_au_dessus_du_plafond_automatique");
      if (c.preuveFournie !== true) return HUMAIN("preuve_absente");
      // Remboursement partiel : la part du restaurant le supporte ; le livreur est payé.
      return { decision: "rembourser_partiel", remboursementClientGnf: demande, restaurantPaye: true, livreurPaye: true, perteSpeedfoodGnf: 0, regle: "plat_manquant_partiel_automatique" };
    }

    case "contestation_apres_liberation":
      return HUMAIN("contestation_apres_liberation");
  }
}
