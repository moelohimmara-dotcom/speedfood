"use server";

import { revalidatePath } from "next/cache";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { trancherDoublon } from "./doublons";

/** Décision de l'équipe sur une inscription suspendue : permission `compte.inviter` (opérations et super administrateur), tracée dans l'audit. */
async function decider(formData: FormData, decision: "autorise" | "refuse"): Promise<void> {
  const contexte = await verifierPermission("compte.inviter");
  const r = await trancherDoublon(formData.get("id"), decision, formData.get("motif"), contexte.utilisateurId);
  if (!r.ok) return;
  await journaliserActionSysteme(contexte, r.trace);
  revalidatePath("/system/acces/doublons");
}

export async function autoriserDoublonAction(formData: FormData): Promise<void> {
  await decider(formData, "autorise");
}

export async function refuserDoublonAction(formData: FormData): Promise<void> {
  await decider(formData, "refuse");
}
