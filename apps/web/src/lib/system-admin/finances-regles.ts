/** Règles pures du lot L3. Paramètres de développement, à valider avant toute production. */
export const TAUX_COMMISSION_DEFAUT = 0.10;
export const RYTHME_VERSEMENT_DEFAUT = "hebdomadaire" as const;
export type RythmeVersement = "hebdomadaire" | "mensuel";

export interface VenteFinance {
  id: string;
  etablissementId: string;
  etablissementNom: string;
  reference: string;
  creeLe: string;
  montantPlatsGnf: number;
  fraisLivraisonGnf: number;
  remboursementGnf: number;
}

export interface LigneReleve {
  etablissementId: string;
  etablissementNom: string;
  ventesGnf: number;
  commissionGnf: number;
  fraisLivraisonGnf: number;
  remboursementsGnf: number;
  netAReverserGnf: number;
  tauxCommission: number;
}

export function arrondirFranc(montant: number): number {
  return Math.round(montant);
}

export function calculerCommission(montantHorsLivraisonGnf: number, taux: number = TAUX_COMMISSION_DEFAUT): number {
  if (!Number.isFinite(montantHorsLivraisonGnf) || montantHorsLivraisonGnf < 0) throw new Error("Le montant hors livraison doit être positif ou nul.");
  if (!Number.isFinite(taux) || taux < 0 || taux > 1) throw new Error("Le taux de commission doit être compris entre 0 % et 100 %.");
  return arrondirFranc(montantHorsLivraisonGnf * taux);
}

export function calculerReleve(ventes: VenteFinance[], debut: Date, fin: Date, tauxParEtablissement: Record<string, number> = {}): LigneReleve[] {
  if (!(debut instanceof Date) || Number.isNaN(debut.getTime()) || !(fin instanceof Date) || Number.isNaN(fin.getTime()) || debut >= fin) throw new Error("La période doit avoir une date de début antérieure à la date de fin.");
  const groupes = new Map<string, VenteFinance[]>();
  for (const vente of ventes) {
    const date = new Date(vente.creeLe);
    if (Number.isNaN(date.getTime()) || date < debut || date >= fin) continue;
    if (vente.montantPlatsGnf < 0 || vente.fraisLivraisonGnf < 0 || vente.remboursementGnf < 0) throw new Error("Une vente contient un montant négatif.");
    const groupe = groupes.get(vente.etablissementId) ?? [];
    groupe.push(vente);
    groupes.set(vente.etablissementId, groupe);
  }
  return [...groupes.values()].map((liste) => {
    const premiere = liste[0];
    const taux = tauxParEtablissement[premiere.etablissementId] ?? TAUX_COMMISSION_DEFAUT;
    const ventesGnf = liste.reduce((s, v) => s + v.montantPlatsGnf, 0);
    const fraisLivraisonGnf = liste.reduce((s, v) => s + v.fraisLivraisonGnf, 0);
    const remboursementsGnf = liste.reduce((s, v) => s + v.remboursementGnf, 0);
    const commissionGnf = calculerCommission(ventesGnf - remboursementsGnf, taux);
    return { etablissementId: premiere.etablissementId, etablissementNom: premiere.etablissementNom, ventesGnf, commissionGnf, fraisLivraisonGnf, remboursementsGnf, netAReverserGnf: ventesGnf - remboursementsGnf - commissionGnf + fraisLivraisonGnf, tauxCommission: taux };
  });
}

export function exporterReleveCsv(lignes: LigneReleve[]): string {
  const echapper = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const entete = ["Établissement", "Ventes (GNF)", "Commission (GNF)", "Frais de livraison (GNF)", "Remboursements (GNF)", "Net à reverser (GNF)", "Taux"].map(echapper).join(";");
  const corps = lignes.map((l) => [l.etablissementNom, l.ventesGnf, l.commissionGnf, l.fraisLivraisonGnf, l.remboursementsGnf, l.netAReverserGnf, `${l.tauxCommission * 100}%`].map(echapper).join(";")).join("\n");
  return `${entete}\n${corps}\n`;
}
