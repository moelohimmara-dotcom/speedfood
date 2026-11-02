import "server-only";
import { NextResponse, after } from "next/server";
import { notifierRestaurant } from "@/lib/push/envoi";
import { CLE_JETON_ALERTE, traiterAlerteInterne } from "@/lib/api/alerte-interne";
import { lireCorpsJson, repondre } from "@/lib/api/v1";

/**
 * Appelée UNIQUEMENT depuis le Worker lui-même, par la RPC `JetonsCommande.alerter` (appel direct au gestionnaire OpenNext) : toute requête externe vers
 * `/api/v1/interne/*` est refusée en 404 par `worker-entree.js`. En plus, le jeton `x-alerte-interne` (aléatoire, propre à l'isolat) est exigé. Corps :
 * {"restaurantId":"<uuid>"}. L'envoi FCM + push web est planifié après la réponse (`after`). Jamais de cookie, jamais de relais.
 */
export async function POST(request: Request) {
  const reponse = await traiterAlerteInterne(
    {
      attendu: (globalThis as Record<symbol, unknown>)[CLE_JETON_ALERTE] as string | undefined,
      recu: request.headers.get("x-alerte-interne"),
      lireCorps: async () => {
        const lu = await lireCorpsJson(request);
        if (!lu.ok) throw new Error();
        return lu.corps;
      },
    },
    after,
    notifierRestaurant
  );
  if (reponse.corps === null) return new NextResponse(null, { status: reponse.statut, headers: { "Cache-Control": "no-store" } });
  return repondre(reponse.corps, reponse.statut);
}

export const dynamic = "force-dynamic";
