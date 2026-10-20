import { estMontantGnf } from "./types";

/**
 * Répartition d'un paiement en ligne (voir docs/PAIEMENT-ARCHITECTURE.md §5). Entiers GNF, aucun flottant.
 *
 *  - total client = repas + frais de livraison ;
 *  - frais de paiement mobile : supportés par Speedfood (décision de Malika), arrondis au GNF SUPÉRIEUR ;
 *  - restaurant : repas − frais fixe Speedfood (+ frais de livraison si c'est le restaurant qui livre) ;
 *  - livreur indépendant : frais de livraison ;
 *  - Speedfood brut : frais fixe par commande ; net : brut − frais mobile − frais de versement (peut être négatif : déficit signalé).
 *
 * Invariant (testé) : restaurant + livreur + Speedfood brut = total client.
 */

export type LivraisonPar = "aucune" | "livreur_independant" | "restaurant";

export interface EntreeRepartition {
  repasGnf: number;
  fraisLivraisonGnf: number;
  /** Frais fixe de Speedfood par commande, prélevé sur la part du restaurant. */
  fraisSpeedfoodGnf: number;
  /** Taux des frais de paiement mobile en pour-mille (15 = 1,5 %). */
  tauxFraisMobilePermille: number;
  livraisonPar: LivraisonPar;
  /** Frais de transfert par versement, payés par Speedfood ; 0 tant que le prestataire ne les a pas communiqués. */
  fraisVersementGnf?: number;
}

export interface Repartition {
  totalClientGnf: number;
  restaurantGnf: number;
  livreurGnf: number;
  speedfoodBrutGnf: number;
  fraisMobileGnf: number;
  fraisVersementTotalGnf: number;
  speedfoodNetGnf: number;
  /** Vrai si Speedfood perd de l'argent sur cette commande. */
  deficit: boolean;
  /** Le frais fixe réellement prélevé (plafonné au repas, jamais plus que ce que touche le restaurant). */
  fraisSpeedfoodAppliqueGnf: number;
}

export type ResultatRepartition = { ok: true; repartition: Repartition } | { ok: false; raison: string };

const TAUX_MAX_PERMILLE = 100; // 10 % : au-delà, la valeur est forcément une erreur de saisie

/** `ceil(montant × permille / 1000)` en entiers purs. */
export function fraisMobile(totalGnf: number, tauxPermille: number): number {
  return Math.floor((totalGnf * tauxPermille + 999) / 1000);
}

export function calculerRepartition(e: EntreeRepartition): ResultatRepartition {
  const fraisVersement = e.fraisVersementGnf ?? 0;
  for (const [nom, v] of [
    ["repas", e.repasGnf],
    ["frais de livraison", e.fraisLivraisonGnf],
    ["frais Speedfood", e.fraisSpeedfoodGnf],
    ["taux de frais mobile", e.tauxFraisMobilePermille],
    ["frais de versement", fraisVersement],
  ] as const) {
    if (!estMontantGnf(v)) return { ok: false, raison: `Valeur invalide : ${nom}.` };
  }
  if (e.tauxFraisMobilePermille > TAUX_MAX_PERMILLE) return { ok: false, raison: "Taux de frais mobile hors limites." };
  if (e.repasGnf <= 0) return { ok: false, raison: "Le repas doit avoir un montant." };
  if (e.fraisLivraisonGnf > 0 && e.livraisonPar === "aucune") return { ok: false, raison: "Des frais de livraison sans livraison." };

  const totalClientGnf = e.repasGnf + e.fraisLivraisonGnf;
  const fraisSpeedfoodAppliqueGnf = Math.min(e.fraisSpeedfoodGnf, e.repasGnf);
  const livreurGnf = e.livraisonPar === "livreur_independant" ? e.fraisLivraisonGnf : 0;
  const restaurantGnf = e.repasGnf - fraisSpeedfoodAppliqueGnf + (e.livraisonPar === "restaurant" ? e.fraisLivraisonGnf : 0);
  const speedfoodBrutGnf = fraisSpeedfoodAppliqueGnf;
  const fraisMobileGnf = fraisMobile(totalClientGnf, e.tauxFraisMobilePermille);
  const nombreVersements = (restaurantGnf > 0 ? 1 : 0) + (livreurGnf > 0 ? 1 : 0);
  const fraisVersementTotalGnf = fraisVersement * nombreVersements;
  const speedfoodNetGnf = speedfoodBrutGnf - fraisMobileGnf - fraisVersementTotalGnf;

  return {
    ok: true,
    repartition: {
      totalClientGnf,
      restaurantGnf,
      livreurGnf,
      speedfoodBrutGnf,
      fraisMobileGnf,
      fraisVersementTotalGnf,
      speedfoodNetGnf,
      deficit: speedfoodNetGnf < 0,
      fraisSpeedfoodAppliqueGnf,
    },
  };
}

/**
 * Remboursement partiel AVANT libération (par exemple un plat manquant) : la part du restaurant le supporte, dans la limite de
 * ce qu'il touche. Au-delà, la demande n'est pas traitable automatiquement (renvoi à un humain).
 */
export function appliquerRemboursementPartiel(r: Repartition, remboursementGnf: number): { ok: true; repartition: Repartition } | { ok: false; raison: string } {
  if (!estMontantGnf(remboursementGnf) || remboursementGnf === 0) return { ok: false, raison: "Montant de remboursement invalide." };
  if (remboursementGnf > r.restaurantGnf) return { ok: false, raison: "Le remboursement dépasse la part du restaurant." };
  return { ok: true, repartition: { ...r, totalClientGnf: r.totalClientGnf - remboursementGnf, restaurantGnf: r.restaurantGnf - remboursementGnf } };
}
