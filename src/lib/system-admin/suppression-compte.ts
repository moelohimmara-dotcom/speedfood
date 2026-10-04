"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientServeur } from "@/lib/db/server";
import { estUuid } from "@/lib/commande/commun";
import { verifierPermission } from "./contexte";

/**
 * Suppression d'un compte par un super_admin (comptes de test, comptes à fermer).
 * IRRÉVERSIBLE. Garde-fous cumulés :
 * - permission `compte.supprimer` (super_admin seulement), et la fonction de base la revérifie
 *   (avec la double authentification si le compte l'a activée) ;
 * - l'adresse e-mail du compte doit être retapée à l'identique, avec un motif écrit ;
 * - jamais son propre compte, jamais un autre super_admin (retirer son rôle d'abord) ;
 * - un restaurant n'est supprimé que si le compte en est le seul membre ET s'il n'a AUCUNE
 *   commande (les restaurants avec commandes sont conservés) ;
 * - la suppression est journalisée dans l'audit avant que le compte disparaisse.
 */

export interface EtatSuppressionCompte {
  erreur?: string;
}

const MESSAGES_REFUS: Record<string, string> = {
  "REFUS:propre_compte": "Vous ne pouvez pas supprimer votre propre compte.",
  "REFUS:introuvable": "Ce compte n'existe plus.",
  "REFUS:super_admin": "Ce compte est super administrateur : retirez d'abord son rôle dans « Rôles système ».",
};

export async function supprimerCompteAction(
  _etatPrecedent: EtatSuppressionCompte,
  formData: FormData
): Promise<EtatSuppressionCompte> {
  const utilisateurId = String(formData.get("utilisateur_id") ?? "");
  const confirmation = String(formData.get("confirmation_email") ?? "").trim().toLowerCase();
  const motif = String(formData.get("motif") ?? "").trim();
  const supprimerRestaurants = formData.get("supprimer_restaurants") === "on";

  if (!estUuid(utilisateurId)) {
    return { erreur: "Compte invalide." };
  }
  if (!motif || motif.length > 500) {
    return { erreur: "Indiquez un motif (500 caractères au plus), par exemple « compte de test »." };
  }

  await verifierPermission("compte.supprimer");

  const admin = creerClientAdmin();
  const { data: cible, error: erreurLecture } = await admin.auth.admin.getUserById(utilisateurId);
  if (erreurLecture || !cible?.user) {
    return { erreur: "Ce compte n'existe plus." };
  }
  if ((cible.user.email ?? "").toLowerCase() !== confirmation) {
    return { erreur: "L'adresse e-mail saisie ne correspond pas à celle du compte : rien n'a été supprimé." };
  }

  // Garde-fous, restaurants et trace d'audit : en base, avec la session du super_admin.
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("fn_preparer_suppression_compte", {
    p_utilisateur: utilisateurId,
    p_supprimer_restaurants: supprimerRestaurants,
    p_motif: motif,
  });
  if (error) {
    const refus = Object.entries(MESSAGES_REFUS).find(([cle]) => error.message.includes(cle));
    return { erreur: refus ? refus[1] : "Suppression refusée. Rien n'a été supprimé." };
  }

  const { error: erreurSuppression } = await admin.auth.admin.deleteUser(utilisateurId);
  if (erreurSuppression) {
    return {
      erreur:
        "Les restaurants ont été traités mais le compte n'a pas pu être supprimé. Réessayez : l'opération peut être relancée sans risque.",
    };
  }

  revalidatePath("/system/acces/comptes");
  const resume = data as { restaurants_supprimes?: number; restaurants_conserves?: number } | null;
  // La carte du compte disparaît de la liste : le résultat est donc affiché par la page, à partir
  // de simples nombres (jamais un texte venu de l'adresse).
  const params = new URLSearchParams({
    supprime: "1",
    rs: String(resume?.restaurants_supprimes ?? 0),
    rc: String(resume?.restaurants_conserves ?? 0),
  });
  redirect(`/system/acces/comptes?${params.toString()}`);
}

const LIMITE_SUPPRESSION_GROUPEE = 50;

/**
 * Suppression groupée (nettoyage de comptes de test). Mêmes garde-fous que la suppression d'un compte, appliqués compte
 * par compte : permission `compte.supprimer`, motif écrit, mot « SUPPRIMER » retapé, jamais son propre compte ni un
 * super_admin (refus par la base), restaurants conservés s'ils ont des commandes ou d'autres membres, trace d'audit pour
 * chaque compte. Au plus 50 comptes par envoi. Un compte refusé n'arrête pas les autres : le résultat donne les nombres.
 */
export async function supprimerComptesAction(
  _etatPrecedent: EtatSuppressionCompte,
  formData: FormData
): Promise<EtatSuppressionCompte> {
  const identifiants = Array.from(new Set(formData.getAll("utilisateur_id").map(String).filter(estUuid)));
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const motif = String(formData.get("motif") ?? "").trim();
  const supprimerRestaurants = formData.get("supprimer_restaurants") === "on";

  if (identifiants.length === 0) {
    return { erreur: "Cochez au moins un compte." };
  }
  if (identifiants.length > LIMITE_SUPPRESSION_GROUPEE) {
    return { erreur: `Au plus ${LIMITE_SUPPRESSION_GROUPEE} comptes à la fois : décochez-en quelques-uns.` };
  }
  if (!motif || motif.length > 500) {
    return { erreur: "Indiquez un motif (500 caractères au plus), par exemple « comptes de test »." };
  }
  if (confirmation !== "SUPPRIMER") {
    return { erreur: "Tapez le mot SUPPRIMER en majuscules pour confirmer : rien n'a été supprimé." };
  }

  await verifierPermission("compte.supprimer");

  const admin = creerClientAdmin();
  const supabase = await creerClientServeur();
  let supprimes = 0;
  let refuses = 0;
  let restaurantsSupprimes = 0;
  let restaurantsConserves = 0;

  for (const utilisateurId of identifiants) {
    const { data, error } = await supabase.rpc("fn_preparer_suppression_compte", {
      p_utilisateur: utilisateurId,
      p_supprimer_restaurants: supprimerRestaurants,
      p_motif: motif,
    });
    if (error) {
      refuses += 1;
      continue;
    }
    const { error: erreurSuppression } = await admin.auth.admin.deleteUser(utilisateurId);
    if (erreurSuppression) {
      refuses += 1;
      continue;
    }
    supprimes += 1;
    const resume = data as { restaurants_supprimes?: number; restaurants_conserves?: number } | null;
    restaurantsSupprimes += resume?.restaurants_supprimes ?? 0;
    restaurantsConserves += resume?.restaurants_conserves ?? 0;
  }

  revalidatePath("/system/acces/comptes");
  const params = new URLSearchParams({
    supprime: "1",
    n: String(supprimes),
    refus: String(refuses),
    rs: String(restaurantsSupprimes),
    rc: String(restaurantsConserves),
  });
  redirect(`/system/acces/comptes?${params.toString()}`);
}
