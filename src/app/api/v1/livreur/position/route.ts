import { envoyerPosition } from "@/lib/livraison/service-livreur";
import { actionLivreur } from "@/lib/api/v1-livreur";

/** Position du livreur (bornée à la Guinée et ses environs, au plus une mise à jour toutes les 4 secondes). Seule la dernière position est gardée. */
export async function POST(request: Request) {
  return actionLivreur(request, (id, corps) =>
    typeof corps.latitude === "number" && typeof corps.longitude === "number"
      ? envoyerPosition(id, corps.latitude, corps.longitude)
      : Promise.resolve({ ok: false as const, message: "Position invalide." })
  );
}

export const dynamic = "force-dynamic";
