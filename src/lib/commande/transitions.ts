import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { transitionAutorisee, type StatutCommande } from "@/lib/contracts/statuts";
import type { EtatDeriveCommande, PropositionRevisee } from "@/lib/contracts/commande";
import type { ClientCommandeDb } from "./commun";
import { versStatutCommande } from "./commun";

/**
 * Transitions de statut de commande (TDR.md §6, statuts.ts).
 *
 * La validation est faite ici en amont (`transitionAutorisee`) pour des
 * messages compréhensibles, et une seconde fois côté base par le trigger
 * `fn_valider_transition_commande` (défense en profondeur) : même un accès
 * direct à la table ne peut pas produire une transition invalide. Chaque
 * transition écrit une ligne dans `order_status_events`.
 */

export interface CommandeMinimale {
  id: string;
  statut: StatutCommande;
  restaurantId: string;
  sousTotal: number;
  fraisLivraisonEstime: number;
}

export async function lireCommandeMinimale(
  db: ClientCommandeDb,
  commandeId: string
): Promise<CommandeMinimale | null> {
  const { data, error } = await db
    .from("orders")
    .select("id, statut, restaurant_id, sous_total, frais_livraison_estime")
    .eq("id", commandeId)
    .maybeSingle();

  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de lire la commande. Réessayez.");
  }
  if (!data) {
    return null;
  }
  return {
    id: data.id,
    statut: versStatutCommande(data.statut),
    restaurantId: data.restaurant_id,
    sousTotal: data.sous_total,
    fraisLivraisonEstime: data.frais_livraison_estime,
  };
}

export async function enregistrerEvenementStatut(
  db: ClientCommandeDb,
  evenement: {
    commandeId: string;
    statutPrecedent: StatutCommande | null;
    statutSuivant: StatutCommande;
    acteur: string;
  }
): Promise<void> {
  const { error } = await db.from("order_status_events").insert({
    order_id: evenement.commandeId,
    statut_precedent: evenement.statutPrecedent,
    statut_suivant: evenement.statutSuivant,
    acteur: evenement.acteur,
  });
  if (error) {
    throw new ErreurMetier("ERREUR_SERVEUR", "Transition appliquée mais non historisée. Réessayez.");
  }
}

/**
 * Applique une transition validée et l'historise. `acteur` est une chaîne sans
 * donnée personnelle ni jeton : `restaurant:<utilisateur_id>`, `client:<reference>`
 * ou `systeme:<motif>`.
 */
export async function appliquerTransitionStatut(
  db: ClientCommandeDb,
  commande: { id: string; statut: StatutCommande },
  vers: StatutCommande,
  acteur: string
): Promise<void> {
  if (!transitionAutorisee(commande.statut, vers)) {
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      `Transition impossible : la commande est « ${commande.statut} » et ne peut pas devenir « ${vers} ».`,
      { statut: "La commande a changé d'état. Rechargez la page." }
    );
  }

  const { error } = await db.from("orders").update({ statut: vers }).eq("id", commande.id);
  if (error) {
    // Le trigger de base rejette aussi les transitions invalides (course entre
    // deux traitements simultanés, par exemple).
    throw new ErreurMetier(
      "CONFLIT_ETAT",
      "La commande a changé d'état entre-temps. Rechargez la page et réessayez."
    );
  }

  await enregistrerEvenementStatut(db, {
    commandeId: commande.id,
    statutPrecedent: commande.statut,
    statutSuivant: vers,
    acteur,
  });
}

/**
 * État dérivé affiché : `attente_confirmation_client` quand la commande est
 * `en_attente` et qu'une proposition révisée active attend la réponse du client
 * (schéma gelé : cet état n'existe pas dans la table `orders`).
 */
export function calculerEtatDerive(
  statut: StatutCommande,
  propositionActive: PropositionRevisee | null
): EtatDeriveCommande {
  if (statut === "en_attente" && propositionActive !== null) {
    return "attente_confirmation_client";
  }
  return statut;
}
