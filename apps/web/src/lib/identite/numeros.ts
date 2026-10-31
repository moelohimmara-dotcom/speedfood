import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { normaliserTelephone } from "@/lib/commande/telephone";
import { creerClientAdmin } from "@/lib/db/admin";
import type { TraceActionSysteme } from "@/lib/system-admin/audit";

/**
 * « Un numéro, un titulaire » pour les profils professionnels (candidatures de restaurateurs, livreurs) : deux personnes n'utilisent pas le même numéro, sauf si le titulaire le cède.
 * La règle vit en base (`numeros_titulaires`, `reserver_numero`) ; ce module en est l'accès serveur. Les numéros des consommateurs ne sont pas concernés tant qu'ils ne sont pas
 * vérifiés par un code (sans vérification, un numéro réservé par un autre bloquerait son vrai propriétaire).
 */

export type SourceNumero = "candidature" | "livreur";

export const MESSAGE_NUMERO_PRIS =
  "Ce numéro est déjà utilisé par un autre compte Speedfood. Si c'est le vôtre, connectez-vous avec ce compte. Sinon, contactez l'équipe : elle vérifiera par un appel et vous l'attribuera si c'est bien le vôtre.";

function admin(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

/**
 * Réserve le numéro pour le compte. `ok: false` si un AUTRE compte en est le titulaire : un conflit est alors consigné pour l'équipe (une seule fois par demandeur et numéro).
 * Un numéro illisible n'est pas réservé (la validation du formulaire le refuse ailleurs). Une panne de la base n'est jamais prise pour un succès.
 */
export async function reserverNumero(utilisateurId: string, telephone: string, source: SourceNumero): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!estUuid(utilisateurId)) return { ok: false, message: "Compte invalide." };
  const { data, error } = await admin().rpc("reserver_numero", { p_telephone: telephone, p_utilisateur: utilisateurId, p_source: source });
  if (error) {
    console.error("numero_reservation_echec", error.code);
    return { ok: false, message: "Votre numéro n'a pas pu être vérifié pour le moment. Réessayez dans un instant." };
  }
  return data ? { ok: false, message: MESSAGE_NUMERO_PRIS } : { ok: true };
}

/** Un compte (autre que `sauf`) est-il titulaire de ce numéro ? Pour les formulaires sans compte, qui ne peuvent pas réserver. */
export async function numeroEstPris(telephone: string, sauf?: string): Promise<boolean> {
  const t = normaliserTelephone(telephone);
  if (!t) return false;
  const { data } = await admin().from("numeros_titulaires").select("utilisateur_id").eq("telephone", t).maybeSingle();
  return Boolean(data && data.utilisateur_id !== sauf);
}

/** Libère le numéro d'un compte (candidature refusée, par exemple), sans toucher à un numéro qu'un autre usage du même compte retiendrait encore. */
export async function libererNumero(utilisateurId: string, telephone: string | null, source: SourceNumero): Promise<void> {
  const t = telephone ? normaliserTelephone(telephone) : null;
  if (!t || !estUuid(utilisateurId)) return;
  await admin().from("numeros_titulaires").delete().eq("telephone", t).eq("utilisateur_id", utilisateurId).eq("source", source);
}

export interface ConflitNumero {
  id: string;
  telephone: string;
  source: SourceNumero;
  statut: "en_attente" | "cede" | "refuse";
  demandeurEmail: string | null;
  titulaireEmail: string | null;
  creeLe: string;
  traiteLe: string | null;
  motif: string | null;
}

async function emailDe(utilisateurId: string | null): Promise<string | null> {
  if (!utilisateurId) return null;
  const { data } = await creerClientAdmin().auth.admin.getUserById(utilisateurId);
  return data?.user?.email ?? null;
}

