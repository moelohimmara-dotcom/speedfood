import { argentRecu, transitionPaiement } from "./machine";
import { calculerRepartition, type LivraisonPar, type Repartition } from "./repartition";
import {
  ecrituresEncaissement,
  ecrituresFraisMobile,
  ecrituresLiberation,
  ecrituresRemboursementAvantLiberation,
  ecrituresVersement,
  type Ecriture,
} from "./ecritures";
import { REGLES_LITIGES_SIMULATION, decider, type Decision, type Situation } from "./litiges";
import { ErreurPasserelle, type EvenementNotification, type NomFournisseur, type PasserelleDePaiement } from "./fournisseur";
import type { EtatPaiement, EvenementPaiement, OperateurMobile } from "./types";

/**
 * Orchestration du paiement en ligne (voir docs/PAIEMENT-ARCHITECTURE.md §3, §4, §7). Ce module ne connaît NI la base NI le réseau : il
 * parle à un `DepotPaiement` (port vers la base) et à une `PasserelleDePaiement` (port vers le prestataire). C'est ce qui permet de le
 * tester de bout en bout, sans argent ni serveur, avec un dépôt en mémoire.
 *
 * Règles qui tiennent l'argent en place :
 *  - tout changement d'état est un « compare-and-set » (de → vers) : deux traitements simultanés ne peuvent pas tous deux réussir ;
 *  - une écriture du livre de comptes porte une clé d'idempotence : la rejouer ne produit rien ;
 *  - un versement a une référence interne STABLE : le redemander au prestataire ne paie pas deux fois ;
 *  - dans le doute (donnée manquante, montant différent, prestataire en erreur), on NE LIBÈRE PAS : le paiement reste en l'état et
 *    l'exploitation le voit.
 */

// ------------------------------------------------------------------------------------------------------------------ ports

export interface Reglages {
  actif: boolean;
  fournisseur: NomFournisseur;
  tauxMobilePermille: { orange_money: number; mtn_momo: number };
  fraisSpeedfoodCommandeGnf: number;
  fraisVersementGnf: number;
  delaiExpirationMinutes: number;
  plafondPaiementGnf: number;
  plafondRemboursementAutoPermille: number;
  seuilLitigeHumainGnf: number;
}

export interface CommandePourPaiement {
  id: string;
  restaurantId: string;
  statut: string;
  mode: string;
  sousTotalGnf: number;
  fraisLivraisonGnf: number;
  /** Mode de livraison du restaurant : qui livre. */
  livraisonMode: "speedfood" | "propre" | "aucune";
  /** Livreur affecté à la commande, s'il y en a un. */
  livreurId: string | null;
  /** Mode de paiement actuellement enregistré sur la commande (null : aucun) et son statut (« recu » : déjà payée par un autre moyen). */
  paiementMode: string | null;
  paiementStatut: string;
}

export interface LignePaiement {
  id: string;
  orderId: string;
  restaurantId: string;
  fournisseur: NomFournisseur;
  operateur: OperateurMobile;
  etat: EtatPaiement;
  repasGnf: number;
  fraisLivraisonGnf: number;
  totalGnf: number;
  livraisonPar: LivraisonPar;
  fraisSpeedfoodGnf: number;
  fraisMobileGnf: number;
  restaurantGnf: number;
  livreurGnf: number;
  speedfoodBrutGnf: number;
  rembourseGnf: number;
  referenceInterne: string;
  referenceExterne: string | null;
}

export type NouveauPaiement = Omit<LignePaiement, "id" | "etat" | "totalGnf" | "rembourseGnf" | "referenceExterne"> & { expireLe: string };

export interface PatchPaiement {
  referenceExterne?: string;
  expireLe?: string | null;
  confirmeLe?: string;
  libereLe?: string;
  rembourseGnf?: number;
}

export type Beneficiaire = "restaurant" | "livreur";

export interface LigneVersement {
  id: string;
  paiementId: string;
  beneficiaire: Beneficiaire;
  restaurantId: string | null;
  livreurId: string | null;
  operateur: OperateurMobile;
  montantGnf: number;
  etat: "a_verser" | "envoye" | "confirme" | "echoue";
  referenceInterne: string;
  referenceExterne: string | null;
  tentatives: number;
}

export interface NouveauVersement {
  paiementId: string;
  beneficiaire: Beneficiaire;
  restaurantId: string | null;
  livreurId: string | null;
  operateur: OperateurMobile;
  numeroMasque: string;
  compteVersementId: string | null;
  montantGnf: number;
  referenceInterne: string;
}

export interface CompteVersement {
  id: string;
  operateur: OperateurMobile;
  /** Numéro complet : ne sort jamais du serveur, jamais journalisé. */
  numero: string;
  verifie: boolean;
}

export interface EvenementRecu {
  fournisseur: NomFournisseur;
  identifiant: string;
  referenceExterne: string | null;
  etatRecu: "en_attente" | "succes" | "echec" | "annule" | "expire";
  montantGnf: number | null;
  resultat: string;
}

export interface LigneLitige {
  id: string;
  paiementId: string;
  situation: Situation;
  etat: "ouvert" | "decide_auto" | "a_humain" | "clos";
}

