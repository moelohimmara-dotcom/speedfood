"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Modération des restaurants (bloc 8b). Toute mutation :
 * 1. vérifie la permission `restaurant.moderer` (en plus de la policy RLS
 *    `admins_maj_restaurants`, qui reste la seule autorité réelle) ;
 * 2. journalise l'action dans `audit_events` avec l'auteur et le motif.
 */

export interface EtatActionRestaurant {
  erreur?: string;
  succes?: boolean;
}

export interface RestaurantAdmin {
  id: string;
  nom: string;
  categorie: string;
  quartier: string;
  publie: boolean;
  ouvert: boolean;
  suspendu_le: string | null;
  suspendu_motif: string | null;
  motif_correction: string | null;
  cree_le: string;
}

export type StatutFiltre = "tous" | "en_attente" | "publies" | "suspendus" | "correction";

export async function listerRestaurantsAdmin(filtres: {
  q?: string;
  statut?: StatutFiltre;
}): Promise<RestaurantAdmin[]> {
  await verifierPermission("restaurant.consulter");
  const supabase = await creerClientServeur();

  let requete = supabase
    .from("restaurants")
    .select(
      "id, nom, publie, ouvert, suspendu_le, suspendu_motif, motif_correction, cree_le, menu_categories(nom), neighborhoods(nom)"
    )
    .order("cree_le", { ascending: false });

  if (filtres.q) {
    requete = requete.ilike("nom", `%${filtres.q}%`);
  }
  if (filtres.statut === "en_attente") {
    requete = requete.eq("publie", false).is("suspendu_le", null).is("motif_correction", null);
  } else if (filtres.statut === "publies") {
    requete = requete.eq("publie", true).is("suspendu_le", null);
  } else if (filtres.statut === "suspendus") {
    requete = requete.not("suspendu_le", "is", null);
  } else if (filtres.statut === "correction") {
    requete = requete.not("motif_correction", "is", null);
  }

  const { data, error } = await requete;
  if (error || !data) {
    return [];
  }

  return data.map((r) => ({
    id: r.id,
    nom: r.nom,
    categorie: r.menu_categories?.nom ?? "",
    quartier: r.neighborhoods?.nom ?? "",
    publie: r.publie,
    ouvert: r.ouvert,
    suspendu_le: r.suspendu_le,
    suspendu_motif: r.suspendu_motif,
    motif_correction: r.motif_correction,
    cree_le: r.cree_le,
  }));
}

export async function obtenirRestaurantAdmin(id: string): Promise<RestaurantAdmin | null> {
  await verifierPermission("restaurant.consulter");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, nom, publie, ouvert, suspendu_le, suspendu_motif, motif_correction, cree_le, menu_categories(nom), neighborhoods(nom)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    nom: data.nom,
    categorie: data.menu_categories?.nom ?? "",
    quartier: data.neighborhoods?.nom ?? "",
    publie: data.publie,
    ouvert: data.ouvert,
    suspendu_le: data.suspendu_le,
    suspendu_motif: data.suspendu_motif,
    motif_correction: data.motif_correction,
    cree_le: data.cree_le,
  };
}

export async function approuverRestaurantAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("restaurants")
    .update({ publie: true, suspendu_le: null, suspendu_motif: null, motif_correction: null })
    .eq("id", restaurantId);

  if (error) {
    return { erreur: "Impossible d'approuver ce restaurant. Réessayez dans un instant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "restaurant.approbation",
    cibleType: "restaurant",
    cibleId: restaurantId,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function demanderCorrectionAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }
  if (!motif) {
    return { erreur: "Indiquez ce qui doit être corrigé." };
  }
  if (motif.length > 1000) {
    return { erreur: "Le message ne peut pas dépasser 1000 caractères." };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("restaurants")
    .update({ publie: false, motif_correction: motif })
    .eq("id", restaurantId);

  if (error) {
    return { erreur: "Impossible d'enregistrer la demande de correction." };
  }

  await journaliserActionSysteme(contexte, {
    action: "restaurant.demande_correction",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function suspendreRestaurantAction(
  _etatPrecedent: EtatActionRestaurant,
  formData: FormData
): Promise<EtatActionRestaurant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  if (!restaurantId) {
    return { erreur: "Restaurant introuvable." };
  }
  if (!motif) {
    return { erreur: "Indiquez le motif de la suspension." };
  }
  if (motif.length > 1000) {
    return { erreur: "Le motif ne peut pas dépasser 1000 caractères." };
  }

  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("restaurants")
    .update({ suspendu_le: new Date().toISOString(), suspendu_motif: motif })
    .eq("id", restaurantId);

  if (error) {
    return { erreur: "Impossible de suspendre ce restaurant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "restaurant.suspension",
    cibleType: "restaurant",
    cibleId: restaurantId,
    motif,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
  return { succes: true };
}

export async function reactiverRestaurantAction(restaurantId: string): Promise<void> {
  const contexte = await verifierPermission("restaurant.moderer");
  const supabase = await creerClientServeur();

  await supabase
    .from("restaurants")
    .update({ suspendu_le: null, suspendu_motif: null })
    .eq("id", restaurantId);

  await journaliserActionSysteme(contexte, {
    action: "restaurant.reactivation",
    cibleType: "restaurant",
    cibleId: restaurantId,
  });

  revalidatePath("/system/catalogue/restaurants");
  revalidatePath(`/system/catalogue/restaurants/${restaurantId}`);
}
