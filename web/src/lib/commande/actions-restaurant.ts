"use server";

import { revalidatePath } from "next/cache";
import type { ResultatActionCommande, ValeursProposition } from "@/lib/contracts/commande";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { confirmerPaiement, emettreDocument } from "./service-paiement";
import { proposerRevision, traiterCommande, type ActionStatutCommande } from "./service-restaurant";

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

export type { ActionStatutCommande };

/**
 * Applique une action de la machine à états (accepter/refuser/prete/terminee/annuler) pour le membre connecté ; les règles sont dans
 * `service-restaurant.ts`, partagé avec l’application native.
 */
export async function traiterCommandeAction(commandeId: string, action: ActionStatutCommande): Promise<ResultatActionCommande> {
  const { supabase, user, membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  const resultat = await traiterCommande(supabase, user.id, membership.restaurant_id, commandeId, action);
  if (resultat.ok) {
    revalidatePath("/restaurant/commandes");
    revalidatePath("/restaurant");
  }
  return resultat;
}

/**
 * Crée une proposition révisée (prix, frais, conditions) : nouvelle version immuable, avec échéance de réponse (voir COMMANDE_PROPOSITION_DELAI_MINUTES).
 * La commande reste en attente et aucune préparation ne reprend avant l’accord du client sur cette version.
 */
export async function creerPropositionAction(commandeId: string, valeurs: ValeursProposition): Promise<ResultatActionCommande> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  const resultat = await proposerRevision(supabase, membership.restaurant_id, commandeId, valeurs);
  if (resultat.ok) {
    revalidatePath("/restaurant/commandes");
    revalidatePath("/restaurant");
  }
  return resultat;
}

/**
 * Le restaurateur CONFIRME avoir reçu le paiement (« recu ») ou CONTESTE une déclaration du client (« non_recu »). Règles dans `service-paiement.ts`
 * (partagé avec l’application native) et dans le trigger de base : l’interface n’est pas la garde.
 */
export async function confirmerPaiementAction(commandeId: string, decision: "recu" | "non_recu"): Promise<ResultatActionCommande> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/commandes");
  const resultat = await confirmerPaiement(supabase, membership.restaurant_id, commandeId, decision);
  if (resultat.ok) {
    revalidatePath("/restaurant/commandes");
    revalidatePath("/restaurant");
  }
  return resultat;
}

/** Le restaurateur établit un reçu (après paiement confirmé) ou une facture (dès l’acceptation) pour une commande. Demander deux fois le même document renvoie le premier. */
export async function emettreDocumentAction(commandeId: string, type: "recu" | "facture"): Promise<ResultatActionCommande> {
  const { supabase } = await obtenirContexteRestaurant("/restaurant/commandes");
  const resultat = await emettreDocument(supabase, commandeId, type);
  if (resultat.ok) {
    revalidatePath("/restaurant/commandes");
    revalidatePath("/restaurant/documents");
  }
  return resultat;
}
