import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReponseCommandesRestaurant } from "@speedfood/shared/contracts/restaurant-commandes";
import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { projeterCommandesRestaurant } from "./restaurant-commandes-projection";

/**
 * Commandes du restaurant du compte : toutes celles qui attendent une action, plus un historique récent (20). Lecture avec le client LIÉ AU JETON du membre :
 * la RLS décide de ce qui est visible. Utilisée par la route du site ET par l'API unique (même lecture, même projection).
 */
export async function lireCommandesRestaurant(supabase: SupabaseClient, restaurantId: string, origine: string): Promise<ReponseCommandesRestaurant> {
  const [commandes, restaurant] = await Promise.all([
    chargerApercusCommandes(supabase, restaurantId, { historique: 20 }),
    supabase.from("restaurants").select("id, nom, ouvert, accepte_commandes").eq("id", restaurantId).maybeSingle(),
  ]);
  const ids = commandes.map((c) => c.id);
  const { data: documents } = ids.length
    ? await supabase.from("documents_commande").select("order_id, type, numero").eq("restaurant_id", restaurantId).in("order_id", ids).limit(200)
    : { data: [] as { order_id: string; type: string; numero: string }[] };
  return projeterCommandesRestaurant({ commandes, documents: documents ?? [], restaurant: restaurant.data ?? null, origine });
}
