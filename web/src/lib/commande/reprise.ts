/**
 * Valeurs de départ du formulaire de proposition révisée.
 *
 * Extraite du composant React pour être testable : la règle est qu'une commande
 * ayant déjà reçu une proposition repart de ces valeurs, pas des montants
 * originaux de la commande. Ressaisir les mêmes chiffres après un refus du
 * client est le cas le plus fréquent, et c'est là que les erreurs de saisie
 * arrivent.
 */

export interface MontantsCommande {
  sousTotalActuel: number;
  fraisActuels: number;
}

export interface PropositionPrecedente {
  nouveauSousTotal: number;
  nouveauxFraisLivraison: number;
  conditionsModifiees: string | null;
}

export interface ValeursReprise {
  sousTotal: string;
  frais: string;
  conditions: string;
  /** Vrai quand les valeurs viennent d'une proposition précédente (l'écran l'annonce). */
  reprise: boolean;
}

export function valeursDeReprise(
  commande: MontantsCommande,
  precedente: PropositionPrecedente | undefined
): ValeursReprise {
  if (!precedente) {
    return {
      sousTotal: String(commande.sousTotalActuel),
      frais: String(commande.fraisActuels),
      conditions: "",
      reprise: false,
    };
  }
  return {
    // String() d'un nombre est toujours une saisie valide : 0 devient "0", jamais "".
    sousTotal: String(precedente.nouveauSousTotal),
    frais: String(precedente.nouveauxFraisLivraison),
    conditions: precedente.conditionsModifiees ?? "",
    reprise: true,
  };
}