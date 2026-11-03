import { ErreurMetier } from "@/lib/contracts/erreurs";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";
import { lireCommandesRestaurant } from "@/lib/api/restaurant-commandes";

/**
 * Commandes du restaurant du compte pour l'application : toutes celles qui attendent une action, plus un historique récent (20). Lecture avec l'identité du
 * membre : la RLS décide de ce qui est visible.
 *
 * La lecture et la projection (statut de paiement, numéros de document, liens WhatsApp prérenseignés, jeton du reçu jamais envoyé) sont partagées avec l'API
 * unique : voir `lib/api/restaurant-commandes.ts` et `restaurant-commandes-projection.ts`.
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { supabase, restaurantId } = auth.contexte;
  try {
    return repondre(await lireCommandesRestaurant(supabase, restaurantId, new URL(request.url).origin));
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible de charger les commandes. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
