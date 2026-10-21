import { estimerPourClient } from "@/lib/livraison/estimation-service";
import { lireCorpsJson, repondre, repondreErreur, utilisateurDuJeton } from "@/lib/api/v1";

/**
 * Estimation des frais de livraison pour l'application native (même calcul que le site). Compte identifié (jeton porteur) comme pour la commande ;
 * plafonnée par adresse IP. Informative : la commande recalcule tout et refuse si les frais vus à l'écran diffèrent.
 */
export async function POST(request: Request) {
  const utilisateur = await utilisateurDuJeton(request);
  if (!utilisateur) return repondreErreur({ code: "NON_AUTHENTIFIE", message: "Connectez-vous pour calculer la livraison." });

  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { restaurantId?: unknown; destination?: unknown; sousTotal?: unknown };

  return repondre({ ok: true, estimation: await estimerPourClient(corps.restaurantId, corps.destination, corps.sousTotal) });
}

export const dynamic = "force-dynamic";
