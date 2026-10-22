import "server-only";
import type { NextResponse } from "next/server";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { limiterClientApplication } from "@/lib/securite/limitation-debit";
import { repondreErreur, utilisateurDuJeton } from "./v1";

/**
 * Entrée commune des routes `/api/v1/client/*` : compte identifié par le jeton porteur (jamais un identifiant envoyé par l'application), plafond par compte.
 * Les cookies de session du site ne sont jamais lus.
 */
export async function clientAuthentifie(request: Request): Promise<{ ok: true; utilisateurId: string } | { ok: false; reponse: NextResponse }> {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return { ok: false, reponse: repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous avec votre compte." }) };
  try {
    await limiterClientApplication(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { ok: false, reponse: repondreErreur(erreur.toApi()) };
    return { ok: false, reponse: repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." }) };
  }
  return { ok: true, utilisateurId: utilisateur.id };
}
