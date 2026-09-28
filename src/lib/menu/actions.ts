"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { televerserImage, supprimerImage } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";

export interface EtatFormulaireMenu {
  erreur?: string;
}

export async function creerPlatAction(
  _etatPrecedent: EtatFormulaireMenu,
  formData: FormData
): Promise<EtatFormulaireMenu> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const prixBrut = String(formData.get("prix") ?? "");
  const prix = Number.parseInt(prixBrut, 10);

  if (!nom || nom.length > 120) {
    return { erreur: "Le nom du plat est obligatoire (120 caractères maximum)." };
  }
  if (description.length > 500) {
    return { erreur: "La description ne peut pas dépasser 500 caractères." };
  }
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) {
    return {
      erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixPlatMaxGnf.toLocaleString("fr-FR")}.`,
    };
  }

  let photoUrl: string | null = null;
  const fichierPhoto = formData.get("photo");
  if (fichierPhoto instanceof File && fichierPhoto.size > 0) {
    try {
      photoUrl = await televerserImage(fichierPhoto, "plats");
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo." };
    }
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: membership.restaurant_id,
    nom,
    description,
    prix,
    photo_url: photoUrl,
  });

  if (error) {
    return { erreur: "Impossible d'ajouter le plat. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function modifierPlatAction(
  _etatPrecedent: EtatFormulaireMenu,
  formData: FormData
): Promise<EtatFormulaireMenu> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");

  const id = String(formData.get("id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const prixBrut = String(formData.get("prix") ?? "");
  const prix = Number.parseInt(prixBrut, 10);

  if (!id) {
    return { erreur: "Plat introuvable." };
  }
  if (!nom || nom.length > 120) {
    return { erreur: "Le nom du plat est obligatoire (120 caractères maximum)." };
  }
  if (description.length > 500) {
    return { erreur: "La description ne peut pas dépasser 500 caractères." };
  }
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  if (!Number.isFinite(prix) || prix < 0 || prix > prixPlatMaxGnf) {
    return {
      erreur: `Le prix doit être un nombre entier en GNF, entre 0 et ${prixPlatMaxGnf.toLocaleString("fr-FR")}.`,
    };
  }

  const supabase = await creerClientServeur();

  const fichierPhoto = formData.get("photo");
  const changerPhoto = fichierPhoto instanceof File && fichierPhoto.size > 0;
  let photoUrl: string | undefined;

  if (changerPhoto) {
    try {
      photoUrl = await televerserImage(fichierPhoto as File, "plats");
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo." };
    }
  }

  if (changerPhoto) {
    const { data: ancien } = await supabase
      .from("menu_items")
      .select("photo_url")
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id)
      .maybeSingle();
    const { error } = await supabase
      .from("menu_items")
      .update({ nom, description, prix, photo_url: photoUrl })
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id);
    if (error) {
      return { erreur: "Impossible de modifier le plat. Réessayez dans un instant." };
    }
    await supprimerImage(ancien?.photo_url ?? null);
  } else {
    const { error } = await supabase
      .from("menu_items")
      .update({ nom, description, prix })
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id);
    if (error) {
      return { erreur: "Impossible de modifier le plat. Réessayez dans un instant." };
    }
  }

  revalidatePath("/restaurant/menu");
  return {};
}

export async function basculerDisponibiliteAction(id: string, disponible: boolean): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  await supabase
    .from("menu_items")
    .update({ disponible })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  revalidatePath("/restaurant/menu");
  revalidatePath("/restaurant");
}

export async function archiverPlatAction(id: string): Promise<void> {
  const { membership } = await obtenirContexteRestaurant("/restaurant/menu");
  const supabase = await creerClientServeur();

  await supabase
    .from("menu_items")
    .update({ archive_le: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", membership.restaurant_id);

  revalidatePath("/restaurant/menu");
}
