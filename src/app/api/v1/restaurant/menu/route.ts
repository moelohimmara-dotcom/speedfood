import { lireMenu } from "@/lib/menu/service-menu";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/** Menu du restaurant du compte (plats non archivés, avec suppléments et dernière confirmation de disponibilité), lu avec l'identité du membre. */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  try {
    return repondre({ ok: true, ...(await lireMenu(auth.contexte.supabase, auth.contexte.restaurantId)) });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible de charger le menu. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
