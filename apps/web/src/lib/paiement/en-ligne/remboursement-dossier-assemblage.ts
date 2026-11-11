// Assemblage PUR du dossier d'un remboursement à partir de lignes déjà lues en base (lot R2). Aucun accès à la base ici : testable seul.
// Les lectures (remboursement-lecture.ts) ne sélectionnent QUE les colonnes de `BrutDossier` : jamais le nom, le téléphone ni l'adresse du
// client, ni le code de remise, ni la référence de transaction déclarée, ni un identifiant de compte.
// La conclusion de la règle automatique vient de `decider` (litiges.ts), réutilisée telle quelle : rien n'est recalculé en double.
import { decider, type Decision as DecisionAutomatique, type Situation } from "./litiges";
import type { CibleDecision, DecisionEnregistree } from "./remboursement-decision-service";
import { modeOrigineDe, type ModeOrigine } from "./remboursement-decision";
import { categorieActeur, type DossierDecision, type DossierDonnees } from "./remboursement-dossier";

export interface BrutDossier {
  commande: {
    id: string;
    reference: string;
    restaurantNom: string;
    mode: string;
    statut: string;
    sousTotalGnf: number;
    fraisLivraisonGnf: number;
    modePaiement: string | null;
    statutPaiement: string;
    paiementDeclareLe: string | null;
    paiementRecuLe: string | null;
    creeLe: string;
  };
  evenements: { de: string | null; vers: string; acteur: string; le: string }[];
  paiement: null | {
    id: string;
    fournisseur: string;
    operateur: string;
    etat: string;
    repasGnf: number;
    fraisLivraisonGnf: number;
    totalGnf: number;
    restaurantGnf: number;
    livreurGnf: number;
    speedfoodBrutGnf: number;
    fraisPrestataireGnf: number;
    rembourseGnf: number;
    creeLe: string;
    confirmeLe: string | null;
    libereLe: string | null;
  };
  versements: { beneficiaire: "restaurant" | "livreur"; etat: string; montantGnf: number }[];
  litiges: {
    id: string;
    situation: string;
    etat: string;
    ouvertPar: string;
    montantDemandeGnf: number | null;
    preuveDeclaree: boolean;
    decision: string | null;
    regle: string | null;
    remboursementGnf: number | null;
    creeLe: string;
    closLe: string | null;
    motifClotureRenseigne: boolean;
  }[];
  livraison: null | {
    mode: string;
    statut: string;
    assigneeLe: string | null;
    recupereeLe: string | null;
    livreeLe: string | null;
    essaisCode: number;
    raisonRenseignee: boolean;
  };
  remboursementManuel: null | { moyen: string; montantGnf: number; referenceRenseignee: boolean; decisionId: string | null; le: string | null };
  decisions: DecisionEnregistree[];
  reglages: { plafondRemboursementAutoPermille: number; seuilLitigeHumainGnf: number };
}

/** Le litige à considérer : celui qui attend une décision, sinon le plus récent. */
export function litigeRetenu<T extends { etat: string; creeLe: string }>(litiges: T[]): T | null {
  if (litiges.length === 0) return null;
  const parRecence = [...litiges].sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  return parRecence.find((l) => l.etat === "a_humain" || l.etat === "ouvert") ?? parRecence[0] ?? null;
}

export function totalCommande(b: BrutDossier): number {
  return b.paiement ? b.paiement.totalGnf : b.commande.sousTotalGnf + b.commande.fraisLivraisonGnf;
}

export function modeOrigineDuDossier(b: BrutDossier): ModeOrigine | null {
  return modeOrigineDe({ fournisseurPaiement: b.paiement?.fournisseur ?? null, modePaiementCommande: b.commande.modePaiement });
}

/** Ce que la règle automatique existante conclurait (litige + paiement en ligne requis). `null` sinon. */
export function regleAutomatiqueDe(b: BrutDossier): DecisionAutomatique | null {
  const litige = litigeRetenu(b.litiges);
  if (!litige || !b.paiement) return null;
  return decider(
    {
      situation: litige.situation as Situation,
      repasGnf: b.paiement.repasGnf,
      fraisLivraisonGnf: b.paiement.fraisLivraisonGnf,
      montantDemandeGnf: litige.montantDemandeGnf ?? undefined,
      commandeRecupereeParLivreur: b.livraison ? b.livraison.recupereeLe !== null : false,
      preuveFournie: litige.preuveDeclaree,
    },
    { plafondRemboursementAutoPourMille: b.reglages.plafondRemboursementAutoPermille, seuilHumainGnf: b.reglages.seuilLitigeHumainGnf }
  );
}

/** Cible d'une décision (montant et mode d'origine lus en base par le serveur). `null` : aucun paiement à rembourser sur cette commande. */
export function cibleDeDecision(b: BrutDossier): CibleDecision | null {
  const mode = modeOrigineDuDossier(b);
  if (mode === null) return null;
  const total = totalCommande(b);
  if (!(total > 0)) return null;
  return {
    orderId: b.commande.id,
    paiementId: b.paiement?.id ?? null,
    litigeId: b.paiement ? (litigeRetenu(b.litiges)?.id ?? null) : null,
    totalGnf: total,
    modeOrigine: mode,
    regleAutomatique: regleAutomatiqueDe(b),
  };
}

