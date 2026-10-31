import type { OperateurMobile } from "./types";

/**
 * Interface UNIQUE d'une passerelle de paiement (voir docs/PAIEMENT-ARCHITECTURE.md §3). Le reste du système (états, livre de comptes,
 * litiges, écrans) ne connaît que cette interface : changer de prestataire, ou en ajouter un, ne touche rien d'autre.
 */

export type NomFournisseur = "simulation" | "chapchap";

export interface DemandeEncaissement {
  /** Référence de Speedfood, unique par tentative : sert à retrouver le paiement à la notification. */
  referenceInterne: string;
  montantGnf: number;
  operateur: OperateurMobile;
  description: string;
  /** Adresse où le prestataire notifie le résultat (webhook), si le prestataire en demande une. */
  urlNotification?: string;
  /** Adresse où le client revient après le paiement. */
  urlRetour?: string;
  /** Adresse où le client revient s'il annule. */
  urlAnnulation?: string;
}

export interface ResultatEncaissement {
  /** Identifiant de l'opération chez le prestataire. */
  referenceExterne: string;
  /** Adresse où envoyer le client pour régler, si le prestataire en fournit une. */
  urlPaiement: string | null;
}

export type EtatOperation = "en_attente" | "succes" | "echec" | "annule" | "expire";

export interface StatutOperation {
  referenceExterne: string;
  etat: EtatOperation;
  montantGnf: number | null;
}

export interface EvenementNotification {
  /** Identifiant UNIQUE de la notification : sert à ignorer un rejeu. */
  identifiant: string;
  referenceExterne: string;
  referenceInterne: string | null;
  etat: EtatOperation;
  montantGnf: number | null;
  /** Statut tel que le prestataire l'a écrit (journal) : utile quand plusieurs statuts du prestataire donnent le même état interne. */
  statutBrut?: string;
}

export type ResultatVerification = { ok: true; evenement: EvenementNotification } | { ok: false; raison: string };

export interface DemandeVersement {
  referenceInterne: string;
  montantGnf: number;
  operateur: OperateurMobile;
  /** Numéro mobile money du bénéficiaire (jamais journalisé en clair). */
  numero: string;
}

export interface ResultatVersement {
  referenceExterne: string;
  etat: "en_attente" | "succes" | "echec";
}

export interface DemandeRemboursement {
  referenceExterneEncaissement: string;
  referenceInterne: string;
  montantGnf: number;
}

export interface ResultatRemboursement {
  referenceExterne: string;
  etat: "en_attente" | "succes" | "echec";
}

export interface PasserelleDePaiement {
  readonly nom: NomFournisseur;
  /**
   * Ce que la passerelle sait faire. Absent : tout (la simulation). Faux : le service ne tente pas l'appel et bascule en traitement
   * MANUEL (versement fait par l'exploitation et déclaré dans l'application ; remboursement confié à un humain).
   */
  readonly capacites?: { versement: boolean; remboursement: boolean };
  /** Montant minimal d'un encaissement chez ce prestataire, en GNF. En dessous, le paiement en ligne n'est pas proposé. */
  readonly montantMinimumGnf?: number;
  encaisser(demande: DemandeEncaissement): Promise<ResultatEncaissement>;
  lireStatut(referenceExterne: string): Promise<StatutOperation>;
  /** Vérifie la signature du corps BRUT puis le lit. Ne lève jamais : renvoie `{ ok: false }` si quoi que ce soit cloche. */
  verifierNotification(corpsBrut: string, entetes: Record<string, string | undefined>): ResultatVerification;
  verser(demande: DemandeVersement): Promise<ResultatVersement>;
  rembourser(demande: DemandeRemboursement): Promise<ResultatRemboursement>;
}

/** Erreur d'une passerelle : un code stable, jamais d'information secrète dans le message. */
export class ErreurPasserelle extends Error {
  code: "non_implemente" | "non_configuree" | "refusee" | "reseau" | "reponse_invalide";
  constructor(code: ErreurPasserelle["code"], message: string) {
    super(message);
    this.name = "ErreurPasserelle";
    this.code = code;
  }
}
