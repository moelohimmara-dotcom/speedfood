import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { VALIDITE_SESSION_HEURES } from "./questions";

/**
 * Accès serveur aux questions de sécurité (facultatives). Voir `questions.ts` pour ce que c'est et ce que ce n'est pas.
 * Les tables ne sont lisibles que par la clé de service : jamais d'appel à ces fonctions depuis le navigateur.
 */

export interface EtatQuestions {
  active: boolean;
  /** Le compte a des questions et la session courante n'y a pas encore répondu. */
  requise: boolean;
  codesRestants: number;
  question1: string | null;
  question2: string | null;
  bloqueJusqu: string | null;
}

const ETAT_VIDE: EtatQuestions = { active: false, requise: false, codesRestants: 0, question1: null, question2: null, bloqueJusqu: null };

/** Client sans typage de tables : les tables de ce module sont absentes des types générés. */
export function clientQuestions(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

/** État pour le compte connecté (lu par la base : identité et session viennent du jeton, pas du navigateur). */
export async function lireEtatQuestions(supabase: SupabaseClient): Promise<EtatQuestions> {
  const { data, error } = await supabase.rpc("fn_questions_etat");
  if (error) {
    // Fonction pas encore créée (migration non appliquée) : la barrière n'existe pas, on n'enferme personne dehors.
    // Toute autre erreur est traitée comme « réponse requise » : refuser vaut mieux que laisser passer.
    if (error.code === "PGRST202" || error.code === "42883") return ETAT_VIDE;
    return { ...ETAT_VIDE, active: true, requise: true };
  }
  const brut = (data ?? {}) as Record<string, unknown>;
  return {
    active: brut.active === true,
    requise: brut.requise === true,
    codesRestants: typeof brut.codes_restants === "number" ? brut.codes_restants : 0,
    question1: typeof brut.question_1 === "string" ? brut.question_1 : null,
    question2: typeof brut.question_2 === "string" ? brut.question_2 : null,
    bloqueJusqu: typeof brut.bloque_jusqu === "string" ? brut.bloque_jusqu : null,
  };
}

/** Identifiant de la session courante, lu dans le jeton vérifié. */
export async function lireIdentifiantSession(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.session_id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/** Marque la session comme ayant répondu, et purge les validations expirées. */
export async function validerSession(utilisateurId: string, sessionId: string): Promise<void> {
  const admin = clientQuestions();
  const jusqua = new Date(Date.now() + VALIDITE_SESSION_HEURES * 3_600_000).toISOString();
  await admin.from("securite_questions_sessions").delete().lt("valide_jusqu", new Date().toISOString());
  await admin
    .from("securite_questions_sessions")
    .upsert({ session_id: sessionId, utilisateur_id: utilisateurId, valide_jusqu: jusqua }, { onConflict: "session_id" });
}

/** Trace dans le journal d'audit (écrite par le serveur : la personne concernée n'a pas accès à cette table). */
export async function tracerSecurite(acteurId: string, action: string, cibleId: string, motif?: string): Promise<void> {
  await clientQuestions().from("audit_events").insert({ acteur_id: acteurId, action, cible_type: "compte", cible_id: cibleId, motif: motif ?? null });
}
