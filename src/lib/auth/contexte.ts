import "server-only";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";

/**
 * Vérifie que l'utilisateur est connecté et rattaché à un restaurant, redirige
 * sinon. Centralise ce qui était dupliqué entre /restaurant et /restaurant/nouveau
 * au bloc 4 — toute page de la console appelle ceci une fois, plutôt que de
 * refaire la même requête à la main.
 *
 * Ne remplace pas la RLS : c'est un raccourci de navigation (afficher la bonne
 * page), pas un contrôle de sécurité — la RLS reste la seule source d'autorité
 * sur ce que chaque requête peut réellement lire ou écrire.
 */
export async function obtenirContexteRestaurant(cheminActuel: string) {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/connexion?suite=${encodeURIComponent(cheminActuel)}`);
  }

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id, role")
    .eq("utilisateur_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/restaurant/nouveau");
  }

  return { supabase, user, membership };
}
