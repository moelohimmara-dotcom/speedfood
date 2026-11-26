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

export interface PaiementLibere {
  id: string;
  etablissementId: string;
  etablissementNom: string;
  repasGnf: number;
  fraisLivraisonGnf: number;
  livraisonPar: string;
  commissionGnf: number;
  netRestaurantGnf: number;
  remboursementGnf: number;
  libereLe: string | null;
}
export interface VersementSimple { paiementId: string; etat: string; operateur: string | null }
export interface LigneReleveReel extends LigneReleve { paiements: number; statutVersement: "verse" | "partiel" | "a_verser"; operateurVersement: string | null; dernierPaiementLe: string | null }

/**
 * Agrège les paiements en ligne LIBÉRÉS d'une période par restaurant : montants déjà stockés à l'ouverture du paiement
 * (commission prélevée, réduction du palier excellent comprise), jamais de recalcul de taux après coup.
 * Le net est la part du restaurant stockée ; les frais de livraison ne sont comptés que quand le restaurant livre lui-même.
 */
export function agregerPaiementsLiberes(paiements: readonly PaiementLibere[], versementsParPaiement: ReadonlyMap<string, readonly VersementSimple[]>): LigneReleveReel[] {
  const groupes = new Map<string, PaiementLibere[]>();
  for (const p of paiements) {
    for (const [nom, v] of [["repas", p.repasGnf], ["frais de livraison", p.fraisLivraisonGnf], ["commission", p.commissionGnf], ["net restaurant", p.netRestaurantGnf], ["remboursement", p.remboursementGnf]] as const) {
      if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Un paiement contient un montant invalide : ${nom}.`);
    }
    const liste = groupes.get(p.etablissementId) ?? [];
    liste.push(p);
    groupes.set(p.etablissementId, liste);
  }
  return [...groupes.entries()].map(([etablissementId, liste]) => {
    const ventesGnf = liste.reduce((s, p) => s + p.repasGnf, 0);
    const commissionGnf = liste.reduce((s, p) => s + p.commissionGnf, 0);
    const remboursementsGnf = liste.reduce((s, p) => s + p.remboursementGnf, 0);
    const aVerser = liste.filter((p) => p.netRestaurantGnf - p.remboursementGnf > 0);
    const confirmes = aVerser.filter((p) => (versementsParPaiement.get(p.id) ?? []).some((v) => v.etat === "confirme")).length;
    const versements = liste.flatMap((p) => versementsParPaiement.get(p.id) ?? []);
    return {
      etablissementId,
      etablissementNom: liste[0].etablissementNom,
      ventesGnf,
      commissionGnf,
      fraisLivraisonGnf: liste.filter((p) => p.livraisonPar === "restaurant").reduce((s, p) => s + p.fraisLivraisonGnf, 0),
      remboursementsGnf,
      // Identité du relevé : ventes − commission + livraison du restaurant − remboursements = net. Un remboursement porté sur un paiement libéré est déduit ici.
      netAReverserGnf: liste.reduce((s, p) => s + p.netRestaurantGnf, 0) - remboursementsGnf,
      tauxCommission: ventesGnf > 0 ? commissionGnf / ventesGnf : 0,
      paiements: liste.length,
      statutVersement: aVerser.length > 0 && confirmes === aVerser.length ? "verse" as const : confirmes > 0 ? "partiel" as const : "a_verser" as const,
      operateurVersement: versements[0]?.operateur ?? null,
      dernierPaiementLe: liste.map((p) => p.libereLe).filter((d): d is string => d !== null).sort().at(-1) ?? null,
    };
  }).sort((a, b) => b.netAReverserGnf - a.netAReverserGnf || a.etablissementNom.localeCompare(b.etablissementNom, "fr"));
}

export function exporterReleveCsv(lignes: LigneReleve[]): string {
  const echapper = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const entete = ["Établissement", "Ventes (GNF)", "Commission (GNF)", "Frais de livraison (GNF)", "Remboursements (GNF)", "Net à reverser (GNF)", "Taux"].map(echapper).join(";");
  const corps = lignes.map((l) => [l.etablissementNom, l.ventesGnf, l.commissionGnf, l.fraisLivraisonGnf, l.remboursementsGnf, l.netAReverserGnf, `${l.tauxCommission * 100}%`].map(echapper).join(";")).join("\n");
  return `${entete}\n${corps}\n`;
}
