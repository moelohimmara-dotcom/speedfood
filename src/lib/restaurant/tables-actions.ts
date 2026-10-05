"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";

/**
 * Active ou désactive le service à table. Écriture par la session du membre : la RLS limite la mise à jour à son propre restaurant.
 * Désactiver bloque aussitôt les nouvelles commandes à table (vérifié côté serveur à la création), même avec des QR déjà imprimés.
 */
export async function definirServiceATableAction(actif: boolean): Promise<{ ok: boolean; erreur?: string }> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/tables");
  if (typeof actif !== "boolean") {
    return { ok: false, erreur: "Valeur invalide." };
  }
  const { data, error } = await supabase
    .from("restaurants")
    .update({ accepte_sur_place: actif })
    .eq("id", membership.restaurant_id)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, erreur: "Enregistrement impossible. Réessayez." };
  }
  revalidatePath("/restaurant/tables");
  revalidatePath(`/restaurants/${membership.restaurant_id}`);
  return { ok: true };
}
