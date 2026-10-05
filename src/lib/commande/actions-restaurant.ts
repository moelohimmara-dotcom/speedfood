"use server";

import { revalidatePath } from "next/cache";
import { ErreurMetier, type ErreurApi } from "@/lib/contracts/erreurs";
import type { ResultatActionCommande, ValeursProposition } from "@/lib/contracts/commande";
import type { StatutCommande } from "@/lib/contracts/statuts";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "./commun";
import {
  lirePropositions,
  propositionActiveParmi,
  traiterPropositionEchue,
  creerPropositionRevisee,
} from "./propositions";
import { appliquerTransitionStatut, lireCommandeMinimale } from "./transitions";

/**
 * Actions serveur de la console restaurant (bloc 7).
 *
 * ADR-011 : ces actions passent par `creerClientServeur()` avec la session du
 * membre, SANS élévation service-role — la RLS le permet directement :
 *   - `membres_lecture_leurs_commandes` (lecture de sa commande),
 *   - `membres_maj_leurs_commandes` (transition de statut),
 *   - `membres_ecriture_historique_commandes` (order_status_events),
 *   - `membres_creation_propositions` (order_proposals, insertion seule).
 * La RLS reste donc la source d'autorité : restaurant A ne voit ni ne modifie
 * jamais les commandes de restaurant B. Le contrôle `restaurant_id` ci-dessous
 * est une défense en profondeur, pas le contrôle principal.
 *
 * Seule exception : `traiterPropositionEchue` (effet d'horloge système) utilise
 * le client service-role — voir lib/commande/propositions.ts.
 */

export type ActionStatutCommande = "accepter" | "refuser" | "prete" | "terminee" | "annuler";

function erreurInattendue(): ErreurApi {
  return {
    code: "ERREUR_SERVEUR",
    message: "Une erreur est survenue. Réessayez dans un instant.",
  };
}

function erreurValidationCommande(): ErreurApi {
  return { code: "VALIDATION", message: "Commande invalide." };
}

/**
 * Applique une action de la machine à états (accepter/refuser/prete/terminee/
 * annuler). Toute transition invalide est rejetée côté serveur, historisée dans
 * `order_status_events`, et revalidée par le trigger de base.
 */
export async function traiterCommandeAction(
  commandeId: string,
  action: ActionStatutCommande
): Promise<ResultatActionCommande> {
  const { supabase, user, membership } = await obtenirContexteRestaurant("/restaurant/commandes");

  if (!estUuid(commandeId)) {
    return { ok: false, erreur: erreurValidationCommande() };
  }

  const cibles: Record<ActionStatutCommande, StatutCommande> = {
    accepter: "acceptee",
    refuser: "refusee",
    prete: "prete",
    terminee: "terminee",
    annuler: "annulee",
  };
  const vers = cibles[action];
  if (!vers) {
    return { ok: false, erreur: erreurValidationCommande() };
  }

  try {
    // L'appartenance est vérifiée AVANT tout traitement en clé serveur (revue de
    // sécurité, point 12) ; une proposition échue est ensuite traitée par le système
    // et la commande relue : elle peut être déjà annulée, la transition sera alors
    // légitimement refusée.
    let commande = await lireCommandeMinimale(supabase, commandeId);
    if (!commande) {
      return {
        ok: false,
        erreur: { code: "INTROUVABLE", message: "Commande introuvable." },
      };
    }
    if (commande.restaurantId !== membership.restaurant_id) {
      return {
        ok: false,
        erreur: { code: "NON_AUTORISE", message: "Cette commande ne relève pas de votre restaurant." },
      };
    }
    if (await traiterPropositionEchue(commandeId)) {
      commande = (await lireCommandeMinimale(supabase, commandeId)) ?? commande;
    }

    // Aucune préparation ni acceptation tant que le client n'a pas répondu à la
    // proposition révisée active (seul l'annullement reste possible).
    if (action !== "annuler") {
      const propositions = await lirePropositions(supabase, commandeId);
      if (propositionActiveParmi(propositions) !== null) {
        return {
          ok: false,
          erreur: {
            code: "CONFLIT_ETAT",
            message:
              "Une proposition de modification attend la réponse du client : aucune autre action n'est possible avant sa réponse ou l'échéance.",
          },
        };
      }
    }

    await appliquerTransitionStatut(supabase, commande, vers, `restaurant:${user.id}`);
    revalidatePath("/restaurant/commandes");
    revalidatePath("/restaurant");
    return { ok: true };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return { ok: false, erreur: erreur.toApi() };
    }
    return { ok: false, erreur: erreurInattendue() };
  }
}

/**
 * Crée une proposition révisée (prix, frais, conditions) : nouvelle version
 * immuable, avec échéance de réponse (voir COMMANDE_PROPOSITION_DELAI_MINUTES).
 * La commande reste en attente et aucune préparation ne reprend avant l'accord
 * du client sur cette version.
 */
export async function creerPropositionAction(
  commandeId: string,
  valeurs: ValeursProposition
): Promise<ResultatActionCommande> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");

  if (!estUuid(commandeId)) {
    return { ok: false, erreur: erreurValidationCommande() };
  }

  try {
    let commande = await lireCommandeMinimale(supabase, commandeId);
    if (!commande) {
      return {
        ok: false,
        erreur: { code: "INTROUVABLE", message: "Commande introuvable." },
      };
    }
    if (commande.restaurantId !== membership.restaurant_id) {
      return {
        ok: false,
        erreur: { code: "NON_AUTORISE", message: "Cette commande ne relève pas de votre restaurant." },
      };
    }
    if (await traiterPropositionEchue(commandeId)) {
      commande = (await lireCommandeMinimale(supabase, commandeId)) ?? commande;
    }

    await creerPropositionRevisee(supabase, commande, valeurs);
    revalidatePath("/restaurant/commandes");
    revalidatePath("/restaurant");
    return { ok: true };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) {
      return { ok: false, erreur: erreur.toApi() };
    }
    return { ok: false, erreur: erreurInattendue() };
  }
}

/**
 * Le restaurateur CONFIRME avoir reçu le paiement (« recu ») ou CONTESTE une déclaration du client (« non_recu »). Speedfood ne
 * vérifie rien : il compare, de son côté, le SMS de son opérateur. Les règles (seulement après acceptation, seul un paiement
 * déclaré peut être contesté, un paiement confirmé est définitif, le mode et la référence appartiennent au client) sont
 * imposées par le trigger `fn_valider_paiement_commande` : l'interface n'est pas la garde.
 */
export async function confirmerPaiementAction(
  commandeId: string,
  decision: "recu" | "non_recu"
): Promise<ResultatActionCommande> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  if (!estUuid(commandeId) || (decision !== "recu" && decision !== "non_recu")) {
    return { ok: false, erreur: erreurValidationCommande() };
  }
  const { data, error } = await supabase
    .from("orders")
    .update({ paiement_statut: decision })
    .eq("id", commandeId)
    .eq("restaurant_id", membership.restaurant_id)
    .select("id");
  if (error) {
    return {
      ok: false,
      erreur: { code: "CONFLIT_ETAT", message: "Ce paiement ne peut pas être modifié maintenant (commande non acceptée, paiement non déclaré ou déjà confirmé)." },
    };
  }
  if (!data || data.length === 0) {
    return { ok: false, erreur: { code: "INTROUVABLE", message: "Commande introuvable." } };
  }
  revalidatePath("/restaurant/commandes");
  revalidatePath("/restaurant");
  return { ok: true };
}
