import "server-only";
import type { ClientCommandeDb } from "./commun";
import { commandesATraiter } from "./a-traiter";

/**
 * Commandes d'un restaurant qui attendent SA réponse (voir `a-traiter.ts`). Source unique du compteur de la pastille « Commandes » et de
 * l'alerte sonore : les deux comptaient auparavant toutes les commandes `en_attente`, y compris celles qui attendent le client.
 * Lecture avec le client de la session : la RLS reste l'autorité (un restaurant ne voit que ses commandes).
 */
export async function lireCommandesATraiter(db: ClientCommandeDb, restaurantId: string, limite = 50) {
  const { data, error } = await db
    .from("orders")
    .select("id, cree_le, order_proposals(statut, expire_le)")
    .eq("restaurant_id", restaurantId)
    .eq("statut", "en_attente")
    .order("cree_le", { ascending: false })
    .limit(limite);
  if (error) return { erreur: true as const, commandes: [] };
  return { erreur: false as const, commandes: commandesATraiter(data ?? []) };
}
