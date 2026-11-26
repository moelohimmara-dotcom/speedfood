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
  /** Déclaration d'allergènes du restaurateur ou de l'équipe : `null` = non renseignée, `[]` = aucun, sinon la liste déclarée. */
  allergenes: string[] | null;
  allergenesDeclaresLe: string | null;
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

  // Allergènes : lus quand la colonne existe ; sinon (base pas encore migrée) les plats se lisent sans déclaration, jamais un catalogue en échec.
  const avecAllergenes = await admin
    .from("menu_items")
    .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, allergenes, allergenes_declares_le")
    .eq("restaurant_id", restaurantId)
    .is("archive_le", null)
    .order("cree_le")
    .order("id")
    .limit(500);
  // Repli seulement si la colonne allergènes est absente (base pas encore migrée) ; toute autre erreur rend le catalogue illisible, jamais silencieusement incomplet.
  let data = avecAllergenes.data;
  if (avecAllergenes.error) {
    const colonneAbsente = avecAllergenes.error.code === "42703" || avecAllergenes.error.message.includes("allergenes");
    if (!colonneAbsente) throw new Error("catalogue_equipe_illisible");
    const repli = await admin
      .from("menu_items")
      .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url")
      .eq("restaurant_id", restaurantId)
      .is("archive_le", null)
      .order("cree_le")
      .order("id")
      .limit(500);
    if (repli.error) throw new Error("catalogue_equipe_illisible");
    data = repli.data as unknown as typeof data;
  }

  type LignePlat = { id: string; nom: string; description: string; prix: number; prix_promo: number | null; disponible: boolean; disponibilite_confirmee_le: string | null; photo_url: string | null; allergenes?: string[] | null; allergenes_declares_le?: string | null };
  const lignes = (data ?? []) as unknown as LignePlat[];
  return {
    restaurant: { id: resto.id, nom: resto.nom, modeVente },
    plats: lignes.map((p) => {
      const ligne = p;
      return {
        id: p.id,
        nom: p.nom,
        description: p.description,
        prix: p.prix,
        prixPromo: p.prix_promo,
        disponible: p.disponible,
        confirmeLe: p.disponibilite_confirmee_le,
        photoUrl: p.photo_url,
        allergenes: Array.isArray(ligne.allergenes) ? ligne.allergenes : null,
        allergenesDeclaresLe: ligne.allergenes_declares_le ?? null,
      };
    }),
  };
}
