import type { SupabaseClient } from "@supabase/supabase-js";
import { etatDisponibilite } from "@speedfood/shared/disponibilite/etat";
import type { ReglagesAEcrire, ReponseReglagesRestaurant, StatutDemande } from "@speedfood/shared/contracts/restaurant-service";

/**
 * Statut du service, réglages et plats à reconfirmer (lot D4a), comme `apps/web/src/app/api/v1/restaurant/{statut,reglages}/route.ts` (les routes du site portent cette logique
 * en ligne : elle est reprise ici, requête pour requête, sans toucher au site). TOUTES les lectures et écritures reçoivent le client lié au jeton du membre (RLS) et filtrent
 * en plus sur le restaurant du compte (`restaurantId` vient de l'appartenance, jamais du corps). Aucune colonne autre que celles écrites ci-dessous n'est jamais envoyée.
 *
 * La règle « plat à reconfirmer » n'est PAS recopiée : c'est `etatDisponibilite` (règle partagée) appliquée au seuil de fraîcheur global fourni par l'appelant.
 */

/** Lit les réglages et les plats à reconfirmer. `null` = illisible (la route répond 500). */
export async function lireReglagesRestaurant(db: SupabaseClient, restaurantId: string, fraicheurHeures: number, maintenant: Date = new Date()): Promise<ReponseReglagesRestaurant | null> {
  try {
    const [restaurant, plats] = await Promise.all([
      db.from("restaurants").select("horaires, ouvert, accepte_commandes, delai_preparation_minutes").eq("id", restaurantId).maybeSingle(),
      db
        .from("menu_items")
        .select("id, nom, disponible, disponibilite_confirmee_le")
        .eq("restaurant_id", restaurantId)
        .is("archive_le", null)
        .eq("disponible", true)
        .limit(500),
    ]);
    if (restaurant.error || !restaurant.data || plats.error) return null;
    const aReconfirmer = (plats.data ?? [])
      .map((plat) => ({
        id: plat.id as string,
        nom: plat.nom as string,
        etat: etatDisponibilite({ disponible: Boolean(plat.disponible), confirmeLe: (plat.disponibilite_confirmee_le as string | null) ?? null }, fraicheurHeures, maintenant),
      }))
      .filter((entree) => entree.etat.type === "a_confirmer")
      .map((entree) => ({ id: entree.id, nom: entree.nom, confirmeLe: entree.etat.type === "a_confirmer" ? (entree.etat.confirmeLe?.toISOString() ?? null) : null }));
    return {
      ok: true,
      horaires: (restaurant.data.horaires as string | null) ?? "",
      ouvert: Boolean(restaurant.data.ouvert),
      accepteCommandes: Boolean(restaurant.data.accepte_commandes),
      delaiPreparationMinutes: (restaurant.data.delai_preparation_minutes as number | null) ?? null,
      platsAReconfirmer: aReconfirmer,
    };
  } catch {
    return null;
  }
}

/**
 * Un seul interrupteur à la fois, vers SA colonne. L'heure du changement est posée par la base (trigger), jamais ici. `true` seulement si la base a confirmé qu'une ligne
 * de CE restaurant a été modifiée (`select("id")` non vide).
 */
export async function ecrireStatutRestaurant(db: SupabaseClient, restaurantId: string, demande: StatutDemande): Promise<boolean> {
  const maj = demande.champ === "ouvert" ? { ouvert: demande.valeur } : { accepte_commandes: demande.valeur };
  const { data, error } = await db.from("restaurants").update(maj).eq("id", restaurantId).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

/** Horaires et/ou délai de préparation, et RIEN d'autre (les colonnes sont choisies une à une : pas d'assignation de masse). `true` seulement si la base a confirmé. */
export async function ecrireReglagesRestaurant(db: SupabaseClient, restaurantId: string, valeurs: ReglagesAEcrire): Promise<boolean> {
  const maj: { horaires?: string; delai_preparation_minutes?: number | null } = {};
  if (valeurs.horaires !== undefined) maj.horaires = valeurs.horaires;
  if (valeurs.delaiPreparationMinutes !== undefined) maj.delai_preparation_minutes = valeurs.delaiPreparationMinutes;
  if (Object.keys(maj).length === 0) return false;
  const { data, error } = await db.from("restaurants").update(maj).eq("id", restaurantId).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}
