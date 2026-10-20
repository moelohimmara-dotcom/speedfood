"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { analyserPosition } from "./position";
import { clientLivraison, pointDuRestaurant, speedfoodPossible } from "@/lib/livraison/lecture";
import { MESSAGE_SPEEDFOOD_INDISPONIBLE } from "@/lib/livraison/garde-fou-speedfood";

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

  // Garde-fou : « Livreur Speedfood » ne se choisit que s'il existe un livreur réel utilisable près du restaurant (un restaurant qui l'a déjà
  // peut enregistrer sa position sans être bloqué ; ses nouvelles commandes retombent alors sur sa livraison propre).
  if (mode === "speedfood") {
    const { data: actuel } = await supabase.from("restaurants").select("livraison_mode, donnees_demo").eq("id", membership.restaurant_id).maybeSingle();
    if (actuel?.livraison_mode !== "speedfood") {
      const db = clientLivraison();
      const depart = position.position ?? (await pointDuRestaurant(db, membership.restaurant_id)).point;
      if (!(await speedfoodPossible(db, depart, actuel?.donnees_demo === true))) return { erreur: MESSAGE_SPEEDFOOD_INDISPONIBLE };
    }
  }

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
