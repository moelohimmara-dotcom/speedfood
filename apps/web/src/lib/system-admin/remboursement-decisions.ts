"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { changerReglageEspeces, enregistrerDecision } from "@/lib/paiement/en-ligne/remboursement-decision-service";
import { portsDecisionSupabase, portsReglageSupabase } from "@/lib/paiement/en-ligne/remboursement-lecture";
import { roleAPermission } from "./permissions";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission, type ContexteSysteme } from "./contexte";
import type { EtatActionPaiementAdmin } from "./paiements";

/**
 * Décision humaine sur un remboursement et réglage des espèces (lot R2). RÉSERVÉ AU SUPER ADMINISTRATEUR (`parametres.editer`) : une action
 * qui engage de l'argent ou qui consigne une décision n'est pas pour l'assistance. Le service revérifie la permission (défense en profondeur)
 * et relit TOUT côté serveur : le navigateur ne fournit ni le montant d'un remboursement total, ni le mode d'origine, ni l'état du réglage.
 * Enregistrer une décision NE déplace AUCUN argent : le remboursement reste une action distincte et confirmée.
 */

async function contexteSuperAdmin(): Promise<ContexteSysteme | { erreur: string }> {
  try {
    return await verifierPermission("parametres.editer");
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: "Cette action est réservée au super administrateur." };
    throw e;
  }
}

/** Enregistre une décision (ou en remplace une : le serveur choisit la décision remplacée, jamais le navigateur). */
export async function enregistrerDecisionRemboursementAction(
  identifiant: string,
  saisie: { issue: string; montantGnf: number | null; moyen: string; motif: string; referenceAvis: string; reconnaitArgentChezRestaurant: boolean }
): Promise<EtatActionPaiementAdmin> {
  const contexte = await contexteSuperAdmin();
  if ("erreur" in contexte) return { erreur: contexte.erreur };
  if (!estUuid(identifiant)) return { erreur: "Dossier invalide." };
  let r;
  try {
    r = await enregistrerDecision(portsDecisionSupabase(), {
      aPermission: (p) => roleAPermission(contexte.role, p),
      utilisateurId: contexte.utilisateurId,
      identifiant,
      saisie: {
        issue: saisie?.issue,
        montantGnf: saisie?.montantGnf,
        moyen: saisie?.moyen,
        motif: saisie?.motif,
        referenceAvis: saisie?.referenceAvis,
        reconnaitArgentChezRestaurant: saisie?.reconnaitArgentChezRestaurant,
      },
    });
  } catch {
    return { erreur: "Le service n'est pas disponible. Rien n'a été modifié." };
  }
  if (!r.ok) return { erreur: r.erreur };
  // Le journal d'audit ne garde ni le motif ni la référence de l'avis (textes libres) : seulement ce qui a été décidé.
  try {
    await journaliserActionSysteme(contexte, {
      action: "paiement.decision_remboursement",
      cibleType: "remboursement_decision",
      cibleId: r.id,
      motif: `${r.decision.issue}, moyen ${r.decision.moyen}, ${r.decision.montantGnf} GNF${r.remplaceId ? ", remplace la précédente" : ""}`,
    });
  } catch {
    // La décision est déjà enregistrée avec son auteur et sa date (ajout seul) : le journal d'audit n'est qu'un second témoin.
  }
  revalidatePath("/system/paiements");
  revalidatePath(`/system/paiements/dossier/${identifiant}`);
  return { succes: "Décision enregistrée. Aucun argent n'a bougé : le remboursement reste une étape distincte." };
}

/** Réglage de plateforme « remboursement en espèces autorisé » (faux par défaut). Chaque changement est journalisé par la base avec son auteur et sa date. */
export async function changerReglageEspecesAction(valeur: boolean, motif: string): Promise<EtatActionPaiementAdmin> {
  const contexte = await contexteSuperAdmin();
  if ("erreur" in contexte) return { erreur: contexte.erreur };
  let r;
  try {
    r = await changerReglageEspeces(portsReglageSupabase(), { aPermission: (p) => roleAPermission(contexte.role, p), utilisateurId: contexte.utilisateurId, valeur, motif });
  } catch {
    return { erreur: "Le service n'est pas disponible. Rien n'a été modifié." };
  }
  if (!r.ok) return { erreur: r.erreur };
  if (!r.inchange) {
    try {
      await journaliserActionSysteme(contexte, { action: "paiement.reglage_especes_modifie", cibleType: "parametres_remboursement", cibleId: "global", motif: `espèces ${valeur ? "autorisées" : "interdites"}` });
    } catch {
      // Le journal du réglage (table dédiée, tenue par la base) fait foi.
    }
  }
  revalidatePath("/system/parametres/paiement");
  revalidatePath("/system/paiements");
  return { succes: r.inchange ? "Le réglage était déjà dans cet état." : valeur ? "Remboursement en espèces autorisé. Le changement est journalisé." : "Remboursement en espèces interdit. Le changement est journalisé." };
}
