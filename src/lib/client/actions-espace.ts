"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientServeur } from "@/lib/db/server";
import { estUuid } from "@/lib/commande/commun";
import { NOM_COOKIE_SUIVI, optionsCookieSuivi } from "@/lib/commande/sessionSuivi";

/**
 * Actions de l'espace client. L'identité vient TOUJOURS de la session : un identifiant de compte envoyé par le navigateur n'est jamais cru.
 * Les écritures passent par le serveur (la base n'accepte aucune écriture directe des comptes sur les favoris).
 */

/** Les types générés ne connaissent pas encore la table des favoris : client sans typage de tables. */
const dbSansTypes = () => creerClientAdmin() as unknown as SupabaseClient;

async function utilisateurConnecte(): Promise<string | null> {
  const {
    data: { user },
  } = await (await creerClientServeur()).auth.getUser();
  return user?.id ?? null;
}

/**
 * Ouvre le suivi (ou le reçu) d'une commande DU COMPTE : pose le cookie de suivi de cette commande, puis redirige vers la page de suivi.
 * Une commande qui n'appartient pas au compte renvoie simplement à la liste (aucune indication sur son existence).
 */
export async function ouvrirSuiviCommandeAction(orderId: string, cible: "suivi" | "recu"): Promise<void> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/entrer?suite=/compte/commandes");
  if (!estUuid(orderId)) redirect("/compte/commandes");

  const { data } = await creerClientAdmin().from("orders").select("jeton_suivi").eq("id", orderId).eq("client_user_id", utilisateur).maybeSingle();
  if (!data?.jeton_suivi) redirect("/compte/commandes");

  (await cookies()).set(NOM_COOKIE_SUIVI, data.jeton_suivi, optionsCookieSuivi());
  redirect(cible === "recu" ? "/suivi/recu" : "/suivi");
}

export type ResultatFavori = { ok: true; favori: boolean } | { ok: false; message: string };

/** État du cœur sur la fiche d'un restaurant : appelé après l'affichage (la fiche publique est mise en cache, pas l'état d'un compte). */
export async function etatFavoriAction(restaurantId: string): Promise<{ connecte: boolean; favori: boolean }> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return { connecte: false, favori: false };
  if (!estUuid(restaurantId)) return { connecte: true, favori: false };
  const { data } = await dbSansTypes().from("client_favoris").select("restaurant_id").eq("utilisateur_id", utilisateur).eq("restaurant_id", restaurantId).maybeSingle();
  return { connecte: true, favori: Boolean(data) };
}

/** Ajoute ou retire un restaurant des favoris. Seul un restaurant publié peut être ajouté ; cent favoris au plus (la base le garantit aussi). */
export async function basculerFavoriAction(restaurantId: string): Promise<ResultatFavori> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return { ok: false, message: "Connectez-vous pour enregistrer vos restaurants favoris." };
  if (!estUuid(restaurantId)) return { ok: false, message: "Restaurant introuvable." };
  const db = dbSansTypes();

  const { data: existe } = await db.from("client_favoris").select("restaurant_id").eq("utilisateur_id", utilisateur).eq("restaurant_id", restaurantId).maybeSingle();
  if (existe) {
    const { error } = await db.from("client_favoris").delete().eq("utilisateur_id", utilisateur).eq("restaurant_id", restaurantId);
    if (error) return { ok: false, message: "Impossible de retirer ce favori pour le moment." };
    revalidatePath("/compte/favoris");
    return { ok: true, favori: false };
  }

  const { data: resto } = await db.from("restaurants").select("id").eq("id", restaurantId).eq("publie", true).maybeSingle();
  if (!resto) return { ok: false, message: "Restaurant introuvable." };
  const { error } = await db.from("client_favoris").insert({ utilisateur_id: utilisateur, restaurant_id: restaurantId });
  if (error) {
    if (error.code === "23514") return { ok: false, message: "Vous avez déjà 100 favoris : retirez-en avant d'en ajouter." };
    if (error.code === "23505") return { ok: true, favori: true };
    return { ok: false, message: "Impossible d'enregistrer ce favori pour le moment." };
  }
  revalidatePath("/compte/favoris");
  return { ok: true, favori: true };
}

/** Retire un favori depuis la liste (formulaire sans JavaScript). */
export async function retirerFavoriAction(restaurantId: string): Promise<void> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) redirect("/entrer?suite=/compte/favoris");
  if (estUuid(restaurantId)) await dbSansTypes().from("client_favoris").delete().eq("utilisateur_id", utilisateur).eq("restaurant_id", restaurantId);
  revalidatePath("/compte/favoris");
}
