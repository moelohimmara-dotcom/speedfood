import { lireCorpsJson, repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";

/**
 * Statuts opérationnels du restaurant : « ouvert » et « accepte_commandes » (il prend des commandes en ce moment). Enregistré seulement après confirmation de la
 * base ; l'heure du changement est posée par la base (trigger), jamais par l'application. Écriture avec l'identité du membre : la RLS décide.
 */
export async function POST(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const lu = await lireCorpsJson(request);
  if (!lu.ok) return lu.reponse;
  const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { champ?: unknown; valeur?: unknown };
  if ((corps.champ !== "ouvert" && corps.champ !== "accepte_commandes") || typeof corps.valeur !== "boolean") {
    return repondreErreur({ code: "VALIDATION", message: "Statut inconnu." });
  }
  const { supabase, restaurantId } = auth.contexte;
  const { data, error } = await supabase
    .from("restaurants")
    .update(corps.champ === "ouvert" ? { ouvert: corps.valeur } : { accepte_commandes: corps.valeur })
    .eq("id", restaurantId)
    .select("id");
  if (error || !data || data.length === 0) {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer le changement. Réessayez dans un instant." });
  }
  return repondre({ ok: true });
}

export const dynamic = "force-dynamic";
