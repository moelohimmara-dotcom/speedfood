"use server";

import { revalidatePath } from "next/cache";
import { estLienBanniereSur } from "@/lib/auth/redirection";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { journaliserActionSysteme } from "./audit";
import { televerserImage, supprimerImage } from "@/lib/storage/images";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { invaliderCache } from "@/lib/cms/cache";

/**
 * Pages éditoriales (aide/FAQ/accueil) et bannières — bloc 8c. Toute mutation
 * vérifie `contenu.editer` et journalise l'action. Statut brouillon/publié
 * déjà appliqué par la RLS (`editeurs_gestion_contenu`/`editeurs_gestion_bannieres`,
 * lecture publique restreinte à `statut = 'publie'`) : aucun contenu non
 * publié n'est jamais exposé publiquement, quoi que fasse ce code.
 */

export interface EtatActionContenu {
  erreur?: string;
  succes?: boolean;
}

export interface PageEditoriale {
  id: string;
  slug: string;
  titre: string;
  contenu: string;
  statut: "brouillon" | "publie";
  auteur_id: string | null;
  cree_le: string;
  mis_a_jour_le: string;
  publie_le: string | null;
}

export interface Banniere {
  id: string;
  titre: string;
  texte: string;
  lien: string | null;
  statut: "brouillon" | "publie";
  ordre: number;
  auteur_id: string | null;
  cree_le: string;
  mis_a_jour_le: string;
  image_url: string | null;
}

const REGEX_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Invalidation du cache public (cms/cache.ts) après une écriture réussie. Elle ne purge QUE le centre de données local :
 * ailleurs, le TTL (60 s, 10 s pour une valeur vide) borne le délai. Le slug d'une page n'est pas modifiable ; pour une
 * action par identifiant on le relit, faute de quoi seul le TTL s'applique (jamais d'erreur ici).
 */
async function invaliderPagePubliee(supabase: Awaited<ReturnType<typeof creerClientServeur>>, id: string) {
  try {
    const { data } = await supabase.from("content_pages").select("slug").eq("id", id).maybeSingle();
    if (data?.slug) await invaliderCache([`page:${data.slug}`]);
  } catch {
    // Le TTL prend le relais.
  }
}

export async function listerPages(): Promise<PageEditoriale[]> {
  await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("content_pages")
    .select("id, slug, titre, contenu, statut, auteur_id, cree_le, mis_a_jour_le, publie_le")
    .order("mis_a_jour_le", { ascending: false });
  if (error || !data) {
    return [];
  }
  return data as PageEditoriale[];
}

export async function obtenirPage(id: string): Promise<PageEditoriale | null> {
  await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("content_pages")
    .select("id, slug, titre, contenu, statut, auteur_id, cree_le, mis_a_jour_le, publie_le")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as PageEditoriale;
}

export async function creerPageAction(
  _etatPrecedent: EtatActionContenu,
  formData: FormData
): Promise<EtatActionContenu> {
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const titre = String(formData.get("titre") ?? "").trim();
  const contenu = String(formData.get("contenu") ?? "");

  if (!slug || !REGEX_SLUG.test(slug)) {
    return {
      erreur: "Le slug doit être en minuscules, sans espaces (ex. \"comment-commander\").",
    };
  }
  if (!titre || titre.length > 200) {
    return { erreur: "Le titre est obligatoire (200 caractères maximum)." };
  }
  if (contenu.length > 20000) {
    return { erreur: "Le contenu ne peut pas dépasser 20 000 caractères." };
  }

  const contexte = await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from("content_pages")
    .insert({ slug, titre, contenu, statut: "brouillon", auteur_id: contexte.utilisateurId })
    .select("id")
    .single();

  if (error) {
    return {
      erreur: error.code === "23505" ? "Ce slug existe déjà." : "Impossible de créer la page.",
    };
  }

  await journaliserActionSysteme(contexte, {
    action: "contenu.page_creation",
    cibleType: "content_page",
    cibleId: data.id,
    motif: slug,
  });

  await invaliderCache([`page:${slug}`]);
  revalidatePath("/system/contenu/pages");
  return { succes: true };
}

