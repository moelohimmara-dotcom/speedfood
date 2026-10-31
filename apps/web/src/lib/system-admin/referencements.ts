"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { changerStatutReferencement, creerEtablissementDepuisDemande, rattacherCompteCandidat } from "./referencements-service";

/**
 * Demandes de référencement, côté administration (ADR-020). Les coordonnées sont des données personnelles : lecture et changements passent par le
 * serveur (service-role, la table n'est lisible par aucun navigateur), exigent `restaurant.moderer` (super administrateur et opérations) et laissent
 * une trace dans le journal d'audit sans y écrire les coordonnées.
 */

export interface EtatCreationEtablissement {
  erreur?: string;
}

export async function changerStatutReferencementAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const r = await changerStatutReferencement(formData.get("id"), formData.get("statut"), formData.get("motif"));
  if (!r.ok) return;
  await journaliserActionSysteme(contexte, r.trace);
  revalidatePath("/system/catalogue/referencements");
}

/** Supprime une demande (retrait demandé par la personne, ou demande indésirable). Irréversible ; les coordonnées ne sont pas écrites dans le journal. */
export async function supprimerReferencementAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const id = String(formData.get("id") ?? "");
  if (!estUuid(id)) return;
  const { error } = await creerClientAdmin().from("referencement_demandes").delete().eq("id", id);
  if (error) return;
  await journaliserActionSysteme(contexte, { action: "referencement.suppression", cibleType: "referencement_demandes", cibleId: id });
  revalidatePath("/system/catalogue/referencements");
}

export async function creerEtablissementDepuisDemandeAction(
  _etat: EtatCreationEtablissement,
  formData: FormData
): Promise<EtatCreationEtablissement> {
  const contexte = await verifierPermission("restaurant.moderer");
  const r = await creerEtablissementDepuisDemande(formData.get("demande_id"), formData.get("categorie_id"), formData.get("quartier_id"));
  if (!r.ok) return { erreur: r.message };
  await journaliserActionSysteme(contexte, r.trace);
  revalidatePath("/system/catalogue/referencements");
  redirect(`/system/catalogue/restaurants/${r.restaurantId}`);
}

/** Rattache le compte du candidat à l'établissement créé (règles dans le service, commun avec l'application de l'équipe). */
export async function rattacherCompteCandidatAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const r = await rattacherCompteCandidat(formData.get("id"));
  if (!r.ok) return;
  await journaliserActionSysteme(contexte, r.trace);
  revalidatePath("/system/catalogue/referencements");
}
