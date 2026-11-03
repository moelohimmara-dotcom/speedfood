import type { OptionPaiement, StatutPaiement } from "./regles";

/**
 * Décisions d'affichage du panneau de règlement du suivi (pures, testées). Décision du 3 novembre 2026 : Speedfood ne manipule jamais d'espèces ; le mode « especes »
 * n'est jamais proposé, mais l'état d'une commande déjà en cours (espèces à régler, paiement déclaré, non retrouvé) reste affiché.
 */
export const MESSAGE_SANS_MODE_PAIEMENT = "Le paiement en ligne Chap Chap Pay arrive bientôt. Rien à régler pour le moment.";
export const MESSAGE_ATTENTE_ACCEPTATION = "Speedfood n'encaisse rien. Quand le restaurant aura accepté votre commande, les moyens de paiement disponibles s'afficheront ici.";

/** Options réellement proposées : jamais les espèces. */
export function optionsAffichables(options: readonly OptionPaiement[]): OptionPaiement[] {
  return options.filter((o) => o.mode !== "especes");
}

/**
 * `recu` : carte « payé ». `sans_mode` : carte courte, SEULEMENT si rien n'a été demandé ni déclaré (`non_demande`) et qu'aucun mode ni paiement en ligne n'est proposé.
 * `principal` : rendu complet, qui affiche le libellé du statut (espèces à régler, déclaré, non retrouvé) même sans option à proposer.
 */
export function decisionPanneau(statut: StatutPaiement, nombreOptions: number, afficheEnLigne: boolean): "recu" | "sans_mode" | "principal" {
  if (statut === "recu") return "recu";
  if (statut === "non_demande" && nombreOptions === 0 && !afficheEnLigne) return "sans_mode";
  return "principal";
}

/** Texte de la carte courte : message Chap Chap Pay si le paiement est ouvert, sinon l'attente de l'acceptation. */
export function texteSansMode(ouvert: boolean): string {
  return ouvert ? MESSAGE_SANS_MODE_PAIEMENT : MESSAGE_ATTENTE_ACCEPTATION;
}
