import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { creerClientServeur } from "@/lib/db/server";

/**
 * Qui regarde la fiche publique d'un restaurant : un visiteur, le propriétaire (ou un membre de l'équipe) ou un administrateur système.
 * Comme l'aperçu « voir comme » d'une page Facebook : la fiche s'adapte au regardeur (bandeau d'aperçu, commandes désactivées,
 * lecture même si le restaurant n'est pas encore publié) sans jamais ouvrir quoi que ce soit à un visiteur ordinaire.
 *
 * Aucune confiance accordée au navigateur : le rôle vient de la SESSION (cookies HttpOnly) et de la base (`fn_est_membre_restaurant`,
 * `fn_est_admin_systeme`), pas d'un paramètre d'adresse. Le visiteur anonyme (aucun cookie de session) ne déclenche aucun appel à l'authentification.
 */
export type RoleVue = "visiteur" | "proprietaire" | "admin";

export const lireVueFiche = cache(async (restaurantId: string): Promise<RoleVue> => {
  const magasin = await cookies();
  const aUneSession = magasin.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));
  if (!aUneSession) return "visiteur";

  const client = await creerClientServeur();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return "visiteur";

  const [{ data: membre }, { data: admin }] = await Promise.all([
    client.rpc("fn_est_membre_restaurant", { p_restaurant_id: restaurantId }),
    client.rpc("fn_est_admin_systeme"),
  ]);
  if (membre === true) return "proprietaire";
  if (admin === true) return "admin";
  return "visiteur";
});
