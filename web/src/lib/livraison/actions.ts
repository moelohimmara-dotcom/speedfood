"use server";

import { creerClientServeur } from "@/lib/db/server";
import type { DestinationLivraison } from "./lecture";
import { estimerPourClient, type EstimationPublique } from "./estimation-service";

export type { EstimationPublique };

/**
 * Estimation des frais de livraison affichée dans le formulaire de commande du site (voir docs/LIVRAISON.md). Le calcul est partagé avec l'application
 * native (`estimation-service.ts`) ; ici seule l'identité (session du site) est vérifiée.
 */
export async function estimerLivraisonAction(
  restaurantId: string,
  destination: DestinationLivraison | null,
  sousTotalGnf: number
): Promise<EstimationPublique> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  if (!user) return { statut: "erreur", message: "Connectez-vous pour calculer la livraison." };
  return estimerPourClient(restaurantId, destination, sousTotalGnf);
}
