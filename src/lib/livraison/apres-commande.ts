import "server-only";
import type { StatutCommande } from "@/lib/contracts/statuts";

/**
 * Ce qui se passe côté livraison quand une commande change d'état. Appelé APRÈS la transition (jamais avant) et sans jamais
 * la faire échouer : une panne de la livraison ne doit pas empêcher un restaurant d'accepter ou de refuser une commande.
 * Import dynamique : le service de livraison lui-même fait avancer des commandes, d'où le risque d'import circulaire.
 */
export async function apresTransitionCommande(commandeId: string, vers: StatutCommande): Promise<void> {
  try {
    const service = await import("./service");
    if (vers === "acceptee") {
      await service.creerLivraisonPourCommande(commandeId);
    } else if (vers === "refusee" || vers === "annulee") {
      await service.annulerLivraisonDeCommande(commandeId);
    }
  } catch {
    console.error("livraison_apres_transition_echec");
  }
  await apresTransitionPaiement(commandeId, vers);
  await apresTransitionClient(commandeId, vers);
}

/** Notification de suivi au client connecté (si ses préférences l'autorisent et qu'il a un appareil abonné). Ne fait jamais échouer la transition. */
async function apresTransitionClient(commandeId: string, vers: StatutCommande): Promise<void> {
  try {
    const { signalerChangementCommande } = await import("@/lib/client/notifications");
    await signalerChangementCommande(commandeId, vers);
  } catch {
    console.error("client_notification_echec");
  }
}

/**
 * Paiement en ligne (mode « speedfood ») : commande terminée → libération et versements ; commande refusée ou annulée → remboursement.
 * Sans effet pour une commande qui n'a pas de paiement en ligne (la grande majorité : une seule lecture). Ne fait jamais échouer la
 * transition ; un échec est repris par l'exploitation (versements à verser, remboursement en échec visibles en base).
 */
async function apresTransitionPaiement(commandeId: string, vers: StatutCommande): Promise<void> {
  if (vers !== "terminee" && vers !== "refusee" && vers !== "annulee") return;
  try {
    const { obtenirServicePourCommande } = await import("@/lib/paiement/en-ligne/fabrique");
    const service = await obtenirServicePourCommande(commandeId);
    if (!service) return;
    if (vers === "terminee") await service.surCommandeTerminee(commandeId);
    else await service.surCommandeAnnulee(commandeId);
  } catch {
    console.error("paiement_apres_transition_echec");
  }
}
