import "server-only";
import type { creerClientServeur } from "@/lib/db/server";

/**
 * Détecte si le compte connecté a aussi l'autre type d'accès (restaurant ou
 * rôle système), pour proposer un lien de bascule entre les deux consoles
 * uniquement quand c'est réellement le cas — jamais pour un restaurateur ou
 * un rôle système ordinaire (ADR-010 : chaque console reste simple par
 * défaut ; seul un compte qui cumule les deux voit un moyen de passer de
 * l'une à l'autre).
 *
 * Lecture autorisée par les policies RLS existantes : chaque compte peut lire
 * sa propre ligne dans les deux tables (`lecture_sa_propre_membership`,
 * `lecture_son_propre_role_systeme`), quel que soit son rôle.
 */

type ClientServeur = Awaited<ReturnType<typeof creerClientServeur>>;

export async function aUnRoleSysteme(
  supabase: ClientServeur,
  utilisateurId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("system_admin_memberships")
    .select("utilisateur_id")
    .eq("utilisateur_id", utilisateurId)
    .maybeSingle();
  return data !== null;
}

export async function aUnMembershipRestaurant(
  supabase: ClientServeur,
  utilisateurId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("restaurant_memberships")
    .select("utilisateur_id")
    .eq("utilisateur_id", utilisateurId)
    .maybeSingle();
  return data !== null;
}
