"use server";

import { revalidatePath } from "next/cache";
import { estLienBanniereSur } from "@/lib/auth/redirection";
import { creerClientServeur } from "@/lib/db/server";
import { verifierPermission } from "./contexte";
import { verifierPalier } from "./paliers-serveur";
import { MINIMUMS_STUDIO } from "./paliers";
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
 *
 * Studio, palier 2 : en plus de `contenu.editer` (inchangée), chaque fonction exige un palier sur son actif
 * (`contenu:pages`, `contenu:bannieres`) : voir ≥ 0, brouillon ≥ 1, publier/dépublier/supprimer ≥ 2. Modifier une page
 * déjà en ligne change directement le site : cela demande aussi le palier 2. Sans habilitation, les rôles gardent leur
 * comportement d'avant (préréglages) ; habilitations illisibles = refus (voir paliers-serveur.ts).
 */

/** Message d'un refus de palier pour les formulaires (qui affichent une erreur au lieu de lever). */
function messageRefus(erreur: unknown): string {
  return erreur instanceof ErreurMetier ? erreur.message : "Action refusée.";
}

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
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
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
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
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
  // L'adresse « accueil » est réservée à la page d'accueil du site (accueil en blocs, bouton dédié) : une page de texte qui
  // la prendrait ne pourrait ni être supprimée ni renommée et bloquerait ce bouton.
  if (slug === "accueil") {
    return { erreur: "Ce nom est réservé à la page d'accueil du site. Utilisez le bouton « Créer l'accueil en blocs »." };
  }
  if (!titre || titre.length > 200) {
    return { erreur: "Le titre est obligatoire (200 caractères maximum)." };
  }
  if (contenu.length > 20000) {
    return { erreur: "Le contenu ne peut pas dépasser 20 000 caractères." };
  }

  const contexte = await verifierPermission("contenu.editer");
  try {
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.brouillon, { contexte });
  } catch (erreur) {
    return { erreur: messageRefus(erreur) };
  }
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
  let palier;
  try {
    ({ palier } = await verifierPalier("contenu:pages", MINIMUMS_STUDIO.brouillon, { contexte }));
  } catch (erreur) {
    return { erreur: messageRefus(erreur) };
  }
  const supabase = await creerClientServeur();

  if (palier < MINIMUMS_STUDIO.publier) {
    // Palier Contributeur : brouillons seulement. La condition sur le statut est DANS la mise à jour (pas seulement lue
    // avant), pour qu'une publication simultanée ne laisse pas passer une modification du site en ligne.
    const { data: modifiees, error } = await supabase
      .from("content_pages")
      .update({ titre, contenu, mis_a_jour_le: new Date().toISOString() })
      .eq("id", id)
      .eq("statut", "brouillon")
      .select("id");
    if (error) {
      return { erreur: "Impossible d'enregistrer les modifications." };
    }
    if (!modifiees || modifiees.length === 0) {
      return {
        erreur:
          "Cette page est en ligne : la modifier change directement le site, ce qui demande le palier Éditeur. Votre accès est limité aux brouillons.",
      };
    }
  } else {
    const { error } = await supabase
      .from("content_pages")
      .update({ titre, contenu, mis_a_jour_le: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { erreur: "Impossible d'enregistrer les modifications." };
    }
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

/**
 * Publie ou dépublie une page de TEXTE.
 *
 * Refuse explicitement une page à blocs (7 octobre 2026) : sa publication passe par
 * `fn_publier_blocs`, qui copie le brouillon validé vers `blocs_publie`, incrémente la
 * version et élague en UNE transaction. Poser seulement `statut` laisserait `blocs_publie`
 * périmé — la page en ligne afficherait un contenu vide ou ancien. Le trigger
 * `fn_garde_palier_blocs` refusait déjà cette mise à jour, mais cette fonction ignorait le
 * résultat de l'écriture : l'action renvoyait une réussite, journalisait « publication », et
 * ne se passait rien. Un refus explicite vaut mieux qu'un échec silencieux.
 *
 * Le résultat de l'écriture est maintenant vérifié : rien n'est journalisé si la base n'a
 * rien modifié.
 */
export async function basculerPublicationPageAction(id: string, publier: boolean): Promise<void> {
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:pages", MINIMUMS_STUDIO.publier, { contexte });
  const supabase = await creerClientServeur();

  const { data: page, error: erreurLecture } = await supabase
    .from("content_pages")
    .select("format")
    .eq("id", id)
    .maybeSingle();
  if (erreurLecture || !page) throw new ErreurMetier("INTROUVABLE", "Page introuvable.");
  if (page.format === "blocs") {
    throw new ErreurMetier(
      "VALIDATION",
      "Une page à blocs se publie depuis son éditeur : la publication y valide les blocs, met à jour la version en ligne et garde l'historique."
    );
  }

  const { data: modifiees, error: erreurEcriture } = await supabase
    .from("content_pages")
    .update({
      statut: publier ? "publie" : "brouillon",
      publie_le: publier ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");
  if (erreurEcriture) throw new ErreurMetier("ERREUR_SERVEUR", "Impossible de modifier le statut de cette page, réessayez dans un instant.");
  if (!modifiees || modifiees.length === 0) {
    throw new ErreurMetier("CONFLIT_ETAT", "Cette page a changé entre-temps. Rechargez-la avant de réessayer.");
  }

  await journaliserActionSysteme(contexte, {
    action: publier ? "contenu.page_publication" : "contenu.page_depublication",
    cibleType: "content_page",
    cibleId: id,
  });

  await invaliderPagePubliee(supabase, id);
  revalidatePath("/system/contenu/pages");
  revalidatePath(`/system/contenu/pages/${id}`);
}

/**
 * Supprime une page (texte ou à blocs) — et, par cascade, son historique de versions
 * (`content_pages_versions.page_id ... on delete cascade`, avec le trigger de palier qui exige
 * ≥ 2 sur les deux tables).
 *
 * Le slug est lu AVANT l'écriture : `invaliderPagePubliee` relit l'identifiant après coup, ce qui
 * ne trouverait plus rien une fois la ligne supprimée — seule la purge par slug évite que l'ancien
 * contenu reste servi 60 s.
 *
 * Supprimer la page `accueil` est accepté : le site bascule alors sur son accueil d'origine par le
 * repli prévu (`decider` → « aucune page publiée »), silencieusement et sans erreur — c'est le même
 * état qu'avant sa création.
 */
export async function supprimerPageAction(id: string): Promise<EtatActionContenu> {
  // `verifierPermission` peut appeler `notFound()` (signal Next.js, à propager tel quel) ou
  // jeter `ErreurMetier("NON_AUTORISE")` — converti en objet pour que le client l'affiche.
  let contexte;
  try {
    contexte = await verifierPermission("contenu.editer");
  } catch (erreur) {
    if (erreur instanceof ErreurMetier) return { erreur: messageRefus(erreur) };
    throw erreur;
  }
  try {
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.publier, { contexte });
  } catch (erreur) {
    return { erreur: messageRefus(erreur) };
  }
  const supabase = await creerClientServeur();

  const { data: page, error: erreurLecture } = await supabase
    .from("content_pages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (erreurLecture || !page) {
    return { erreur: "Page introuvable." };
  }

  const { error } = await supabase.from("content_pages").delete().eq("id", id);
  if (error) {
    return { erreur: "Impossible de supprimer la page." };
  }

  // La page est supprimée ; l'audit et l'invalidation du cache sont best-effort : un échec ici
  // ne doit pas faire croire que la suppression a échoué (la page n'existe déjà plus).
  try {
    await journaliserActionSysteme(contexte, {
      action: "contenu.page_suppression",
      cibleType: "content_page",
      cibleId: id,
      motif: page.slug,
    });
  } catch {
    // trace d'audit manquante — la suppression a tout de même eu lieu.
  }

  try {
    await invaliderCache([`page:${page.slug}`]);
  } catch {
    // Le TTL (60 s) prend le relais.
  }
  try {
    revalidatePath(`/p/${page.slug}`);
    if (page.slug === "accueil") revalidatePath("/");
    revalidatePath("/system/contenu/pages");
  } catch {
    // revalidatePath est best-effort après une suppression réussie.
  }
  return { succes: true };
}

// --- Bannières -------------------------------------------------------------

export async function listerBannieres(): Promise<Banniere[]> {
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:bannieres", MINIMUMS_STUDIO.lire, { contexte });
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
  try {
    await verifierPalier("contenu:bannieres", MINIMUMS_STUDIO.brouillon, { contexte });
  } catch (erreur) {
    return { erreur: messageRefus(erreur) };
  }

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
  await verifierPalier("contenu:bannieres", MINIMUMS_STUDIO.publier, { contexte });
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
  await verifierPalier("contenu:bannieres", MINIMUMS_STUDIO.publier, { contexte });
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
