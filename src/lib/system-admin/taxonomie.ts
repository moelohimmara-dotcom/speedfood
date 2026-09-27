"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";

/**
 * Taxonomie (catégories de menu, quartiers) — bloc 8c. Ces deux tables
 * n'avaient aucune policy d'écriture avant la migration 20260927230000 : geré
 * uniquement en SQL direct jusqu'ici. Référencées par `restaurants` (clé
 * étrangère `not null`) : la suppression d'une valeur utilisée échoue
 * proprement (contrainte de clé étrangère), message clair renvoyé.
 */

export interface EtatActionTaxonomie {
  erreur?: string;
  succes?: boolean;
}

export interface ElementTaxonomie {
  id: string;
  nom: string;
  ordre: number;
}

type TableTaxonomie = "menu_categories" | "neighborhoods";

export async function listerTaxonomie(table: TableTaxonomie): Promise<ElementTaxonomie[]> {
  await verifierPermission("taxonomie.editer");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.from(table).select("id, nom, ordre").order("ordre");
  if (error || !data) {
    return [];
  }
  return data;
}

function estViolationCleEtrangere(error: { code?: string }): boolean {
  return error.code === "23503";
}

export async function creerElementTaxonomieAction(
  table: TableTaxonomie,
  _etatPrecedent: EtatActionTaxonomie,
  formData: FormData
): Promise<EtatActionTaxonomie> {
  const nom = String(formData.get("nom") ?? "").trim();
  const ordreBrut = String(formData.get("ordre") ?? "0");
  const ordre = Number.parseInt(ordreBrut, 10);

  if (!nom || nom.length > 100) {
    return { erreur: "Le nom est obligatoire (100 caractères maximum)." };
  }
  if (!Number.isFinite(ordre)) {
    return { erreur: "Ordre d'affichage invalide." };
  }

  const contexte = await verifierPermission("taxonomie.editer");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from(table)
    .insert({ nom, ordre })
    .select("id")
    .single();

  if (error) {
    return {
      erreur:
        error.code === "23505"
          ? "Ce nom existe déjà."
          : "Impossible de créer cet élément. Réessayez dans un instant.",
    };
  }

  await journaliserActionSysteme(contexte, {
    action: "taxonomie.creation",
    cibleType: table,
    cibleId: data.id,
    motif: nom,
  });

  revalidatePath("/system/contenus/taxonomie");
  return { succes: true };
}

export async function modifierElementTaxonomieAction(
  table: TableTaxonomie,
  _etatPrecedent: EtatActionTaxonomie,
  formData: FormData
): Promise<EtatActionTaxonomie> {
  const id = String(formData.get("id") ?? "");
  const nom = String(formData.get("nom") ?? "").trim();
  const ordreBrut = String(formData.get("ordre") ?? "0");
  const ordre = Number.parseInt(ordreBrut, 10);

  if (!id) {
    return { erreur: "Élément introuvable." };
  }
  if (!nom || nom.length > 100) {
    return { erreur: "Le nom est obligatoire (100 caractères maximum)." };
  }
  if (!Number.isFinite(ordre)) {
    return { erreur: "Ordre d'affichage invalide." };
  }

  const contexte = await verifierPermission("taxonomie.editer");
  const supabase = await creerClientServeur();

  const { error } = await supabase.from(table).update({ nom, ordre }).eq("id", id);

  if (error) {
    return {
      erreur:
        error.code === "23505"
          ? "Ce nom existe déjà."
          : "Impossible de modifier cet élément. Réessayez dans un instant.",
    };
  }

  await journaliserActionSysteme(contexte, {
    action: "taxonomie.modification",
    cibleType: table,
    cibleId: id,
    motif: nom,
  });

  revalidatePath("/system/contenus/taxonomie");
  return { succes: true };
}

export async function supprimerElementTaxonomieAction(
  table: TableTaxonomie,
  id: string
): Promise<{ erreur?: string }> {
  const contexte = await verifierPermission("taxonomie.editer");
  const supabase = await creerClientServeur();

  const { error } = await supabase.from(table).delete().eq("id", id);

  if (error) {
    if (estViolationCleEtrangere(error)) {
      return {
        erreur:
          "Impossible de supprimer : au moins un restaurant utilise encore cette valeur.",
      };
    }
    return { erreur: "Impossible de supprimer cet élément." };
  }

  await journaliserActionSysteme(contexte, {
    action: "taxonomie.suppression",
    cibleType: table,
    cibleId: id,
  });

  revalidatePath("/system/contenus/taxonomie");
  return {};
}
