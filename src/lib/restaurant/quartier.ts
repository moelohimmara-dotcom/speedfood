"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";

export interface EtatQuartierRestaurant {
  erreur?: string;
  succes?: boolean;
}

/**
 * Le restaurateur choisit le quartier de son établissement parmi les quartiers actifs.
 * Vérifié ici (et non seulement dans le formulaire) : un quartier désactivé ou dont la commune est
 * désactivée est refusé. La règle d'accès à la ligne `restaurants` reste celle des membres (RLS).
 */
export async function modifierQuartierRestaurantAction(
  _etatPrecedent: EtatQuartierRestaurant,
  formData: FormData
): Promise<EtatQuartierRestaurant> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");

  const quartierId = String(formData.get("quartier_id") ?? "");
  if (!estUuid(quartierId)) {
    return { erreur: "Choisissez un quartier dans la liste." };
  }

  const { data: quartier, error: erreurLecture } = await supabase
    .from("neighborhoods")
    .select("id, communes!inner(actif)")
    .eq("id", quartierId)
    .eq("actif", true)
    .eq("communes.actif", true)
    .maybeSingle();
  if (erreurLecture) {
    return { erreur: "Impossible de vérifier ce quartier. Réessayez dans un instant." };
  }
  if (!quartier) {
    return { erreur: "Ce quartier n'est plus proposé. Choisissez-en un autre." };
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ quartier_id: quartierId })
    .eq("id", membership.restaurant_id);
  if (error) {
    return { erreur: "Impossible d'enregistrer le quartier. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/profil", "layout");
  return { succes: true };
}
