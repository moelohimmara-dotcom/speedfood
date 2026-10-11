"use server";

import type { ReponseProposition, ResultatActionCommande } from "@/lib/contracts/commande";
import { lireJetonSessionSuivi } from "./sessionSuivi";
import { repondrePropositionAction, declarerPaiementAction } from "./actions";

/** Actions du nouveau parcours /suivi, authentifiées par cookie HttpOnly. */
export async function repondrePropositionSessionAction(
  propositionId: string,
  reponse: ReponseProposition,
): Promise<ResultatActionCommande> {
  const jeton = await lireJetonSessionSuivi();
  if (!jeton) return { ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } };
  return repondrePropositionAction(jeton, propositionId, reponse);
}

export async function declarerPaiementSessionAction(
  mode: string,
  reference: string,
): Promise<ResultatActionCommande> {
  const jeton = await lireJetonSessionSuivi();
  if (!jeton) return { ok: false, erreur: { code: "INTROUVABLE", message: "Lien de suivi introuvable." } };
  return declarerPaiementAction(jeton, mode, reference);
}
