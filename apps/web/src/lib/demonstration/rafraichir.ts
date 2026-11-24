import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";

/** Au-delà de cet âge, la confirmation d'un plat de démonstration est renouvelée (le seuil public est de 6 h par défaut : on reste bien en dessous). */
export const AGE_MAX_CONFIRMATION_MINUTES = 180;

/**
 * Garde la démonstration « vivante » : tant que le lot de démonstration existe, la dernière confirmation de ses plats disponibles ne dépasse jamais
 * `AGE_MAX_CONFIRMATION_MINUTES`. Sans cela, au bout du seuil de fraîcheur (6 h) tous les plats afficheraient « à confirmer » et la démonstration paraîtrait abandonnée.
 *
 * Ne touche QUE les plats des restaurants du lot de démonstration (`demo_lot`) : jamais un vrai restaurant. Chaque restaurant reçoit une heure différente
 * (de 3 à 40 minutes en arrière) pour un rendu naturel. Appelée toutes les 5 minutes par la tâche planifiée ; sans effet, et sans coût notable, quand rien n'est périmé.
 * Si le lot est supprimé, il n'y a plus de restaurant concerné : la fonction ne fait rien.
 */
export async function rafraichirConfirmationsDemonstration(maintenant = Date.now()): Promise<{ restaurants: number }> {
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const limite = new Date(maintenant - AGE_MAX_CONFIRMATION_MINUTES * 60_000).toISOString();
  const { data: restos } = await admin.from("restaurants").select("id").not("demo_lot", "is", null).limit(500);
  const ids = ((restos ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return { restaurants: 0 };

  const { data: perimes } = await admin
    .from("menu_items")
    .select("restaurant_id")
    .in("restaurant_id", ids)
    .eq("disponible", true)
    .or(`disponibilite_confirmee_le.is.null,disponibilite_confirmee_le.lt.${limite}`)
    .limit(5000);
  const aRenouveler = [...new Set(((perimes ?? []) as { restaurant_id: string }[]).map((p) => p.restaurant_id))];

  let renouveles = 0;
  for (const id of aRenouveler) {
    const minutes = 3 + Math.floor(Math.random() * 38);
    const { error } = await admin
      .from("menu_items")
      .update({ disponibilite_confirmee_le: new Date(maintenant - minutes * 60_000).toISOString() })
      .eq("restaurant_id", id)
      .eq("disponible", true);
    if (!error) renouveles += 1;
  }
  return { restaurants: renouveles };
}
