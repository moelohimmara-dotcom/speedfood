"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "./lecture";
import { avancerLivraison } from "./service";

/**
 * Actions du restaurant sur SA livraison. Le restaurant qui livre lui-même (mode « propre ») fait avancer sa livraison :
 * « parti livrer », puis « livrée » avec le code que le client lui donne. Dans tous les modes il peut annuler. L'identité vient
 * de la session ; la livraison doit appartenir à son restaurant.
 */
export type ActionLivraisonRestaurant = "partir" | "livree" | "annuler";

export async function agirSurLivraisonAction(
  livraisonId: string,
  action: ActionLivraisonRestaurant,
  code?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  if (!estUuid(livraisonId)) return { ok: false, message: "Livraison invalide." };

  const { data: ligne } = await clientLivraison().from("livraisons").select("id, restaurant_id").eq("id", livraisonId).maybeSingle();
  if (!ligne || ligne.restaurant_id !== membership.restaurant_id) return { ok: false, message: "Livraison introuvable." };

  const vers = action === "partir" ? "vers_client" : action === "livree" ? "livree" : "annulee";
  const resultat = await avancerLivraison({
    livraisonId,
    acteur: "restaurant",
    vers,
    code: action === "livree" ? String(code ?? "").slice(0, 12) : undefined,
    raison: action === "annuler" ? "Annulée par le restaurant" : undefined,
  });
  revalidatePath("/restaurant/commandes");
  return resultat;
}
