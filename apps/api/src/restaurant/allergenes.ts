import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResultatActionCommande } from "@speedfood/shared/contracts/commande";
import type { Allergene } from "@speedfood/shared/menu/classement-personnalise";

/**
 * Déclaration des allergènes d'un plat par son restaurant. Écriture avec le client du JETON (RLS) filtrée sur le restaurant du contexte et le plat non archivé : un plat d'un autre
 * restaurant est « inconnu ». Écriture CONFIRMÉE (une ligne modifiée, jamais « ok » sur zéro ligne). Les deux colonnes s'écrivent ensemble : une déclaration porte sa date, son retrait
 * (`null`) efface les deux. Aucune autre colonne n'est touchée.
 */
const PLAT_INCONNU: ResultatActionCommande = { ok: false, erreur: { code: "VALIDATION", message: "Plat inconnu." } };
const PANNE: ResultatActionCommande = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer les allergènes. Réessayez dans un instant." } };

export async function definirAllergenesPlat(db: SupabaseClient, restaurantId: string, platId: string, allergenes: readonly Allergene[] | null, maintenant: () => Date = () => new Date()): Promise<ResultatActionCommande> {
  try {
    const valeurs = allergenes === null ? { allergenes: null, allergenes_declares_le: null } : { allergenes: [...allergenes], allergenes_declares_le: maintenant().toISOString() };
    const { data, error } = await db.from("menu_items").update(valeurs).eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).select("id");
    if (error) return PANNE;
    return Array.isArray(data) && data.length > 0 ? { ok: true } : PLAT_INCONNU;
  } catch {
    return PANNE;
  }
}
