import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estRoleSysteme } from "@/lib/system-admin/permissions";

export interface RolesCompte {
  restaurateur: { restaurant: string } | null;
  livreur: boolean;
  equipe: string | null;
}

/** Quels espaces ce compte peut-il ouvrir ? Extrait de la route `/api/v1/moi` pour que le site et l'API partagent la même lecture. */
export async function lireRolesCompte(utilisateurId: string): Promise<RolesCompte> {
  // Client sans types générés : la table `livreurs` n'en fait pas partie (même usage que src/lib/livraison/livreur.ts).
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const [restaurant, livreur, equipe] = await Promise.all([
    admin.from("restaurant_memberships").select("restaurant_id, restaurants(nom)").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
    admin.from("livreurs").select("id").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
    admin.from("system_admin_memberships").select("role").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
  ]);
  const jointure = restaurant.data?.restaurants as { nom?: string } | { nom?: string }[] | null | undefined;
  const nomRestaurant = Array.isArray(jointure) ? jointure[0]?.nom : jointure?.nom;
  const roleEquipe = typeof equipe.data?.role === "string" && estRoleSysteme(equipe.data.role) ? equipe.data.role : null;
  return {
    restaurateur: restaurant.data ? { restaurant: nomRestaurant ?? "Mon restaurant" } : null,
    livreur: Boolean(livreur.data),
    equipe: roleEquipe,
  };
}
