import { ErreurPasserelle } from "./fournisseur";
import type {
  DemandeEncaissement,
  DemandeRemboursement,
  DemandeVersement,
  EtatOperation,
  PasserelleDePaiement,
  ResultatEncaissement,
  ResultatRemboursement,
  ResultatVerification,
  ResultatVersement,
  StatutOperation,
} from "./fournisseur";

/**
 * Adaptateur Chap Chap Pay : SQUELETTE, volontairement NON BRANCHÉ (voir docs/PAIEMENT-ARCHITECTURE.md §9).
 *
 * Seul est utilisé ce que le guide public de Chap Chap Pay confirme (lu le 20 octobre 2026) : URL de base unique, en-tête de clé
 * `CCP-Api-Key` (clé Test ou Production, le mode dépend de la clé), signature HMAC-SHA256 en-tête `CCP-HMAC-Signature`, statuts de
 * notification `success`, `failed`, `canceled`, `expired`, `error`, notifications possiblement multiples (idempotence).
 *
 * NON confirmé, donc NON implémenté : endpoint de création d'un paiement, chaîne exacte à signer, format des notifications, API de
 * versement, remboursement, sandbox, délais de règlement, frais, codes d'erreur. Chaque méthode refuse de fonctionner avec une erreur
 * explicite plutôt que de deviner. Elles seront implémentées à partir de la Référence API de Chap Chap Pay et de clés de test.
 */

export const CHAPCHAP = {
  urlDeBase: "https://chapchappay.com/api",
  enTeteCle: "CCP-Api-Key",
  enTeteSignature: "CCP-HMAC-Signature",
} as const;

/**
 * Statut de notification Chap Chap vers l'état interne. `error` et tout statut inconnu renvoient `null` : un statut d'erreur peut
 * être technique (l'issue du paiement est alors INCONNUE) ; on ne change pas l'état d'un paiement sur une hypothèse.
 */
export function etatDepuisStatutChapChap(statut: string): EtatOperation | null {
  switch (statut) {
    case "success":
      return "succes";
    case "failed":
      return "echec";
    case "canceled":
      return "annule";
    case "expired":
      return "expire";
    default:
      return null;
  }
}

const NON_IMPLEMENTE = (quoi: string) =>
  new ErreurPasserelle("non_implemente", `Chap Chap Pay : ${quoi} n'est pas implémenté. La Référence API (et des clés de test) est requise : voir docs/PAIEMENT-ARCHITECTURE.md §9.`);

export interface ConfigurationChapChap {
  /** Clé d'API (test ou production). Lue dans l'environnement, jamais dans le dépôt. */
  cleApi: string | null;
  /** Clé de signature HMAC. Lue dans l'environnement, jamais dans le dépôt. */
  cleSignature: string | null;
}

export function creerPasserelleChapChap(configuration: ConfigurationChapChap): PasserelleDePaiement {
  const configuree = Boolean(configuration.cleApi && configuration.cleSignature);
  const exiger = () => {
    if (!configuree) throw new ErreurPasserelle("non_configuree", "Chap Chap Pay : clés absentes de l'environnement.");
  };
  return {
    nom: "chapchap",
    async encaisser(_d: DemandeEncaissement): Promise<ResultatEncaissement> {
      exiger();
      throw NON_IMPLEMENTE("la création d'un paiement (PULL)");
    },
    async lireStatut(_ref: string): Promise<StatutOperation> {
      exiger();
      throw NON_IMPLEMENTE("la lecture du statut d'une opération");
    },
    verifierNotification(_corps: string, _entetes: Record<string, string | undefined>): ResultatVerification {
      // Ne lève jamais : tant que la chaîne à signer et le format sont inconnus, toute notification est refusée.
      return { ok: false, raison: "adaptateur_non_implemente" };
    },
    async verser(_d: DemandeVersement): Promise<ResultatVersement> {
      exiger();
      throw NON_IMPLEMENTE("le versement (PUSH)");
    },
    async rembourser(_d: DemandeRemboursement): Promise<ResultatRemboursement> {
      exiger();
      throw NON_IMPLEMENTE("le remboursement");
    },
  };
}
