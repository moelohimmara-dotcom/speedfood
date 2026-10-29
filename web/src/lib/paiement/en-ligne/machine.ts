import type { EtatPaiement, EvenementPaiement } from "./types";

/**
 * Machine à états du paiement en ligne (voir docs/PAIEMENT-ARCHITECTURE.md §4).
 *
 * Règles de sécurité de l'argent :
 *  - une transition qui n'est pas dans la table est REFUSÉE (jamais corrigée en silence) ;
 *  - un événement qui répète l'état déjà atteint est un no-op (idempotence : un prestataire peut notifier plusieurs fois) ;
 *  - un succès qui arrive APRÈS une expiration ou une annulation n'est pas ignoré : l'argent est là, il passe à « confirmé »
 *    et l'appelant décide (remboursement automatique si la commande n'est plus valable).
 */

type Table = Partial<Record<EtatPaiement, Partial<Record<EvenementPaiement, EtatPaiement>>>>;

const TRANSITIONS: Table = {
  cree: { demander: "en_attente", annuler: "annule" },
  en_attente: {
    notification_succes: "confirme",
    notification_echec: "echoue",
    notification_annulation: "annule",
    annuler: "annule",
    expiration: "expire",
  },
  confirme: { liberer: "libere", remboursement_total: "rembourse", ouvrir_litige: "en_litige" },
  libere: { ouvrir_litige: "en_litige" },
  en_litige: { clore_litige_liberer: "libere", clore_litige_rembourser: "rembourse" },
  expire: { notification_succes: "confirme" },
  annule: { notification_succes: "confirme" },
};

export type ResultatTransition =
  | { ok: true; etat: EtatPaiement; change: boolean }
  | { ok: false; raison: "transition_interdite"; de: EtatPaiement; evenement: EvenementPaiement };

/** États dont on ne sort plus (hors succès tardif, géré dans la table). */
export const ETATS_TERMINAUX: readonly EtatPaiement[] = ["echoue", "rembourse"];

export function transitionPaiement(etat: EtatPaiement, evenement: EvenementPaiement): ResultatTransition {
  const vers = TRANSITIONS[etat]?.[evenement];
  if (vers) return { ok: true, etat: vers, change: vers !== etat };
  // Notification de succès rejouée alors que l'argent est déjà reçu (même après libération, litige ou remboursement) : ignorée.
  if (evenement === "notification_succes" && argentRecu(etat)) return { ok: true, etat, change: false };
  // Idempotence : un événement qui ramènerait à l'état courant n'est pas une erreur.
  if (evenementDejaApplique(etat, evenement)) return { ok: true, etat, change: false };
  return { ok: false, raison: "transition_interdite", de: etat, evenement };
}

/** Vrai si `evenement` a déjà produit `etat` (rejeu d'une notification ou d'une demande). */
function evenementDejaApplique(etat: EtatPaiement, evenement: EvenementPaiement): boolean {
  for (const [source, evenements] of Object.entries(TRANSITIONS) as [EtatPaiement, Partial<Record<EvenementPaiement, EtatPaiement>>][]) {
    if (source !== etat && evenements[evenement] === etat) return true;
  }
  return false;
}

/** L'argent est (ou a été) réellement chez le prestataire dans cet état. */
export function argentRecu(etat: EtatPaiement): boolean {
  return etat === "confirme" || etat === "libere" || etat === "en_litige" || etat === "rembourse";
}

/** Une libération (versement aux bénéficiaires) n'est possible que depuis « confirmé ». */
export function peutLiberer(etat: EtatPaiement): boolean {
  return etat === "confirme";
}
