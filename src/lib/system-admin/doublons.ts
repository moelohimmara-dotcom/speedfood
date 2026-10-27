import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import type { TraceActionSysteme } from "./audit";

/**
 * Doublons d'inscription : une inscription dont l'adresse e-mail, ramenée à sa forme canonique, appartient déjà à un autre compte est suspendue (30 jours) et signalée à l'équipe par le
 * déclencheur de la base (`surveiller_inscription`). L'équipe tranche ici : AUTORISER (cas légitime : le compte est débloqué) ou REFUSER (doublon confirmé : le compte reste suspendu de façon
 * durable). Les tables sont privées (aucune policy) : seules ces fonctions, côté serveur, les lisent et les écrivent.
 */

export interface SignalementDoublon {
  id: string;
  statut: "en_attente" | "autorise" | "refuse";
  emailCanonique: string;
  nouvelEmail: string | null;
  emailExistant: string | null;
  creeLe: string;
  traiteLe: string | null;
  motif: string | null;
}

const SUSPENSION_DURABLE = "876000h"; // environ 100 ans : un refus ne se lève pas tout seul.

function admin(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

async function emailDe(utilisateurId: string | null): Promise<string | null> {
  if (!utilisateurId) return null;
  const { data } = await creerClientAdmin().auth.admin.getUserById(utilisateurId);
  return data?.user?.email ?? null;
}

/** Signalements à examiner d'abord, puis les derniers traités (80 au plus). */
export async function listerSignalementsDoublons(): Promise<SignalementDoublon[]> {
  const { data, error } = await admin()
    .from("signalements_doublons")
    .select("id, statut, email_canonique, nouvel_utilisateur_id, utilisateur_existant_id, cree_le, traite_le, motif")
    .order("statut", { ascending: true })
    .order("cree_le", { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const liste: SignalementDoublon[] = [];
  for (const l of data) {
    liste.push({
      id: l.id,
      statut: l.statut,
      emailCanonique: l.email_canonique,
      nouvelEmail: await emailDe(l.nouvel_utilisateur_id),
      emailExistant: await emailDe(l.utilisateur_existant_id),
      creeLe: l.cree_le,
      traiteLe: l.traite_le,
      motif: l.motif,
    });
  }
  return liste;
}

export async function compterSignalementsOuverts(): Promise<number> {
  const { count } = await admin().from("signalements_doublons").select("id", { count: "exact", head: true }).eq("statut", "en_attente");
  return count ?? 0;
}

/**
 * Tranche un signalement. « autorise » rend la connexion au nouveau compte ; « refuse » le garde suspendu durablement. Un signalement déjà traité ne change plus.
 * Le motif (300 caractères au plus) est conservé avec la décision, jamais montré à la personne.
 */
export async function trancherDoublon(
  id: unknown,
  decision: "autorise" | "refuse",
  motifBrut: unknown,
  traiteParUtilisateurId: string
): Promise<{ ok: true; trace: TraceActionSysteme } | { ok: false; message: string }> {
  if (typeof id !== "string" || !estUuid(id)) return { ok: false, message: "Signalement introuvable." };
  const motif = typeof motifBrut === "string" ? motifBrut.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) : "";
  const { data: l } = await admin().from("signalements_doublons").select("id, statut, nouvel_utilisateur_id").eq("id", id).maybeSingle();
  if (!l) return { ok: false, message: "Signalement introuvable." };
  if (l.statut !== "en_attente") return { ok: false, message: "Ce signalement est déjà traité." };

  const { error: erreurAuth } = await creerClientAdmin().auth.admin.updateUserById(l.nouvel_utilisateur_id, {
    ban_duration: decision === "autorise" ? "none" : SUSPENSION_DURABLE,
  });
  if (erreurAuth) return { ok: false, message: "Le compte n'a pas pu être mis à jour. Réessayez dans un instant." };

  const { error } = await admin()
    .from("signalements_doublons")
    .update({ statut: decision, traite_le: new Date().toISOString(), traite_par: traiteParUtilisateurId, motif: motif || null })
    .eq("id", id)
    .eq("statut", "en_attente");
  if (error) return { ok: false, message: "La décision n'a pas pu être enregistrée. Réessayez dans un instant." };
  return { ok: true, trace: { action: decision === "autorise" ? "compte.doublon_autorise" : "compte.doublon_refuse", cibleType: "signalements_doublons", cibleId: id, motif: motif || undefined } };
}

/** Signalements dont l'équipe n'a pas encore été prévenue par e-mail (le Worker les envoie, puis les confirme). */
export async function signalementsAEnvoyer(): Promise<{ id: string; nouvelEmail: string | null; emailExistant: string | null; emailCanonique: string; creeLe: string }[]> {
  const { data } = await admin()
    .from("signalements_doublons")
    .select("id, email_canonique, nouvel_utilisateur_id, utilisateur_existant_id, cree_le")
    .is("mail_envoye_le", null)
    .eq("statut", "en_attente")
    .order("cree_le")
    .limit(20);
  const liste = [];
  for (const l of data ?? []) {
    liste.push({ id: l.id as string, nouvelEmail: await emailDe(l.nouvel_utilisateur_id), emailExistant: await emailDe(l.utilisateur_existant_id), emailCanonique: l.email_canonique as string, creeLe: l.cree_le as string });
  }
  return liste;
}

export async function marquerEnvoyes(ids: string[]): Promise<void> {
  const valides = ids.filter((i) => estUuid(i));
  if (valides.length === 0) return;
  await admin().from("signalements_doublons").update({ mail_envoye_le: new Date().toISOString() }).in("id", valides);
}
