import type {
  CommandePourPaiement,
  CompteVersement,
  DepotPaiement,
  EvenementRecu,
  LigneLitige,
  LignePaiement,
  LigneVersement,
  NouveauPaiement,
  NouveauVersement,
  PatchPaiement,
  Reglages,
} from "../../src/lib/paiement/en-ligne/service";
import type { Ecriture } from "../../src/lib/paiement/en-ligne/ecritures";

/**
 * Dépôt EN MÉMOIRE pour tester le service de paiement sans base. Il reproduit les garanties que la vraie base donne par contrainte :
 * compare-and-set de l'état, unicité (événement, versement par bénéficiaire, écriture par clé d'idempotence), équilibre d'un groupe
 * d'écritures, et refus d'un groupe déséquilibré. Si ce dépôt était plus permissif que la base, les tests mentiraient : la parité est
 * donc elle-même contrôlée côté base par scripts/tests/cloisonnement.mjs.
 */

export interface EcritureStockee extends Ecriture {
  paiementId: string;
  cle: string;
}

export function reglagesParDefaut(surcharge: Partial<Reglages> = {}): Reglages {
  return {
    actif: true,
    fournisseur: "simulation",
    tauxMobilePermille: { orange_money: 15, mtn_momo: 17 },
    fraisSpeedfoodCommandeGnf: 1000,
    fraisVersementGnf: 0,
    fraisMobileFixeGnf: 0,
    delaiExpirationMinutes: 15,
    plafondPaiementGnf: 500_000,
    plafondRemboursementAutoPermille: 300,
    seuilLitigeHumainGnf: 50_000,
    ...surcharge,
  };
}

