import { repondreOffreLivreur } from "@/lib/livraison/service-livreur";
import { actionLivreur } from "@/lib/api/v1-livreur";

/** Accepter ou refuser l'offre de course reçue ; une offre expirée ou attribuée à quelqu'un d'autre est refusée par le service. */
export async function POST(request: Request) {
  return actionLivreur(request, (id, corps) => repondreOffreLivreur(id, typeof corps.offreId === "string" ? corps.offreId : "", typeof corps.reponse === "string" ? corps.reponse : ""));
}

export const dynamic = "force-dynamic";
