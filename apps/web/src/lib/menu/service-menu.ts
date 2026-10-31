import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { validerOption, validerPlat } from "./regles-plat";

/**
 * Menu d'un restaurant : lecture et modifications, UN seul chemin pour l'application native (`/api/v1/restaurant/menu`). Le client `db` est lié à l'identité du
 * membre (RLS) ; chaque écriture filtre en plus sur `restaurant_id` (défense en profondeur). Les photos passent par `photo-plat.ts` (`/api/v1/restaurant/menu/photo`).
 */

export interface OptionMenu {
  id: string;
  nom: string;
  prix: number;
  disponible: boolean;
}

export interface PlatMenu {
  id: string;
  nom: string;
  description: string;
  prix: number;
  prixPromo: number | null;
  disponible: boolean;
  /** Dernière confirmation de disponibilité (posée par la base) ; null = jamais confirmé. */
  confirmeLe: string | null;
  sectionId: string | null;
  /** Adresse publique de la photo ; null = pas de photo. */
  photoUrl: string | null;
  options: OptionMenu[];
}

export interface SectionMenu {
  id: string;
  nom: string;
}

export type ResultatMenu = { ok: true } | { ok: false; message: string };

const PLAFOND_PLATS = 500;
const PLAFOND_SECTIONS = 50;
const echec = (message: string): ResultatMenu => ({ ok: false, message });
const INDISPONIBLE = "Impossible d'enregistrer le changement. Réessayez dans un instant.";

export async function lireMenu(db: SupabaseClient, restaurantId: string): Promise<{ sections: SectionMenu[]; plats: PlatMenu[] }> {
  const [sections, plats] = await Promise.all([
    db.from("menu_sections").select("id, nom, position").eq("restaurant_id", restaurantId).order("position", { ascending: true }).limit(PLAFOND_SECTIONS),
    db
      .from("menu_items")
      .select("id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, section_id, photo_url, menu_item_options(id, nom, prix, disponible)")
      .eq("restaurant_id", restaurantId)
      .is("archive_le", null)
      .order("cree_le", { ascending: true })
      .limit(PLAFOND_PLATS),
  ]);
  if (sections.error || plats.error) throw new Error("menu_illisible");
  return {
    sections: (sections.data ?? []).map((s) => ({ id: s.id as string, nom: s.nom as string })),
    plats: (plats.data ?? []).map((p) => {
      const options = (p.menu_item_options ?? []) as { id: string; nom: string; prix: number; disponible: boolean }[];
      return {
        id: p.id as string,
        nom: p.nom as string,
        description: (p.description as string | null) ?? "",
        prix: p.prix as number,
        prixPromo: (p.prix_promo as number | null) ?? null,
        disponible: p.disponible as boolean,
        confirmeLe: (p.disponibilite_confirmee_le as string | null) ?? null,
        sectionId: (p.section_id as string | null) ?? null,
        photoUrl: (p.photo_url as string | null) ?? null,
        options: options.map((o) => ({ id: o.id, nom: o.nom, prix: o.prix, disponible: o.disponible })),
      };
    }),
  };
}

/** Retire un plat de la vente (épuisé) ou le remet en vente. */
export async function basculerDisponibilite(db: SupabaseClient, restaurantId: string, id: unknown, disponible: unknown): Promise<ResultatMenu> {
  if (typeof id !== "string" || !estUuid(id) || typeof disponible !== "boolean") return echec("Demande invalide.");
  const { data, error } = await db.from("menu_items").update({ disponible }).eq("id", id).eq("restaurant_id", restaurantId).select("id");
  return error || !data || data.length === 0 ? echec("Plat introuvable.") : { ok: true };
}

