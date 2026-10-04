"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { televerserImage, supprimerImage } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { estCouleurValide } from "@/lib/design/paletteMarque";
import { moyensPaiementValides, normaliserMoyensPaiement } from "@/lib/restaurant/paiement";
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

  // Moyens de paiement déclarés : liste fermée, jamais une valeur libre.
  const moyensBruts = formData.getAll("moyens_paiement");
  if (!moyensPaiementValides(moyensBruts)) {
    return { erreur: "Moyen de paiement inconnu." };
  }
  const moyensPaiement = normaliserMoyensPaiement(moyensBruts);

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
  const payload: MiseAJourRestaurant = {
    horaires,
    consignes,
    couleur_accent: couleurAccent,
    moyens_paiement: moyensPaiement,
  };
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

export type ChampStatut = "ouvert" | "accepte_commandes";

export interface ResultatStatut {
  ok: boolean;
  erreur?: string;
}

/**
 * Statuts opérationnels, distincts : « ouvert » (le restaurant est ouvert) et
 * « accepte_commandes » (il prend des commandes en ce moment). Le statut n'est
 * considéré comme enregistré qu'après confirmation du serveur ; l'heure du
 * changement est posée par la base (trigger), jamais par le navigateur.
 */
export async function definirStatutRestaurantAction(
  champ: ChampStatut,
  valeur: boolean
): Promise<ResultatStatut> {
  if ((champ !== "ouvert" && champ !== "accepte_commandes") || typeof valeur !== "boolean") {
    return { ok: false, erreur: "Statut inconnu." };
  }
  const { membership } = await obtenirContexteRestaurant("/restaurant");
  const supabase = await creerClientServeur();

  const miseAJour: MiseAJourRestaurant = champ === "ouvert" ? { ouvert: valeur } : { accepte_commandes: valeur };
  const { data, error } = await supabase
    .from("restaurants")
    .update(miseAJour)
    .eq("id", membership.restaurant_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { ok: false, erreur: "Impossible d'enregistrer le changement. Réessayez dans un instant." };
  }

  revalidatePath("/restaurant");
  revalidatePath("/restaurant/profil");
  return { ok: true };
}
