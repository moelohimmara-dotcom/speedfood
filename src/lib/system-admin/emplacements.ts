"use server";

import { revalidatePath } from "next/cache";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { invaliderCache } from "@/lib/cms/cache";
import { EMPLACEMENTS, erreurSaisie, type Emplacement } from "@/lib/cms/emplacements";

/**
 * Emplacements de contenu (Studio, palier 1) : surcharge des textes du site public. Toute mutation vérifie `contenu.editer`
 * (et la RLS `editeurs_gestion_emplacements` applique les mêmes rôles), revalide la saisie côté serveur, journalise
 * (`contenu.emplacement_modification`) et invalide le cache `textes`. Texte brut seulement : aucune balise n'est acceptée.
 */

export interface EtatActionEmplacements {
  erreur?: string;
  succes?: string;
  /** Erreurs par clé d'emplacement (affichées sous le champ concerné). */
  erreurs?: Record<string, string>;
}

export interface SurchargeEmplacement {
  valeur: string;
  misAJourLe: string;
}

const ACTION_AUDIT = "contenu.emplacement_modification";
const CHEMIN_ECRAN = "/system/contenu/textes";

/** Surcharges actuelles (lues avec la session de l'éditeur : la RLS décide), indexées par clé du catalogue. */
export async function listerSurcharges(): Promise<Record<string, SurchargeEmplacement>> {
  const contexte = await verifierPermission("contenu.editer");
  const { data, error } = await contexte.supabase
    .from("contenu_emplacements")
    .select("cle, valeur, mis_a_jour_le");
  if (error || !data) return {};
  const connues = new Set<string>(EMPLACEMENTS.map((e) => e.cle));
  const resultat: Record<string, SurchargeEmplacement> = {};
  for (const ligne of data) {
    if (connues.has(ligne.cle)) resultat[ligne.cle] = { valeur: ligne.valeur, misAJourLe: ligne.mis_a_jour_le };
  }
  return resultat;
}

/** Extrait lisible d'une valeur pour le motif d'audit (borné : le journal n'est pas un stockage de contenu). */
function extrait(valeur: string): string {
  return valeur.length > 100 ? `${valeur.slice(0, 100)}…` : valeur;
}

/**
 * Enregistre un groupe d'emplacements. Pour chaque emplacement du groupe : valeur vide ou identique au défaut → la ligne est
 * supprimée (retour au défaut) ; sinon la valeur rognée est enregistrée. Tout est validé AVANT la première écriture : une
 * erreur de saisie n'écrit rien.
 */
export async function enregistrerGroupeAction(
  _etatPrecedent: EtatActionEmplacements,
  formData: FormData
): Promise<EtatActionEmplacements> {
  const groupe = String(formData.get("groupe") ?? "");
  const emplacements: readonly Emplacement[] = EMPLACEMENTS.filter((e) => e.groupe === groupe);
  if (emplacements.length === 0) {
    return { erreur: "Groupe de textes introuvable." };
  }

  // Normalisation : rognage ; un champ d'une ligne ne garde aucun saut de ligne.
  const saisies = new Map<string, string>();
  const erreurs: Record<string, string> = {};
  for (const e of emplacements) {
    const brut = String(formData.get(`v:${e.cle}`) ?? "");
    const valeur = (e.multiligne ? brut.replace(/\r\n/g, "\n") : brut.replace(/\s*[\r\n]+\s*/g, " ")).trim();
    const message = erreurSaisie(e, valeur);
    if (message) erreurs[e.cle] = message;
    saisies.set(e.cle, valeur);
  }
  if (Object.keys(erreurs).length > 0) {
    return { erreur: "Certains textes sont refusés : corrigez-les puis enregistrez à nouveau.", erreurs };
  }

  let contexte;
  try {
    contexte = await verifierPermission("contenu.editer");
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Action refusée." };
  }
  const { supabase, utilisateurId } = contexte;

  const { data: lignes, error: erreurLecture } = await supabase
    .from("contenu_emplacements")
    .select("cle, valeur")
    .in("cle", emplacements.map((e) => e.cle));
  if (erreurLecture) return { erreur: "Impossible de lire les textes actuels." };
  const actuelles = new Map((lignes ?? []).map((l) => [l.cle, l.valeur]));

  let modifies = 0;
  try {
    for (const e of emplacements) {
      const valeur = saisies.get(e.cle) ?? "";
      const existante = actuelles.get(e.cle);
      const retourAuDefaut = valeur === "" || valeur === e.defaut;

      if (retourAuDefaut) {
        if (existante === undefined) continue;
        const { error } = await supabase.from("contenu_emplacements").delete().eq("cle", e.cle);
        if (error) return { erreur: "Impossible de rétablir un texte par défaut. Rien d'autre n'a été modifié après lui." };
        await journaliserActionSysteme(contexte, {
          action: ACTION_AUDIT,
          cibleType: "emplacement",
          cibleId: e.cle,
          motif: "Défaut rétabli",
        });
        modifies += 1;
      } else if (valeur !== existante) {
        const { error } = await supabase.from("contenu_emplacements").upsert({
          cle: e.cle,
          valeur,
          mis_a_jour_le: new Date().toISOString(),
          mis_a_jour_par: utilisateurId,
        });
        if (error) return { erreur: "Impossible d'enregistrer un texte. Rien d'autre n'a été modifié après lui." };
        await journaliserActionSysteme(contexte, {
          action: ACTION_AUDIT,
          cibleType: "emplacement",
          cibleId: e.cle,
          motif: `Remplacé par « ${extrait(valeur)} »`,
        });
        modifies += 1;
      }
    }

  } catch (erreur) {
    // Trace d'audit impossible : l'action est refusée par prudence (voir journaliserActionSysteme).
    if (modifies > 0) await invaliderCache(["textes"]);
    revalidatePath(CHEMIN_ECRAN);
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Enregistrement interrompu." };
  }

  if (modifies > 0) await invaliderCache(["textes"]);
  revalidatePath(CHEMIN_ECRAN);
  return { succes: modifies === 0 ? "Aucun changement." : `${modifies} texte${modifies > 1 ? "s" : ""} enregistré${modifies > 1 ? "s" : ""}.` };
}

/** Rétablit le défaut d'un seul emplacement (supprime sa ligne). */
export async function retablirEmplacementAction(cle: string): Promise<EtatActionEmplacements> {
  if (!EMPLACEMENTS.some((e) => e.cle === cle)) return { erreur: "Texte introuvable." };
  let contexte;
  try {
    contexte = await verifierPermission("contenu.editer");
  } catch (erreur) {
    return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Action refusée." };
  }
  const { data, error } = await contexte.supabase.from("contenu_emplacements").delete().eq("cle", cle).select("cle");
  if (error) return { erreur: "Impossible de rétablir le texte par défaut." };
  if ((data ?? []).length > 0) {
    await journaliserActionSysteme(contexte, {
      action: ACTION_AUDIT,
      cibleType: "emplacement",
      cibleId: cle,
      motif: "Défaut rétabli",
    });
    await invaliderCache(["textes"]);
  }
  revalidatePath(CHEMIN_ECRAN);
  return { succes: "Texte par défaut rétabli." };
}