export interface DepotPaiement {
  lireReglages(): Promise<Reglages>;
  lireCommande(orderId: string): Promise<CommandePourPaiement | null>;
  paiementParId(id: string): Promise<LignePaiement | null>;
  paiementParCommande(orderId: string): Promise<LignePaiement | null>;
  paiementParReferenceExterne(reference: string): Promise<LignePaiement | null>;
  paiementParReferenceInterne(reference: string): Promise<LignePaiement | null>;
  creerPaiement(n: NouveauPaiement): Promise<LignePaiement>;
  /** Compare-and-set : vrai si l'état était bien `de` et vient de passer à `vers`. */
  changerEtat(id: string, de: EtatPaiement, vers: EtatPaiement, patch?: PatchPaiement): Promise<boolean>;
  /** Pose des champs sans changer l'état (par exemple le montant remboursé). */
  patcher(id: string, patch: PatchPaiement): Promise<void>;
  /** Vrai si l'événement est nouveau, faux si déjà vu (rejeu). */
  enregistrerEvenement(e: EvenementRecu): Promise<boolean>;
  /** Reflète le paiement en ligne sur la commande (mode « speedfood », statut de paiement) : en cours, payée, ou abandonnée (retour aux autres modes). */
  synchroniserCommande(orderId: string, situation: "en_cours" | "payee" | "abandonnee"): Promise<void>;
  /** Paiements « en attente » dont le délai est passé (entretien périodique). */
  paiementsAExpirer(avant: string, limite: number): Promise<{ id: string; fournisseur: NomFournisseur }[]>;
  /** Paiements libérés dont un versement reste à faire ou a échoué (moins de `maxTentatives` essais). */
  paiementsAReprendre(maxTentatives: number, limite: number): Promise<{ id: string; fournisseur: NomFournisseur }[]>;
  /** Un groupe d'écritures, atomique. Vrai si écrit, faux si cette clé d'idempotence l'avait déjà été. */
  ajouterEcritures(paiementId: string, cleIdempotence: string, ecritures: readonly Ecriture[]): Promise<boolean>;
  lireCompteVersement(b: Beneficiaire, proprietaireId: string): Promise<CompteVersement | null>;
  /** Crée le versement, ou renvoie celui qui existe déjà pour ce (paiement, bénéficiaire). */
  creerVersement(v: NouveauVersement): Promise<LigneVersement>;
  versementsDuPaiement(paiementId: string): Promise<LigneVersement[]>;
  versementParId(id: string): Promise<LigneVersement | null>;
  versementParReferenceExterne(reference: string): Promise<LigneVersement | null>;
  /** Compare-and-set : « je prends ce versement ». Vrai si son état était l'un de `depuis` et qu'il passe à « envoyé » (tentative comptée). */
  reserverVersement(id: string, depuis: readonly LigneVersement["etat"][]): Promise<boolean>;
  majVersement(id: string, patch: { etat?: LigneVersement["etat"]; referenceExterne?: string; tentatives?: number; erreurCode?: string | null }): Promise<void>;
  creerLitige(l: { paiementId: string; ouvertPar: "client" | "restaurant" | "livreur" | "systeme"; situation: Situation; montantDemandeGnf: number | null; preuveFournie: boolean }): Promise<LigneLitige>;
  litigesOuverts(paiementId: string): Promise<LigneLitige[]>;
  majLitige(id: string, patch: { etat: LigneLitige["etat"]; decision?: Decision["decision"]; regle?: string; remboursementGnf?: number | null; motifCloture?: string | null }): Promise<void>;
}

export interface DependancesService {
  depot: DepotPaiement;
  passerelle: PasserelleDePaiement;
  maintenant?: () => Date;
  /** Adresses publiques transmises au prestataire (webhook, retour client, annulation). Absentes : la passerelle n'en reçoit pas. */
  urls?: { notification: string; retour: string; annulation: string };
  /** Référence interne unique (non devinable). */
  genererReference?: (prefixe: string) => string;
}

// ------------------------------------------------------------------------------------------------------------------ résultats

export type ResultatOuverture =
  | { ok: true; paiementId: string; etat: EtatPaiement; urlPaiement: string | null; deja: boolean }
  | { ok: false; raison: "desactive" | "commande_introuvable" | "montant_invalide" | "montant_minimum" | "plafond_depasse" | "passerelle_indisponible" | "commande_non_payable"; detail?: string };

export type ResultatNotification =
  | { statut: "refuse"; raison: string }
  | { statut: "doublon" }
  | { statut: "inconnu" }
  | { statut: "ignore"; raison: string }
  | { statut: "applique"; paiementId: string; etat: EtatPaiement };

export type ResultatLiberation =
  | { ok: true; deja: boolean; versements: { beneficiaire: Beneficiaire; etat: LigneVersement["etat"] }[] }
  | { ok: false; raison: "introuvable" | "etat_incompatible" | "livreur_inconnu" | "concurrent"; etat?: EtatPaiement };

export type ResultatRemboursement =
  | { ok: true; deja: boolean }
  | { ok: false; raison: "introuvable" | "etat_incompatible" | "passerelle" | "concurrent"; etat?: EtatPaiement };

const EVENEMENT_DEPUIS_ETAT_RECU: Partial<Record<EvenementNotification["etat"], EvenementPaiement>> = {
  succes: "notification_succes",
  echec: "notification_echec",
  annule: "notification_annulation",
  expire: "expiration",
};

