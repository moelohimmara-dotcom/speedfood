"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { messageSupportValide, statutFilValide, type StatutFilSupport } from "./support-regles";

export type EtatActionSupport = { erreur?: string; succes?: string };

export async function envoyerMessageSupportAction(_etat: EtatActionSupport, formData: FormData): Promise<EtatActionSupport> {
  const commandeId = String(formData.get("commande_id") ?? "");
  const contenu = messageSupportValide(formData.get("contenu"));
  if (!commandeId) return { erreur: "Commande introuvable." };
  if (!contenu.ok) return { erreur: contenu.message };
  const contexte = await verifierPermission("commande.support");
  const supabase = contexte.supabase as unknown as SupabaseClient;
  const { error: filError } = await supabase.from("support_threads").upsert({ commande_id: commandeId, statut: "ouvert" });
  if (filError) return { erreur: "Le fil de support n'a pas pu être ouvert." };
  const { error } = await supabase.from("support_messages").insert({ commande_id: commandeId, auteur: "equipe", contenu: contenu.valeur });
  if (error) return { erreur: "Le message n'a pas pu être enregistré." };
  await journaliserActionSysteme(contexte, { action: "support.message", cibleType: "commande", cibleId: commandeId, motif: "Réponse de support enregistrée" });
  revalidatePath(`/system/commandes/${commandeId}`);
  return { succes: "Message ajouté au fil." };
}

export async function changerStatutFilSupportAction(_etat: EtatActionSupport, formData: FormData): Promise<EtatActionSupport> {
  const commandeId = String(formData.get("commande_id") ?? "");
  const statut = formData.get("statut");
  const motif = String(formData.get("motif") ?? "").trim();
  if (!commandeId) return { erreur: "Commande introuvable." };
  if (!statutFilValide(statut)) return { erreur: "Statut de support invalide." };
  if (motif.length < 5) return { erreur: "Un motif d'au moins 5 caractères est obligatoire." };
  const contexte = await verifierPermission("commande.support");
  const { error } = await (contexte.supabase as unknown as SupabaseClient).from("support_threads").upsert({ commande_id: commandeId, statut: statut as StatutFilSupport });
  if (error) return { erreur: "Le statut du fil n'a pas pu être modifié." };
  await journaliserActionSysteme(contexte, { action: statut === "resolu" ? "support.resolution" : "support.reouverture", cibleType: "commande", cibleId: commandeId, motif });
  revalidatePath(`/system/commandes/${commandeId}`);
  return { succes: statut === "resolu" ? "Fil marqué comme résolu." : "Fil rouvert." };
}
