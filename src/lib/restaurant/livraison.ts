"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { analyserPosition } from "./position";

/**
 * Livraison du restaurant : qui livre (« aucune » = retrait seulement, « propre » = son personnel) et où il se trouve exactement.
 * Le mode « speedfood » (livreur Speedfood) passe par la répartition des courses (livreurs de démonstration pour l'instant). La position sert au calcul de distance :
 * sans elle, le centre du quartier du restaurant est utilisé. Chaque écriture est limitée à l'établissement du compte par la RLS.
 */
export interface EtatLivraisonRestaurant {
  erreur?: string;
  succes?: boolean;
  message?: string;
}

const MODES_CHOISISSABLES = ["aucune", "propre", "speedfood"] as const;

export async function definirLivraisonRestaurantAction(_prec: EtatLivraisonRestaurant, formData: FormData): Promise<EtatLivraisonRestaurant> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil/zones");

  const mode = String(formData.get("livraison_mode") ?? "");
  if (!(MODES_CHOISISSABLES as readonly string[]).includes(mode)) {
    return { erreur: "Choisissez qui livre vos commandes." };
  }
  const position = analyserPosition(String(formData.get("latitude") ?? ""), String(formData.get("longitude") ?? ""));
  if (!position.ok) return { erreur: position.erreur };

  const { error } = await supabase
    .from("restaurants")
    .update({
      livraison_mode: mode,
      latitude: position.position?.latitude ?? null,
      longitude: position.position?.longitude ?? null,
    })
    .eq("id", membership.restaurant_id);
  if (error) return { erreur: "Impossible d'enregistrer pour le moment. Réessayez dans un instant." };

  revalidatePath("/restaurant/profil", "layout");
  return { succes: true, message: "Livraison enregistrée." };
}
