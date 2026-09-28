"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Mises en avant (bloc 8c) : permission `contenu.mettre_en_avant`, réservée à
 * `operations` et `super_admin` — PAS `content_editor` (matrice v1.0.0). Un
 * choix de mise en avant est une décision opérationnelle/commerciale, pas
 * éditoriale, d'où la séparation des permissions malgré la table `content_*`
 * voisine.
 */

export interface EtatActionMiseEnAvant {
  erreur?: string;
  succes?: boolean;
}

export interface MiseEnAvant {
  id: string;
  restaurant_id: string;
  restaurant_nom: string;
  position: number;
  actif: boolean;
  debut_le: string | null;
  fin_le: string | null;
}

export async function listerMisesEnAvant(): Promise<MiseEnAvant[]> {
  await verifierPermission("contenu.mettre_en_avant");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("featured_placements")
    .select("id, restaurant_id, position, actif, debut_le, fin_le, restaurants(nom)")
    .order("position");
  if (error || !data) {
    return [];
  }
  return data.map((m) => ({
    id: m.id,
    restaurant_id: m.restaurant_id,
    restaurant_nom: m.restaurants?.nom ?? "",
    position: m.position,
    actif: m.actif,
    debut_le: m.debut_le,
    fin_le: m.fin_le,
  }));
}

/** Restaurants publiés, pour le sélecteur d'ajout (seuls ceux-là ont un sens à mettre en avant). */
export async function listerRestaurantsPublies(): Promise<{ id: string; nom: string }[]> {
  await verifierPermission("contenu.mettre_en_avant");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, nom")
    .eq("publie", true)
    .is("suspendu_le", null)
    .order("nom");
  if (error || !data) {
    return [];
  }
  return data;
}

export async function ajouterMiseEnAvantAction(
  _etatPrecedent: EtatActionMiseEnAvant,
  formData: FormData
): Promise<EtatActionMiseEnAvant> {
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const positionBrut = String(formData.get("position") ?? "0");
  const position = Number.parseInt(positionBrut, 10);

  if (!restaurantId) {
    return { erreur: "Choisissez un restaurant." };
  }
  if (!Number.isFinite(position) || position < 0) {
    return { erreur: "Position invalide." };
  }

  const contexte = await verifierPermission("contenu.mettre_en_avant");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("featured_placements")
    .insert({ restaurant_id: restaurantId, position, actif: true });

  if (error) {
    return { erreur: "Impossible d'ajouter cette mise en avant." };
  }

  await journaliserActionSysteme(contexte, {
    action: "mise_en_avant.creation",
    cibleType: "restaurant",
    cibleId: restaurantId,
  });

  revalidatePath("/system/catalogue/mises-en-avant");
  return { succes: true };
}

export async function basculerMiseEnAvantAction(id: string, actif: boolean): Promise<void> {
  const contexte = await verifierPermission("contenu.mettre_en_avant");
  const supabase = await creerClientServeur();

  const { data } = await supabase
    .from("featured_placements")
    .update({ actif })
    .eq("id", id)
    .select("restaurant_id")
    .single();

  await journaliserActionSysteme(contexte, {
    action: actif ? "mise_en_avant.activation" : "mise_en_avant.desactivation",
    cibleType: "restaurant",
    cibleId: data?.restaurant_id ?? id,
  });

  revalidatePath("/system/catalogue/mises-en-avant");
}

export async function retirerMiseEnAvantAction(id: string): Promise<void> {
  const contexte = await verifierPermission("contenu.mettre_en_avant");
  const supabase = await creerClientServeur();

  const { data } = await supabase
    .from("featured_placements")
    .delete()
    .eq("id", id)
    .select("restaurant_id")
    .single();

  await journaliserActionSysteme(contexte, {
    action: "mise_en_avant.suppression",
    cibleType: "restaurant",
    cibleId: data?.restaurant_id ?? id,
  });

  revalidatePath("/system/catalogue/mises-en-avant");
}
