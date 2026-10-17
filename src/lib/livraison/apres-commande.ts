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
}
