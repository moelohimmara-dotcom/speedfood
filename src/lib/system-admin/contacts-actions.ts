"use server";

import { revalidatePath } from "next/cache";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { enregistrerContact } from "./contacts-service";
import type { SaisieContact } from "./contacts-regles";

/**
 * Lot L7 — journal des contacts avec l'établissement.
 *
 * Écrire dans le journal demande `restaurant.moderer` (Opérations et Super administrateur) : c'est le
 * travail de l'équipe qui tient l'établissement. La lecture est ouverte à `restaurant.consulter`.
 * Chaque contact est journalisé (`etablissement.contact_ajoute`).
 */

export interface EtatActionContact {
  succes?: string;
  erreur?: string;
}

const REFRESH = "/system/contacts";

/** Lit la date d'échéance d'un champ `datetime-local` (vide = pas d'échéance). */
function lireEcheance(brut: string): Date | null {
  const valeur = brut.trim();
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Note un contact : type, compte rendu, prochaine action et son échéance. */
export async function enregistrerContactAction(
  _etatPrecedent: EtatActionContact,
  formData: FormData
): Promise<EtatActionContact> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) return { erreur: "Établissement introuvable." };

  const saisie: SaisieContact = {
    type: String(formData.get("type_contact") ?? ""),
    compteRendu: String(formData.get("compte_rendu") ?? ""),
    prochaineAction: String(formData.get("prochaine_action") ?? ""),
    echeanceLe: lireEcheance(String(formData.get("echeance_le") ?? "")),
  };

  try {
    const contexte = await verifierPermission("restaurant.moderer");
    const resultat = await enregistrerContact(restaurantId, saisie, contexte.utilisateurId);
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
