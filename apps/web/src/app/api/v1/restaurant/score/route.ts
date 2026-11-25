import { repondre, repondreErreur } from "@/lib/api/v1";
import { restaurantAuthentifie } from "@/lib/api/v1-restaurant";
import { creerClientAdmin } from "@/lib/db/admin";

/**
 * Score qualité mensuel de CE restaurant, pour l'application : le mois le plus récent calculé, ou `score: null` avant le premier calcul.
 * Lecture seule. La table des scores est réservée au serveur (aucune policy), donc la lecture passe par le client de service, mais seulement
 * après que `restaurantAuthentifie` a prouvé l'appartenance : jamais un autre restaurant que le sien.
 */
export async function GET(request: Request) {
  const auth = await restaurantAuthentifie(request);
  if (!auth.ok) return auth.reponse;
  const { restaurantId } = auth.contexte;
  const admin = creerClientAdmin();
  const { data, error } = await admin
    .from("scores_qualite_mensuels" as never)
    .select("mois, score, palier, indicateurs, mois_bas_consecutifs")
    .eq("restaurant_id", restaurantId)
    .order("mois", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return repondreErreur({ code: "ERREUR_SERVEUR", message: "Votre score n'a pas pu être chargé. Réessayez dans un instant." });
  if (!data) return repondre({ ok: true, score: null });
  const ligne = data as unknown as { mois: string; score: number; palier: string; indicateurs: Record<string, unknown>; mois_bas_consecutifs: number };
  const ind = ligne.indicateurs ?? {};
  const nombreOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return repondre({
    ok: true,
    score: {
      mois: ligne.mois,
      score: ligne.score,
      palier: ligne.palier,
      moisBasConsecutifs: ligne.mois_bas_consecutifs,
      indicateurs: {
        acceptationDelai: nombreOuNull(ind.acceptationDelai),
        preparationTenue: nombreOuNull(ind.preparationTenue),
        exactitude: nombreOuNull(ind.exactitude),
        note: nombreOuNull(ind.note),
        ficheComplete: nombreOuNull(ind.ficheComplete),
        disponibilite: nombreOuNull(ind.disponibilite),
      },
    },
  });
}

export const dynamic = "force-dynamic";
