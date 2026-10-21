import "server-only";
import { ErreurMetier, type ErreurApi } from "@/lib/contracts/erreurs";
import type { ResultatActionCommande, ValeursProposition } from "@/lib/contracts/commande";
import type { StatutCommande } from "@/lib/contracts/statuts";
import type { ClientCommandeDb } from "./commun";
import { estUuid } from "./commun";
import { lirePropositions, propositionActiveParmi, traiterPropositionEchue, creerPropositionRevisee } from "./propositions";
import { appliquerTransitionStatut, lireCommandeMinimale } from "./transitions";

/**
 * Actions du restaurant sur une commande, UN seul chemin pour la console du site (actions serveur, session du membre) et l'application native
 * (`/api/v1/restaurant/*`, jeton porteur). Le client `db` est TOUJOURS lié à l'identité du membre (RLS) : la base reste l'autorité, sans élévation de
 * clé de service ; le contrôle `restaurant_id` ci-dessous est une défense en profondeur. L'identité du membre et son restaurant arrivent DÉJÀ établis.
 */

export type ActionStatutCommande = "accepter" | "refuser" | "prete" | "terminee" | "annuler";

function erreurInattendue(): ErreurApi {
  return { code: "ERREUR_SERVEUR", message: "Une erreur est survenue. Réessayez dans un instant." };
}

const CIBLES: Record<ActionStatutCommande, StatutCommande> = {
  accepter: "acceptee",
  refuser: "refusee",
  prete: "prete",
  terminee: "terminee",
  annuler: "annulee",
};

/**
 * Applique une action de la machine à états. Toute transition invalide est rejetée côté serveur, historisée dans `order_status_events`, et revalidée par le
 * trigger de base. Aucune acceptation ni préparation tant que le client n'a pas répondu à une proposition révisée active (seule l'annulation reste possible).
 */
export async function traiterCommande(
  db: ClientCommandeDb,
  utilisateurId: string,
  restaurantId: string,
  commandeId: string,
  action: string
): Promise<ResultatActionCommande> {
  const vers = (CIBLES as Record<string, StatutCommande | undefined>)[action];
  if (!estUuid(commandeId) || !vers) return { ok: false, erreur: { code: "VALIDATION", message: "Commande invalide." } };

  try {
    // L'appartenance est vérifiée AVANT tout traitement en clé serveur ; une proposition échue est ensuite traitée par le système et la commande relue.
    let commande = await lireCommandeMinimale(db, commandeId);
    if (!commande) return { ok: false, erreur: { code: "INTROUVABLE", message: "Commande introuvable." } };
    if (commande.restaurantId !== restaurantId) {
      return { ok: false, erreur: { code: "NON_AUTORISE", message: "Cette commande ne relève pas de votre restaurant." } };
    }
    if (await traiterPropositionEchue(commandeId)) {
      commande = (await lireCommandeMinimale(db, commandeId)) ?? commande;
    }
    if (action !== "annuler") {
      const propositions = await lirePropositions(db, commandeId);
      if (propositionActiveParmi(propositions) !== null) {
        return {
          ok: false,
          erreur: {
            code: "CONFLIT_ETAT",
            message: "Une proposition de modification attend la réponse du client : aucune autre action n'est possible avant sa réponse ou l'échéance.",
          },
        };
      }
    }
    await appliquerTransitionStatut(db, commande, vers, `restaurant:${utilisateurId}`);
    return { ok: true };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.toApi() };
    return { ok: false, erreur: erreurInattendue() };
  }
}

/** Crée une proposition révisée (prix, frais, conditions) : nouvelle version immuable avec échéance de réponse ; la commande reste en attente. */
export async function proposerRevision(db: ClientCommandeDb, restaurantId: string, commandeId: string, valeurs: ValeursProposition): Promise<ResultatActionCommande> {
  if (!estUuid(commandeId)) return { ok: false, erreur: { code: "VALIDATION", message: "Commande invalide." } };
  try {
    let commande = await lireCommandeMinimale(db, commandeId);
    if (!commande) return { ok: false, erreur: { code: "INTROUVABLE", message: "Commande introuvable." } };
    if (commande.restaurantId !== restaurantId) {
      return { ok: false, erreur: { code: "NON_AUTORISE", message: "Cette commande ne relève pas de votre restaurant." } };
    }
    if (await traiterPropositionEchue(commandeId)) {
      commande = (await lireCommandeMinimale(db, commandeId)) ?? commande;
    }
    await creerPropositionRevisee(db, commande, valeurs);
    return { ok: true };
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.toApi() };
    return { ok: false, erreur: erreurInattendue() };
  }
}
