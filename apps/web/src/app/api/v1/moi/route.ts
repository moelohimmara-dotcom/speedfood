import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";
import { limiterClientApplication } from "@/lib/securite/limitation-debit";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { estRoleSysteme } from "@/lib/system-admin/permissions";

/**
 * Quels espaces ce compte peut-il ouvrir dans l'application ? Le client est l'espace de tout le monde ; les espaces professionnels (restaurateur, livreur, équipe
 * Speedfood) n'apparaissent QUE pour les comptes qui en ont le droit : l'application n'affiche rien d'autre. Information d'affichage seulement : chaque route
 * d'un espace revérifie le droit elle-même. Un compte sans rôle reçoit trois valeurs vides, jamais une erreur (la route ne révèle rien sur l'existence des espaces).
 */
export async function GET(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous avec votre compte." });
  try {
    await limiterClientApplication(utilisateur.id);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier && erreur.code === "TROP_DE_REQUETES") return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  }

  // Client sans types générés : la table `livreurs` n'en fait pas partie (même usage que src/lib/livraison/livreur.ts).
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const [restaurant, livreur, equipe] = await Promise.all([
    admin.from("restaurant_memberships").select("restaurant_id, restaurants(nom)").eq("utilisateur_id", utilisateur.id).limit(1).maybeSingle(),
    admin.from("livreurs").select("id").eq("utilisateur_id", utilisateur.id).limit(1).maybeSingle(),
    admin.from("system_admin_memberships").select("role").eq("utilisateur_id", utilisateur.id).limit(1).maybeSingle(),
  ]);
  const jointure = restaurant.data?.restaurants as { nom?: string } | { nom?: string }[] | null | undefined;
  const nomRestaurant = Array.isArray(jointure) ? jointure[0]?.nom : jointure?.nom;
  const roleEquipe = typeof equipe.data?.role === "string" && estRoleSysteme(equipe.data.role) ? equipe.data.role : null;

  return repondre({
    ok: true,
    roles: {
      restaurateur: restaurant.data ? { restaurant: nomRestaurant ?? "Mon restaurant" } : null,
      livreur: Boolean(livreur.data),
      equipe: roleEquipe,
    },
  });
}

export const dynamic = "force-dynamic";
