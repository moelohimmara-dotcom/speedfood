"use server";

import { revalidatePath } from "next/cache";
import { estUuid } from "@/lib/commande/commun";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Géographie administrable depuis la console système : communes (activer / désactiver, renommer) et
 * quartiers (créer, renommer, changer de commune, activer / désactiver). Même permission que la taxonomie
 * (`taxonomie.editer`). Toute écriture est journalisée dans `audit_events`.
 * Désactiver ne supprime rien : les restaurants déjà rattachés gardent leur quartier.
 */

export interface EtatGeographie {
  erreur?: string;
  succes?: boolean;
}

export interface CommuneSysteme {
  id: string;
  nom: string;
  actif: boolean;
  codeOfficiel: string | null;
}

export interface QuartierSysteme {
  id: string;
  nom: string;
  actif: boolean;
  communeId: string | null;
  communeNom: string | null;
}

export interface GeographieSysteme {
  communes: CommuneSysteme[];
  quartiers: QuartierSysteme[];
}

const MESSAGE_ECHEC = "Impossible d'enregistrer. Réessayez dans un instant.";

export async function listerGeographieSysteme(): Promise<GeographieSysteme> {
  const { supabase } = await verifierPermission("taxonomie.editer");

  const [{ data: communes }, { data: quartiers }] = await Promise.all([
    supabase.from("communes").select("id, nom, actif, code_officiel").order("nom"),
    supabase
      .from("neighborhoods")
      .select("id, nom, actif, commune_id, communes(nom)")
      .order("nom"),
  ]);

  return {
    communes: (communes ?? []).map((c) => ({
      id: c.id,
      nom: c.nom,
      actif: c.actif,
      codeOfficiel: c.code_officiel,
    })),
    quartiers: (quartiers ?? []).map((q) => {
      const commune = Array.isArray(q.communes) ? q.communes[0] : q.communes;
      return {
        id: q.id,
        nom: q.nom,
        actif: q.actif,
        communeId: q.commune_id,
        communeNom: commune?.nom ?? null,
      };
    }),
  };
}

function lireNom(formData: FormData): string | null {
  const nom = String(formData.get("nom") ?? "").trim();
  if (nom.length < 2 || nom.length > 80) {
    return null;
  }
  return nom;
}

/** Créer ou modifier un quartier. Sans `id` : création. */
export async function enregistrerQuartierAction(
  _etatPrecedent: EtatGeographie,
  formData: FormData
): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const id = String(formData.get("id") ?? "");
  const nom = lireNom(formData);
  const communeId = String(formData.get("commune_id") ?? "");
  const actif = formData.get("actif") === "on";

  if (!nom) {
    return { erreur: "Le nom du quartier doit compter de 2 à 80 caractères." };
  }
  if (!estUuid(communeId)) {
    return { erreur: "Choisissez une commune." };
  }
  if (id && !estUuid(id)) {
    return { erreur: "Quartier introuvable." };
  }

  const supabase = contexte.supabase;
  if (id) {
    const { error } = await supabase
      .from("neighborhoods")
      .update({ nom, commune_id: communeId, actif })
      .eq("id", id);
    if (error) {
      return { erreur: error.code === "23505" ? "Ce nom de quartier existe déjà." : MESSAGE_ECHEC };
    }
    await journaliserActionSysteme(contexte, {
      action: "taxonomie.modification",
      cibleType: "neighborhoods",
      cibleId: id,
      motif: `${nom} (${actif ? "actif" : "inactif"})`,
    });
  } else {
    const { data, error } = await supabase
      .from("neighborhoods")
      .insert({ nom, commune_id: communeId, actif })
      .select("id")
      .single();
    if (error || !data) {
      return { erreur: error?.code === "23505" ? "Ce nom de quartier existe déjà." : MESSAGE_ECHEC };
    }
    await journaliserActionSysteme(contexte, {
      action: "taxonomie.creation",
      cibleType: "neighborhoods",
      cibleId: data.id,
      motif: nom,
    });
  }

  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  return { succes: true };
}

/** Activer / désactiver une commune (et renommer). */
export async function enregistrerCommuneAction(
  _etatPrecedent: EtatGeographie,
  formData: FormData
): Promise<EtatGeographie> {
  const contexte = await verifierPermission("taxonomie.editer");
  const id = String(formData.get("id") ?? "");
  const nom = lireNom(formData);
  const actif = formData.get("actif") === "on";

  if (!estUuid(id)) {
    return { erreur: "Commune introuvable." };
  }
  if (!nom) {
    return { erreur: "Le nom de la commune doit compter de 2 à 80 caractères." };
  }

  const { error } = await contexte.supabase.from("communes").update({ nom, actif }).eq("id", id);
  if (error) {
    return { erreur: error.code === "23505" ? "Ce nom de commune existe déjà." : MESSAGE_ECHEC };
  }

  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: "communes",
    cibleId: id,
    motif: `${nom} (${actif ? "active" : "inactive"})`,
  });

  revalidatePath("/system/catalogue/geographie");
  revalidatePath("/restaurants");
  revalidatePath("/quartiers");
  return { succes: true };
}
