import "server-only";
import { NextResponse, after } from "next/server";
import { notifierClientReservation } from "@/lib/push/reservation";
import { CLE_JETON_ALERTE, traiterMessageReservationInterne } from "@/lib/api/alerte-interne";
import { lireCorpsJson, repondre } from "@/lib/api/v1";

/**
 * Message au client après la réponse du restaurant à sa réservation (lot M4c). Appelée UNIQUEMENT depuis le Worker lui-même, par la RPC `JetonsCommande.prevenirClientReservation` : toute requête externe
 * vers `/api/v1/interne/*` est refusée en 404 par `worker-entree.js`, et le jeton `x-alerte-interne` (aléatoire, propre à l'isolat) est exigé en plus. Corps :
 * {"reservationId":"<uuid>","statut":"confirmee"|"refusee"|"annulee_restaurant"}. Le compte du client est relu ici, jamais reçu. L'envoi est planifié après la réponse (`after`). Jamais de cookie ni de relais.
 */
export async function POST(request: Request) {
  const reponse = await traiterMessageReservationInterne(
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
    notifierClientReservation
  );
  if (reponse.corps === null) return new NextResponse(null, { status: reponse.statut, headers: { "Cache-Control": "no-store" } });
  return repondre(reponse.corps, reponse.statut);
}

export const dynamic = "force-dynamic";
