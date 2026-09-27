"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";

export interface EtatFormulaireProfil {
  erreur?: string;
  succes?: boolean;
}

export async function modifierProfilAction(
  _etatPrecedent: EtatFormulaireProfil,
  formData: FormData
): Promise<EtatFormulaireProfil> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/profil");

  const horaires = String(formData.get("horaires") ?? "").trim();
  const consignes = String(formData.get("consignes") ?? "").trim();

  if (horaires.length > 500) {
    return { erreur: "Les horaires ne peuvent pas dépasser 500 caractères." };
  }
  if (consignes.length > 1000) {
    return { erreur: "Les consignes ne peuvent pas dépasser 1000 caractères." };
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase
    .from("restaurants")
    .update({ horaires, consignes })
    .eq("id", membership.restaurant_id);

  if (error) {
    return { erreur: "Impossible d'enregistrer les modifications. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/profil");
  revalidatePath("/restaurant");
  return { succes: true };
}

export async function basculerOuvertAction(ouvert: boolean): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/profil");
  const supabase = await creerClientServeur();

  await supabase.from("restaurants").update({ ouvert }).eq("id", membership.restaurant_id);

  revalidatePath("/restaurant/profil");
  revalidatePath("/restaurant");
}