export function creerDepotMemoire(initial: { reglages?: Reglages; commandes?: CommandePourPaiement[] } = {}) {
  const etat = {
    reglages: initial.reglages ?? reglagesParDefaut(),
    commandes: new Map<string, CommandePourPaiement>((initial.commandes ?? []).map((c) => [c.id, c])),
    paiements: new Map<string, LignePaiement>(),
    evenements: new Set<string>(),
    ecritures: [] as EcritureStockee[],
    cles: new Set<string>(),
    versements: new Map<string, LigneVersement>(),
    comptes: new Map<string, CompteVersement>(),
    litiges: new Map<string, LigneLitige & { decision?: string; regle?: string }>(),
    compteur: 0,
    commandesSync: new Map<string, string>(),
    /** Date d'expiration posée à l'ouverture, par paiement (le dépôt réel la garde dans la colonne expire_le). */
    expirations: new Map<string, string>(),
  };
  const id = (p: string) => `${p}-${++etat.compteur}`;

  const depot: DepotPaiement = {
    async lireReglages() {
      return etat.reglages;
    },
    async lireCommande(orderId) {
      return etat.commandes.get(orderId) ?? null;
    },
    // Des COPIES, comme une vraie lecture en base : l'appelant ne voit pas l'état changer sous ses pieds.
    async paiementParId(i) {
      const p = etat.paiements.get(i);
      return p ? { ...p } : null;
    },
    async paiementParCommande(orderId) {
      const p = [...etat.paiements.values()].find((x) => x.orderId === orderId);
      return p ? { ...p } : null;
    },
    async paiementParReferenceExterne(r) {
      const p = [...etat.paiements.values()].find((x) => x.referenceExterne === r);
      return p ? { ...p } : null;
    },
    async paiementParReferenceInterne(r) {
      const p = [...etat.paiements.values()].find((x) => x.referenceInterne === r);
      return p ? { ...p } : null;
    },
    async creerPaiement(n: NouveauPaiement) {
      if ([...etat.paiements.values()].some((p) => p.orderId === n.orderId)) throw new Error("unique(order_id)");
      const total = n.repasGnf + n.fraisLivraisonGnf;
      if (n.restaurantGnf + n.livreurGnf + n.speedfoodBrutGnf !== total) throw new Error("parts_egales_total");
      const { expireLe: _e, ...reste } = n;
      const ligne: LignePaiement = { ...reste, id: id("pay"), etat: "cree", totalGnf: total, rembourseGnf: 0, referenceExterne: null };
      etat.paiements.set(ligne.id, ligne);
      return ligne;
    },
    async changerEtat(i, de, vers, patch?: PatchPaiement) {
      const p = etat.paiements.get(i);
      if (!p || p.etat !== de) return false;
      p.etat = vers;
      if (patch?.referenceExterne) p.referenceExterne = patch.referenceExterne;
      if (patch?.expireLe) etat.expirations.set(i, patch.expireLe);
      if (patch?.rembourseGnf !== undefined) p.rembourseGnf = patch.rembourseGnf;
      return true;
    },
    async patcher(i, patch) {
      const p = etat.paiements.get(i);
      if (p && patch.rembourseGnf !== undefined) p.rembourseGnf = patch.rembourseGnf;
    },
    async enregistrerEvenement(e: EvenementRecu) {
      const cle = `${e.fournisseur}|${e.identifiant}`;
      if (etat.evenements.has(cle)) return false;
      etat.evenements.add(cle);
      return true;
    },
    async paiementsAExpirer(avant, limite) {
      return [...etat.paiements.values()]
        .filter((p) => p.etat === "en_attente" && (etat.expirations.get(p.id) ?? "") < avant)
        .slice(0, limite)
        .map((p) => ({ id: p.id, fournisseur: p.fournisseur }));
    },
    async paiementsAReprendre(maxTentatives, limite) {
      const ids = new Set(
        [...etat.versements.values()].filter((v) => (v.etat === "a_verser" || v.etat === "echoue") && v.tentatives < maxTentatives).map((v) => v.paiementId)
      );
      return [...etat.paiements.values()]
        .filter((p) => ids.has(p.id) && p.etat === "libere")
        .slice(0, limite)
        .map((p) => ({ id: p.id, fournisseur: p.fournisseur }));
    },
    async synchroniserCommande(orderId, situation) {
      etat.commandesSync.set(orderId, situation);
    },
    async ajouterEcritures(paiementId, cle, ecritures) {
      if (etat.cles.has(`${paiementId}|${cle}`)) return false;
      // Même agrégation que la vraie implémentation : une ligne par (compte, sens).
      const agregees = new Map<string, Ecriture>();
      for (const e of ecritures) {
        const k = `${e.compte}|${e.sens}`;
        const x = agregees.get(k);
        if (x) x.montantGnf += e.montantGnf;
        else agregees.set(k, { ...e });
      }
      const lignes = [...agregees.values()];
      const debits = lignes.filter((l) => l.sens === "debit").reduce((s, l) => s + l.montantGnf, 0);
      const credits = lignes.filter((l) => l.sens === "credit").reduce((s, l) => s + l.montantGnf, 0);
      if (debits !== credits) throw new Error("groupe d'écritures déséquilibré");
      etat.cles.add(`${paiementId}|${cle}`);
      for (const l of lignes) etat.ecritures.push({ ...l, paiementId, cle });
      return true;
    },
    async lireCompteVersement(b, proprietaireId) {
      return etat.comptes.get(`${b}|${proprietaireId}`) ?? null;
    },
    async creerVersement(v: NouveauVersement) {
      const existant = [...etat.versements.values()].find((x) => x.paiementId === v.paiementId && x.beneficiaire === v.beneficiaire);
      if (existant) return { ...existant };
      const ligne: LigneVersement = {
        id: id("ver"),
        paiementId: v.paiementId,
        beneficiaire: v.beneficiaire,
        restaurantId: v.restaurantId,
        livreurId: v.livreurId,
        operateur: v.operateur,
        montantGnf: v.montantGnf,
        etat: "a_verser",
        referenceInterne: v.referenceInterne,
        referenceExterne: null,
        tentatives: 0,
      };
      etat.versements.set(ligne.id, ligne);
      return { ...ligne };
    },
    async versementsDuPaiement(paiementId) {
      return [...etat.versements.values()].filter((v) => v.paiementId === paiementId).map((v) => ({ ...v }));
    },
    async versementParId(i) {
      const v = etat.versements.get(i);
      return v ? { ...v } : null;
    },
    async versementParReferenceExterne(r) {
      const v = [...etat.versements.values()].find((x) => x.referenceExterne === r);
      return v ? { ...v } : null;
    },
    async reserverVersement(i, depuis) {
      const v = etat.versements.get(i);
      if (!v || !depuis.includes(v.etat)) return false;
      v.etat = "envoye";
      v.tentatives += 1;
      return true;
    },
    async majVersement(i, patch) {
      const v = etat.versements.get(i);
      if (!v) return;
      if (patch.etat) v.etat = patch.etat;
      if (patch.referenceExterne) v.referenceExterne = patch.referenceExterne;
      if (patch.tentatives !== undefined) v.tentatives = patch.tentatives;
      (v as LigneVersement & { erreur?: string | null }).erreur = patch.erreurCode ?? null;
    },
    async creerLitige(l) {
      const ligne: LigneLitige = { id: id("lit"), paiementId: l.paiementId, situation: l.situation, etat: "ouvert" };
      etat.litiges.set(ligne.id, ligne);
      return ligne;
    },
    async litigesOuverts(paiementId) {
      return [...etat.litiges.values()].filter((l) => l.paiementId === paiementId && (l.etat === "ouvert" || l.etat === "a_humain"));
    },
    async majLitige(i, patch) {
      const l = etat.litiges.get(i);
      if (!l) return;
      l.etat = patch.etat;
      l.decision = patch.decision;
      l.regle = patch.regle;
    },
  };
  return { depot, etat };
}
