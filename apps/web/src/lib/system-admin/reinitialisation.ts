"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireEtatMfa } from "@/lib/auth/mfa-etat";
import { verifierPermission } from "./contexte";
import { listerFichiersMedias, sauvegarderAvantReinitialisation } from "./sauvegarde";
import { validerDemande } from "./reinitialisationRegles";

/**
 * Réinitialisation de l'application (remise à l'état neuf). Deux actions, toutes deux réservées au super administrateur
 * avec une session renforcée (double authentification) :
 * 1. `preparerReinitialisationAction` : simulation en lecture seule + jeton à usage unique de 5 minutes ;
 * 2. `executerReinitialisationAction` : phrase, motif, case à cocher, sauvegarde obligatoire, suppression en une
 *    transaction (fonction de base), puis suppression des fichiers. Voir docs/specs/2026-10-04-illustrations-et-reinitialisation-design.md.
 */

export interface ResumeReinitialisation {
  supprime: Record<string, number>;
  conserve: Record<string, number>;
}

export interface EtatPreparation {
  erreur?: string;
  jeton?: string;
  expireLe?: string;
  resume?: ResumeReinitialisation;
}

export interface EtatExecution {
  erreur?: string;
  succes?: boolean;
  sauvegarde?: string;
  avertissement?: string;
}

async function controlerAcces() {
  const contexte = await verifierPermission("parametres.editer");
  if (contexte.role !== "super_admin") {
    return { erreur: "Réservé au super administrateur." as const };
  }
  const supabase = await creerClientServeur();
  const mfa = await lireEtatMfa(supabase);
  if (!mfa.actif) {
    return { erreur: "Activez d'abord la double authentification de votre compte." as const };
  }
  if (!mfa.sessionRenforcee) {
    return { erreur: "Confirmez votre identité : déconnectez-vous puis reconnectez-vous avec votre code." as const };
  }
  return { contexte, supabase };
}

export async function preparerReinitialisationAction(): Promise<EtatPreparation> {
  const acces = await controlerAcces();
  if ("erreur" in acces) return { erreur: acces.erreur };
  const { data, error } = await acces.supabase.rpc("fn_reinitialisation_simuler");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { erreur: "Impossible de calculer ce qui sera supprimé. Réessayez dans un instant." };
  }
  const d = data as { jeton: string; expire_le: string; supprime: Record<string, number>; conserve: Record<string, number> };
  return { jeton: d.jeton, expireLe: d.expire_le, resume: { supprime: d.supprime, conserve: d.conserve } };
}

const MESSAGES_REFUS: Record<string, string> = {
  "REFUS:jeton": "Cette étape a expiré ou a déjà servi : recommencez par le calcul de ce qui sera supprimé.",
  "REFUS:motif": "Le motif est trop court ou trop long.",
  "REFUS:limite": "Une réinitialisation a déjà eu lieu il y a moins d'une heure.",
};

export async function executerReinitialisationAction(_precedent: EtatExecution, formData: FormData): Promise<EtatExecution> {
  const acces = await controlerAcces();
  if ("erreur" in acces) return { erreur: acces.erreur };

  const demande = {
    phrase: String(formData.get("phrase") ?? ""),
    motif: String(formData.get("motif") ?? ""),
    compris: formData.get("compris") === "on",
    jeton: String(formData.get("jeton") ?? ""),
  };
  const refus = validerDemande(demande);
  if (refus) return { erreur: refus };

  let sauvegarde;
  try {
    sauvegarde = await sauvegarderAvantReinitialisation();
  } catch {
    return { erreur: "La sauvegarde préalable a échoué : rien n'a été supprimé. Réessayez dans un instant." };
  }

  const { error } = await acces.supabase.rpc("fn_reinitialiser_application", {
    p_jeton: demande.jeton,
    p_motif: demande.motif.trim(),
  });
  if (error) {
    const connu = Object.entries(MESSAGES_REFUS).find(([cle]) => error.message.includes(cle));
    return { erreur: connu ? connu[1] : "La réinitialisation a échoué : rien n'a été supprimé." };
  }

  let avertissement: string | undefined;
  try {
    const admin = creerClientAdmin();
    const fichiers = await listerFichiersMedias();
    for (let i = 0; i < fichiers.length; i += 100) {
      const { error: e } = await admin.storage.from("medias").remove(fichiers.slice(i, i + 100));
      if (e) throw e;
    }
  } catch {
    avertissement = "Les données sont supprimées, mais certains fichiers d'images n'ont pas pu être effacés. Ils restent dans la sauvegarde et peuvent être supprimés à la main.";
  }

  revalidatePath("/", "layout");
  return { succes: true, sauvegarde: sauvegarde.dossier, avertissement };
}
