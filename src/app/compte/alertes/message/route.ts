import { creerClientServeur } from "@/lib/db/server";
import { lireProchaineNotification } from "@/lib/client/notifications";

export const dynamic = "force-dynamic";

/**
 * Texte de la prochaine notification du client, demandé par SON Service Worker au moment où le push (vide) arrive. Authentifié par la session
 * (cookies) : rien n'est lisible sans être connecté, et chacun ne reçoit que SES notifications. Jamais mis en cache.
 */
export async function GET(): Promise<Response> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  const entetes = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!user) return new Response(JSON.stringify({ contenu: null }), { status: 401, headers: entetes });
  const contenu = await lireProchaineNotification(user.id);
  return new Response(JSON.stringify({ contenu }), { status: 200, headers: entetes });
}
