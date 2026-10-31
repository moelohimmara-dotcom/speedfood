"use server";

import { revalidatePath } from "next/cache";
import { trancherConflitNumero } from "@/lib/identite/numeros";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/** Décision de l'équipe sur un numéro réclamé par deux comptes : permission `compte.inviter`, tracée dans l'audit (un transfert d'accès doit être justifié par un motif). */
async function decider(formData: FormData, decision: "cede" | "refuse"): Promise<void> {
  const contexte = await verifierPermission("compte.inviter");
  const r = await trancherConflitNumero(formData.get("id"), decision, formData.get("motif"), contexte.utilisateurId);
  if (!r.ok) return;
  await journaliserActionSysteme(contexte, r.trace);
  revalidatePath("/system/acces/numeros");
}

export async function cederNumeroAction(formData: FormData): Promise<void> {
  await decider(formData, "cede");
}

export async function refuserNumeroAction(formData: FormData): Promise<void> {
  await decider(formData, "refuse");
}
