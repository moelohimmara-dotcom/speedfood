import "server-only";
import type { NextResponse } from "next/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterLivreur } from "@/lib/securite/limitation-debit";
import type { ResultatLivreur } from "@/lib/livraison/service-livreur";
import { lireCorpsJson, repondre, repondreErreur, utilisateurDuJeton } from "./v1";

/**
 * Entrée commune des routes `/api/v1/livreur/*` : compte identifié par le jeton porteur, plafond par compte, corps JSON (sauf lecture).
 * L'identifiant du livreur n'est jamais pris dans la requête : le service le déduit du compte.
 */
export async function livreurAuthentifie(request: Request): Promise<{ ok: true; utilisateurId: string } | { ok: false; reponse: NextResponse }> {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return { ok: false, reponse: repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous avec votre compte livreur." }) };
  try {
    await limiterLivreur(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { ok: false, reponse: repondreErreur(erreur.toApi()) };
    return { ok: false, reponse: repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." }) };
  }
  return { ok: true, utilisateurId: utilisateur.id };
}

/** Corps JSON d'une action de livreur, déjà authentifiée. */
export async function actionLivreur(
  request: Request,
  executer: (utilisateurId: string, corps: Record<string, unknown>) => Promise<ResultatLivreur>
): Promise<NextResponse> {
  const auth = await livreurAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const resultat = await executer(auth.utilisateurId, corps);
  if (!resultat.ok) return repondreErreur({ code: "VALIDATION", message: resultat.message });
  return repondre({ ok: true });
}
