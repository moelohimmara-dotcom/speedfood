import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { candidatsPhoto, originePhoto, typeReconnu, type SourcePhotoPlat } from "./photo-bibliotheque";

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
  sectionId: string | null;
  options: { id: string; nom: string; prix: number; disponible: boolean }[];
  /** Origine de la photo : vraie photo du restaurant, photo libre de la bibliothèque, ou image générée (« illustrative »). */
  photoSource: SourcePhotoPlat | null;
  photoLicence: string | null;
  photoAuteur: string | null;
  photoPage: string | null;
  /** Type de plat reconnu d'après le nom, et photos de la bibliothèque de ce type que l'équipe peut poser. */
  typePlat: string | null;
  photoCandidats: { id: string; source: "banque" | "ia"; licence: string | null }[];
}

export interface SectionEquipe {
  id: string;
  nom: string;
  position: number;
}

export interface CatalogueEquipe {
  restaurant: { id: string; nom: string; modeVente: ModeVente } | null;
  plats: PlatEquipe[];
  sections: SectionEquipe[];
}

/** Au plus 500 plats par établissement (borne volontaire : un catalogue de restaurant de quartier en compte quelques dizaines). */
export async function lireCatalogueEquipe(restaurantId: string): Promise<CatalogueEquipe> {
  const admin = creerClientAdmin();
  const { data: resto } = await admin.from("restaurants").select("id, nom, mode_vente").eq("id", restaurantId).maybeSingle();
  const modeVente = lireModeVente(resto?.mode_vente);
  if (!resto || !modeVente) return { restaurant: null, plats: [], sections: [] };

  // Allergènes : lus quand la colonne existe ; sinon (base pas encore migrée) les plats se lisent sans déclaration, jamais un catalogue en échec.
  const avecAllergenes = await admin
    .from("menu_items")
    .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, section_id, allergenes, allergenes_declares_le, menu_item_options(id, nom, prix, disponible)")
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
      .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, section_id, menu_item_options(id, nom, prix, disponible)")
      .eq("restaurant_id", restaurantId)
      .is("archive_le", null)
      .order("cree_le")
      .order("id")
      .limit(500);
    if (repli.error) throw new Error("catalogue_equipe_illisible");
    data = repli.data as unknown as typeof data;
  }

  const { data: sectionsBrutes, error: erreurSections } = await admin.from("menu_sections").select("id, nom, position").eq("restaurant_id", restaurantId).order("position").order("id").limit(100);
  if (erreurSections) throw new Error("catalogue_equipe_illisible");
  type LigneOption = { id: string; nom: string; prix: number; disponible: boolean };
  type LignePlat = { id: string; nom: string; description: string; prix: number; prix_promo: number | null; disponible: boolean; disponibilite_confirmee_le: string | null; photo_url: string | null; section_id?: string | null; allergenes?: string[] | null; allergenes_declares_le?: string | null; menu_item_options?: LigneOption[] | null };
  const lignes = (data ?? []) as unknown as LignePlat[];
  return {
    restaurant: { id: resto.id, nom: resto.nom, modeVente },
    sections: ((sectionsBrutes ?? []) as SectionEquipe[]).map((s) => ({ id: s.id, nom: s.nom, position: s.position })),
    plats: lignes.map((p) => {
      const ligne = p;
      const origine = originePhoto(p.photo_url);
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
        sectionId: ligne.section_id ?? null,
        options: (ligne.menu_item_options ?? []).map((o) => ({ id: o.id, nom: o.nom, prix: o.prix, disponible: o.disponible })),
        photoSource: origine?.source ?? null,
        photoLicence: origine?.entree?.licence ?? null,
        photoAuteur: origine?.entree?.auteur ?? null,
        photoPage: origine?.entree?.page ?? null,
        typePlat: typeReconnu(p.nom),
        photoCandidats: candidatsPhoto(p.nom).map((c) => ({ id: c.id, source: c.source, licence: c.licence ?? null })),
      };
    }),
  };
}
