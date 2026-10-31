import "server-only";
import type { NextResponse } from "next/server";
import { lireEtatQuestions } from "@/lib/auth/questions-serveur";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientJeton } from "@/lib/db/jeton";
import { limiterEquipeApplication } from "@/lib/securite/limitation-debit";
import { estRoleSysteme, roleAPermission, type Permission, type RoleSysteme } from "@/lib/system-admin/permissions";
import type { ContexteSysteme } from "@/lib/system-admin/contexte";
import type { SupabaseClient } from "@supabase/supabase-js";
import { repondreErreur } from "./v1";
import { lireBearer } from "./v1-regles";

function niveauDuJeton(jeton: string): string | null {
  try {
    const charge = JSON.parse(Buffer.from(jeton.split(".")[1] ?? "", "base64url").toString("utf8")) as { aal?: unknown };
    return typeof charge.aal === "string" ? charge.aal : null;
  } catch {
    return null;
  }
}

export interface ContexteEquipeApi {
  /** Client lié au jeton de la personne : RLS appliquée comme sur le site. */
  supabase: SupabaseClient;
  utilisateurId: string;
  role: RoleSysteme;
}

/**
 * Entrée commune des routes `/api/v1/equipe/*` (espace équipe Speedfood de l'application) : compte identifié par le jeton porteur, doté d'un rôle système, avec la
 * permission demandée. Mêmes barrières que le site `/system`, jamais plus faibles : second facteur confirmé ⇒ jeton « aal2 » exigé, questions de sécurité à confirmer
 * ⇒ refus (l'application n'a pas encore ces écrans). Le rôle est lu en base (jamais fourni par l'application). Refus : message identique pour « aucun rôle » et
 * « permission manquante », pour ne pas révéler l'existence de l'espace équipe. Plafond par compte.
 */
export async function equipeAuthentifiee(
  request: Request,
  permission: Permission | null
): Promise<{ ok: true; contexte: ContexteEquipeApi } | { ok: false; reponse: NextResponse }> {
  const refuser = (code: "NON_AUTHENTIFIE" | "NON_AUTORISE", message: string) => ({ ok: false as const, reponse: repondreErreur({ code, message }) });
  const refus = () => refuser("NON_AUTORISE", "Cet espace est réservé à l'équipe Speedfood.");

  const jeton = lireBearer(request.headers.get("authorization"));
  if (!jeton) return refuser("NON_AUTHENTIFIE", "Connectez-vous avec votre compte.");
  const admin = creerClientAdmin();
  const { data, error } = await admin.auth.getUser(jeton);
  if (error || !data.user) return refuser("NON_AUTHENTIFIE", "Connectez-vous avec votre compte.");
  const utilisateurId = data.user.id;

  // Rôle système lu en base AVANT tout autre calcul : un compte sans rôle ne coûte rien de plus et ne apprend rien.
  const { data: ligne } = await admin.from("system_admin_memberships").select("role").eq("utilisateur_id", utilisateurId).maybeSingle();
  const role = ligne?.role;
  if (typeof role !== "string" || !estRoleSysteme(role)) return refus();
  if (permission !== null && !roleAPermission(role, permission)) return refus();

  try {
    await limiterEquipeApplication(utilisateurId);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return { ok: false, reponse: repondreErreur(erreur.toApi()) };
    return { ok: false, reponse: repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." }) };
  }

  const supabase = creerClientJeton(jeton) as unknown as SupabaseClient;

  const { data: facteurs } = await admin.auth.admin.mfa.listFactors({ userId: utilisateurId });
  const aUnFacteur = (facteurs?.factors ?? []).some((f) => f.status === "verified");
  if (aUnFacteur && niveauDuJeton(jeton) !== "aal2") {
    return refuser("NON_AUTORISE", "Ce compte utilise la double authentification : utilisez le site pour l'instant.");
  }
  if ((await lireEtatQuestions(supabase)).requise) {
    return refuser("NON_AUTORISE", "Ce compte a des questions de sécurité à confirmer : utilisez le site pour l'instant.");
  }

  return { ok: true, contexte: { supabase, utilisateurId, role } };
}

/**
 * Le contexte de l'API transposé au contexte « console » : mêmes clés, donc le contrôle de palier (`verifierPalier`) s'applique à
 * l'application exactement comme sur le site. Les habilitations sont lues avec le client lié au jeton : la RLS (`acces_paliers` : ses
 * propres lignes) limite donc la lecture aux habilitations de la personne, comme dans la console.
 */
export function contexteSystemeDepuisApi(contexte: ContexteEquipeApi): ContexteSysteme {
  return {
    supabase: contexte.supabase as unknown as ContexteSysteme["supabase"],
    utilisateurId: contexte.utilisateurId,
    role: contexte.role,
  };
}
