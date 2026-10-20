import { ErreurPasserelle } from "./fournisseur";
import { calculerSignature, signatureValide } from "./signature";
import { estOperateur } from "./types";
import type {
  DemandeEncaissement,
  DemandeRemboursement,
  DemandeVersement,
  EtatOperation,
  EvenementNotification,
  PasserelleDePaiement,
  ResultatEncaissement,
  ResultatRemboursement,
  ResultatVerification,
  ResultatVersement,
  StatutOperation,
} from "./fournisseur";

/**
 * Adaptateur Chap Chap Pay (Référence API lue le 21 octobre 2026 : docs/CHAPCHAP-NOTES-API.md).
 *
 * IMPLÉMENTÉ (documenté et confirmé) :
 *  - encaisser : `POST /ecommerce/create` (lien de paiement hébergé), signé HMAC-SHA256 hexadécimal du corps exact ;
 *  - lireStatut : `GET /ecommerce/{operation_id}` ;
 *  - verifierNotification : signature HMAC du corps BRUT, statut de l'opération.
 *
 * NON DISPONIBLE (la Référence ne l'offre pas, ou le service n'est pas activé sur le compte) : l'adaptateur le DIT au lieu de deviner.
 *  - remboursement : aucun endpoint documenté → `non_implemente` ; le service confie alors le cas à un humain ;
 *  - versement (PUSH) : service « API Push » non activé sur le compte → `non_implemente` tant que `pushActif` est faux ; le service
 *    passe alors en versement MANUEL (l'exploitation verse depuis le compte Chap Chap et le déclare dans l'application).
 *
 * Règles de la Référence qui conditionnent le code :
 *  - `success` est définitif et n'arrive qu'une fois ; `failed`, `error` et même `canceled` peuvent être suivis d'un `success`. Seuls
 *    `success`, `canceled` et `expired` changent l'état d'un paiement ; `failed`, `error`, `new` et `pending` sont reçus et journalisés mais
 *    laissent le paiement « en attente » (l'issue n'est pas définitive).
 *  - Il n'y a pas d'identifiant d'événement : l'identifiant d'idempotence est `operation_id:statut`.
 */

export const CHAPCHAP = {
  urlDeBase: "https://chapchappay.com/api",
  hotePaiement: "chapchappay.com",
  /** Minimum d'un paiement, constaté en mode test le 21 octobre 2026 (« Le montant doit être supérieur ou égal à 3 000 GNF »). */
  montantMinimumGnf: 3000,
  enTeteCle: "CCP-Api-Key",
  enTeteSignature: "CCP-HMAC-Signature",
  delaiMs: 15_000,
} as const;

/** Statut de notification Chap Chap vers l'état interne ; `null` pour un statut inconnu (refusé, jamais deviné). */
export function etatDepuisStatutChapChap(statut: string): EtatOperation | null {
  switch (statut) {
    case "success":
      return "succes";
    case "canceled":
      return "annule";
    case "expired":
      return "expire";
    // Non définitifs : le paiement peut encore aboutir (nouvel essai du client, confirmation tardive de l'opérateur).
    case "failed":
    case "error":
    case "new":
    case "pending":
      return "en_attente";
    default:
      return null;
  }
}

export interface ConfigurationChapChap {
  /** Clé d'API (test ou production). Lue dans l'environnement, jamais dans le dépôt. */
  cleApi: string | null;
  /** Encryption Password : clé de signature HMAC. Lue dans l'environnement, jamais dans le dépôt. */
  cleSignature: string | null;
  /** Remplace `fetch` (tests). */
  fetch?: typeof fetch;
  /** Le service « API Push » est-il activé sur le compte ? Faux tant que Chap Chap ne l'a pas activé (versement manuel). */
  pushActif?: boolean;
}

interface ReponseHttp {
  statut: number;
  corps: unknown;
}

