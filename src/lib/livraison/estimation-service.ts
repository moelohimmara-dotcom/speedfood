import "server-only";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { estUuid } from "@/lib/commande/commun";
import { limiterEstimationLivraison } from "@/lib/securite/limitation-debit";
import { estimerLivraison, type DestinationLivraison } from "./lecture";

/**
 * Estimation des frais de livraison affichée avant l'envoi (voir docs/LIVRAISON.md). UN seul chemin pour le site (action serveur) et l'application
 * (`/api/v1/livraison/estimation`) ; l'identité est établie par l'appelant. Informative : à l'envoi, le serveur recalcule tout et compare avec ce que le
 * client a vu (`fraisAffiches`).
 */
export type EstimationPublique =
  | { statut: "non_calcule" }
  | { statut: "ok"; fraisGnf: number; distanceKm: number; gratuite: boolean; dureeMinutes: number; libelle: string }
  | { statut: "erreur"; message: string };

export async function estimerPourClient(restaurantId: unknown, destination: unknown, sousTotalGnf: unknown): Promise<EstimationPublique> {
  if (typeof restaurantId !== "string" || !estUuid(restaurantId) || typeof sousTotalGnf !== "number" || !Number.isSafeInteger(sousTotalGnf) || sousTotalGnf < 0) {
    return { statut: "erreur", message: "Demande invalide." };
  }

  let propre: DestinationLivraison | null = null;
  if (destination && typeof destination === "object") {
    const d = destination as { latitude?: unknown; longitude?: unknown; quartierId?: unknown };
    if (typeof d.latitude === "number" && typeof d.longitude === "number") {
      propre = { latitude: d.latitude, longitude: d.longitude };
    } else if (typeof d.quartierId === "string" && estUuid(d.quartierId)) {
      propre = { quartierId: d.quartierId };
    }
  }

  try {
    await limiterEstimationLivraison();
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { statut: "erreur", message: erreur.message };
    return { statut: "erreur", message: "Réessayez dans un instant." };
  }

  const e = await estimerLivraison(restaurantId, propre, sousTotalGnf);
  if (e.statut === "ok") {
    return { statut: "ok", fraisGnf: e.fraisGnf, distanceKm: e.distanceKm, gratuite: e.gratuite, dureeMinutes: e.dureeMinutes, libelle: e.libelle };
  }
  if (e.statut === "erreur") return { statut: "erreur", message: e.message };
  return { statut: "non_calcule" };
}
