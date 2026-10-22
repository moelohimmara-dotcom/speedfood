import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estUuid } from "@/lib/commande/commun";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { supprimerImage, supprimerTeleversementOrphelin, televerserImage } from "@/lib/storage/images";
import type { ResultatMenu } from "./service-menu";

/**
 * Photo d'un plat depuis l'application native (`POST /api/v1/restaurant/menu/photo`). Mêmes contrôles que la console du site : type, taille (5 Mo), signature réelle des
 * octets et quota d'envois par restaurant (`televerserImage`). Le plat doit appartenir au restaurant du compte ; l'écriture passe par le client lié au membre (RLS).
 * Le nouveau fichier est enregistré AVANT de retirer l'ancien, et supprimé s'il n'a pas pu être rattaché au plat (pas d'orphelin).
 */
const echec = (message: string): ResultatMenu => ({ ok: false, message });

export async function definirPhotoPlat(db: SupabaseClient, restaurantId: string, platId: unknown, fichier: File | null): Promise<ResultatMenu> {
  if (!estUuid(platId)) return echec("Plat inconnu.");
  const { data: ancien } = await db.from("menu_items").select("photo_url").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
  if (!ancien) return echec("Plat inconnu.");

  let url: string;
  try {
    url = await televerserImage(fichier, "plats", restaurantId);
  } catch (erreur) {
    return echec(erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer la photo. Réessayez.");
  }
  const { error } = await db.from("menu_items").update({ photo_url: url }).eq("id", platId).eq("restaurant_id", restaurantId);
  if (error) {
    await supprimerTeleversementOrphelin(url);
    return echec("Impossible d'enregistrer la photo. Réessayez dans un instant.");
  }
  await supprimerImage((ancien.photo_url as string | null) ?? null);
  return { ok: true };
}

/** Retire la photo d'un plat (le plat reste en vente, sans image). */
export async function retirerPhotoPlat(db: SupabaseClient, restaurantId: string, platId: unknown): Promise<ResultatMenu> {
  if (!estUuid(platId)) return echec("Plat inconnu.");
  const { data: ancien } = await db.from("menu_items").select("photo_url").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
  if (!ancien) return echec("Plat inconnu.");
  const { error } = await db.from("menu_items").update({ photo_url: null }).eq("id", platId).eq("restaurant_id", restaurantId);
  if (error) return echec("Impossible de retirer la photo. Réessayez dans un instant.");
  await supprimerImage((ancien.photo_url as string | null) ?? null);
  return { ok: true };
}