export function assemblerDossier(b: BrutDossier, genereLe: string, especesAutorise: boolean): DossierDonnees | null {
  const mode = modeOrigineDuDossier(b);
  if (mode === null) return null;
  const regle = regleAutomatiqueDe(b);
  const litige = litigeRetenu(b.litiges);
  const remplaces = new Set(b.decisions.map((d) => d.remplaceId).filter((x): x is string => x !== null));
  const decisions: DossierDecision[] = [...b.decisions]
    .sort((x, y) => x.decideLe.localeCompare(y.decideLe))
    .map((d) => ({
      id: d.id,
      issue: d.issue,
      montantGnf: d.montantGnf,
      moyen: d.moyen,
      motif: d.motif,
      referenceAvis: d.referenceAvis,
      ecartRegle: d.ecartRegle,
      regleAutomatique: d.regleAutomatique,
      argentChezRestaurantReconnu: d.argentChezRestaurantReconnu,
      remplaceId: d.remplaceId,
      remplacee: remplaces.has(d.id),
      decideLe: d.decideLe,
    }));
  return {
    genereLe,
    commande: {
      reference: b.commande.reference,
      restaurantNom: b.commande.restaurantNom,
      mode: b.commande.mode,
      statut: b.commande.statut,
      sousTotalGnf: b.commande.sousTotalGnf,
      fraisLivraisonGnf: b.commande.fraisLivraisonGnf,
      totalGnf: totalCommande(b),
      creeLe: b.commande.creeLe,
      historique: [...b.evenements].sort((x, y) => x.le.localeCompare(y.le)).map((e) => ({ de: e.de, vers: e.vers, acteur: categorieActeur(e.acteur), le: e.le })),
    },
    modeOrigine: mode,
    paiement: b.paiement
      ? {
          fournisseur: b.paiement.fournisseur,
          operateur: b.paiement.operateur,
          etat: b.paiement.etat,
          repasGnf: b.paiement.repasGnf,
          fraisLivraisonGnf: b.paiement.fraisLivraisonGnf,
          totalGnf: b.paiement.totalGnf,
          restaurantGnf: b.paiement.restaurantGnf,
          livreurGnf: b.paiement.livreurGnf,
          speedfoodBrutGnf: b.paiement.speedfoodBrutGnf,
          fraisPrestataireGnf: b.paiement.fraisPrestataireGnf,
          rembourseGnf: b.paiement.rembourseGnf,
          creeLe: b.paiement.creeLe,
          confirmeLe: b.paiement.confirmeLe,
          libereLe: b.paiement.libereLe,
          versements: b.versements,
        }
      : null,
    codeMarchand: b.paiement ? null : { moyen: b.commande.modePaiement ?? "inconnu", statut: b.commande.statutPaiement, declareLe: b.commande.paiementDeclareLe, recuLe: b.commande.paiementRecuLe },
    livraison: b.livraison
      ? {
          mode: b.livraison.mode,
          statut: b.livraison.statut,
          assigneeLe: b.livraison.assigneeLe,
          recupereeLe: b.livraison.recupereeLe,
          livreeLe: b.livraison.livreeLe,
          essaisCode: b.livraison.essaisCode,
          codeRemiseSaisi: b.livraison.statut === "livree",
          raisonRenseignee: b.livraison.raisonRenseignee,
        }
      : null,
    litige: litige
      ? {
          situation: litige.situation,
          etat: litige.etat,
          ouvertPar: litige.ouvertPar,
          montantDemandeGnf: litige.montantDemandeGnf,
          preuveDeclaree: litige.preuveDeclaree,
          decisionAutomatique: litige.decision,
          regleAppliquee: litige.regle,
          remboursementDecideGnf: litige.remboursementGnf,
          creeLe: litige.creeLe,
          closLe: litige.closLe,
          motifClotureRenseigne: litige.motifClotureRenseigne,
        }
      : null,
    regleAutomatique: regle
      ? { decision: regle.decision, remboursementClientGnf: regle.remboursementClientGnf, restaurantPaye: regle.restaurantPaye, livreurPaye: regle.livreurPaye, perteSpeedfoodGnf: regle.perteSpeedfoodGnf, regle: regle.regle }
      : null,
    decisions,
    remboursementExecute: b.remboursementManuel
      ? { moyen: b.remboursementManuel.moyen, montantGnf: b.remboursementManuel.montantGnf, referenceRenseignee: b.remboursementManuel.referenceRenseignee, decisionId: b.remboursementManuel.decisionId, le: b.remboursementManuel.le }
      : b.paiement && b.paiement.etat === "rembourse"
        ? { moyen: "prestataire", montantGnf: b.paiement.rembourseGnf, referenceRenseignee: false, decisionId: null, le: null }
        : null,
    especesAutorise,
  };
}
