import "server-only";
import { NextResponse, after } from "next/server";
import { notifierRestaurantReservation } from "@/lib/push/reservation";
import { CLE_JETON_ALERTE, traiterAlerteInterne } from "@/lib/api/alerte-interne";
import { lireCorpsJson, repondre } from "@/lib/api/v1";

/**
 * Alerte « nouvelle demande de réservation » (lot M4c). Appelée UNIQUEMENT depuis le Worker lui-même, par la RPC `JetonsCommande.alerterReservation` : toute requête externe vers `/api/v1/interne/*` est
 * refusée en 404 par `worker-entree.js`, et le jeton `x-alerte-interne` (aléatoire, propre à l'isolat) est exigé en plus. Corps : {"restaurantId":"<uuid>"}. L'envoi (applications natives) est planifié
 * après la réponse (`after`). Jamais de cookie, jamais de relais, aucune donnée de client.
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
    notifierRestaurantReservation
  );
  if (reponse.corps === null) return new NextResponse(null, { status: reponse.statut, headers: { "Cache-Control": "no-store" } });
  return repondre(reponse.corps, reponse.statut);
}

export const dynamic = "force-dynamic";
