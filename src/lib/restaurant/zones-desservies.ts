"use server";

import { revalidatePath } from "next/cache";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { estUuid } from "@/lib/commande/commun";

export interface EtatZoneDesservie {
  erreur?: string;
  succes?: boolean;
}

/** Entier facultatif dans une plage ; chaîne vide = non renseigné (rien n'est inventé à la place). */
function entierFacultatif(brut: FormDataEntryValue | null, min: number, max: number, libelle: string): { valeur: number | null; erreur?: string } {
  const texte = String(brut ?? "").replace(/[\s  ]/g, "");
  if (texte === "") return { valeur: null };
  if (!/^\d{1,7}$/.test(texte)) return { valeur: null, erreur: `${libelle} : entrez un nombre entier.` };
  const n = Number(texte);
  if (n < min || n > max) return { valeur: null, erreur: `${libelle} : entre ${min.toLocaleString("fr-FR")} et ${max.toLocaleString("fr-FR")}.` };
  return { valeur: n };
}

/**
 * Le restaurateur déclare une zone qu'il dessert (commune entière ou quartier), avec des frais et un délai facultatifs.
 * Redéclarer une zone met à jour ses frais et son délai. La zone est revérifiée ici (active), la ligne reste protégée par la RLS
 * des membres : un restaurateur ne peut écrire que pour son établissement.
 */
export async function declarerZoneDesserviePAction(_etat: EtatZoneDesservie, formData: FormData): Promise<EtatZoneDesservie> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");

  const zone = String(formData.get("zone") ?? "");
  const [type, id] = zone.split(":");
  if ((type !== "c" && type !== "q") || !estUuid(id ?? "")) {
    return { erreur: "Choisissez une zone dans la liste." };
  }
  const frais = entierFacultatif(formData.get("frais_gnf"), 0, 1_000_000, "Frais de livraison");
  if (frais.erreur) return { erreur: frais.erreur };
  const delai = entierFacultatif(formData.get("delai_minutes"), 5, 480, "Délai");
  if (delai.erreur) return { erreur: delai.erreur };

  // La zone doit exister et être active (un quartier désactivé ou d'une commune désactivée est refusé).
  if (type === "c") {
    const { data } = await supabase.from("communes").select("id").eq("id", id).eq("actif", true).maybeSingle();
    if (!data) return { erreur: "Cette commune n'est plus proposée." };
  } else {
    const { data } = await supabase.from("neighborhoods").select("id, communes!inner(actif)").eq("id", id).eq("actif", true).eq("communes.actif", true).maybeSingle();
    if (!data) return { erreur: "Ce quartier n'est plus proposé." };
  }

  const colonne = type === "c" ? "commune_id" : "neighborhood_id";
  const { data: existante, error: erreurLecture } = await supabase
    .from("restaurant_zones_desservies")
    .select("id")
    .eq("restaurant_id", membership.restaurant_id)
    .eq(colonne, id)
    .maybeSingle();
  if (erreurLecture) return { erreur: "Impossible de vérifier vos zones. Réessayez dans un instant." };

  const valeurs = { frais_gnf: frais.valeur, delai_minutes: delai.valeur };
  const { error } = existante
    ? await supabase.from("restaurant_zones_desservies").update(valeurs).eq("id", existante.id).eq("restaurant_id", membership.restaurant_id)
    : await supabase.from("restaurant_zones_desservies").insert({ restaurant_id: membership.restaurant_id, [colonne]: id, ...valeurs });
  if (error) return { erreur: "Impossible d'enregistrer cette zone. Réessayez dans un instant." };

  revalidatePath("/restaurant/profil");
  revalidatePath(`/restaurants/${membership.restaurant_id}`);
  return { succes: true };
}

/** Retire une zone desservie de CE restaurant (le filtre sur le restaurant s'ajoute à la RLS). */
export async function retirerZoneDesserviePAction(formData: FormData): Promise<void> {
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/profil");
  const id = String(formData.get("id") ?? "");
  if (!estUuid(id)) return;
  await supabase.from("restaurant_zones_desservies").delete().eq("id", id).eq("restaurant_id", membership.restaurant_id);
  revalidatePath("/restaurant/profil");
  revalidatePath(`/restaurants/${membership.restaurant_id}`);
}
