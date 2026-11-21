"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";
import { clientLivraison } from "./lecture";
import { avancerLivraison } from "./service";
import { MOTIFS_ECHEC_RESTAURANT, motifEchecRestaurantValide } from "./statuts";

/**
 * Actions du restaurant sur SA livraison. Le restaurant qui livre lui-même (mode « propre ») fait avancer sa livraison :
 * « parti livrer », puis « livrée » avec le code que le client lui donne. Dans tous les modes il peut annuler. L'identité vient
 * de la session ; la livraison doit appartenir à son restaurant.
 */
export type ActionLivraisonRestaurant = "partir" | "livree" | "annuler" | "non_aboutie";

export async function agirSurLivraisonAction(
  livraisonId: string,
  action: ActionLivraisonRestaurant,
  code?: string,
  motif?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  if (!estUuid(livraisonId)) return { ok: false, message: "Livraison invalide." };
  if (action === "non_aboutie" && !motifEchecRestaurantValide(motif)) return { ok: false, message: "Choisissez le motif de l'échec." };

  const { data: ligne } = await clientLivraison().from("livraisons").select("id, restaurant_id").eq("id", livraisonId).maybeSingle();
  if (!ligne || ligne.restaurant_id !== membership.restaurant_id) return { ok: false, message: "Livraison introuvable." };

  const vers = action === "partir" ? "vers_client" : action === "livree" ? "livree" : action === "non_aboutie" ? "echec" : "annulee";
  const resultat = await avancerLivraison({
    livraisonId,
    acteur: "restaurant",
    vers,
    code: action === "livree" ? String(code ?? "").slice(0, 12) : undefined,
    raison: action === "annuler" ? "Annulée par le restaurant" : action === "non_aboutie" && motifEchecRestaurantValide(motif) ? `Non aboutie (restaurant) : ${MOTIFS_ECHEC_RESTAURANT[motif]}` : undefined,
  });
  revalidatePath("/restaurant/commandes");
  return resultat;
}