// ------------------------------------------------------------------------------------------------------------------ service

/** Version affichable d'un numéro : seuls les deux derniers chiffres restent visibles. */
export function masquerNumero(numero: string): string {
  const chiffres = numero.replace(/D/g, "");
  return chiffres.length < 4 ? "••••" : `•••• •• ${chiffres.slice(-2)}`;
}

export function creerServicePaiement(deps: DependancesService) {
  const { depot, passerelle } = deps;
  const maintenant = deps.maintenant ?? (() => new Date());
  const genererReference =
    deps.genererReference ?? ((prefixe: string) => `${prefixe}-${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`);
  const iso = () => maintenant().toISOString();

  function repartitionStockee(p: LignePaiement): Repartition {
    return {
      totalClientGnf: p.totalGnf,
      restaurantGnf: p.restaurantGnf,
      livreurGnf: p.livreurGnf,
      speedfoodBrutGnf: p.speedfoodBrutGnf,
      fraisMobileGnf: p.fraisMobileGnf,
      fraisVersementTotalGnf: 0,
      speedfoodNetGnf: p.speedfoodBrutGnf - p.fraisMobileGnf,
      deficit: p.speedfoodBrutGnf - p.fraisMobileGnf < 0,
      fraisSpeedfoodAppliqueGnf: p.fraisSpeedfoodGnf,
    };
  }

  // -------------------------------------------------------------------------------------------------- 1. ouvrir
  /**
   * Ouvre le paiement en ligne d'une commande. Les montants viennent de la BASE (la commande), jamais du navigateur. Idempotent :
   * un deuxième appel pour la même commande renvoie le paiement existant.
   */
  async function ouvrirPaiement(entree: { orderId: string; operateur: OperateurMobile }): Promise<ResultatOuverture> {
    const reglages = await depot.lireReglages();
    if (!reglages.actif) return { ok: false, raison: "desactive" };

    const existant = await depot.paiementParCommande(entree.orderId);
    if (existant) return { ok: true, paiementId: existant.id, etat: existant.etat, urlPaiement: null, deja: true };

    const commande = await depot.lireCommande(entree.orderId);
    if (!commande) return { ok: false, raison: "commande_introuvable" };
    if (!["en_attente", "acceptee"].includes(commande.statut)) return { ok: false, raison: "commande_non_payable", detail: commande.statut };

    const livraisonPar: LivraisonPar =
      commande.mode !== "livraison" || commande.livraisonMode === "aucune" ? "aucune" : commande.livraisonMode === "speedfood" ? "livreur_independant" : "restaurant";
    const calcul = calculerRepartition({
      repasGnf: commande.sousTotalGnf,
      fraisLivraisonGnf: livraisonPar === "aucune" ? 0 : commande.fraisLivraisonGnf,
      fraisSpeedfoodGnf: reglages.fraisSpeedfoodCommandeGnf,
      tauxFraisMobilePermille: reglages.tauxMobilePermille[entree.operateur],
      livraisonPar,
      fraisVersementGnf: reglages.fraisVersementGnf,
    });
    if (!calcul.ok) return { ok: false, raison: "montant_invalide", detail: calcul.raison };
    const r = calcul.repartition;
    if (r.totalClientGnf > reglages.plafondPaiementGnf) return { ok: false, raison: "plafond_depasse" };
    if (passerelle.montantMinimumGnf !== undefined && r.totalClientGnf < passerelle.montantMinimumGnf) return { ok: false, raison: "montant_minimum", detail: String(passerelle.montantMinimumGnf) };

    const referenceInterne = genererReference("SF-PAY");
    const expireLe = new Date(maintenant().getTime() + reglages.delaiExpirationMinutes * 60_000).toISOString();
    const paiement = await depot.creerPaiement({
      orderId: commande.id,
      restaurantId: commande.restaurantId,
      fournisseur: reglages.fournisseur,
      operateur: entree.operateur,
      livraisonPar,
      repasGnf: commande.sousTotalGnf,
      fraisLivraisonGnf: livraisonPar === "aucune" ? 0 : commande.fraisLivraisonGnf,
      fraisSpeedfoodGnf: r.fraisSpeedfoodAppliqueGnf,
      fraisMobileGnf: r.fraisMobileGnf,
      restaurantGnf: r.restaurantGnf,
      livreurGnf: r.livreurGnf,
      speedfoodBrutGnf: r.speedfoodBrutGnf,
      referenceInterne,
      expireLe,
    });

    try {
      const demande = await passerelle.encaisser({
        referenceInterne,
        montantGnf: r.totalClientGnf,
        operateur: entree.operateur,
        description: "Commande Speedfood",
        urlNotification: deps.urls?.notification,
        urlRetour: deps.urls?.retour,
        urlAnnulation: deps.urls?.annulation,
      });
      const ok = await depot.changerEtat(paiement.id, "cree", "en_attente", { referenceExterne: demande.referenceExterne, expireLe });
      if (ok) await depot.synchroniserCommande(commande.id, "en_cours");
      if (!ok) return { ok: true, paiementId: paiement.id, etat: (await depot.paiementParId(paiement.id))?.etat ?? "cree", urlPaiement: demande.urlPaiement, deja: true };
      return { ok: true, paiementId: paiement.id, etat: "en_attente", urlPaiement: demande.urlPaiement, deja: false };
    } catch (e) {
      // Le prestataire n'a pas pris la demande : aucun argent n'a bougé, le paiement est annulé et le client choisira un autre mode.
      await depot.changerEtat(paiement.id, "cree", "annule");
      return { ok: false, raison: "passerelle_indisponible", detail: e instanceof ErreurPasserelle ? e.code : "erreur" };
    }
  }

  // -------------------------------------------------------------------------------------------------- 2. notification
  /**
   * Reçoit une notification du prestataire. La signature est vérifiée par la passerelle AVANT toute lecture du corps. La réponse du
   * service ne dit jamais pourquoi une signature est refusée au-delà d'un code stable.
   */
  async function appliquerNotification(corpsBrut: string, entetes: Record<string, string | undefined>): Promise<ResultatNotification> {
    const verification = passerelle.verifierNotification(corpsBrut, entetes);
    if (!verification.ok) return { statut: "refuse", raison: verification.raison };
    const ev = verification.evenement;

    const enregistre = (resultat: string) =>
      depot.enregistrerEvenement({
        fournisseur: passerelle.nom,
        identifiant: ev.identifiant,
        referenceExterne: ev.referenceExterne,
        etatRecu: ev.etat,
        montantGnf: ev.montantGnf,
        resultat,
      });

    // Rejeu : le même identifiant ne produit jamais un second effet.
    if (!(await enregistre(ev.statutBrut ? `recu:${ev.statutBrut}`.slice(0, 80) : "recu"))) return { statut: "doublon" };

    const paiement = (await depot.paiementParReferenceExterne(ev.referenceExterne)) ?? (ev.referenceInterne ? await depot.paiementParReferenceInterne(ev.referenceInterne) : null);
    if (!paiement) {
      const versement = await depot.versementParReferenceExterne(ev.referenceExterne);
      if (versement) return appliquerNotificationVersement(versement, ev);
      return { statut: "inconnu" };
    }
    if (paiement.fournisseur !== passerelle.nom) return { statut: "ignore", raison: "fournisseur_different" };

    if (ev.etat === "en_attente") return { statut: "ignore", raison: "en_attente" };
    const evenement = EVENEMENT_DEPUIS_ETAT_RECU[ev.etat];
    if (!evenement) return { statut: "ignore", raison: "etat_non_gere" };

    // Garde-fou d'argent : un succès pour un autre montant que celui attendu n'est JAMAIS confirmé automatiquement.
    if (evenement === "notification_succes" && ev.montantGnf !== null && ev.montantGnf !== paiement.totalGnf) {
      return { statut: "ignore", raison: "montant_different" };
    }

    const t = transitionPaiement(paiement.etat, evenement);
    if (!t.ok) return { statut: "ignore", raison: "transition_interdite" };
    if (!t.change) return { statut: "applique", paiementId: paiement.id, etat: paiement.etat };

    const patch: PatchPaiement = t.etat === "confirme" ? { confirmeLe: iso() } : {};
    const change = await depot.changerEtat(paiement.id, paiement.etat, t.etat, patch);
    if (!change) {
      const actuel = await depot.paiementParId(paiement.id);
      return { statut: "applique", paiementId: paiement.id, etat: actuel?.etat ?? paiement.etat };
    }

    if (t.etat === "echoue" || t.etat === "annule" || t.etat === "expire") await depot.synchroniserCommande(paiement.orderId, "abandonnee");
    if (t.etat === "confirme") {
      await depot.ajouterEcritures(paiement.id, "encaissement", ecrituresEncaissement(paiement.totalGnf));
      await depot.ajouterEcritures(paiement.id, "frais_mobile", ecrituresFraisMobile(paiement.fraisMobileGnf));
      if (paiement.etat === "expire" || paiement.etat === "annule") {
        // Argent arrivé APRÈS une expiration ou une annulation de notre côté. Si la commande tient toujours et n'a été réglée par aucun
        // autre moyen, le paiement est valable : on le garde. Sinon (commande annulée, client passé aux espèces, déjà payée à la main) l'argent
        // est rendu, ou, si le prestataire ne sait pas rembourser, confié à un humain.
        const commande = await depot.lireCommande(paiement.orderId);
        const valable =
          commande !== null &&
          ["acceptee", "prete", "terminee"].includes(commande.statut) &&
          (commande.paiementMode === null || commande.paiementMode === "speedfood") &&
          commande.paiementStatut !== "recu";
        if (valable) {
          await depot.synchroniserCommande(paiement.orderId, "payee");
          await libererSiCommandeTerminee(paiement);
        } else {
          await rembourserOuEscalader(paiement.id);
        }
      } else {
        await depot.synchroniserCommande(paiement.orderId, "payee");
        await libererSiCommandeTerminee(paiement);
      }
    }
    return { statut: "applique", paiementId: paiement.id, etat: (await depot.paiementParId(paiement.id))?.etat ?? t.etat };
  }

  async function appliquerNotificationVersement(v: LigneVersement, ev: EvenementNotification): Promise<ResultatNotification> {
    const paiement = await depot.paiementParId(v.paiementId);
    if (!paiement) return { statut: "inconnu" };
    if (ev.etat === "succes" && v.etat !== "confirme") {
      await depot.majVersement(v.id, { etat: "confirme", erreurCode: null });
      await depot.ajouterEcritures(v.paiementId, `versement:${v.beneficiaire}`, ecrituresVersement(v.beneficiaire, v.montantGnf));
    } else if ((ev.etat === "echec" || ev.etat === "annule" || ev.etat === "expire") && v.etat !== "confirme") {
      await depot.majVersement(v.id, { etat: "echoue", erreurCode: `notification_${ev.etat}` });
    }
    return { statut: "applique", paiementId: v.paiementId, etat: paiement.etat };
  }

  /** Si la commande est déjà terminée quand l'argent arrive (cas rare : notification très tardive), on libère tout de suite. */
  async function libererSiCommandeTerminee(p: LignePaiement): Promise<void> {
    const commande = await depot.lireCommande(p.orderId);
    if (commande?.statut === "terminee") await libererPaiement(p.id);
  }

  // -------------------------------------------------------------------------------------------------- 3. libération et versements
  /** Verse le restaurant et le livreur. Idempotent : un paiement déjà libéré ne reverse rien (sauf reprise des versements en échec). */
  async function libererPaiement(paiementId: string, options: { depuisLitige?: boolean } = {}): Promise<ResultatLiberation> {
    const p = await depot.paiementParId(paiementId);
    if (!p) return { ok: false, raison: "introuvable" };
    const reglages = await depot.lireReglages();
    if (p.etat === "libere") {
      await traiterVersements(p, reglages.fraisVersementGnf);
      return { ok: true, deja: true, versements: (await depot.versementsDuPaiement(p.id)).map((v) => ({ beneficiaire: v.beneficiaire, etat: v.etat })) };
    }
    // Depuis « en litige », seule une décision de litige (automatique ou humaine) peut libérer.
    if (p.etat !== "confirme" && !(p.etat === "en_litige" && options.depuisLitige === true)) return { ok: false, raison: "etat_incompatible", etat: p.etat };

    // Données nécessaires AVANT de bouger l'argent : un livreur à payer doit être connu.
    let livreurId: string | null = null;
    if (p.livreurGnf > 0) {
      livreurId = (await depot.lireCommande(p.orderId))?.livreurId ?? null;
      if (!livreurId) return { ok: false, raison: "livreur_inconnu" };
    }

    const passe = await depot.changerEtat(p.id, p.etat, "libere", { libereLe: iso() });
    if (!passe) return { ok: false, raison: "concurrent" };
    await depot.ajouterEcritures(p.id, "liberation", ecrituresLiberation(repartitionStockee(p)));

    if (p.restaurantGnf > 0) await ouvrirVersement(p, "restaurant", p.restaurantId, p.restaurantGnf, "R");
    if (p.livreurGnf > 0 && livreurId) await ouvrirVersement(p, "livreur", livreurId, p.livreurGnf, "L");
    await traiterVersements(p, reglages.fraisVersementGnf);
    return { ok: true, deja: false, versements: (await depot.versementsDuPaiement(p.id)).map((v) => ({ beneficiaire: v.beneficiaire, etat: v.etat })) };
  }

  async function ouvrirVersement(p: LignePaiement, beneficiaire: Beneficiaire, proprietaireId: string, montantGnf: number, suffixe: string): Promise<void> {
    const compte = await depot.lireCompteVersement(beneficiaire, proprietaireId);
    await depot.creerVersement({
      paiementId: p.id,
      beneficiaire,
      restaurantId: beneficiaire === "restaurant" ? proprietaireId : null,
      livreurId: beneficiaire === "livreur" ? proprietaireId : null,
      operateur: compte?.operateur ?? p.operateur,
      numeroMasque: compte ? masquerNumero(compte.numero) : "non renseigné",
      compteVersementId: compte?.id ?? null,
      montantGnf,
      // Référence STABLE : redemander le même versement au prestataire ne paie pas deux fois.
      referenceInterne: `${p.referenceInterne}-${suffixe}`,
    });
  }

  /** Tente (ou reprend) chaque versement non terminé. Un compte absent ou non vérifié laisse le versement « à verser » avec un code. */
  async function traiterVersements(p: LignePaiement, fraisVersementGnf = 0): Promise<void> {
    for (const v of await depot.versementsDuPaiement(p.id)) {
      if (v.etat === "confirme" || v.etat === "envoye") continue;
      await executerVersement(v, fraisVersementGnf);
    }
  }

  async function executerVersement(v: LigneVersement, fraisVersementGnf = 0): Promise<void> {
    const proprietaire = v.beneficiaire === "restaurant" ? v.restaurantId : v.livreurId;
    const compte = proprietaire ? await depot.lireCompteVersement(v.beneficiaire, proprietaire) : null;
    if (!compte) return void (await depot.majVersement(v.id, { etat: "a_verser", erreurCode: "compte_absent" }));
    if (!compte.verifie) return void (await depot.majVersement(v.id, { etat: "a_verser", erreurCode: "compte_non_verifie" }));
    // La passerelle ne verse pas (service non activé) : versement MANUEL, visible à l'exploitation, jamais tenté ni compté comme échec.
    if (passerelle.capacites?.versement === false) return void (await depot.majVersement(v.id, { etat: "a_verser", erreurCode: "versement_manuel_requis" }));
    // Un seul traitement à la fois par versement : celui qui ne réussit pas à le « prendre » s'arrête là.
    if (!(await depot.reserverVersement(v.id, ["a_verser", "echoue"]))) return;
    try {
      const r = await passerelle.verser({ referenceInterne: v.referenceInterne, montantGnf: v.montantGnf, operateur: compte.operateur, numero: compte.numero });
      if (r.etat === "succes") {
        await depot.majVersement(v.id, { etat: "confirme", referenceExterne: r.referenceExterne, erreurCode: null });
        await depot.ajouterEcritures(v.paiementId, `versement:${v.beneficiaire}`, ecrituresVersement(v.beneficiaire, v.montantGnf, fraisVersementGnf));
      } else if (r.etat === "en_attente") {
        await depot.majVersement(v.id, { etat: "envoye", referenceExterne: r.referenceExterne, erreurCode: null });
      } else {
        await depot.majVersement(v.id, { etat: "echoue", referenceExterne: r.referenceExterne, erreurCode: "refuse_par_le_prestataire" });
      }
    } catch (e) {
      await depot.majVersement(v.id, { etat: "echoue", erreurCode: e instanceof ErreurPasserelle ? e.code : "erreur" });
    }
  }

  /** Reprise manuelle ou planifiée des versements d'un paiement (à verser, en échec). */
  async function reprendreVersements(paiementId: string): Promise<{ ok: boolean }> {
    const p = await depot.paiementParId(paiementId);
    if (!p || p.etat !== "libere") return { ok: false };
    const reglages = await depot.lireReglages();
    for (const v of await depot.versementsDuPaiement(p.id)) {
      if (v.etat === "a_verser" || v.etat === "echoue") await executerVersement(v, reglages.fraisVersementGnf);
    }
    return { ok: true };
  }

  // -------------------------------------------------------------------------------------------------- 4. remboursement
  /**
   * Rend la totalité au client, AVANT libération (ou depuis un litige tranché). Après libération, l'argent est déjà chez les
   * bénéficiaires : le remboursement est une décision humaine (aucun retrait automatique chez un tiers).
   */
  async function rembourserTotal(paiementId: string): Promise<ResultatRemboursement> {
    const p = await depot.paiementParId(paiementId);
    if (!p) return { ok: false, raison: "introuvable" };
    if (p.etat === "rembourse") return { ok: true, deja: true };
    if (p.etat !== "confirme" && p.etat !== "en_litige") return { ok: false, raison: "etat_incompatible", etat: p.etat };
    if (!p.referenceExterne) return { ok: false, raison: "etat_incompatible", etat: p.etat };

    // Un litige qui a déjà été libéré ne se rembourse pas automatiquement : on ne reprend pas d'argent à des tiers.
    if (p.etat === "en_litige" && (await depot.versementsDuPaiement(p.id)).length > 0) return { ok: false, raison: "etat_incompatible", etat: p.etat };

    // Le prestataire ne sait pas rembourser : aucun appel, le cas est confié à un humain (voir rembourserOuEscalader).
    if (passerelle.capacites?.remboursement === false) return { ok: false, raison: "passerelle", etat: p.etat };

    const evenement: EvenementPaiement = p.etat === "confirme" ? "remboursement_total" : "clore_litige_rembourser";
    const t = transitionPaiement(p.etat, evenement);
    if (!t.ok) return { ok: false, raison: "etat_incompatible", etat: p.etat };

    let reponse;
    try {
      reponse = await passerelle.rembourser({ referenceExterneEncaissement: p.referenceExterne, referenceInterne: `${p.referenceInterne}-RB`, montantGnf: p.totalGnf });
    } catch {
      return { ok: false, raison: "passerelle", etat: p.etat };
    }
    if (reponse.etat === "echec") return { ok: false, raison: "passerelle", etat: p.etat };

    const passe = await depot.changerEtat(p.id, p.etat, "rembourse", { rembourseGnf: p.totalGnf });
    if (!passe) return { ok: false, raison: "concurrent" };
    await depot.ajouterEcritures(p.id, "remboursement", ecrituresRemboursementAvantLiberation(p.totalGnf));
    await depot.synchroniserCommande(p.orderId, "abandonnee");
    return { ok: true, deja: false };
  }

  /**
   * Tente le remboursement automatique ; s'il est impossible (le prestataire ne rembourse pas, ou est en panne), le paiement est GELÉ en
   * litige confié à l'exploitation, avec la règle « remboursement à faire à la main ». L'argent ne se libère jamais vers les bénéficiaires
   * dans l'intervalle.
   */
  async function rembourserOuEscalader(paiementId: string): Promise<ResultatRemboursement> {
    const r = await rembourserTotal(paiementId);
    if (r.ok || r.raison !== "passerelle") return r;
    const p = await depot.paiementParId(paiementId);
    if (p && p.etat === "confirme" && (await depot.changerEtat(p.id, "confirme", "en_litige"))) {
      const litige = await depot.creerLitige({ paiementId: p.id, ouvertPar: "systeme", situation: "restaurant_refuse_ou_annule", montantDemandeGnf: p.totalGnf, preuveFournie: false });
      await depot.majLitige(litige.id, { etat: "a_humain", decision: "rembourser_total", regle: "remboursement_a_faire_a_la_main", remboursementGnf: null });
    }
    return r;
  }

  /** L'exploitation a rendu l'argent au client HORS de l'application (compte du prestataire, mobile money) : on l'enregistre. */
  async function rembourserManuellement(paiementId: string): Promise<ResultatRemboursement> {
    const p = await depot.paiementParId(paiementId);
    if (!p) return { ok: false, raison: "introuvable" };
    if (p.etat === "rembourse") return { ok: true, deja: true };
    if (p.etat !== "confirme" && p.etat !== "en_litige") return { ok: false, raison: "etat_incompatible", etat: p.etat };
    if ((await depot.versementsDuPaiement(p.id)).length > 0) return { ok: false, raison: "etat_incompatible", etat: p.etat };
    const passe = await depot.changerEtat(p.id, p.etat, "rembourse", { rembourseGnf: p.totalGnf });
    if (!passe) return { ok: false, raison: "concurrent" };
    await depot.ajouterEcritures(p.id, "remboursement", ecrituresRemboursementAvantLiberation(p.totalGnf));
    await depot.synchroniserCommande(p.orderId, "abandonnee");
    return { ok: true, deja: false };
  }

  /**
   * L'exploitation a versé le bénéficiaire HORS de l'application (depuis le compte du prestataire) : on enregistre le versement avec sa
   * référence. Une seule fois : un versement déjà confirmé est refusé.
   */
  async function confirmerVersementManuel(versementId: string, reference: string): Promise<{ ok: true } | { ok: false; raison: "introuvable" | "deja_traite" | "paiement_non_libere" }> {
    const v = await depot.versementParId(versementId);
    if (!v) return { ok: false, raison: "introuvable" };
    const p = await depot.paiementParId(v.paiementId);
    if (!p || p.etat !== "libere") return { ok: false, raison: "paiement_non_libere" };
    if (!(await depot.reserverVersement(v.id, ["a_verser", "echoue"]))) return { ok: false, raison: "deja_traite" };
    await depot.majVersement(v.id, { etat: "confirme", referenceExterne: reference.slice(0, 80), erreurCode: null });
    const reglages = await depot.lireReglages();
    await depot.ajouterEcritures(v.paiementId, `versement:${v.beneficiaire}`, ecrituresVersement(v.beneficiaire, v.montantGnf, reglages.fraisVersementGnf));
    return { ok: true };
  }

  // -------------------------------------------------------------------------------------------------- 5. litiges
  async function ouvrirLitige(entree: {
    paiementId: string;
    ouvertPar: "client" | "restaurant" | "livreur" | "systeme";
    situation: Situation;
    montantDemandeGnf?: number;
    preuveFournie?: boolean;
    commandeRecupereeParLivreur?: boolean;
  }): Promise<{ ok: true; litigeId: string; decision: Decision } | { ok: false; raison: "introuvable" | "etat_incompatible" }> {
    const p = await depot.paiementParId(entree.paiementId);
    if (!p) return { ok: false, raison: "introuvable" };
    if (p.etat !== "confirme" && p.etat !== "libere") return { ok: false, raison: "etat_incompatible" };

    const reglages = await depot.lireReglages();
    const avantLiberation = p.etat === "confirme";
    const litige = await depot.creerLitige({
      paiementId: p.id,
      ouvertPar: entree.ouvertPar,
      situation: entree.situation,
      montantDemandeGnf: entree.montantDemandeGnf ?? null,
      preuveFournie: entree.preuveFournie === true,
    });
    // Le paiement est gelé le temps de la décision : aucune libération possible depuis « en litige ».
    const gele = await depot.changerEtat(p.id, p.etat, "en_litige");
    if (!gele) return { ok: false, raison: "etat_incompatible" };

    const decision = decider(
      {
        situation: entree.situation,
        repasGnf: p.repasGnf,
        fraisLivraisonGnf: p.fraisLivraisonGnf,
        montantDemandeGnf: entree.montantDemandeGnf,
        commandeRecupereeParLivreur: entree.commandeRecupereeParLivreur,
        preuveFournie: entree.preuveFournie,
      },
      { plafondRemboursementAutoPourMille: reglages.plafondRemboursementAutoPermille, seuilHumainGnf: reglages.seuilLitigeHumainGnf }
    );

    // Seules deux décisions automatiques sont appliquées, et seulement AVANT libération ; tout le reste va à un humain.
    if (decision.decision === "rembourser_total" && avantLiberation && decision.restaurantPaye === false && decision.livreurPaye === false) {
      const r = await rembourserTotal(p.id);
      if (r.ok) {
        await depot.majLitige(litige.id, { etat: "clos", decision: decision.decision, regle: decision.regle, remboursementGnf: decision.remboursementClientGnf, motifCloture: "Décision automatique" });
        return { ok: true, litigeId: litige.id, decision };
      }
    } else if (decision.decision === "aucun_remboursement" && avantLiberation && decision.restaurantPaye && decision.livreurPaye) {
      const l = await libererPaiement(p.id, { depuisLitige: true });
      if (l.ok) {
        await depot.majLitige(litige.id, { etat: "clos", decision: decision.decision, regle: decision.regle, remboursementGnf: 0, motifCloture: "Décision automatique" });
        return { ok: true, litigeId: litige.id, decision };
      }
    }
    await depot.majLitige(litige.id, { etat: "a_humain", decision: decision.decision, regle: decision.regle, remboursementGnf: null });
    return { ok: true, litigeId: litige.id, decision };
  }

  /**
   * Décision HUMAINE sur un litige resté à l'exploitation : rendre l'argent au client ou libérer vers les bénéficiaires. Le remboursement
   * est refusé si l'argent est déjà parti (aucun retrait automatique chez un tiers) : l'exploitation le traite alors à la main.
   */
  async function trancherLitige(entree: { paiementId: string; litigeId: string; decision: "rembourser" | "liberer" | "rembourser_manuel"; motif: string }): Promise<
    { ok: true } | { ok: false; raison: "introuvable" | "litige_clos" | "deja_verse" | "echec" }
  > {
    const p = await depot.paiementParId(entree.paiementId);
    if (!p) return { ok: false, raison: "introuvable" };
    const ouverts = await depot.litigesOuverts(p.id);
    const litige = ouverts.find((l) => l.id === entree.litigeId);
    if (!litige) return { ok: false, raison: "litige_clos" };
    if (p.etat !== "en_litige") return { ok: false, raison: "echec" };

    if (entree.decision === "rembourser" || entree.decision === "rembourser_manuel") {
      if ((await depot.versementsDuPaiement(p.id)).length > 0) return { ok: false, raison: "deja_verse" };
      const r = entree.decision === "rembourser_manuel" ? await rembourserManuellement(p.id) : await rembourserTotal(p.id);
      if (!r.ok) return { ok: false, raison: "echec" };
    } else {
      const r = await libererPaiement(p.id, { depuisLitige: true });
      if (!r.ok) return { ok: false, raison: "echec" };
    }
    await depot.majLitige(litige.id, {
      etat: "clos",
      decision: entree.decision === "liberer" ? "aucun_remboursement" : "rembourser_total",
      regle: entree.decision === "rembourser_manuel" ? "decision_humaine_remboursement_manuel" : "decision_humaine",
      remboursementGnf: entree.decision === "liberer" ? 0 : p.totalGnf,
      motifCloture: entree.motif.slice(0, 300),
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------------------------------------- 6. réactions aux commandes
  /** Commande terminée (remise au client, retrait fait, servie) : l'objectif est atteint, on libère. Sans effet s'il n'y a pas de paiement en ligne. */
  async function surCommandeTerminee(orderId: string): Promise<ResultatLiberation | null> {
    const p = await depot.paiementParCommande(orderId);
    if (!p) return null;
    if (p.etat === "en_litige") return { ok: false, raison: "etat_incompatible", etat: p.etat };
    if (p.etat !== "confirme" && p.etat !== "libere") return { ok: false, raison: "etat_incompatible", etat: p.etat };
    return libererPaiement(p.id);
  }

  /** Commande refusée ou annulée : l'argent déjà reçu est rendu ; un paiement encore en attente est annulé. */
  async function surCommandeAnnulee(orderId: string): Promise<ResultatRemboursement | null> {
    const p = await depot.paiementParCommande(orderId);
    if (!p) return null;
    if (p.etat === "rembourse") return { ok: true, deja: true };
    if (p.etat === "cree" || p.etat === "en_attente") {
      const t = transitionPaiement(p.etat, "annuler");
      if (t.ok && (await depot.changerEtat(p.id, p.etat, "annule"))) await depot.synchroniserCommande(p.orderId, "abandonnee");
      return { ok: true, deja: false };
    }
    if (p.etat === "confirme") return rembourserOuEscalader(p.id);
    if (argentRecu(p.etat)) return { ok: false, raison: "etat_incompatible", etat: p.etat };
    return { ok: true, deja: true };
  }

  /**
   * Entretien périodique (toutes les quelques minutes) : expire les paiements restés en attente, relance les versements à faire ou en
   * échec. Ne traite que les paiements du fournisseur de CETTE passerelle. Borné : au plus `limite` paiements par passage.
   */
  async function entretien(options: { limite?: number; maxTentatives?: number } = {}): Promise<{ expires: number; reprises: number }> {
    const limite = options.limite ?? 50;
    let expires = 0;
    let reprises = 0;
    for (const p of await depot.paiementsAExpirer(iso(), limite)) {
      if (p.fournisseur === passerelle.nom && (await expirerSiBesoin(p.id))) expires += 1;
    }
    for (const p of await depot.paiementsAReprendre(options.maxTentatives ?? 5, limite)) {
      if (p.fournisseur === passerelle.nom && (await reprendreVersements(p.id)).ok) reprises += 1;
    }
    return { expires, reprises };
  }

  /** Paiements restés « en attente » après le délai : expirés. À appeler périodiquement. */
  async function expirerSiBesoin(paiementId: string): Promise<boolean> {
    const p = await depot.paiementParId(paiementId);
    if (!p || p.etat !== "en_attente") return false;
    const expire = await depot.changerEtat(p.id, "en_attente", "expire");
    if (expire) await depot.synchroniserCommande(p.orderId, "abandonnee");
    return expire;
  }

  return {
    ouvrirPaiement,
    appliquerNotification,
    libererPaiement,
    reprendreVersements,
    rembourserTotal,
    rembourserManuellement,
    confirmerVersementManuel,
    ouvrirLitige,
    trancherLitige,
    surCommandeTerminee,
    surCommandeAnnulee,
    expirerSiBesoin,
    entretien,
  };
}

export type ServicePaiement = ReturnType<typeof creerServicePaiement>;

export { REGLES_LITIGES_SIMULATION };
