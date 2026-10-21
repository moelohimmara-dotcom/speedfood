import { chargerApercusCommandes } from "@/lib/commande/requetes";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/**
 * Commandes du restaurant du compte pour l'application : toutes celles qui attendent une action, plus un historique récent (20). Lecture avec l'identité du
 * membre : la RLS décide de ce qui est visible. Le jeton du reçu (clé de lecture d'un document) n'est jamais envoyé à l'application.
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { supabase, restaurantId } = auth.contexte;
  try {
    const [commandes, restaurant] = await Promise.all([
      chargerApercusCommandes(supabase, restaurantId, { historique: 20 }),
      supabase.from("restaurants").select("id, nom, ouvert, accepte_commandes").eq("id", restaurantId).maybeSingle(),
    ]);
    return repondre({
      ok: true,
      restaurant: restaurant.data ? { id: restaurant.data.id, nom: restaurant.data.nom, ouvert: restaurant.data.ouvert, accepteCommandes: restaurant.data.accepte_commandes } : null,
      commandes: commandes.map((c) => {
        const { jetonRecu: _jetonRecu, ...sansJeton } = c;
        void _jetonRecu;
        return sansJeton;
      }),
    });
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return repondreErreur(erreur.toApi());
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible de charger les commandes. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