const NON_IMPLEMENTE = (quoi: string) => new ErreurPasserelle("non_implemente", `Chap Chap Pay : ${quoi}.`);

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function creerPasserelleChapChap(configuration: ConfigurationChapChap): PasserelleDePaiement {
  const { cleApi, cleSignature } = configuration;
  const appeler = configuration.fetch ?? fetch;
  const exiger = () => {
    if (!cleApi || !cleSignature) throw new ErreurPasserelle("non_configuree", "Chap Chap Pay : clés absentes de l'environnement.");
  };

  async function requete(methode: "GET" | "POST", chemin: string, corps?: string): Promise<ReponseHttp> {
    exiger();
    const entetes: Record<string, string> = { [CHAPCHAP.enTeteCle]: cleApi as string, Accept: "application/json" };
    if (corps !== undefined) {
      entetes["Content-Type"] = "application/json";
      // La signature porte sur les octets EXACTS envoyés : le même texte est signé et transmis.
      entetes[CHAPCHAP.enTeteSignature] = calculerSignature(corps, cleSignature as string, "hex");
    }
    let reponse: Response;
    try {
      reponse = await appeler(CHAPCHAP.urlDeBase + chemin, { method: methode, headers: entetes, body: corps, signal: AbortSignal.timeout(CHAPCHAP.delaiMs) });
    } catch {
      throw new ErreurPasserelle("reseau", "Chap Chap Pay : injoignable.");
    }
    let lu: unknown = null;
    try {
      lu = await reponse.json();
    } catch {
      lu = null;
    }
    if (reponse.status === 401 || reponse.status === 403) throw new ErreurPasserelle("refusee", "Chap Chap Pay : clé refusée.");
    if (reponse.status >= 500) throw new ErreurPasserelle("reseau", "Chap Chap Pay : erreur du prestataire.");
    if (reponse.status >= 400) {
      // Le message du prestataire explique le refus (validation) : il ne contient aucun secret, on le garde pour le diagnostic.
      const detail = estObjet(lu) && typeof lu.message === "string" ? ` (${lu.message.slice(0, 160)})` : "";
      throw new ErreurPasserelle("refusee", `Chap Chap Pay : demande refusée${detail}.`);
    }
    return { statut: reponse.status, corps: lu };
  }

  return {
    nom: "chapchap",
    capacites: { versement: configuration.pushActif === true, remboursement: false },
    montantMinimumGnf: CHAPCHAP.montantMinimumGnf,

    async encaisser(d: DemandeEncaissement): Promise<ResultatEncaissement> {
      const options: Record<string, unknown> = { "jump-to-payment-method": d.operateur };
      const corps = JSON.stringify({
        amount: d.montantGnf,
        // Notre référence interne : 4 à 64 caractères alphanumériques, « - » et « _ ».
        order_id: d.referenceInterne,
        description: d.description.slice(0, 120),
        // Les frais sont déduits de ce que reçoit Speedfood : décision « frais supportés par Speedfood ».
        fee_handling: "deduct",
        ...(d.urlNotification ? { callback_url: d.urlNotification } : {}),
        ...(d.urlRetour ? { return_url: d.urlRetour } : {}),
        ...(d.urlAnnulation ? { cancel_url: d.urlAnnulation } : {}),
        options,
      });
      const r = await requete("POST", "/ecommerce/create", corps);
      const lu = estObjet(r.corps) ? r.corps : null;
      const operation = typeof lu?.operation_id === "string" ? lu.operation_id : null;
      const url = typeof lu?.payment_url === "string" ? lu.payment_url : null;
      if (!operation || !url) throw new ErreurPasserelle("reponse_invalide", "Chap Chap Pay : réponse de création illisible.");
      // L'adresse de paiement n'est suivie que si elle pointe bien chez le prestataire (jamais une adresse arbitraire renvoyée telle quelle).
      let hote = "";
      try {
        const u = new URL(url);
        hote = u.protocol === "https:" ? u.hostname : "";
      } catch {
        hote = "";
      }
      if (hote !== CHAPCHAP.hotePaiement && !hote.endsWith("." + CHAPCHAP.hotePaiement)) throw new ErreurPasserelle("reponse_invalide", "Chap Chap Pay : adresse de paiement inattendue.");
      return { referenceExterne: operation, urlPaiement: url };
    },

    async lireStatut(referenceExterne: string): Promise<StatutOperation> {
      if (!/^[0-9a-fA-F-]{8,64}$/.test(referenceExterne)) throw new ErreurPasserelle("reponse_invalide", "Chap Chap Pay : identifiant d'opération invalide.");
      const r = await requete("GET", `/ecommerce/${referenceExterne}`);
      const lu = estObjet(r.corps) ? r.corps : null;
      const statut = estObjet(lu?.status) && typeof lu.status.code === "string" ? lu.status.code : "";
      const etat = etatDepuisStatutChapChap(statut);
      if (!etat) throw new ErreurPasserelle("reponse_invalide", "Chap Chap Pay : statut inconnu.");
      const montant = typeof lu?.amount === "number" && Number.isSafeInteger(lu.amount) && lu.amount >= 0 ? lu.amount : null;
      return { referenceExterne, etat, montantGnf: montant };
    },

    verifierNotification(corpsBrut: string, entetes: Record<string, string | undefined>): ResultatVerification {
      // Ne lève jamais. La signature se vérifie sur le corps BRUT, avant toute lecture du JSON.
      if (!cleSignature) return { ok: false, raison: "non_configuree" };
      if (!signatureValide(corpsBrut, entetes[CHAPCHAP.enTeteSignature.toLowerCase()], cleSignature, "hex")) return { ok: false, raison: "signature_invalide" };
      let lu: unknown;
      try {
        lu = JSON.parse(corpsBrut);
      } catch {
        return { ok: false, raison: "corps_illisible" };
      }
      if (!estObjet(lu)) return { ok: false, raison: "corps_illisible" };
      const operation = lu.operation_id;
      const statut = estObjet(lu.status) ? lu.status.code : undefined;
      if (typeof operation !== "string" || operation === "" || typeof statut !== "string") return { ok: false, raison: "champs_manquants" };
      const etat = etatDepuisStatutChapChap(statut);
      if (!etat) return { ok: false, raison: "statut_inconnu" };
      const montant = lu.amount;
      if (montant !== undefined && montant !== null && !(typeof montant === "number" && Number.isSafeInteger(montant) && montant >= 0)) return { ok: false, raison: "montant_invalide" };
      const evenement: EvenementNotification = {
        // Pas d'identifiant d'événement chez Chap Chap : (opération, statut) en tient lieu ; un renvoi du même statut est un doublon.
        identifiant: `${operation}:${statut}`,
        referenceExterne: operation,
        referenceInterne: typeof lu.order_id === "string" ? lu.order_id : null,
        etat,
        montantGnf: typeof montant === "number" ? montant : null,
        statutBrut: statut,
      };
      return { ok: true, evenement };
    },

    async verser(d: DemandeVersement): Promise<ResultatVersement> {
      if (configuration.pushActif !== true) throw NON_IMPLEMENTE("le versement (API Push) n'est pas activé sur le compte : versement manuel");
      exiger();
      // Opérateurs pris en charge par le modèle PUSH : orange_money et mtn_momo (`payment_channel`).
      if (!estOperateur(d.operateur)) throw new ErreurPasserelle("refusee", "Chap Chap Pay : opérateur de versement invalide.");
      throw NON_IMPLEMENTE("le versement (API Push) attend l'activation et la documentation du service sur le compte");
    },

    async rembourser(_d: DemandeRemboursement): Promise<ResultatRemboursement> {
      void _d;
      throw NON_IMPLEMENTE("aucun endpoint de remboursement dans la Référence API : remboursement manuel");
    },
  };
}
