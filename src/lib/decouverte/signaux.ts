import "server-only";
import { clientLivraison } from "@/lib/livraison/lecture";
import { POIDS_PAR_DEFAUT, poidsValides, prixMedian, type EntreeClassement, type PoidsClassement } from "./recommandation";
import type { PlatPublic } from "./classement";
import { lireTout } from "@/lib/db/lecture-complete";

/**
 * Signaux du classement « recommandés » (note, prix, fréquentation) — voir docs/NOTATION.md §9.
 *
 * Lecture TOLÉRANTE : tant que la migration de notation n'est pas appliquée, ou si une lecture échoue, le signal manquant vaut 0 (donc
 * neutre dans le classement) et le catalogue continue de s'afficher. Aucune erreur ne remonte au visiteur.
 */

const FENETRE_PAR_DEFAUT_JOURS = 30;

export interface SignauxClassement {
  entrees: Map<string, EntreeClassement>;
  poids: PoidsClassement;
}

function prixTypiqueDe(plats: PlatPublic[]): number | null {
  return prixMedian(plats.filter((p) => p.disponible).map((p) => p.prixPromo ?? p.prix));
}

export async function lireSignauxClassement(
  idsRestaurants: string[],
  platsParRestaurant: Map<string, PlatPublic[]>
): Promise<SignauxClassement> {
  const avis = new Map<string, { somme: number; total: number }>();
  const commandes = new Map<string, number>();
  let poids = POIDS_PAR_DEFAUT;

  try {
    const supabase = clientLivraison();

    const { data: reglages } = await supabase
      .from("parametres_classement")
      .select("poids_note, poids_prix, poids_frequentation, fenetre_frequentation_jours")
      .eq("id", true)
      .maybeSingle();
    const fenetre = Number(reglages?.fenetre_frequentation_jours) || FENETRE_PAR_DEFAUT_JOURS;
    if (reglages) {
      const lus = { note: reglages.poids_note, prix: reglages.poids_prix, frequentation: reglages.poids_frequentation };
      if (poidsValides(lus)) poids = lus;
    }

    const [{ data: notes }, { data: frequentation }] = await Promise.all([
      // Tous les restaurants par pages, puis filtre local : un `.in(id, …)` avec des milliers d'identifiants dépasserait la longueur d'une adresse.
      lireTout((de, a) => supabase.from("restaurants").select("id, avis_somme, avis_total").order("id").range(de, a)),
      supabase.rpc("fn_frequentation_restaurants", { p_jours: fenetre }),
    ]);
    const retenus = new Set(idsRestaurants);
    for (const n of (notes ?? []) as { id: string; avis_somme: number; avis_total: number }[]) {
      if (!retenus.has(n.id)) continue;
      avis.set(n.id, { somme: n.avis_somme ?? 0, total: n.avis_total ?? 0 });
    }
    for (const f of (frequentation ?? []) as { restaurant_id: string; commandes: number }[]) {
      commandes.set(f.restaurant_id, f.commandes);
    }
  } catch {
    // Signaux indisponibles : classement neutre.
  }

  const entrees = new Map<string, EntreeClassement>();
  for (const id of idsRestaurants) {
    const a = avis.get(id);
    entrees.set(id, {
      id,
      avisSomme: a?.somme ?? 0,
      avisTotal: a?.total ?? 0,
      prixTypique: prixTypiqueDe(platsParRestaurant.get(id) ?? []),
      commandes: commandes.get(id) ?? 0,
    });
  }
  return { entrees, poids };
}
