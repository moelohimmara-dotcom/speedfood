import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";

export type ModeVente = "autonome" | "speedfood";

export function lireModeVente(brut: unknown): ModeVente | null {
  return brut === "autonome" || brut === "speedfood" ? brut : null;
}

export interface PlatEquipe {
  id: string;
  nom: string;
  description: string;
  prix: number;
  prixPromo: number | null;
  disponible: boolean;
  confirmeLe: string | null;
  photoUrl: string | null;
}

export interface CatalogueEquipe {
  restaurant: { id: string; nom: string; modeVente: ModeVente } | null;
  plats: PlatEquipe[];
}

/** Au plus 500 plats par établissement (borne volontaire : un catalogue de restaurant de quartier en compte quelques dizaines). */
export async function lireCatalogueEquipe(restaurantId: string): Promise<CatalogueEquipe> {
  const admin = creerClientAdmin();
  const { data: resto } = await admin.from("restaurants").select("id, nom, mode_vente").eq("id", restaurantId).maybeSingle();
  const modeVente = lireModeVente(resto?.mode_vente);
  if (!resto || !modeVente) return { restaurant: null, plats: [] };

  const { data } = await admin
    .from("menu_items")
    .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url")
    .eq("restaurant_id", restaurantId)
    .is("archive_le", null)
    .order("cree_le")
    .order("id")
    .limit(500);

  return {
    restaurant: { id: resto.id, nom: resto.nom, modeVente },
    plats: (data ?? []).map((p) => ({
      id: p.id,
      nom: p.nom,
      description: p.description,
      prix: p.prix,
      prixPromo: p.prix_promo,
      disponible: p.disponible,
      confirmeLe: p.disponibilite_confirmee_le,
      photoUrl: p.photo_url,
    })),
  };
}
