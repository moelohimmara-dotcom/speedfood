"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/db/database.types";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { validerIllustration, type Illustration } from "@/lib/illustrations/modele";
import { familleDepuisCategorie, illustrationCouverture, illustrationLogo, illustrationPlat } from "@/lib/illustrations/automatique";

/**
 * Illustrations des restaurants et des plats (logo, couverture, plat), modifiables depuis la console. Toute valeur passe
 * par `validerIllustration` (liste blanche de motifs, couleurs hexadécimales, initiales) avant d'atteindre la base ;
 * la base n'accepte que des objets de petite taille et vérifie le rôle (`fn_admin_definir_illustration`).
 */

export interface EtatActionIllustration {
  erreur?: string;
  succes?: boolean;
}

export interface PlatAdmin {
  id: string;
  nom: string;
  prix: number;
  photoUrl: string | null;
  illustration: Illustration | null;
}

export async function listerPlatsAdmin(restaurantId: string): Promise<PlatAdmin[]> {
  await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("fn_admin_lister_plats", { p_restaurant: restaurantId });
  if (error || !data) {
    return [];
  }
  return data.map((p) => ({
    id: p.id,
    nom: p.nom,
    prix: p.prix,
    photoUrl: p.photo_url,
    illustration: validerIllustration(p.illustration),
  }));
}

const enJson = (i: Illustration): Json => i as unknown as Json;
const CIBLES = ["logo", "couverture", "plat"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enregistre (ou supprime avec `supprimer=1`) l'illustration d'un logo, d'une couverture ou d'un plat. */
export async function definirIllustrationAction(
  _precedent: EtatActionIllustration,
  formData: FormData,
): Promise<EtatActionIllustration> {
  const cible = String(formData.get("cible") ?? "");
  const id = String(formData.get("id") ?? "");
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!(CIBLES as readonly string[]).includes(cible) || !UUID.test(id) || !UUID.test(restaurantId)) {
    return { erreur: "Élément introuvable." };
  }
  const contexte = await verifierPermission("restaurant.moderer");

  let valeur: Illustration | null = null;
  if (formData.get("supprimer") !== "1") {
    valeur = validerIllustration({
      style: formData.get("style"),
      motif: formData.get("motif"),
      fond: formData.get("fond"),
      forme: formData.get("forme"),
      accent: formData.get("accent"),
      texte: String(formData.get("texte") ?? ""),
      genere: false,
    });
    if (!valeur) {
      return { erreur: "Illustration invalide : vérifiez le motif, les couleurs (lisibilité des initiales) et les initiales (3 au plus)." };
    }
  }

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("fn_admin_definir_illustration", { p_cible: cible, p_id: id, p_valeur: valeur as unknown as Json });
  if (error) {
    return { erreur: "Impossible d'enregistrer l'illustration. Réessayez dans un instant." };
  }
  await journaliserActionSysteme(contexte, {
    action: "illustration.modification",
    cibleType: cible === "plat" ? "plat" : "restaurant",
    cibleId: id,
    motif: valeur ? `${cible} : ${valeur.style} / ${valeur.motif}` : `${cible} : supprimée`,
  });
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

/**
 * Remplit les illustrations manquantes de TOUS les restaurants et plats qui n'ont ni photo ni illustration (données de
 * démonstration). N'écrase jamais une illustration existante ni une photo.
 */
export async function genererIllustrationsDemoAction(): Promise<{ restaurants: number; plats: number; erreur?: string }> {
  const contexte = await verifierPermission("restaurant.moderer");
  const admin = creerClientAdmin();

  const { data: restos, error } = await admin
    .from("restaurants")
    .select("id, nom, logo_url, photo_url, logo_illustration, couverture_illustration, menu_categories(nom)");
  if (error || !restos) {
    return { restaurants: 0, plats: 0, erreur: "Lecture des restaurants impossible." };
  }

  let nbRestaurants = 0;
  const famille = new Map<string, ReturnType<typeof familleDepuisCategorie>>();
  for (const r of restos) {
    const f = familleDepuisCategorie(r.menu_categories?.nom ?? "");
    famille.set(r.id, f);
    const maj: { logo_illustration?: Json; couverture_illustration?: Json } = {};
    if (!r.logo_url && !validerIllustration(r.logo_illustration)) maj.logo_illustration = enJson(illustrationLogo(r.nom, f));
    if (!r.photo_url && !validerIllustration(r.couverture_illustration)) maj.couverture_illustration = enJson(illustrationCouverture(f));
    if (Object.keys(maj).length > 0) {
      const { error: e } = await admin.from("restaurants").update(maj).eq("id", r.id);
      if (!e) nbRestaurants += 1;
    }
  }

  const { data: plats } = await admin
    .from("menu_items")
    .select("id, nom, restaurant_id, photo_url, illustration")
    .is("archive_le", null);
  let nbPlats = 0;
  for (const p of plats ?? []) {
    if (p.photo_url || validerIllustration(p.illustration)) continue;
    const { error: e } = await admin
      .from("menu_items")
      .update({ illustration: enJson(illustrationPlat(p.nom, famille.get(p.restaurant_id) ?? "defaut")) })
      .eq("id", p.id);
    if (!e) nbPlats += 1;
  }

  await journaliserActionSysteme(contexte, {
    action: "illustration.generation",
    cibleType: "restaurant",
    cibleId: restos[0]?.id ?? "00000000-0000-0000-0000-000000000000",
    motif: `${nbRestaurants} restaurant(s), ${nbPlats} plat(s)`,
  });
  revalidatePath("/system/catalogue/restaurants");
  return { restaurants: nbRestaurants, plats: nbPlats };
}
