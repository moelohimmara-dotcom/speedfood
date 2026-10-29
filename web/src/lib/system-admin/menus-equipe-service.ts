import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { creerClientAdmin } from "@/lib/db/admin";
import { etatDisponibilite } from "@/lib/disponibilite/etat";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import type { TraceActionSysteme } from "./audit";
import { lireModeVente } from "./catalogue-restaurant-lecture";

/**
 * Menus des établissements tenus par l'équipe, pour l'application (`/api/v1/equipe/menus/*`) : état de fraîcheur de chaque menu, reconfirmation en un geste (un plat ou
 * tout le menu), plat épuisé ou remis en vente. Mêmes règles que le catalogue du site (`catalogue-restaurant.ts`) : seul un établissement en mode « speedfood » est
 * modifiable ; la base horodate la confirmation ; la permission `restaurant.moderer` est vérifiée par la route ; chaque action est tracée (la trace est retournée).
 */
const db = () => creerClientAdmin() as unknown as SupabaseClient;
const LIMITE_PLATS = 2000;

export interface MenuEquipeResume {
  restaurantId: string;
  nom: string;
  plats: number;
  aReconfirmer: number;
  epuises: number;
  /** Dernière confirmation de l'un de ses plats (ISO), ou null si aucun plat n'a jamais été confirmé. */
  derniereConfirmation: string | null;
}

export interface PlatMenuEquipe {
  id: string;
  nom: string;
  prix: number;
  disponible: boolean;
  confirmeLe: string | null;
  etat: "disponible" | "a_confirmer" | "epuise";
}

export type ResultatMenuEquipe = { ok: true; message: string; trace?: TraceActionSysteme } | { ok: false; message: string };
const echec = (message: string): ResultatMenuEquipe => ({ ok: false, message });

export async function listerMenusEquipe(): Promise<{ fraicheurHeures: number; menus: MenuEquipeResume[] }> {
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  const base = db();
  const { data: restos } = await base.from("restaurants").select("id, nom").eq("mode_vente", "speedfood").order("nom", { ascending: true }).limit(200);
  const liste = (restos ?? []) as Array<{ id: string; nom: string }>;
  if (liste.length === 0) return { fraicheurHeures: disponibiliteFraicheurHeures, menus: [] };
  const { data: plats } = await base
    .from("menu_items")
    .select("restaurant_id, disponible, disponibilite_confirmee_le")
    .in("restaurant_id", liste.map((r) => r.id))
    .is("archive_le", null)
    .limit(LIMITE_PLATS);
  const maintenant = new Date();
  const parResto = new Map<string, MenuEquipeResume>();
  for (const r of liste) parResto.set(r.id, { restaurantId: r.id, nom: r.nom, plats: 0, aReconfirmer: 0, epuises: 0, derniereConfirmation: null });
  for (const p of (plats ?? []) as Array<{ restaurant_id: string; disponible: boolean; disponibilite_confirmee_le: string | null }>) {
    const m = parResto.get(p.restaurant_id);
    if (!m) continue;
    m.plats += 1;
    const etat = etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant);
    if (etat.type === "epuise") m.epuises += 1;
    if (etat.type === "a_confirmer") m.aReconfirmer += 1;
    if (p.disponibilite_confirmee_le && (m.derniereConfirmation === null || p.disponibilite_confirmee_le > m.derniereConfirmation)) m.derniereConfirmation = p.disponibilite_confirmee_le;
  }
  return { fraicheurHeures: disponibiliteFraicheurHeures, menus: [...parResto.values()] };
}

async function estTenuParLEquipe(restaurantId: string): Promise<boolean> {
  const { data } = await db().from("restaurants").select("mode_vente").eq("id", restaurantId).maybeSingle();
  return lireModeVente((data as { mode_vente?: unknown } | null)?.mode_vente) === "speedfood";
}

export async function lirePlatsMenuEquipe(restaurantId: string): Promise<{ nom: string; plats: PlatMenuEquipe[] } | null> {
  if (!estUuid(restaurantId) || !(await estTenuParLEquipe(restaurantId))) return null;
  const { disponibiliteFraicheurHeures } = await obtenirParametresApplication();
  const base = db();
  const [{ data: resto }, { data: plats }] = await Promise.all([
    base.from("restaurants").select("nom").eq("id", restaurantId).maybeSingle(),
    base.from("menu_items").select("id, nom, prix, disponible, disponibilite_confirmee_le").eq("restaurant_id", restaurantId).is("archive_le", null).order("cree_le", { ascending: true }).limit(500),
  ]);
  const maintenant = new Date();
  return {
    nom: (resto as { nom?: string } | null)?.nom ?? "",
    plats: ((plats ?? []) as Array<{ id: string; nom: string; prix: number; disponible: boolean; disponibilite_confirmee_le: string | null }>).map((p) => ({
      id: p.id,
      nom: p.nom,
      prix: p.prix,
      disponible: p.disponible,
      confirmeLe: p.disponibilite_confirmee_le,
      etat: etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant).type,
    })),
  };
}

/** Reconfirme un plat disponible, ou TOUS les plats disponibles du menu si `platId` est absent : l'heure de confirmation repart de maintenant. */
export async function reconfirmerMenuEquipe(restaurantId: unknown, platId: unknown): Promise<ResultatMenuEquipe> {
  if (typeof restaurantId !== "string" || !estUuid(restaurantId)) return echec("Établissement introuvable.");
  if (!(await estTenuParLEquipe(restaurantId))) return echec("Cet établissement tient lui-même son catalogue.");
  const maintenant = new Date().toISOString();
  let requete = db().from("menu_items").update({ disponibilite_confirmee_le: maintenant }).eq("restaurant_id", restaurantId).eq("disponible", true).is("archive_le", null);
  if (platId !== undefined && platId !== null) {
    if (typeof platId !== "string" || !estUuid(platId)) return echec("Plat inconnu.");
    requete = requete.eq("id", platId);
  }
  const { data, error } = await requete.select("id");
  if (error) return echec("Impossible d'enregistrer pour le moment. Réessayez dans un instant.");
  const n = (data ?? []).length;
  if (n === 0) return echec("Aucun plat disponible à reconfirmer.");
  return {
    ok: true,
    message: n === 1 ? "Plat reconfirmé." : `${n} plats reconfirmés.`,
    trace: { action: "catalogue.plat_disponibilite", cibleType: platId ? "menu_items" : "restaurants", cibleId: String(platId ?? restaurantId), motif: platId ? "reconfirmé" : `menu reconfirmé (${n} plats)` },
  };
}

/** Plat épuisé ou remis en vente (la base horodate la confirmation à la remise en vente). */
export async function definirDisponibilitePlatEquipe(restaurantId: unknown, platId: unknown, disponible: unknown): Promise<ResultatMenuEquipe> {
  if (typeof restaurantId !== "string" || !estUuid(restaurantId) || typeof platId !== "string" || !estUuid(platId) || typeof disponible !== "boolean") return echec("Demande invalide.");
  if (!(await estTenuParLEquipe(restaurantId))) return echec("Cet établissement tient lui-même son catalogue.");
  const { data, error } = await db().from("menu_items").update({ disponible }).eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).select("id");
  if (error || !data || data.length === 0) return echec("Impossible d'enregistrer pour le moment. Réessayez dans un instant.");
  return { ok: true, message: disponible ? "Plat remis en vente." : "Plat marqué épuisé.", trace: { action: "catalogue.plat_disponibilite", cibleType: "menu_items", cibleId: platId, motif: disponible ? "disponible" : "épuisé" } };
}
