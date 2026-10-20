"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { creerClientServeur } from "@/lib/db/server";
import { estUuid } from "@/lib/commande/commun";
import { NOM_COOKIE_SUIVI, optionsCookieSuivi } from "@/lib/commande/sessionSuivi";
import { messageRecommande, reconstruireCommande, type PlatDuMenu } from "./recommander";
import type { LignePanier } from "@/lib/panier/gestion";

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

export type ResultatRecommande =
  | { ok: true; restaurant: { id: string; nom: string }; lignes: LignePanier[]; message: string | null }
  | { ok: false; message: string };

/**
 * « Commander à nouveau » : prépare un panier d'après une commande DU COMPTE et le menu d'aujourd'hui (prix actuels, plats disponibles). Ne crée
 * aucune commande : le panier est rempli dans le navigateur et le client vérifie avant d'envoyer, comme pour toute commande.
 */
export async function preparerRecommandeAction(orderId: string): Promise<ResultatRecommande> {
  const utilisateur = await utilisateurConnecte();
  if (!utilisateur) return { ok: false, message: "Connectez-vous pour commander à nouveau." };
  if (!estUuid(orderId)) return { ok: false, message: "Commande introuvable." };
  const db = creerClientAdmin();

  const { data: commande } = await db
    .from("orders")
    .select("id, restaurant_id, order_items(menu_item_id, nom, quantite, order_item_options(option_id))")
    .eq("id", orderId)
    .eq("client_user_id", utilisateur)
    .maybeSingle();
  if (!commande) return { ok: false, message: "Commande introuvable." };

  const { data: resto } = await db.from("restaurants").select("id, nom, publie, accepte_commandes, ouvert").eq("id", commande.restaurant_id).maybeSingle();
  if (!resto || !resto.publie) return { ok: false, message: "Ce restaurant n'est plus disponible sur Speedfood." };
  if (!resto.accepte_commandes) return { ok: false, message: "Ce restaurant n'accepte pas de commandes pour le moment." };

  const passees = (commande.order_items ?? []).map((l) => ({
    menuItemId: l.menu_item_id,
    nom: l.nom,
    quantite: l.quantite,
    optionIds: (l.order_item_options ?? []).map((o) => o.option_id).filter((x): x is string => typeof x === "string"),
  }));
  const ids = [...new Set(passees.map((l) => l.menuItemId).filter((x): x is string => typeof x === "string"))];
  const { data: plats } = ids.length
    ? await db.from("menu_items").select("id, nom, prix, prix_promo, disponible, archive_le, photo_url, menu_item_options(id, nom, prix, disponible)").eq("restaurant_id", commande.restaurant_id).in("id", ids).limit(60)
    : { data: [] };
  const menu: PlatDuMenu[] = (plats ?? []).map((p) => ({
    id: p.id,
    nom: p.nom,
    prix: p.prix,
    prixPromo: p.prix_promo,
    disponible: p.disponible,
    archive: p.archive_le !== null,
    photoUrl: p.photo_url,
    options: (p.menu_item_options ?? []).map((o) => ({ id: o.id, nom: o.nom, prix: o.prix, disponible: o.disponible })),
  }));

  const r = reconstruireCommande(passees, menu);
  if (r.lignes.length === 0) return { ok: false, message: "Aucun plat de cette commande n'est plus proposé. Ouvrez le menu du restaurant pour choisir." };
  return { ok: true, restaurant: { id: resto.id, nom: resto.nom }, lignes: r.lignes, message: messageRecommande(r) };
}