/** Conflits à examiner d'abord, puis les derniers traités (80 au plus). */
export async function listerConflitsNumero(): Promise<ConflitNumero[]> {
  const { data } = await admin()
    .from("conflits_numero")
    .select("id, telephone, source, statut, demandeur_id, titulaire_id, cree_le, traite_le, motif")
    .order("statut", { ascending: true })
    .order("cree_le", { ascending: false })
    .limit(80);
  const liste: ConflitNumero[] = [];
  for (const c of data ?? []) {
    liste.push({
      id: c.id,
      telephone: c.telephone,
      source: c.source,
      statut: c.statut,
      demandeurEmail: await emailDe(c.demandeur_id),
      titulaireEmail: await emailDe(c.titulaire_id),
      creeLe: c.cree_le,
      traiteLe: c.traite_le,
      motif: c.motif,
    });
  }
  return liste;
}

/**
 * Décision de l'équipe : CÉDER le numéro au demandeur (le titulaire le cède ou n'en est pas le vrai usager, après un appel de vérification) ou le REFUSER (le titulaire garde son numéro).
 * Le motif est obligatoire pour une cession : c'est un transfert d'accès, il doit être justifié dans l'audit.
 */
export async function trancherConflitNumero(
  id: unknown,
  decision: "cede" | "refuse",
  motifBrut: unknown,
  utilisateurId: string
): Promise<{ ok: true; trace: TraceActionSysteme } | { ok: false; message: string }> {
  if (typeof id !== "string" || !estUuid(id)) return { ok: false, message: "Conflit introuvable." };
  const motif = typeof motifBrut === "string" ? motifBrut.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300) : "";
  if (decision === "cede" && motif.length < 5) return { ok: false, message: "Un motif est obligatoire pour céder un numéro (appel de vérification, accord du titulaire…)." };
  if (decision === "cede") {
    const { data, error } = await admin().rpc("ceder_numero", { p_conflit: id, p_par: utilisateurId, p_motif: motif });
    if (error) return { ok: false, message: "La cession n'a pas pu être enregistrée. Réessayez dans un instant." };
    if (!data) return { ok: false, message: "Ce conflit est déjà traité." };
  } else {
    const { data, error } = await admin()
      .from("conflits_numero")
      .update({ statut: "refuse", traite_le: new Date().toISOString(), traite_par: utilisateurId, motif: motif || null })
      .eq("id", id)
      .eq("statut", "en_attente")
      .select("id");
    if (error) return { ok: false, message: "La décision n'a pas pu être enregistrée. Réessayez dans un instant." };
    if (!data || data.length === 0) return { ok: false, message: "Ce conflit est déjà traité." };
  }
  return { ok: true, trace: { action: decision === "cede" ? "compte.numero_cede" : "compte.numero_refuse", cibleType: "conflits_numero", cibleId: id, motif: motif || undefined } };
}

/** Conflits dont l'équipe n'a pas encore été prévenue par e-mail (le Worker les envoie, puis les confirme). */
export async function conflitsAEnvoyer(): Promise<{ id: string; telephone: string; source: SourceNumero; demandeurEmail: string | null; titulaireEmail: string | null; creeLe: string }[]> {
  const { data } = await admin()
    .from("conflits_numero")
    .select("id, telephone, source, demandeur_id, titulaire_id, cree_le")
    .is("mail_envoye_le", null)
    .eq("statut", "en_attente")
    .order("cree_le")
    .limit(20);
  const liste = [];
  for (const c of data ?? []) {
    liste.push({ id: c.id as string, telephone: c.telephone as string, source: c.source as SourceNumero, demandeurEmail: await emailDe(c.demandeur_id), titulaireEmail: await emailDe(c.titulaire_id), creeLe: c.cree_le as string });
  }
  return liste;
}

export async function marquerConflitsEnvoyes(ids: string[]): Promise<void> {
  const valides = ids.filter((i) => estUuid(i));
  if (valides.length === 0) return;
  await admin().from("conflits_numero").update({ mail_envoye_le: new Date().toISOString() }).in("id", valides);
}

export async function compterConflitsOuverts(): Promise<number> {
  const { count } = await admin().from("conflits_numero").select("id", { count: "exact", head: true }).eq("statut", "en_attente");
  return count ?? 0;
}
