import "server-only";
import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { lireEtatQuestions } from "./questions-serveur";

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

  // Double authentification (revue du 19 octobre 2026, M-6) : un compte qui a un facteur confirmé n'utilise pas la console avec une session au seul
  // mot de passe (aal1). Le proxy le fait déjà par chemin ; ceci le garantit aussi pour les actions serveur à clé de service (salle, avis,
  // positionnement...), qui ne passent pas par la RLS, même si le proxy était contourné ou en échec.
  const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (niveau && niveau.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
    redirect(`/connexion/verification?suite=${encodeURIComponent(cheminActuel)}`);
  }

  // Questions de sécurité facultatives : à répondre une fois par session si le compte les a activées.
  if ((await lireEtatQuestions(supabase)).requise) {
    redirect(`/connexion/questions?suite=${encodeURIComponent(cheminActuel)}`);
  }

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id, role")
    .eq("utilisateur_id", user.id)
    .maybeSingle();

  if (!membership) {
    // Un admin système sans restaurant n'a rien à faire dans l'onboarding
    // restaurateur : on le renvoie vers sa console (ADR-010, deux consoles).
    const { data: roleSysteme } = await supabase
      .from("system_admin_memberships")
      .select("utilisateur_id")
      .eq("utilisateur_id", user.id)
      .maybeSingle();
    if (roleSysteme) {
      redirect("/system");
    }
    redirect("/restaurant/nouveau");
  }

  return { supabase, user, membership };
}
