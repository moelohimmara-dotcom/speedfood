import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { etapeDegradation, type EtapeDegradation, type IndicateursScore, type PalierScore } from "./score-qualite";

/**
 * Lecture des scores qualité pour la console équipe : le mois le plus récent calculé, restaurants
 * triés du palier le plus faible au plus fort (ceux qui demandent attention d'abord), puis score
 * croissant. Aucune écriture : l'affichage ne recalcule jamais un score.
 */

export interface LigneScoreEquipe {
  restaurantId: string;
  nom: string;
  score: number;
  palier: PalierScore;
  indicateurs: IndicateursScore;
  moisBasConsecutifs: number;
  etape: EtapeDegradation;
}

const ORDRE_PALIER: Record<PalierScore, number> = { mauvais: 0, moyen: 1, bon: 2, tres_bon: 3, excellent: 4 };

/**
 * Promotions suspendues au palier le plus bas : vrai si le dernier score calculé du restaurant est « mauvais ».
 * En cas d'illisibilité, on laisse passer plutôt que bloquer un menu.
 */
export async function promotionsSuspenduesPour(restaurantId: string): Promise<boolean> {
  try {
    const admin = creerClientAdmin();
    const { data, error } = await admin
      .from("scores_qualite_mensuels" as never)
      .select("palier")
      .eq("restaurant_id", restaurantId)
      .order("mois", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    return (data as unknown as { palier: string }).palier === "mauvais";
  } catch {
    return false;
  }
}

export async function lireDerniersScores(): Promise<{ mois: string | null; lignes: LigneScoreEquipe[] }> {
  const admin = creerClientAdmin();
  const { data: dernier, error: erreurMois } = await admin
    .from("scores_qualite_mensuels" as never)
    .select("mois")
    .order("mois", { ascending: false })
    .limit(1);
  if (erreurMois) throw new Error("scores_lecture_impossible");
  const mois = (dernier as unknown as Array<{ mois: string }> | null)?.[0]?.mois ?? null;
  if (!mois) return { mois: null, lignes: [] };

  const { data, error } = await admin
    .from("scores_qualite_mensuels" as never)
    .select("restaurant_id, score, palier, indicateurs, mois_bas_consecutifs")
    .eq("mois", mois)
    .limit(1000);
  if (error || !data) throw new Error("scores_lecture_impossible");
  const lignesBrutes = data as unknown as Array<{ restaurant_id: string; score: number; palier: PalierScore; indicateurs: Record<string, unknown>; mois_bas_consecutifs: number }>;
  if (lignesBrutes.length === 0) return { mois, lignes: [] };

  const { data: restos, error: erreurRestos } = await admin.from("restaurants").select("id, nom").in("id", lignesBrutes.map((l) => l.restaurant_id)).limit(1000);
  if (erreurRestos || !restos) throw new Error("scores_lecture_impossible");
  const noms = new Map((restos as unknown as Array<{ id: string; nom: string }>).map((r) => [r.id, r.nom]));

  const lignes = lignesBrutes.map((l) => {
    const ind = (l.indicateurs ?? {}) as unknown as IndicateursScore;
    return {
      restaurantId: l.restaurant_id,
      nom: noms.get(l.restaurant_id) ?? "Restaurant inconnu",
      score: l.score,
      palier: l.palier,
      indicateurs: ind,
      moisBasConsecutifs: l.mois_bas_consecutifs,
      etape: etapeDegradation(l.mois_bas_consecutifs),
    } satisfies LigneScoreEquipe;
  });
  lignes.sort((a, b) => ORDRE_PALIER[a.palier] - ORDRE_PALIER[b.palier] || a.score - b.score || a.nom.localeCompare(b.nom, "fr"));
  return { mois, lignes };
}
