"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { messageErreurAffectation, PERIMETRE_AFFECTATION_PAR_DEFAUT, operateursAffectables } from "./quarts-regles";
import { lireOperateursEquipe, chargerVueQuarts } from "./quarts-service";

/**
 * Actions de l'écran « Quarts et affectation » (lot L2) : prendre un établissement, le libérer,
 * relancer une commande qui attend.
 *
 * Permission : `commande.support` (support et super administrateur), comme la page voisine
 * `/system/repartition` : c'est la même équipe qui tient les établissements de l'équipe.
 *
 * Les écritures passent par les fonctions réservées `fn_quarts_prendre` et `fn_quarts_liberer`
 * (la table est en lecture seule pour les comptes connectés) ; la base reste l'autorité : elle
 * refuse une prise sur un établissement déjà tenu, même si l'interface ne l'avait pas vu.
 *
 * Toute action est tracée dans le journal d'audit AVANT d'être rendue visible.
 */

export interface EtatQuart {
  succes?: string;
  erreur?: string;
}

/**
 * Client non typé : les fonctions `fn_quarts_*` sont nouvelles, leur signature n'est pas encore
 * dans `src/lib/db/database.types.ts` (fichier généré, hors périmètre de ce lot).
 */
function clientQuarts(contexte: { supabase: unknown }): SupabaseClient {
  return contexte.supabase as SupabaseClient;
}

/** « Je prends » : je prends (ou fais prendre) un établissement tenu par l'équipe. */
export async function prendreEtablissementAction(_etat: EtatQuart, formData: FormData): Promise<EtatQuart> {
  const contexte = await verifierPermission("commande.support");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const commandeId = String(formData.get("commande_id") ?? "");
  const operateurId = String(formData.get("operateur_id") ?? "").trim() || contexte.utilisateurId;

  if (!estUuid(restaurantId)) return { erreur: "Indiquez l'établissement." };
  if (commandeId !== "" && !estUuid(commandeId)) return { erreur: "Indiquez la commande." };
  if (!estUuid(operateurId)) return { erreur: "Indiquez l'opérateur." };

  // L'opérateur visé doit faire partie de l'équipe, et le périmètre d'affectation doit l'autoriser.
  const operateurs = await lireOperateursEquipe();
  const eligibles = operateursAffectables(PERIMETRE_AFFECTATION_PAR_DEFAUT, operateurs, contexte.utilisateurId);
  if (!eligibles.some((operateur) => operateur.utilisateurId === operateurId)) {
    return { erreur: "Cette personne ne fait pas partie de l'équipe d'exploitation." };
  }

  const { error } = await clientQuarts(contexte).rpc("fn_quarts_prendre", {
    p_restaurant_id: restaurantId,
    p_commande_id: commandeId === "" ? null : commandeId,
    p_operateur_id: operateurId,
  });
  if (error) return { erreur: messageErreurAffectation(error.message) };

  const nomOperateur = eligibles.find((operateur) => operateur.utilisateurId === operateurId)?.email ?? "";
  await journaliserActionSysteme(contexte, {
    action: "quart.prise",
    cibleType: "restaurants",
    cibleId: restaurantId,
    motif: commandeId === "" ? `Prise en charge (${nomOperateur})` : `Prise en charge depuis la commande ${commandeId} (${nomOperateur})`,
  });

  revalidatePath("/system/quarts");
  revalidatePath("/system/repartition");
  return { succes: "Établissement pris en charge." };
}

/** « Je libère » : je rends un établissement que je tenais (ou celui d'un collègue, en déblocage). */
export async function libererEtablissementAction(_etat: EtatQuart, formData: FormData): Promise<EtatQuart> {
  const contexte = await verifierPermission("commande.support");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const operateurId = String(formData.get("operateur_id") ?? "").trim() || contexte.utilisateurId;

  if (!estUuid(restaurantId)) return { erreur: "Indiquez l'établissement." };
  if (!estUuid(operateurId)) return { erreur: "Indiquez l'opérateur." };

  const operateurs = await lireOperateursEquipe();
  if (!operateurs.some((operateur) => operateur.utilisateurId === operateurId)) {
    return { erreur: "Cette personne ne fait pas partie de l'équipe d'exploitation." };
  }

  const { data, error } = await clientQuarts(contexte).rpc("fn_quarts_liberer", {
    p_restaurant_id: restaurantId,
    p_operateur_id: operateurId,
  });
  if (error) return { erreur: messageErreurAffectation(error.message) };
  if (data === false) {
    return { erreur: "Cet établissement n'est tenu par cet opérateur : rien à libérer." };
  }

  const nomOperateur = operateurs.find((operateur) => operateur.utilisateurId === operateurId)?.email ?? "";
  const parMoi = operateurId === contexte.utilisateurId;
  await journaliserActionSysteme(contexte, {
    action: "quart.liberation",
    cibleType: "restaurants",
    cibleId: restaurantId,
    motif: parMoi ? `Libéré (${nomOperateur})` : `Libéré en déblocage (${nomOperateur})`,
  });

  revalidatePath("/system/quarts");
  revalidatePath("/system/repartition");
  return { succes: "Établissement libéré." };
}

/** « Relancer » : une commande attend depuis plus longtemps que le délai de relance. */
export async function relancerCommandeAction(_etat: EtatQuart, formData: FormData): Promise<EtatQuart> {
  const contexte = await verifierPermission("commande.support");
  const commandeId = String(formData.get("commande_id") ?? "");
  const motifSaisi = String(formData.get("motif") ?? "").trim();

  if (!estUuid(commandeId)) return { erreur: "Indiquez la commande." };

  // On ne relance qu'une commande réellement en attente : la vue fait foi.
  const vue = await chargerVueQuarts(contexte);
  const alerte = vue.alertes.find((entree) => entree.commande.id === commandeId);
  if (!alerte) {
    return { erreur: "Cette commande n'est plus en attente de relance. Rechargez la page." };
  }

  await journaliserActionSysteme(contexte, {
    action: "quart.relance",
    cibleType: "commande",
    cibleId: commandeId,
    motif:
      motifSaisi === ""
        ? `Relance de ${alerte.commande.reference} (${alerte.minutesAttente} min d'attente)`
        : motifSaisi,
  });

  revalidatePath("/system/quarts");
  return { succes: `Relance tracée pour ${alerte.commande.reference}.` };
}
