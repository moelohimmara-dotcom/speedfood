import { calculerSignature, signatureValide } from "./signature";
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
 * Passerelle de SIMULATION : aucun réseau, aucun argent. Elle permet de tester tout le système (états, livre de comptes, versements,
 * litiges) et de faire une démonstration. Elle est SANS ÉTAT : l'état d'un paiement vit en base, comme avec un vrai prestataire ;
 * pour « faire payer le client », on fabrique une notification signée (`fabriquerNotification`) que l'on envoie au service comme
 * le ferait le prestataire.
 */

export const EN_TETE_SIGNATURE_SIMULATION = "x-simulation-signature";

export interface OptionsSimulation {
  /** Clé de signature des notifications simulées. Jamais une clé réelle. */
  cle?: string;
}

export interface NotificationFabriquee {
  corps: string;
  entetes: Record<string, string>;
}

export interface PasserelleSimulation extends PasserelleDePaiement {
  fabriquerNotification(e: { identifiant: string; referenceExterne: string; referenceInterne: string | null; etat: EtatOperation; montantGnf: number | null }): NotificationFabriquee;
}

const ETATS: readonly EtatOperation[] = ["en_attente", "succes", "echec", "annule", "expire"];

export function creerPasserelleSimulation(options: OptionsSimulation = {}): PasserelleSimulation {
  const cle = options.cle ?? "cle-de-simulation";
  return {
    nom: "simulation",

    async encaisser(d: DemandeEncaissement): Promise<ResultatEncaissement> {
      return { referenceExterne: `SIM-${d.referenceInterne}`, urlPaiement: null };
    },

    // Sans état : la vérité est en base. Une lecture de statut simulée répond « en attente » ; seules les notifications font avancer.
    async lireStatut(referenceExterne: string): Promise<StatutOperation> {
      return { referenceExterne, etat: "en_attente", montantGnf: null };
    },

    verifierNotification(corpsBrut: string, entetes: Record<string, string | undefined>): ResultatVerification {
      if (!signatureValide(corpsBrut, entetes[EN_TETE_SIGNATURE_SIMULATION], cle)) return { ok: false, raison: "signature_invalide" };
      let lu: unknown;
      try {
        lu = JSON.parse(corpsBrut);
      } catch {
        return { ok: false, raison: "corps_illisible" };
      }
      if (!lu || typeof lu !== "object") return { ok: false, raison: "corps_illisible" };
      const x = lu as Record<string, unknown>;
      if (typeof x.identifiant !== "string" || x.identifiant === "" || typeof x.referenceExterne !== "string" || x.referenceExterne === "") {
        return { ok: false, raison: "champs_manquants" };
      }
      if (typeof x.etat !== "string" || !(ETATS as readonly string[]).includes(x.etat)) return { ok: false, raison: "etat_inconnu" };
      const montant = x.montantGnf;
      if (montant !== null && !(typeof montant === "number" && Number.isSafeInteger(montant) && montant >= 0)) return { ok: false, raison: "montant_invalide" };
      const evenement: EvenementNotification = {
        identifiant: x.identifiant,
        referenceExterne: x.referenceExterne,
        referenceInterne: typeof x.referenceInterne === "string" ? x.referenceInterne : null,
        etat: x.etat as EtatOperation,
        montantGnf: montant === null ? null : (montant as number),
      };
      return { ok: true, evenement };
    },

    async verser(d: DemandeVersement): Promise<ResultatVersement> {
      return { referenceExterne: `SIMV-${d.referenceInterne}`, etat: "succes" };
    },

    async rembourser(d: DemandeRemboursement): Promise<ResultatRemboursement> {
      return { referenceExterne: `SIMR-${d.referenceInterne}`, etat: "succes" };
    },

    fabriquerNotification(e): NotificationFabriquee {
      const corps = JSON.stringify(e);
      return { corps, entetes: { [EN_TETE_SIGNATURE_SIMULATION]: calculerSignature(corps, cle) } };
    },
  };
}
