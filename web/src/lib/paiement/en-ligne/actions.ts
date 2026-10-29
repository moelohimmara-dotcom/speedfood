"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ErreurApi } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { chargerSuiviParJeton } from "@/lib/commande/requetes";
import { estJetonValide } from "@/lib/commande/jetons";
import { lireJetonSessionSuivi } from "@/lib/commande/sessionSuivi";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterDeclarationPaiement } from "@/lib/securite/limitation-debit";
import { paiementOuvert, peutDeclarer } from "@/lib/paiement/regles";
import { creerDepotSupabase } from "./depot-supabase";
import { creerPasserelle, obtenirServicePaiement } from "./fabrique";
import { ErreurPasserelle } from "./fournisseur";
import { creerServicePaiement } from "./service";
import type { PasserelleSimulation } from "./simulation";
import { estOperateur } from "./types";

/**
 * Actions du client sur le paiement en ligne (page de suivi). Authentifiées par le jeton de suivi (ou son cookie) ; les montants viennent
 * de la base, jamais du navigateur. Toutes refusent tant que l'interrupteur `paiement_en_ligne_actif` est éteint.
 */

export type ResultatPaiementEnLigne = { ok: true; urlPaiement: string | null } | { ok: false; erreur: ErreurApi };

const introuvable = (): ResultatPaiementEnLigne => ({ ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } });
const refus = (message: string, code: ErreurApi["code"] = "CONFLIT_ETAT"): ResultatPaiementEnLigne => ({ ok: false, erreur: { code, message } });

async function idCommandeParJeton(jeton: string): Promise<string | null> {
  const { data } = await (creerClientAdmin() as unknown as SupabaseClient).from("orders").select("id").eq("jeton_suivi", jeton).maybeSingle();
  return data ? String(data.id) : null;
}

/** Le client choisit de payer en ligne avec Orange Money ou MTN MoMo. Ouvre le paiement chez le prestataire (idempotent). */
export async function payerEnLigneAction(jeton: string, operateur: string): Promise<ResultatPaiementEnLigne> {
  if (!estJetonValide(jeton)) return introuvable();
  if (!estOperateur(operateur)) return refus("Opérateur invalide.", "VALIDATION");
  try {
    await limiterDeclarationPaiement();
    const suivi = await chargerSuiviParJeton(jeton);
    if (!suivi) return introuvable();
    if (!paiementOuvert(suivi.statut, suivi.propositionActive !== null)) return refus("Le paiement s'ouvre quand le restaurant a accepté la commande.");
    if (!peutDeclarer(suivi.paiement.statut)) return refus("Cette commande est déjà payée.");
    if (!suivi.paiement.enLigne.disponible) return refus("Le paiement en ligne n'est pas disponible pour le moment.");
    const orderId = await idCommandeParJeton(jeton);
    if (!orderId) return introuvable();

    const service = await obtenirServicePaiement();
    const r = await service.ouvrirPaiement({ orderId, operateur });
    if (!r.ok) {
      const messages: Record<typeof r.raison, string> = {
        desactive: "Le paiement en ligne n'est pas disponible pour le moment.",
        commande_introuvable: "Commande introuvable.",
        montant_invalide: "Le montant de cette commande ne peut pas être payé en ligne.",
        plafond_depasse: "Ce montant dépasse la limite du paiement en ligne. Choisissez un autre mode.",
        montant_minimum: `Le paiement en ligne n'est pas possible pour un montant aussi petit${r.detail ? ` (minimum ${Number(r.detail).toLocaleString("fr-FR")} GNF)` : ""}. Choisissez un autre mode.`,
        passerelle_indisponible: "Le service de paiement ne répond pas. Réessayez ou choisissez un autre mode.",
        commande_non_payable: "Cette commande ne peut plus être payée.",
      };
      return refus(messages[r.raison]);
    }
    if (r.deja && (r.etat === "echoue" || r.etat === "expire" || r.etat === "annule")) {
      return refus("Ce paiement n'a pas abouti. Choisissez un autre mode de paiement ou contactez le restaurant.");
    }
    return { ok: true, urlPaiement: r.urlPaiement };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.toApi() };
    if (erreur instanceof ErreurPasserelle) return refus("Le paiement en ligne n'est pas disponible pour le moment.");
    return { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez." } };
  }
}

/**
 * DÉMONSTRATION uniquement : valide le paiement comme le ferait le téléphone du client. Refuse dès que le fournisseur n'est plus la
 * simulation ; la notification est signée avec la clé du serveur et passe par le même chemin qu'une vraie notification.
 */
export async function simulerPaiementAction(jeton: string): Promise<ResultatPaiementEnLigne> {
  if (!estJetonValide(jeton)) return introuvable();
  try {
    await limiterDeclarationPaiement();
    const orderId = await idCommandeParJeton(jeton);
    if (!orderId) return introuvable();
    const depot = creerDepotSupabase();
    const reglages = await depot.lireReglages();
    if (reglages.fournisseur !== "simulation") return refus("Cette validation n'existe qu'en mode démonstration.");
    const paiement = await depot.paiementParCommande(orderId);
    if (!paiement || paiement.fournisseur !== "simulation" || paiement.etat !== "en_attente" || !paiement.referenceExterne) return refus("Aucun paiement en attente.");

    const passerelle = creerPasserelle("simulation") as PasserelleSimulation;
    const notification = passerelle.fabriquerNotification({
      identifiant: `sim-${paiement.id}`,
      referenceExterne: paiement.referenceExterne,
      referenceInterne: paiement.referenceInterne,
      etat: "succes",
      montantGnf: paiement.totalGnf,
    });
    await creerServicePaiement({ depot, passerelle }).appliquerNotification(notification.corps, notification.entetes);
    return { ok: true, urlPaiement: null };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.toApi() };
    if (erreur instanceof ErreurPasserelle) return refus("La démonstration n'est pas configurée.");
    return { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez." } };
  }
}

export async function payerEnLigneSessionAction(operateur: string): Promise<ResultatPaiementEnLigne> {
  const jeton = await lireJetonSessionSuivi();
  return jeton ? payerEnLigneAction(jeton, operateur) : introuvable();
}

export async function simulerPaiementSessionAction(): Promise<ResultatPaiementEnLigne> {
  const jeton = await lireJetonSessionSuivi();
  return jeton ? simulerPaiementAction(jeton) : introuvable();
}
