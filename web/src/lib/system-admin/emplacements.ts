"use server";

import { revalidatePath } from "next/cache";
import { verifierPermission } from "./contexte";
import { verifierPalier } from "./paliers-serveur";
import { MINIMUMS_STUDIO } from "./paliers";
import { journaliserActionSysteme } from "./audit";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { invaliderCache } from "@/lib/cms/cache";
import { EMPLACEMENTS, decider, erreurSaisie, normaliserSaisie, type Emplacement } from "@/lib/cms/emplacements";

/**
 * Emplacements de contenu (Studio, palier 1) : surcharge des textes du site public. Toute mutation vérifie `contenu.editer`
 * (et la RLS `editeurs_gestion_emplacements` applique les mêmes rôles), revalide la saisie côté serveur, journalise
 * (`contenu.emplacement_modification`) et invalide le cache `textes`. Texte brut seulement : aucune balise n'est acceptée.
 *
 * Studio, palier 2 : en plus de `contenu.editer`, palier sur `contenu:textes`. Un texte enregistré est en ligne aussitôt
 * (il n'y a pas de brouillon de texte) : enregistrer comme rétablir demandent donc le palier de publication (2) ; voir ≥ 0.
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
  await verifierPalier("contenu:textes", MINIMUMS_STUDIO.lire, { contexte });
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

  // Normalisation. `i:<cle>` est la valeur que l'éditeur voyait à l'ouverture : elle sert seulement à savoir si le champ a été
  // touché et à détecter un conflit, JAMAIS à valider (la validation reste celle du catalogue serveur, sur la saisie).
  const saisies = new Map<string, string>();
  const initiales = new Map<string, string>();
  const erreurs: Record<string, string> = {};
  for (const e of emplacements) {
    const valeur = normaliserSaisie(e, String(formData.get(`v:${e.cle}`) ?? ""));
    const initiale = normaliserSaisie(e, String(formData.get(`i:${e.cle}`) ?? e.defaut));
    saisies.set(e.cle, valeur);
    initiales.set(e.cle, initiale);
    // Un champ non touché n'est pas revalidé : il ne bloque pas l'enregistrement des autres.
    if ((valeur === "" ? e.defaut : valeur) === initiale) continue;
    const message = erreurSaisie(e, valeur);
    if (message) erreurs[e.cle] = message;
  }
  if (Object.keys(erreurs).length > 0) {
    return { erreur: "Certains textes sont refusés : corrigez-les puis enregistrez à nouveau.", erreurs };
  }

  let contexte;
  try {
    contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:textes", MINIMUMS_STUDIO.publier, { contexte });
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
  const conflits: Record<string, string> = {};
  try {
    for (const e of emplacements) {
      const valeur = saisies.get(e.cle) ?? "";
      const decision = decider(valeur, initiales.get(e.cle) ?? e.defaut, actuelles.get(e.cle) ?? null, e.defaut);

      if (decision === "conflit") {
        conflits[e.cle] = "Ce texte a changé depuis que vous avez ouvert la page, rechargez pour voir la nouvelle valeur";
      } else if (decision === "retablir") {
        const { error } = await supabase.from("contenu_emplacements").delete().eq("cle", e.cle);
        if (error) return { erreur: "Impossible de rétablir un texte par défaut. Rien d'autre n'a été modifié après lui." };
        await journaliserActionSysteme(contexte, {
          action: ACTION_AUDIT,
          cibleType: "emplacement",
          cibleId: e.cle,
          motif: "Défaut rétabli",
        });
        modifies += 1;
      } else if (decision === "enregistrer") {
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
  if (Object.keys(conflits).length > 0) {
    return {
      erreur: `${modifies} texte(s) enregistré(s). Certains textes ont été modifiés par quelqu'un d'autre depuis l'ouverture de la page : ils n'ont pas été écrasés.`,
      erreurs: conflits,
    };
  }
  return { succes: modifies === 0 ? "Aucun changement." : `${modifies} texte${modifies > 1 ? "s" : ""} enregistré${modifies > 1 ? "s" : ""}.` };
}

/** Rétablit le défaut d'un seul emplacement (supprime sa ligne). */
export async function retablirEmplacementAction(cle: string): Promise<EtatActionEmplacements> {
  if (!EMPLACEMENTS.some((e) => e.cle === cle)) return { erreur: "Texte introuvable." };
  let contexte;
  try {
    contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:textes", MINIMUMS_STUDIO.publier, { contexte });
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
