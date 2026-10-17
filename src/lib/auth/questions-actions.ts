"use server";

import { redirect } from "next/navigation";
import { creerClientServeur } from "@/lib/db/server";
import { estCheminInterneSur } from "./redirection";
import {
  ITERATIONS_PBKDF2,
  apresEchec,
  empreinteCode,
  empreinteReponses,
  erreurReponse,
  estCleQuestionValide,
  genererCodesSecours,
  genererSel,
  memeEmpreinte,
  minutesDeBlocage,
  normaliserReponse,
  ressembleACodeSecours,
} from "./questions";
import { clientQuestions, lireEtatQuestions, lireIdentifiantSession, tracerSecurite, validerSession } from "./questions-serveur";

/**
 * Questions de sécurité FACULTATIVES (barrière d'application en plus du mot de passe).
 * Fichier "use server" : uniquement des fonctions asynchrones exportées.
 * Les messages ne disent jamais laquelle des deux réponses est fausse.
 */

export interface EtatQuestionsFormulaire {
  erreur?: string;
  /** Codes de secours en clair : renvoyés UNE seule fois, jamais relisibles ensuite. */
  codes?: string[];
}

const MESSAGE_SESSION = "Votre session n'est plus valide. Reconnectez-vous puis réessayez.";
const MESSAGE_REPONSES = "Les réponses ne correspondent pas.";

async function contexte() {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sessionId = await lireIdentifiantSession(supabase);
  if (!sessionId) return null;
  return { supabase, user, sessionId };
}

function texte(formData: FormData, nom: string): string {
  return String(formData.get(nom) ?? "");
}

/** Remplace tous les codes de secours du compte par de nouveaux ; renvoie les codes en clair. */
async function remplacerCodes(utilisateurId: string): Promise<string[]> {
  const admin = clientQuestions();
  const codes = genererCodesSecours();
  await admin.from("securite_codes_secours").delete().eq("utilisateur_id", utilisateurId);
  const lignes = await Promise.all(codes.map(async (c) => ({ utilisateur_id: utilisateurId, empreinte: await empreinteCode(c) })));
  const { error } = await admin.from("securite_codes_secours").insert(lignes);
  if (error) throw new Error("codes");
  return codes;
}

/** Active (ou redéfinit) les deux questions. Exige que la session ait déjà répondu si des questions existent. */
export async function activerQuestionsAction(_prec: EtatQuestionsFormulaire, formData: FormData): Promise<EtatQuestionsFormulaire> {
  const ctx = await contexte();
  if (!ctx) return { erreur: MESSAGE_SESSION };

  const etat = await lireEtatQuestions(ctx.supabase);
  if (etat.active && etat.requise) return { erreur: "Répondez d'abord à vos questions actuelles pour les modifier." };

  const q1 = texte(formData, "question_1");
  const q2 = texte(formData, "question_2");
  const r1 = texte(formData, "reponse_1");
  const r2 = texte(formData, "reponse_2");
  if (!estCleQuestionValide(q1) || !estCleQuestionValide(q2)) return { erreur: "Choisissez deux questions dans la liste." };
  if (q1 === q2) return { erreur: "Choisissez deux questions différentes." };
  const probleme = erreurReponse(r1) ?? erreurReponse(r2);
  if (probleme) return { erreur: probleme };
  if (normaliserReponse(r1) !== normaliserReponse(texte(formData, "reponse_1_bis")) || normaliserReponse(r2) !== normaliserReponse(texte(formData, "reponse_2_bis"))) {
    return { erreur: "Les réponses saisies une seconde fois ne sont pas identiques aux premières." };
  }
  if (normaliserReponse(r1) === normaliserReponse(r2)) return { erreur: "Les deux réponses doivent être différentes." };

  try {
    const sel = genererSel();
    const empreinte = await empreinteReponses(r1, r2, sel, ITERATIONS_PBKDF2);
    const admin = clientQuestions();
    const { error } = await admin.from("securite_questions").upsert(
      {
        utilisateur_id: ctx.user.id,
        question_1: q1,
        question_2: q2,
        sel,
        empreinte,
        iterations: ITERATIONS_PBKDF2,
        essais_echoues: 0,
        bloque_jusqu: null,
        mis_a_jour_le: new Date().toISOString(),
      },
      { onConflict: "utilisateur_id" }
    );
    if (error) return { erreur: "Impossible d'enregistrer pour le moment. Réessayez dans un instant." };
    const codes = await remplacerCodes(ctx.user.id);
    await validerSession(ctx.user.id, ctx.sessionId);
    await tracerSecurite(ctx.user.id, etat.active ? "securite.questions_modifiees" : "securite.questions_activees", ctx.user.id);
    return { codes };
  } catch {
    return { erreur: "Impossible d'enregistrer pour le moment. Réessayez dans un instant." };
  }
}

/** Génère de nouveaux codes de secours (les anciens cessent de fonctionner). */
export async function regenererCodesSecoursAction(): Promise<EtatQuestionsFormulaire> {
  const ctx = await contexte();
  if (!ctx) return { erreur: MESSAGE_SESSION };
  const etat = await lireEtatQuestions(ctx.supabase);
  if (!etat.active) return { erreur: "Les questions de sécurité ne sont pas activées." };
  if (etat.requise) return { erreur: "Répondez d'abord à vos questions." };
  try {
    const codes = await remplacerCodes(ctx.user.id);
    await tracerSecurite(ctx.user.id, "securite.codes_secours_regeneres", ctx.user.id);
    return { codes };
  } catch {
    return { erreur: "Impossible de générer de nouveaux codes pour le moment." };
  }
}

