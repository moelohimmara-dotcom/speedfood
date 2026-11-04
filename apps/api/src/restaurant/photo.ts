import type { SupabaseClient } from "@supabase/supabase-js";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ResultatActionCommande } from "@speedfood/shared/contracts/commande";

/**
 * Photo d'un plat depuis l'application (lot D4c), pour `POST /api/v1/restaurant/menu/photo`. Même enchaînement que le service du site (`definirPhotoPlat`, `retirerPhotoPlat`) mais avec les codes d'erreur
 * CONSERVÉS (quota d'envois = 429, panne = 500) et une écriture CONFIRMÉE (une ligne modifiée, jamais « ok » sur zéro ligne).
 *
 * Les contrôles du FICHIER (type, taille 5 Mo, signature réelle des octets, quota d'envois par restaurant) sont ceux du site : ils sont dans `televerser` (= `televerserImage`), appelé AVANT toute écriture.
 * Le stockage est INJECTÉ (`StockageImages`) : en production `cablage.ts` y branche les fonctions du site ; les tests y mettent un faux stockage.
 *
 *  - Le plat doit appartenir au restaurant du CONTEXTE et ne pas être archivé : lecture avec le client du jeton (RLS) filtrée sur `restaurant_id` et `archive_le is null` ; un plat d'un autre restaurant est « inconnu ».
 *  - Écriture : la colonne `photo_url` seulement, avec le client du jeton, sur ce plat de ce restaurant, non archivé.
 *  - Le nouveau fichier est enregistré AVANT de retirer l'ancien ; il est supprimé s'il n'a pas pu être rattaché au plat (jamais d'orphelin), sauf en cas de doute : si l'écriture a échoué sans qu'on puisse
 *    savoir si elle a abouti, le fichier est CONSERVÉ (un fichier inutilisé est inoffensif, un fichier supprimé alors que le plat le référence casserait l'image).
 *  - Retirer une photo ne supprime jamais le plat ; la suppression de l'ancien fichier est best-effort et ne change jamais le résultat.
 */
export interface StockageImages {
  /** `televerserImage` du site : valide (type, taille, signature), applique le quota, enregistre, renvoie l'URL publique. Lève `ErreurMetier`. */
  televerser(fichier: File, dossier: "plats", restaurantId: string): Promise<string>;
  /** Supprime un fichier tout neuf que le plat n'a pas retenu. Ne lève jamais. */
  supprimerOrphelin(url: string): Promise<void>;
  /** Supprime l'ancienne image après remplacement ou retrait (refuse si une autre ligne la référence). Best-effort. */
  supprimerAncienne(url: string | null): Promise<void>;
}

const PLAT_INCONNU: ResultatActionCommande = { ok: false, erreur: { code: "VALIDATION", message: "Plat inconnu." } };
const PANNE_ENVOI: ResultatActionCommande = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible d'enregistrer la photo. Réessayez dans un instant." } };
const PANNE_RETRAIT: ResultatActionCommande = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Impossible de retirer la photo. Réessayez dans un instant." } };

type Lecture = { etat: "ok"; photoUrl: string | null } | { etat: "absent" } | { etat: "panne" };

/** Le plat de CE restaurant, non archivé : `photo_url` actuelle, « absent » (inconnu, autre restaurant, archivé) ou « panne ». */
async function lirePlat(db: SupabaseClient, restaurantId: string, platId: string): Promise<Lecture> {
  try {
    const { data, error } = await db.from("menu_items").select("photo_url").eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).maybeSingle();
    if (error) return { etat: "panne" };
    return data ? { etat: "ok", photoUrl: (data.photo_url as string | null) ?? null } : { etat: "absent" };
  } catch {
    return { etat: "panne" };
  }
}

/** Écrit `photo_url` (la seule colonne) ; `ecrit` = une ligne modifiée, `aucune` = zéro ligne (archivé ou accès perdu entre-temps), `echec` = erreur ou exception (état inconnu). */
async function ecrirePhoto(db: SupabaseClient, restaurantId: string, platId: string, url: string | null): Promise<"ecrit" | "aucune" | "echec"> {
  try {
    const { data, error } = await db.from("menu_items").update({ photo_url: url }).eq("id", platId).eq("restaurant_id", restaurantId).is("archive_le", null).select("id");
    if (error) return "echec";
    return Array.isArray(data) && data.length > 0 ? "ecrit" : "aucune";
  } catch {
    return "echec";
  }
}

async function sansEchec(tache: () => Promise<void>): Promise<void> {
  try { await tache(); } catch { /* best-effort : un fichier inutilisé reste sans conséquence */ }
}

export async function definirPhotoPlat(db: SupabaseClient, restaurantId: string, platId: string, fichier: File, stockage: StockageImages): Promise<ResultatActionCommande> {
  const avant = await lirePlat(db, restaurantId, platId);
  if (avant.etat === "absent") return PLAT_INCONNU;
  if (avant.etat === "panne") return PANNE_ENVOI;

  let url: string;
  try {
    url = await stockage.televerser(fichier, "plats", restaurantId);
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.toApi() };
    return PANNE_ENVOI;
  }

  const ecriture = await ecrirePhoto(db, restaurantId, platId, url);
  if (ecriture === "aucune") {
    await sansEchec(() => stockage.supprimerOrphelin(url));
    return PLAT_INCONNU;
  }
  if (ecriture === "echec") {
    // État inconnu : on relit. Rattaché malgré l'erreur = succès ; pas rattaché (relecture sûre) = orphelin à supprimer ; relecture impossible = on ne supprime rien.
    const relue = await lirePlat(db, restaurantId, platId);
    if (relue.etat === "ok" && relue.photoUrl === url) {
      await sansEchec(() => stockage.supprimerAncienne(avant.photoUrl));
      return { ok: true };
    }
    if (relue.etat !== "panne") await sansEchec(() => stockage.supprimerOrphelin(url));
    return PANNE_ENVOI;
  }
  await sansEchec(() => stockage.supprimerAncienne(avant.photoUrl));
  return { ok: true };
}

export async function retirerPhotoPlat(db: SupabaseClient, restaurantId: string, platId: string, stockage: StockageImages): Promise<ResultatActionCommande> {
  const avant = await lirePlat(db, restaurantId, platId);
  if (avant.etat === "absent") return PLAT_INCONNU;
  if (avant.etat === "panne") return PANNE_RETRAIT;
  const ecriture = await ecrirePhoto(db, restaurantId, platId, null);
  if (ecriture === "aucune") return PLAT_INCONNU;
  if (ecriture === "echec") return PANNE_RETRAIT;
  await sansEchec(() => stockage.supprimerAncienne(avant.photoUrl));
  return { ok: true };
}
