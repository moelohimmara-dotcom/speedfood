"use server";

import { revalidatePath } from "next/cache";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { fermerEtablissement, leverFermeture } from "./etablissements-service";
import type { SaisieFermeture } from "./etablissements-regles";

/**
 * Lot L6 — fermeture et suspension d'un établissement.
 *
 * Action VISIBLE PAR LE PUBLIC : elle exige un motif écrit, une confirmation explicite de
 * l'administrateur, et elle est journalisée (`etablissement.fermeture`, `etablissement.fermeture_levee`).
 *
 * Permission : `restaurant.moderer` — Opérations et Super administrateur. L'éditeur de contenu et
 * le support ne peuvent pas fermer un établissement : c'est une décision commerciale, pas éditoriale.
 */

export interface EtatActionEtablissement {
  succes?: string;
  erreur?: string;
}

const REFRESH = "/system/etablissements";

/** Lit la date de reprise d'un champ `datetime-local` (vide = la durée la calcule). */
function lireReprise(brut: string): Date | null {
  const valeur = brut.trim();
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Ferme ou suspend un établissement.
 * Refusée sans confirmation explicite : une case à cocher (« Je confirme ») est exigée du formulaire.
 */
export async function fermerEtablissementAction(
  _etatPrecedent: EtatActionEtablissement,
  formData: FormData
): Promise<EtatActionEtablissement> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) return { erreur: "Établissement introuvable." };

  const confirmation = String(formData.get("confirmation") ?? "");
  if (confirmation !== "oui") {
    return { erreur: "Confirmez la fermeture : l'action est visible par les clients." };
  }

  const dureeLue = Number(String(formData.get("duree_heures") ?? ""));
  const saisie: SaisieFermeture = {
    type: String(formData.get("type_fermeture") ?? ""),
    motif: String(formData.get("motif") ?? ""),
    messagePublic: String(formData.get("message_public") ?? ""),
    dureeHeures: Number.isFinite(dureeLue) ? dureeLue : Number.NaN,
    repriseLe: lireReprise(String(formData.get("reprise_le") ?? "")),
  };

  try {
    const contexte = await verifierPermission("restaurant.moderer");
    const resultat = await fermerEtablissement(restaurantId, saisie, contexte.utilisateurId);
    if (!resultat.ok) return { erreur: resultat.message };
    await journaliserActionSysteme(contexte, resultat.trace);
    revalidatePath(REFRESH);
    revalidatePath("/system/menus-confirmation");
    revalidatePath("/restaurants");
    return { succes: resultat.message };
  } catch (erreur) {
    return {
      erreur:
        erreur instanceof ErreurMetier
          ? erreur.message
          : "L'action n'a pas pu aboutir. Réessayez dans un instant.",
    };
  }
}

/** Lève la fermeture en cours : un motif est demandé, la trace reste dans le journal. */
export async function leverFermetureAction(
  _etatPrecedent: EtatActionEtablissement,
  formData: FormData
): Promise<EtatActionEtablissement> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const motif = String(formData.get("motif_levee") ?? "");
  if (!restaurantId) return { erreur: "Établissement introuvable." };

  try {
    const contexte = await verifierPermission("restaurant.moderer");
    const resultat = await leverFermeture(restaurantId, motif, contexte.utilisateurId);
    if (!resultat.ok) return { erreur: resultat.message };
    await journaliserActionSysteme(contexte, resultat.trace);
    revalidatePath(REFRESH);
    revalidatePath("/system/menus-confirmation");
    revalidatePath("/restaurants");
    return { succes: resultat.message };
  } catch (erreur) {
    return {
      erreur:
        erreur instanceof ErreurMetier
          ? erreur.message
          : "L'action n'a pas pu aboutir. Réessayez dans un instant.",
    };
  }
}
