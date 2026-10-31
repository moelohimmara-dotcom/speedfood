import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { clientAuthentifie } from "@/lib/api/v1-client";
import { basculerFavoriClient } from "@/lib/client/espace-service";

/** Ajoute ou retire un restaurant des favoris du compte connecté (`restaurantId`) ; renvoie le nouvel état. */
export async function POST(request: Request) {
  const auth = await clientAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const c = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as Record<string, unknown>;
  const r = await basculerFavoriClient(auth.utilisateurId, c.restaurantId);
  return r.ok ? repondre({ ok: true, message: r.message, favori: r.favori === true }) : repondreErreur({ code: "VALIDATION", message: r.message });
}

export const dynamic = "force-dynamic";
