import { estMontantGnf } from "./types";
import type { Repartition } from "./repartition";

/**
 * Livre de comptes du paiement en ligne : écriture double, en ajout seul (voir docs/PAIEMENT-ARCHITECTURE.md §6).
 *
 * Chaque événement d'argent produit un GROUPE d'écritures dont les débits égalent les crédits. Convention de signe d'un solde :
 * débits − crédits (un actif comme `fonds_operateur` est positif ; une dette comme `a_verser_restaurant` est négative).
 * Speedfood ne détient jamais de solde retirable : `fonds_operateur` est l'argent qui est CHEZ LE PRESTATAIRE.
 */

export const COMPTES = [
  "fonds_operateur",
  "fonds_a_liberer",
  "a_verser_restaurant",
  "a_verser_livreur",
  "produit_speedfood",
  "charge_frais_mobile",
  "charge_remboursement",
] as const;
export type Compte = (typeof COMPTES)[number];

export type Sens = "debit" | "credit";

export interface Ecriture {
  compte: Compte;
  sens: Sens;
  montantGnf: number;
}

const debit = (compte: Compte, montantGnf: number): Ecriture => ({ compte, sens: "debit", montantGnf });
const credit = (compte: Compte, montantGnf: number): Ecriture => ({ compte, sens: "credit", montantGnf });
/** Ne produit aucune ligne pour un montant nul (une écriture à zéro n'a pas de sens). */
const si = (montantGnf: number, e: Ecriture[]): Ecriture[] => (montantGnf > 0 ? e : []);

function exiger(montantGnf: number): void {
  if (!estMontantGnf(montantGnf)) throw new Error("Montant invalide dans une écriture.");
}

/** Le prestataire confirme avoir reçu l'argent du client : il est chez lui, et conditionné à la libération. */
export function ecrituresEncaissement(totalGnf: number): Ecriture[] {
  exiger(totalGnf);
  return si(totalGnf, [debit("fonds_operateur", totalGnf), credit("fonds_a_liberer", totalGnf)]);
}

/** Frais prélevés par le prestataire sur l'encaissement (supportés par Speedfood). */
export function ecrituresFraisMobile(fraisGnf: number): Ecriture[] {
  exiger(fraisGnf);
  return si(fraisGnf, [debit("charge_frais_mobile", fraisGnf), credit("fonds_operateur", fraisGnf)]);
}

/** Objectif atteint : l'argent conditionnel se répartit entre le restaurant, le livreur et Speedfood. */
export function ecrituresLiberation(r: Repartition): Ecriture[] {
  if (r.restaurantGnf + r.livreurGnf + r.speedfoodBrutGnf !== r.totalClientGnf) throw new Error("Répartition incohérente.");
  return si(r.totalClientGnf, [
    debit("fonds_a_liberer", r.totalClientGnf),
    ...si(r.restaurantGnf, [credit("a_verser_restaurant", r.restaurantGnf)]),
    ...si(r.livreurGnf, [credit("a_verser_livreur", r.livreurGnf)]),
    ...si(r.speedfoodBrutGnf, [credit("produit_speedfood", r.speedfoodBrutGnf)]),
  ]);
}

/** Versement direct au compte mobile money d'un bénéficiaire ; le frais de transfert éventuel est supporté par Speedfood. */
export function ecrituresVersement(beneficiaire: "restaurant" | "livreur", montantGnf: number, fraisVersementGnf = 0): Ecriture[] {
  exiger(montantGnf);
  exiger(fraisVersementGnf);
  const dette: Compte = beneficiaire === "restaurant" ? "a_verser_restaurant" : "a_verser_livreur";
  return [...si(montantGnf, [debit(dette, montantGnf), credit("fonds_operateur", montantGnf)]), ...ecrituresFraisMobile(fraisVersementGnf)];
}

/** Remboursement au client AVANT libération (l'argent n'a pas encore été réparti). */
export function ecrituresRemboursementAvantLiberation(montantGnf: number): Ecriture[] {
  exiger(montantGnf);
  return si(montantGnf, [debit("fonds_a_liberer", montantGnf), credit("fonds_operateur", montantGnf)]);
}

/** Remboursement APRÈS libération : l'argent est déjà parti, il est pris sur les fonds de Speedfood (perte enregistrée). */
export function ecrituresRemboursementApresLiberation(montantGnf: number): Ecriture[] {
  exiger(montantGnf);
  return si(montantGnf, [debit("charge_remboursement", montantGnf), credit("fonds_operateur", montantGnf)]);
}

export function totalDebits(e: readonly Ecriture[]): number {
  return e.filter((x) => x.sens === "debit").reduce((s, x) => s + x.montantGnf, 0);
}
export function totalCredits(e: readonly Ecriture[]): number {
  return e.filter((x) => x.sens === "credit").reduce((s, x) => s + x.montantGnf, 0);
}

/** Un groupe d'écritures est équilibré quand les débits égalent les crédits. Un groupe vide l'est. */
export function estEquilibre(e: readonly Ecriture[]): boolean {
  return totalDebits(e) === totalCredits(e);
}

/** Solde de chaque compte (débits − crédits) sur un ensemble d'écritures. */
export function soldes(e: readonly Ecriture[]): Record<Compte, number> {
  const s = Object.fromEntries(COMPTES.map((c) => [c, 0])) as Record<Compte, number>;
  for (const x of e) s[x.compte] += x.sens === "debit" ? x.montantGnf : -x.montantGnf;
  return s;
}
