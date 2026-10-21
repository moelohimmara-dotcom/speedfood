import { avancerMaCourse } from "@/lib/livraison/service-livreur";
import { actionLivreur } from "@/lib/api/v1-livreur";

/** Fait avancer SA course (vers le restaurant, récupérée, vers le client, livrée avec le code de remise, échec avec raison). Règles revérifiées par le service. */
export async function POST(request: Request) {
  return actionLivreur(request, (id, corps) =>
    avancerMaCourse(
      id,
      typeof corps.vers === "string" ? corps.vers : "",
      typeof corps.code === "string" ? corps.code : undefined,
      typeof corps.raison === "string" ? corps.raison : undefined
    )
  );
}

export const dynamic = "force-dynamic";