export async function modifierPageAction(
  _etatPrecedent: EtatActionContenu,
  formData: FormData
): Promise<EtatActionContenu> {
  const id = String(formData.get("id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const contenu = String(formData.get("contenu") ?? "");

  if (!id) {
    return { erreur: "Page introuvable." };
  }
  if (!titre || titre.length > 200) {
    return { erreur: "Le titre est obligatoire (200 caractères maximum)." };
  }
  if (contenu.length > 20000) {
    return { erreur: "Le contenu ne peut pas dépasser 20 000 caractères." };
  }

  const contexte = await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();

  const { error } = await supabase
    .from("content_pages")
    .update({ titre, contenu, mis_a_jour_le: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { erreur: "Impossible d'enregistrer les modifications." };
  }

  await journaliserActionSysteme(contexte, {
    action: "contenu.page_modification",
    cibleType: "content_page",
    cibleId: id,
  });

  await invaliderPagePubliee(supabase, id);
  revalidatePath("/system/contenu/pages");
  revalidatePath(`/system/contenu/pages/${id}`);
  return { succes: true };
}

export async function basculerPublicationPageAction(id: string, publier: boolean): Promise<void> {
  const contexte = await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();

  await supabase
    .from("content_pages")
    .update({
      statut: publier ? "publie" : "brouillon",
      publie_le: publier ? new Date().toISOString() : null,
    })
    .eq("id", id);

  await journaliserActionSysteme(contexte, {
    action: publier ? "contenu.page_publication" : "contenu.page_depublication",
    cibleType: "content_page",
    cibleId: id,
  });

  await invaliderPagePubliee(supabase, id);
  revalidatePath("/system/contenu/pages");
  revalidatePath(`/system/contenu/pages/${id}`);
}

// --- Bannières -------------------------------------------------------------

export async function listerBannieres(): Promise<Banniere[]> {
  await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("content_banners")
    .select("id, titre, texte, lien, statut, ordre, auteur_id, cree_le, mis_a_jour_le, image_url")
    .order("ordre");
  if (error || !data) {
    return [];
  }
  return data as Banniere[];
}

export async function creerBanniereAction(
  _etatPrecedent: EtatActionContenu,
  formData: FormData
): Promise<EtatActionContenu> {
  const titre = String(formData.get("titre") ?? "").trim();
  const texte = String(formData.get("texte") ?? "").trim();
  const lien = String(formData.get("lien") ?? "").trim();
  const ordreBrut = String(formData.get("ordre") ?? "0");
  const ordre = Number.parseInt(ordreBrut, 10);

  if (!titre || titre.length > 200) {
    return { erreur: "Le titre est obligatoire (200 caractères maximum)." };
  }
  if (texte.length > 500) {
    return { erreur: "Le texte ne peut pas dépasser 500 caractères." };
  }
  if (!Number.isFinite(ordre)) {
    return { erreur: "Ordre d'affichage invalide." };
  }
  if (lien && !estLienBanniereSur(lien)) {
    return { erreur: "Le lien doit être un chemin du site (/restaurants) ou une adresse https://." };
  }

  const contexte = await verifierPermission("contenu.editer");

  let imageUrl: string | null = null;
  const fichierImage = formData.get("image");
  if (fichierImage instanceof File && fichierImage.size > 0) {
    try {
      imageUrl = await televerserImage(fichierImage, "bannieres");
    } catch (erreur) {
      return { erreur: erreur instanceof ErreurMetier ? erreur.message : "Impossible d'enregistrer l'image." };
    }
  }

  const supabase = await creerClientServeur();

  const { data, error } = await supabase
    .from("content_banners")
    .insert({
      titre,
      texte,
      lien: lien || null,
      ordre,
      statut: "brouillon",
      auteur_id: contexte.utilisateurId,
      image_url: imageUrl,
    })
    .select("id")
    .single();

  if (error) {
    return { erreur: "Impossible de créer la bannière." };
  }

  await journaliserActionSysteme(contexte, {
    action: "contenu.banniere_creation",
    cibleType: "content_banner",
    cibleId: data.id,
    motif: titre,
  });

  await invaliderCache(["bannieres"]);
  revalidatePath("/system/contenu/bannieres");
  return { succes: true };
}

export async function basculerPublicationBanniereAction(
  id: string,
  publier: boolean
): Promise<void> {
  const contexte = await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();

  await supabase
    .from("content_banners")
    .update({
      statut: publier ? "publie" : "brouillon",
      mis_a_jour_le: new Date().toISOString(),
    })
    .eq("id", id);

  await journaliserActionSysteme(contexte, {
    action: publier ? "contenu.banniere_publication" : "contenu.banniere_depublication",
    cibleType: "content_banner",
    cibleId: id,
  });

  await invaliderCache(["bannieres"]);
  revalidatePath("/system/contenu/bannieres");
}

export async function supprimerBanniereAction(id: string): Promise<void> {
  const contexte = await verifierPermission("contenu.editer");
  const supabase = await creerClientServeur();

  const { data: banniere } = await supabase
    .from("content_banners")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("content_banners").delete().eq("id", id);
  await supprimerImage(banniere?.image_url ?? null);

  await journaliserActionSysteme(contexte, {
    action: "contenu.banniere_suppression",
    cibleType: "content_banner",
    cibleId: id,
  });

  await invaliderCache(["bannieres"]);
  revalidatePath("/system/contenu/bannieres");
}
