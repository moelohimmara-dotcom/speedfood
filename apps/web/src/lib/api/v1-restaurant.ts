import "server-only";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lireEtatQuestions } from "@/lib/auth/questions-serveur";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientJeton } from "@/lib/db/jeton";
import { limiterRestaurantApplication } from "@/lib/securite/limitation-debit";
import { lireBearer } from "./v1-regles";
import { repondreErreur } from "./v1";

/** Niveau d'assurance d'authentification (« aal1 » mot de passe seul, « aal2 » avec second facteur) lu dans le jeton déjà vérifié. */
function niveauDuJeton(jeton: string): string | null {
  try {
    const charge = JSON.parse(Buffer.from(jeton.split(".")[1] ?? "", "base64url").toString("utf8")) as { aal?: unknown };
    return typeof charge.aal === "string" ? charge.aal : null;
  } catch {
    return null;
  }
}

export interface ContexteRestaurantApi {
  /** Client lié au jeton du membre : RLS appliquée, comme la console du site. */
  supabase: SupabaseClient;
  utilisateurId: string;
  restaurantId: string;
  role: string;
}

/**
 * Entrée commune des routes `/api/v1/restaurant/*` : compte identifié par le jeton porteur, membre d'un restaurant, plafond par compte.
 *
 * Mêmes barrières que la console du site, jamais plus faibles : un compte qui a un second facteur confirmé doit présenter un jeton « aal2 », et un compte qui a
 * des questions de sécurité à confirmer doit d'abord les confirmer ; l'application n'ayant pas encore ces écrans, ces comptes sont renvoyés vers le site.
 * Le restaurant est celui de l'appartenance du compte (`restaurant_memberships`), jamais un identifiant envoyé par l'application.
 */
export async function restaurantAuthentifie(request: Request): Promise<{ ok: true; contexte: ContexteRestaurantApi } | { ok: false; reponse: NextResponse }> {
  const refuser = (code: "NON_AUTHENTIFIE" | "NON_AUTORISE", message: string) => ({ ok: false as const, reponse: repondreErreur({ code, message }) });

  const jeton = lireBearer(request.headers.get("authorization"));
  if (!jeton) return refuser("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
  const admin = creerClientAdmin();
  const { data, error } = await admin.auth.getUser(jeton);
  if (error || !data.user) return refuser("NON_AUTHENTIFIE", "Connectez-vous avec votre compte restaurateur.");
  const utilisateurId = data.user.id;

  try {
    await limiterRestaurantApplication(utilisateurId);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { ok: false, reponse: repondreErreur(erreur.toApi()) };
    return { ok: false, reponse: repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." }) };
  }

  const supabase = creerClientJeton(jeton) as unknown as SupabaseClient;

  // Second facteur : exigé si le compte en a un de confirmé.
  const { data: facteurs } = await admin.auth.admin.mfa.listFactors({ userId: utilisateurId });
  const aUnFacteur = (facteurs?.factors ?? []).some((f) => f.status === "verified");
  if (aUnFacteur && niveauDuJeton(jeton) !== "aal2") {
    return refuser("NON_AUTORISE", "Ce compte utilise la double authentification : utilisez la console restaurateur sur le site pour l'instant.");
  }
  if ((await lireEtatQuestions(supabase)).requise) {
    return refuser("NON_AUTORISE", "Ce compte a des questions de sécurité à confirmer : utilisez la console restaurateur sur le site pour l'instant.");
  }

  const { data: membership } = await supabase.from("restaurant_memberships").select("restaurant_id, role").eq("utilisateur_id", utilisateurId).maybeSingle();
  if (!membership) return refuser("NON_AUTORISE", "Ce compte n'est rattaché à aucun restaurant.");

  return { ok: true, contexte: { supabase, utilisateurId, restaurantId: membership.restaurant_id as string, role: String(membership.role) } };
}
