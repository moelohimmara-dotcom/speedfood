"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { televerserImage, supprimerImage } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { estCouleurValide } from "@/lib/design/paletteMarque";
import type { Database } from "@/lib/db/database.types";

type MiseAJourRestaurant = Database["public"]["Tables"]["restaurants"]["Update"];

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

  // Chaîne vide = pas de couleur d'accent (repli neutre) ; toute autre valeur
  // doit venir de la palette fermée — jamais un hex saisi librement.
  const couleurAccentBrut = String(formData.get("couleur_accent") ?? "").trim();
  if (couleurAccentBrut && !estCouleurValide(couleurAccentBrut)) {
    return { erreur: "Couleur invalide." };
  }
  const couleurAccent = couleurAccentBrut || null;

  const supabase = await creerClientServeur();

  // Photo et logo optionnels : gouvernés par l'appartenance au restaurant,
  // comme horaires/consignes — aucune permission système distincte requise.
  // Chacun est indépendant (on peut changer l'un sans l'autre).
  const payload: MiseAJourRestaurant = { horaires, consignes, couleur_accent: couleurAccent };
  const anciennesImages: { colonne: "photo_url" | "logo_url" }[] = [];

  for (const [champ, colonne, dossier] of [
    ["photo", "photo_url", "restaurants"],
    ["logo", "logo_url", "logos"],
  ] as const) {
    const fichier = formData.get(champ);
    if (fichier instanceof File && fichier.size > 0) {
      try {
        payload[colonne] = await televerserImage(fichier, dossier);
      } catch (erreur) {
        if (erreur instanceof ErreurMetier) {
          return { erreur: erreur.message };
        }
        return { erreur: "Impossible d'enregistrer l'image. Réessayez dans un instant." };
      }
      anciennesImages.push({ colonne });
    }
  }

  const { data: ancien } =
    anciennesImages.length > 0
      ? await supabase
          .from("restaurants")
          .select("photo_url, logo_url")
          .eq("id", membership.restaurant_id)
          .maybeSingle()
      : { data: null };

  const { error } = await supabase
    .from("restaurants")
    .update(payload)
    .eq("id", membership.restaurant_id);
  if (error) {
    return { erreur: "Impossible d'enregistrer les modifications. Réessayez dans un instant." };
  }

  for (const { colonne } of anciennesImages) {
    await supprimerImage(ancien?.[colonne] ?? null);
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
