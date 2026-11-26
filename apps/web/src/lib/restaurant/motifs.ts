import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * Motifs internes d'un restaurant : la correction demandée par l'équipe et le motif d'une suspension.
 * Ces deux colonnes ne sont PLUS lisibles directement (ni par la clé publique, ni par un compte connecté) : seule la fonction `fn_motifs_restaurants`
 * les rend, et seulement aux membres du restaurant et aux administrateurs système (migration 20261118120100). Une panne rend une liste vide : l'écran
 * affiche alors ce qu'il sait sans le texte (l'indicateur `correction_demandee` reste lisible), jamais une erreur qui bloquerait la page.
 */
export interface MotifsRestaurant {
  motifCorrection: string | null;
  suspenduMotif: string | null;
}

/** Nombre d'identifiants par appel (la fonction en refuse plus de 5000). */
export const IDENTIFIANTS_PAR_APPEL = 500;

type LigneMotifs = { restaurant_id: string; motif_correction: string | null; suspendu_motif: string | null };

/** Indexe les lignes reçues par identifiant de restaurant ; une ligne illisible est ignorée. */
export function indexerMotifs(lignes: readonly LigneMotifs[] | null | undefined): Map<string, MotifsRestaurant> {
  const index = new Map<string, MotifsRestaurant>();
  for (const l of lignes ?? []) {
    if (typeof l?.restaurant_id !== "string") continue;
    index.set(l.restaurant_id, {
      motifCorrection: typeof l.motif_correction === "string" && l.motif_correction !== "" ? l.motif_correction : null,
      suspenduMotif: typeof l.suspendu_motif === "string" && l.suspendu_motif !== "" ? l.suspendu_motif : null,
    });
  }
  return index;
}

export async function lireMotifsRestaurants(
  supabase: Pick<SupabaseClient<Database>, "rpc">,
  ids: readonly string[]
): Promise<Map<string, MotifsRestaurant>> {
  const sortie = new Map<string, MotifsRestaurant>();
  const uniques = [...new Set(ids)];
  for (let i = 0; i < uniques.length; i += IDENTIFIANTS_PAR_APPEL) {
    const lot = uniques.slice(i, i + IDENTIFIANTS_PAR_APPEL);
    const { data, error } = await supabase.rpc("fn_motifs_restaurants", { p_ids: lot });
    if (error) {
      console.error("motifs_restaurants_echec", error.code);
      continue;
    }
    for (const [cle, valeur] of indexerMotifs(data)) sortie.set(cle, valeur);
  }
  return sortie;
}
