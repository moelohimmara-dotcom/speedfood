"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import { estUuid } from "@/lib/commande/commun";
import { lireStatut } from "@/lib/site/partenariat";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Demandes de partenariat, côté administration. Les coordonnées sont des données personnelles : la lecture et les changements passent par le
 * serveur (service-role, la table n'est lisible par aucun navigateur), exigent la permission `attente.gerer` (super administrateur et
 * opérations, comme les contacts de la liste d'attente) et laissent une trace dans le journal d'audit sans y écrire les coordonnées.
 */

export async function changerStatutPartenariatAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("attente.gerer");
  const id = String(formData.get("id") ?? "");
  const statut = lireStatut(formData.get("statut"));
  if (!estUuid(id) || !statut) return;
  const { error } = await creerClientAdmin()
    .from("partenariat_demandes")
    .update({ statut, traitee_le: statut === "traitee" || statut === "classee" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return;
  await journaliserActionSysteme(contexte, { action: "partenariat.statut", cibleType: "partenariat_demandes", cibleId: id, motif: `statut : ${statut}` });
  revalidatePath("/system/catalogue/partenariats");
}

/** Supprime une demande (droit de retrait demandé par la personne, ou demande indésirable). Irréversible ; les coordonnées ne sont pas écrites dans le journal. */
export async function supprimerPartenariatAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("attente.gerer");
  const id = String(formData.get("id") ?? "");
  if (!estUuid(id)) return;
  const { error } = await creerClientAdmin().from("partenariat_demandes").delete().eq("id", id);
  if (error) return;
  await journaliserActionSysteme(contexte, { action: "partenariat.suppression", cibleType: "partenariat_demandes", cibleId: id });
  revalidatePath("/system/catalogue/partenariats");
}
