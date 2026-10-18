"use server";

import { revalidatePath } from "next/cache";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { lireTout } from "@/lib/db/lecture-complete";

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

/**
 * Les Server Actions sont appelables avec des arguments arbitraires : le type
 * TypeScript ne protège pas à l'exécution (revue de sécurité, point 11). Liste blanche.
 */
const TABLES_TAXONOMIE: readonly string[] = ["menu_categories", "neighborhoods"];

function verifierTable(table: string): void {
  if (!TABLES_TAXONOMIE.includes(table)) {
    throw new Error("Table de taxonomie inconnue.");
  }
}

export async function listerTaxonomie(table: TableTaxonomie): Promise<ElementTaxonomie[]> {
  verifierTable(table);
  await verifierPermission("taxonomie.editer");
  const supabase = await creerClientServeur();
  // Les quartiers techniques « Centre de … » (generique) représentent une commune hors Conakry : plus de 300, jamais à modifier ni à
  // supprimer ici (ils se gèrent par la commune, dans Géographie). Ils noyaient la liste (près de 1 000 boutons) et pouvaient être supprimés.
  const { data, error } =
    table === "neighborhoods"
      ? await lireTout((de, a) => supabase.from("neighborhoods").select("id, nom, ordre").eq("generique", false).order("ordre").order("id").range(de, a))
      : await supabase.from("menu_categories").select("id, nom, ordre").order("ordre");
  if (error || !data) {
    return [];
  }
  return data;
}

const MESSAGE_GENERIQUE =
  "Ce quartier « Centre de … » représente une commune : il ne se modifie ni ne se supprime ici (il se gère par la commune, dans Géographie).";

/** Garde serveur : le navigateur n'est jamais cru (une action peut être appelée avec n'importe quel identifiant). */
async function estQuartierGenerique(id: string): Promise<boolean> {
  const supabase = await creerClientServeur();
  const { data } = await supabase.from("neighborhoods").select("generique").eq("id", id).maybeSingle();
  return data?.generique === true;
}

function estViolationCleEtrangere(error: { code?: string }): boolean {
  return error.code === "23503";
}

export async function creerElementTaxonomieAction(
  table: TableTaxonomie,
  _etatPrecedent: EtatActionTaxonomie,
  formData: FormData
): Promise<EtatActionTaxonomie> {
  verifierTable(table);
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

  revalidatePath("/system/catalogue/taxonomie");
  return { succes: true };
}

export async function modifierElementTaxonomieAction(
  table: TableTaxonomie,
  _etatPrecedent: EtatActionTaxonomie,
  formData: FormData
): Promise<EtatActionTaxonomie> {
  verifierTable(table);
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
  if (table === "neighborhoods" && (await estQuartierGenerique(id))) {
    return { erreur: MESSAGE_GENERIQUE };
  }
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

  revalidatePath("/system/catalogue/taxonomie");
  return { succes: true };
}

export async function supprimerElementTaxonomieAction(
  table: TableTaxonomie,
  id: string
): Promise<{ erreur?: string }> {
  verifierTable(table);
  const contexte = await verifierPermission("taxonomie.editer");
  if (table === "neighborhoods") {
    if (await estQuartierGenerique(id)) {
      return { erreur: MESSAGE_GENERIQUE };
    }
    // La suppression d'un quartier efface en cascade, dans la base, les inscrits de la liste d'attente et les zones de livraison qui le
    // visent : on refuse tant qu'il en reste (il suffit de désactiver le quartier dans Géographie pour le retirer des choix).
    const admin = creerClientAdmin();
    const [{ count: attente }, { count: zones }] = await Promise.all([
      admin.from("zone_alertes").select("id", { count: "exact", head: true }).eq("neighborhood_id", id),
      admin.from("restaurant_zones_desservies").select("id", { count: "exact", head: true }).eq("neighborhood_id", id),
    ]);
    if ((attente ?? 0) > 0 || (zones ?? 0) > 0) {
      return {
        erreur: `Impossible de supprimer : ${attente ?? 0} personne(s) en liste d'attente et ${zones ?? 0} zone(s) de livraison dépendent de ce quartier. Désactivez-le dans Géographie pour le retirer des choix.`,
      };
    }
  }
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

  revalidatePath("/system/catalogue/taxonomie");
  return {};
}