/** Retire les questions de sécurité du compte (exige que la session ait répondu). */
export async function desactiverQuestionsAction(): Promise<{ erreur?: string; succes?: boolean }> {
  const ctx = await contexte();
  if (!ctx) return { erreur: MESSAGE_SESSION };
  const etat = await lireEtatQuestions(ctx.supabase);
  if (etat.requise) return { erreur: "Répondez d'abord à vos questions pour les désactiver." };
  const admin = clientQuestions();
  await admin.from("securite_questions_sessions").delete().eq("utilisateur_id", ctx.user.id);
  await admin.from("securite_codes_secours").delete().eq("utilisateur_id", ctx.user.id);
  const { error } = await admin.from("securite_questions").delete().eq("utilisateur_id", ctx.user.id);
  if (error) return { erreur: "Impossible de désactiver pour le moment." };
  await tracerSecurite(ctx.user.id, "securite.questions_desactivees", ctx.user.id);
  return { succes: true };
}

/** Compte un échec (réponses ou code) et bloque après 5 erreurs de suite. */
async function enregistrerEchec(utilisateurId: string, essais: number): Promise<string> {
  const suite = apresEchec(essais, new Date());
  await clientQuestions()
    .from("securite_questions")
    .update({ essais_echoues: suite.essais, bloque_jusqu: suite.bloqueJusqu?.toISOString() ?? null })
    .eq("utilisateur_id", utilisateurId);
  if (suite.bloqueJusqu) {
    await tracerSecurite(utilisateurId, "securite.questions_blocage", utilisateurId);
    return "Trop d'essais. Par sécurité, l'accès est bloqué 15 minutes.";
  }
  return "";
}

async function lireLigne(utilisateurId: string) {
  const { data } = await clientQuestions()
    .from("securite_questions")
    .select("sel, empreinte, iterations, essais_echoues, bloque_jusqu")
    .eq("utilisateur_id", utilisateurId)
    .maybeSingle();
  return data as { sel: string; empreinte: string; iterations: number; essais_echoues: number; bloque_jusqu: string | null } | null;
}

/** Réponse aux deux questions après le mot de passe. */
export async function verifierQuestionsAction(_prec: EtatQuestionsFormulaire, formData: FormData): Promise<EtatQuestionsFormulaire> {
  const suite = texte(formData, "suite").trim();
  const destination = estCheminInterneSur(suite) ? suite : "/restaurant";
  const ctx = await contexte();
  if (!ctx) return { erreur: MESSAGE_SESSION };

  const ligne = await lireLigne(ctx.user.id);
  if (!ligne) redirect(destination);

  const restant = minutesDeBlocage(ligne.bloque_jusqu, new Date());
  if (restant > 0) return { erreur: `Trop d'essais. Réessayez dans ${restant} minute${restant > 1 ? "s" : ""}.` };

  const calcule = await empreinteReponses(texte(formData, "reponse_1"), texte(formData, "reponse_2"), ligne.sel, ligne.iterations);
  if (!memeEmpreinte(calcule, ligne.empreinte)) {
    const blocage = await enregistrerEchec(ctx.user.id, ligne.essais_echoues);
    return { erreur: blocage || MESSAGE_REPONSES };
  }

  await clientQuestions().from("securite_questions").update({ essais_echoues: 0, bloque_jusqu: null }).eq("utilisateur_id", ctx.user.id);
  await validerSession(ctx.user.id, ctx.sessionId);
  redirect(destination);
}

/** Porte de secours : un code à usage unique remplace la réponse aux questions pour cette session. */
export async function utiliserCodeSecoursAction(_prec: EtatQuestionsFormulaire, formData: FormData): Promise<EtatQuestionsFormulaire> {
  const ctx = await contexte();
  if (!ctx) return { erreur: MESSAGE_SESSION };

  const ligne = await lireLigne(ctx.user.id);
  if (!ligne) redirect("/restaurant");

  const restant = minutesDeBlocage(ligne.bloque_jusqu, new Date());
  if (restant > 0) return { erreur: `Trop d'essais. Réessayez dans ${restant} minute${restant > 1 ? "s" : ""}.` };

  const saisi = texte(formData, "code");
  const admin = clientQuestions();
  let trouve: string | null = null;
  if (ressembleACodeSecours(saisi)) {
    const { data } = await admin
      .from("securite_codes_secours")
      .select("id")
      .eq("utilisateur_id", ctx.user.id)
      .eq("empreinte", await empreinteCode(saisi))
      .is("utilise_le", null)
      .maybeSingle();
    trouve = (data as { id: string } | null)?.id ?? null;
  }
  if (!trouve) {
    const blocage = await enregistrerEchec(ctx.user.id, ligne.essais_echoues);
    return { erreur: blocage || "Ce code n'est pas valide ou a déjà servi." };
  }

  // « utilise_le is null » dans la mise à jour : deux envois simultanés du même code ne passent pas tous les deux.
  const { data: consomme } = await admin
    .from("securite_codes_secours")
    .update({ utilise_le: new Date().toISOString() })
    .eq("id", trouve)
    .is("utilise_le", null)
    .select("id");
  if (!consomme || consomme.length === 0) return { erreur: "Ce code n'est pas valide ou a déjà servi." };

  await admin.from("securite_questions").update({ essais_echoues: 0, bloque_jusqu: null }).eq("utilisateur_id", ctx.user.id);
  await validerSession(ctx.user.id, ctx.sessionId);
  await tracerSecurite(ctx.user.id, "securite.code_secours_utilise", ctx.user.id);
  redirect("/compte/securite?secours=1");
}
