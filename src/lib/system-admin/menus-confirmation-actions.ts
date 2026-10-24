"use server";

import { revalidatePath } from "next/cache";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { confirmerMenuDuJour, enregistrerRappelMenu } from "./menus-confirmation-service";

/**
 * Lot L5 — rappel de confirmation du menu avant le service.
 *
 * Deux actions, toutes deux réservées à `restaurant.moderer` (Opérations et Super administrateur) :
 * confirmer le menu du jour en un geste, et enregistrer un rappel.
 * Chaque action laisse une trace dans le journal d'audit (`etablissement.menu_confirme`,
 * `etablissement.menu_rappel`).
 */

export interface EtatActionMenu {
  succes?: string;
  erreur?: string;
}

const REFRESH = "/system/menus-confirmation";

/** Confirmation du menu du jour : les plats disponibles repassent « confirmés » pour les clients. */
export async function confirmerMenuDuJourAction(
  _etatPrecedent: EtatActionMenu,
  formData: FormData
): Promise<EtatActionMenu> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) return { erreur: "Établissement introuvable." };

  try {
    const contexte = await verifierPermission("restaurant.moderer");
    const resultat = await confirmerMenuDuJour(restaurantId, contexte.utilisateurId);
    if (!resultat.ok) return { erreur: resultat.message };
    await journaliserActionSysteme(contexte, resultat.trace);
    revalidatePath(REFRESH);
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

/** Rappel de confirmation : notification interne ou appel, tracé dans le journal des rappels. */
export async function rappelerMenuAction(
  _etatPrecedent: EtatActionMenu,
  formData: FormData
): Promise<EtatActionMenu> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const canal = String(formData.get("canal") ?? "interne");
  if (!restaurantId) return { erreur: "Établissement introuvable." };

  try {
    const contexte = await verifierPermission("restaurant.moderer");
    const resultat = await enregistrerRappelMenu(restaurantId, canal, contexte.utilisateurId);
    if (!resultat.ok) return { erreur: resultat.message };
    await journaliserActionSysteme(contexte, resultat.trace);
    revalidatePath(REFRESH);
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
