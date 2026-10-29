import { basculerEnLigne } from "@/lib/livraison/service-livreur";
import { actionLivreur } from "@/lib/api/v1-livreur";

/** Se mettre en ligne (disponible pour les offres) ou hors ligne ; refusé pendant une course ou si la fiche n'est pas active. */
export async function POST(request: Request) {
  return actionLivreur(request, (id, corps) => basculerEnLigne(id, corps.enLigne === true));
}

export const dynamic = "force-dynamic";
