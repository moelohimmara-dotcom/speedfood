import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { statutFilValide, type StatutFilSupport } from "./support-regles";

export type MessageSupport = {
  id: string;
  commandeId: string;
  auteur: "client" | "equipe";
  contenu: string;
  creeLe: string;
};

export type FilSupport = {
  commandeId: string;
  statut: StatutFilSupport;
  messages: MessageSupport[];
};

const LIMITE_MESSAGES = 100;

export async function lireFilSupport(supabase: SupabaseClient, commandeId: string): Promise<FilSupport> {
  const [{ data: fil }, { data: messages }] = await Promise.all([
    supabase.from("support_threads").select("commande_id, statut").eq("commande_id", commandeId).limit(1).maybeSingle(),
    supabase.from("support_messages").select("id, commande_id, auteur, contenu, cree_le").eq("commande_id", commandeId).order("cree_le", { ascending: true }).limit(LIMITE_MESSAGES),
  ]);
  return {
    commandeId,
    statut: statutFilValide(fil?.statut) ? fil.statut : "ouvert",
    messages: (messages ?? []).map((message) => ({
      id: message.id,
      commandeId: message.commande_id,
      auteur: message.auteur === "client" ? "client" : "equipe",
      contenu: message.contenu,
      creeLe: message.cree_le,
    })),
  };
}
