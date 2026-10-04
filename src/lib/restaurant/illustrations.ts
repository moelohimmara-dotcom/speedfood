"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import type { Json } from "@/lib/db/database.types";
import { validerIllustration } from "@/lib/illustrations/modele";

/**
 * Illustrations du restaurateur (logo, couverture, plats de SON restaurant). Même validation que la console admin (liste blanche de
 * motifs, couleurs hexadécimales, initiales), mais avec les droits du membre : la RLS limite l'écriture à son propre restaurant et
 * l'action vérifie en plus que l'identifiant visé appartient bien à ce restaurant. La photo téléversée prime toujours à l'affichage.
 */
export interface EtatActionIllustrationResto {
  erreur?: string;
  succes?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function definirIllustrationRestoAction(
  _precedent: EtatActionIllustrationResto,
  formData: FormData,
): Promise<EtatActionIllustrationResto> {
  const cible = String(formData.get("cible") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!["logo", "couverture", "plat"].includes(cible) || !UUID.test(id)) {
    return { erreur: "Élément introuvable." };
  }
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");

  let valeur: Json | null = null;
  if (formData.get("supprimer") !== "1") {
    const v = validerIllustration({
      style: formData.get("style"),
      motif: formData.get("motif"),
      fond: formData.get("fond"),
      forme: formData.get("forme"),
      accent: formData.get("accent"),
      texte: String(formData.get("texte") ?? ""),
      genere: false,
    });
    if (!v) {
      return { erreur: "Illustration invalide : vérifiez les couleurs (initiales lisibles) et les initiales (3 au plus)." };
    }
    valeur = v as unknown as Json;
  }

  if (cible === "plat") {
    const { error, count } = await supabase
      .from("menu_items")
      .update({ illustration: valeur }, { count: "exact" })
      .eq("id", id)
      .eq("restaurant_id", membership.restaurant_id);
    if (error || !count) return { erreur: "Impossible d'enregistrer l'illustration de ce plat." };
  } else {
    if (id !== membership.restaurant_id) return { erreur: "Élément introuvable." };
    const { error } = await supabase
      .from("restaurants")
      .update(cible === "logo" ? { logo_illustration: valeur } : { couverture_illustration: valeur })
      .eq("id", membership.restaurant_id);
    if (error) return { erreur: "Impossible d'enregistrer l'illustration." };
  }

  revalidatePath("/restaurant/profil");
  revalidatePath("/restaurant/menu");
  revalidatePath(`/restaurants/${membership.restaurant_id}`);
  return { succes: true };
}
