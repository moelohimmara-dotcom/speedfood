"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { estUuid } from "@/lib/commande/commun";
import { creerClientServeur } from "@/lib/db/server";
import { limiterEstimationLivraison } from "@/lib/securite/limitation-debit";
import { estimerLivraison, type DestinationLivraison } from "./lecture";

/**
 * Estimation des frais de livraison affichée dans le formulaire de commande (voir docs/LIVRAISON.md).
 * Informative : à l'envoi, le serveur recalcule tout et compare avec ce que le client a vu (`fraisAffiches`).
 */
export type EstimationPublique =
  | { statut: "non_calcule" }
  | { statut: "ok"; fraisGnf: number; distanceKm: number; gratuite: boolean; dureeMinutes: number; libelle: string }
  | { statut: "erreur"; message: string };

export async function estimerLivraisonAction(
  restaurantId: string,
  destination: DestinationLivraison | null,
  sousTotalGnf: number
): Promise<EstimationPublique> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { statut: "erreur", message: "Connectez-vous pour calculer la livraison." };
  if (!estUuid(restaurantId) || !Number.isSafeInteger(sousTotalGnf) || sousTotalGnf < 0) {
    return { statut: "erreur", message: "Demande invalide." };
  }

  let propre: DestinationLivraison | null = null;
  if (destination && typeof destination === "object") {
    if (typeof destination.latitude === "number" && typeof destination.longitude === "number") {
      propre = { latitude: destination.latitude, longitude: destination.longitude };
    } else if (estUuid(destination.quartierId)) {
      propre = { quartierId: destination.quartierId as string };
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
