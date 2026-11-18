import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";
import { lireMotifsRestaurants } from "@/lib/restaurant/motifs";

/**
 * État de publication du restaurant du compte, pour l'application : publié ou non, suspendu ou non, et la correction demandée par l'équipe avant publication
 * (comme le bandeau de la console du site). Lecture seule, avec l'identité du membre : la RLS décide de ce qui est visible.
 * Le texte de la correction ne se lit que par `fn_motifs_restaurants` (réservée aux membres du restaurant et à l'équipe) : jamais en lecture directe.
 * Le motif d'une suspension n'est PAS envoyé (la console du site ne le montre pas non plus au restaurateur) ; seul l'état « suspendu » l'est.
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { supabase, restaurantId } = auth.contexte;
  const { data, error } = await supabase
    .from("restaurants")
    .select("publie, suspendu_le, correction_demandee")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return repondreErreur({ code: "ERREUR_SERVEUR", message: "L'état de publication n'a pas pu être chargé. Réessayez dans un instant." });
  const ligne = data as { publie: boolean; suspendu_le: string | null; correction_demandee: boolean };
  const motif = ligne.correction_demandee ? (await lireMotifsRestaurants(supabase, [restaurantId])).get(restaurantId)?.motifCorrection ?? null : null;
  return repondre({
    ok: true,
    etat: {
      publie: ligne.publie === true && ligne.suspendu_le === null,
      suspendu: ligne.suspendu_le !== null,
      correctionDemandee: ligne.correction_demandee === true,
      motifCorrection: motif,
    },
  });
}

export const dynamic = "force-dynamic";