/** Reconfirme qu'un plat est toujours disponible : l'heure de confirmation est posée par la base (trigger). */
export async function confirmerDisponibilite(db: SupabaseClient, restaurantId: string, id: unknown): Promise<ResultatMenu> {
  if (typeof id !== "string" || !estUuid(id)) return echec("Demande invalide.");
  const { data, error } = await db
    .from("menu_items")
    .update({ disponibilite_confirmee_le: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .eq("disponible", true)
    .select("id");
  return error || !data || data.length === 0 ? echec("Plat introuvable, ou retiré de la vente : remettez-le en vente avant de le confirmer.") : { ok: true };
}

/** Reconfirme en une fois tous les plats actuellement disponibles. */
export async function confirmerToutesDisponibilites(db: SupabaseClient, restaurantId: string): Promise<ResultatMenu> {
  const { error } = await db
    .from("menu_items")
    .update({ disponibilite_confirmee_le: new Date().toISOString() })
    .eq("restaurant_id", restaurantId)
    .eq("disponible", true)
    .is("archive_le", null);
  return error ? echec(INDISPONIBLE) : { ok: true };
}

async function sectionValide(db: SupabaseClient, restaurantId: string, sectionId: unknown): Promise<{ ok: true; id: string | null } | { ok: false }> {
  if (sectionId === null || sectionId === undefined || sectionId === "") return { ok: true, id: null };
  if (typeof sectionId !== "string" || !estUuid(sectionId)) return { ok: false };
  const { data } = await db.from("menu_sections").select("id").eq("id", sectionId).eq("restaurant_id", restaurantId).maybeSingle();
  return data ? { ok: true, id: sectionId } : { ok: false };
}

export interface BrutPlat {
  nom?: unknown;
  description?: unknown;
  prix?: unknown;
  prixPromo?: unknown;
  sectionId?: unknown;
}

export async function creerPlat(db: SupabaseClient, restaurantId: string, brut: BrutPlat): Promise<ResultatMenu> {
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const v = validerPlat({ nom: brut.nom, description: brut.description ?? "", prix: brut.prix, prixPromo: brut.prixPromo }, prixPlatMaxGnf);
  if (!v.ok) return echec(v.erreur);
  const section = await sectionValide(db, restaurantId, brut.sectionId);
  if (!section.ok) return echec("Section introuvable.");
  const { error } = await db.from("menu_items").insert({
    restaurant_id: restaurantId,
    nom: v.valeurs.nom,
    description: v.valeurs.description,
    prix: v.valeurs.prix,
    prix_promo: v.valeurs.prixPromo,
    section_id: section.id,
  });
  return error ? echec("Impossible d'ajouter le plat. Réessayez dans un instant.") : { ok: true };
}

export async function modifierPlat(db: SupabaseClient, restaurantId: string, id: unknown, brut: BrutPlat): Promise<ResultatMenu> {
  if (typeof id !== "string" || !estUuid(id)) return echec("Plat introuvable.");
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const v = validerPlat({ nom: brut.nom, description: brut.description ?? "", prix: brut.prix, prixPromo: brut.prixPromo }, prixPlatMaxGnf);
  if (!v.ok) return echec(v.erreur);
  const section = await sectionValide(db, restaurantId, brut.sectionId);
  if (!section.ok) return echec("Section introuvable.");
  const { data, error } = await db
    .from("menu_items")
    .update({ nom: v.valeurs.nom, description: v.valeurs.description, prix: v.valeurs.prix, prix_promo: v.valeurs.prixPromo, section_id: section.id })
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .is("archive_le", null)
    .select("id");
  if (error) return echec("Impossible de modifier le plat. Réessayez dans un instant.");
  return !data || data.length === 0 ? echec("Plat introuvable.") : { ok: true };
}

/** Archive un plat : il disparaît du menu et des nouvelles commandes, les commandes passées le gardent. */
export async function archiverPlat(db: SupabaseClient, restaurantId: string, id: unknown): Promise<ResultatMenu> {
  if (typeof id !== "string" || !estUuid(id)) return echec("Plat introuvable.");
  const { data, error } = await db.from("menu_items").update({ archive_le: new Date().toISOString() }).eq("id", id).eq("restaurant_id", restaurantId).select("id");
  return error || !data || data.length === 0 ? echec("Plat introuvable.") : { ok: true };
}

export async function ajouterOption(db: SupabaseClient, restaurantId: string, platId: unknown, brut: { nom?: unknown; prix?: unknown }): Promise<ResultatMenu> {
  if (typeof platId !== "string" || !estUuid(platId)) return echec("Plat introuvable.");
  const { prixPlatMaxGnf } = await obtenirParametresApplication();
  const v = validerOption({ nom: brut.nom, prix: brut.prix }, prixPlatMaxGnf);
  if (!v.ok) return echec(v.erreur);
  const { data: plat } = await db.from("menu_items").select("id").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
  if (!plat) return echec("Plat introuvable.");
  const { error } = await db.from("menu_item_options").insert({ menu_item_id: platId, nom: v.valeurs.nom, prix: v.valeurs.prix });
  return error ? echec("Impossible d'ajouter le supplément. Réessayez dans un instant.") : { ok: true };
}

export async function retirerOption(db: SupabaseClient, restaurantId: string, optionId: unknown): Promise<ResultatMenu> {
  if (typeof optionId !== "string" || !estUuid(optionId)) return echec("Supplément introuvable.");
  // Le restaurant se vérifie par le plat parent (la colonne n'existe pas sur le supplément) ; la RLS applique la même règle en dernier ressort.
  const { data: option } = await db.from("menu_item_options").select("id, menu_items(restaurant_id)").eq("id", optionId).maybeSingle();
  const parent = option ? (Array.isArray(option.menu_items) ? option.menu_items[0] : option.menu_items) : null;
  if (!option || !parent || (parent as { restaurant_id: string }).restaurant_id !== restaurantId) return echec("Supplément introuvable.");
  const { error } = await db.from("menu_item_options").delete().eq("id", optionId);
  return error ? echec(INDISPONIBLE) : { ok: true };
}
