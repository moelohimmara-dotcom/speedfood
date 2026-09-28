"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { televerserImage, supprimerImage } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";

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

  // Photo optionnelle : gouvernée par l'appartenance au restaurant, comme
  // horaires/consignes — aucune permission système distincte n'est requise.
  const fichierPhoto = formData.get("photo");
  const changerPhoto = fichierPhoto instanceof File && fichierPhoto.size > 0;
  let photoUrl: string | undefined;

  if (changerPhoto) {
    try {
      photoUrl = await televerserImage(fichierPhoto as File, "restaurants");
    } catch (erreur) {
      if (erreur instanceof ErreurMetier) {
        return { erreur: erreur.message };
      }
      return { erreur: "Impossible d'enregistrer la photo. Réessayez dans un instant." };
    }
  }

  if (changerPhoto) {
    const { data: ancien } = await supabase
      .from("restaurants")
      .select("photo_url")
      .eq("id", membership.restaurant_id)
      .maybeSingle();
    const { error } = await supabase
      .from("restaurants")
      .update({ horaires, consignes, photo_url: photoUrl })
      .eq("id", membership.restaurant_id);
    if (error) {
      return { erreur: "Impossible d'enregistrer les modifications. Réessayez dans un instant." };
    }
    await supprimerImage(ancien?.photo_url ?? null);
  } else {
    const { error } = await supabase
      .from("restaurants")
      .update({ horaires, consignes })
      .eq("id", membership.restaurant_id);
    if (error) {
      return { erreur: "Impossible d'enregistrer les modifications. Réessayez dans un instant." };
    }
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
