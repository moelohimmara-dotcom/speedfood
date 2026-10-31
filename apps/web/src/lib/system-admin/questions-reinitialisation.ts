"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { clientQuestions } from "@/lib/auth/questions-serveur";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";

/**
 * Retire les questions de sécurité (et les codes de secours) d'un AUTRE compte qui les a oubliées et a perdu ses codes.
 * Réservé à `systeme.roles` (super_admin). Le motif est obligatoire (par exemple « identité vérifiée par téléphone »)
 * et l'action est inscrite dans le journal d'audit. Jamais son propre compte : voir la page « Sécurité du compte ».
 * Cela ne touche pas à la double authentification par application, ni au mot de passe.
 */

export interface EtatReinitialisationQuestions {
  erreur?: string;
  succes?: string;
}

export async function reinitialiserQuestionsCompteAction(
  _prec: EtatReinitialisationQuestions,
  formData: FormData
): Promise<EtatReinitialisationQuestions> {
  const utilisateurId = String(formData.get("utilisateur_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  if (!estUuid(utilisateurId)) return { erreur: "Compte invalide." };
  if (motif.length < 10 || motif.length > 500) {
    return { erreur: "Indiquez comment l'identité de la personne a été vérifiée (10 à 500 caractères)." };
  }

  const contexte = await verifierPermission("systeme.roles");
  if (utilisateurId === contexte.utilisateurId) {
    return { erreur: "Pour votre propre compte, utilisez la page « Sécurité du compte »." };
  }

  const admin = clientQuestions();
  const { data: existant } = await admin.from("securite_questions").select("utilisateur_id").eq("utilisateur_id", utilisateurId).maybeSingle();
  if (!existant) return { erreur: "Ce compte n'a pas activé les questions de sécurité." };

  // La trace d'abord : sans elle, l'action est refusée (même principe que la révélation de coordonnées).
  await journaliserActionSysteme(contexte, { action: "securite.questions_reinitialisees", cibleType: "compte", cibleId: utilisateurId, motif });

  await admin.from("securite_questions_sessions").delete().eq("utilisateur_id", utilisateurId);
  await admin.from("securite_codes_secours").delete().eq("utilisateur_id", utilisateurId);
  const { error } = await admin.from("securite_questions").delete().eq("utilisateur_id", utilisateurId);
  if (error) return { erreur: "La réinitialisation a échoué. Réessayez dans un instant." };

  revalidatePath("/system/acces/comptes");
  return { succes: "Questions de sécurité retirées. La personne peut se reconnecter avec son mot de passe et en définir de nouvelles." };
}
