"use server";

import { revalidatePath } from "next/cache";
import { creerClientAdmin } from "@/lib/db/admin";
import type { Json } from "@/lib/db/database.types";
import { ErreurMetier } from "@/lib/contracts/erreurs";
import { invaliderCache } from "@/lib/cms/cache";
import { slugValide } from "@/lib/cms/lecture";
import { SLUG_ACCUEIL, pageVide, validerPage } from "@/lib/studio/registre";
import { AVERTISSEMENTS_TRACE, finaliserEcriture } from "@/lib/studio/apres-ecriture";
import { MESSAGE_CONCURRENCE, jetonPerime } from "@/lib/studio/concurrence";
import { verifierPermission, type ContexteSysteme } from "./contexte";
import { verifierPalier } from "./paliers-serveur";
import { MINIMUMS_STUDIO } from "./paliers";
import { journaliserActionSysteme } from "./audit";

/**
 * Pages à blocs du Studio (palier 3) : actions serveur, sans interface (l'éditeur arrive en tâche 7).
 *
 * Toute action vérifie `contenu.editer` puis le palier sur `contenu:pages` (tâche 4) : lire ≥ 0 ; enregistrer le brouillon
 * d'une page HORS LIGNE ≥ 1 ; publier, restaurer une version, ou modifier le brouillon d'une page EN LIGNE ≥ 2. La base
 * applique la même règle aux personnes plafonnées (triggers fn_garde_palier_contenu et fn_garde_palier_blocs) : un appel
 * direct à l'API ne la contourne pas.
 *
 * Le document de blocs est validé par `validerPage` à l'écriture (ici) ET à la lecture (rendu public). Écritures avec la
 * SESSION de la personne (RLS et triggers s'appliquent). Le brouillon n'est lisible par aucun rôle de l'API (droits de
 * colonne) : il est lu avec la clé de service, seulement après les contrôles et après avoir vérifié avec la session que
 * la page est visible pour la personne. Un `pageId` reçu du navigateur n'est jamais une autorisation.
 *
 * Après une écriture réussie : invalidation du cache (contenu publié) PUIS trace d'audit, par `finaliserEcriture`. Une
 * trace en échec n'annule rien et ne fait pas croire à un refus : `ok: true` avec un `avertissement` exact (revue 6, I1).
 */

export interface EtatBlocs {
  ok: boolean;
  erreur?: string;
  /** Erreurs de validation du document (messages sans valeur saisie). */
  erreurs?: string[];
  version?: number;
  id?: string;
  /** Nouveau jeton de concurrence du brouillon après une écriture réussie (à renvoyer à l'écriture suivante). */
  jeton?: string;
  /** L'écriture a eu lieu, mais sa trace d'audit n'a pas pu être écrite (message exact à afficher). */
  avertissement?: string;
}

export interface VersionPage {
  version: number;
  auteur_id: string | null;
  motif: string | null;
  cree_le: string;
}

export interface BrouillonBlocs {
  id: string;
  slug: string;
  titre: string;
  statut: string;
  blocs_version: number;
  /** Jeton de concurrence du brouillon (`mis_a_jour_le`) à renvoyer à l'enregistrement et à la publication. */
  jeton: string;
  /** Document de travail tel qu'en base (à revalider avant tout rendu). */
  brouillon: unknown;
  /** Erreurs si le document de travail ne respecte plus le schéma courant (vide sinon). */
  erreurs: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MOTIF = 200;
const MESSAGE_EN_LIGNE =
  "Cette page est en ligne : modifier son brouillon demande le palier Éditeur. Votre accès est limité aux pages hors ligne.";

/** Erreur métier -> état d'échec ; toute autre exception (404 de `notFound`, panne) remonte telle quelle. */
function echec(erreur: unknown): EtatBlocs {
  if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.message };
  throw erreur;
}

/** Message d'une erreur d'écriture en base (jamais le détail technique). */
function messageBase(erreur: { code?: string; message?: string }, defaut: string): string {
  if (erreur.code === "42501") return "La base de données a refusé l'action : vos droits sont insuffisants.";
  if (erreur.code === "23514") return "Le document est refusé par la base (format ou taille, 200 Ko au maximum).";
  if (erreur.message === "REFUS:concurrence") return "La page a été modifiée pendant l'opération : rechargez-la puis réessayez.";
  return defaut;
}

async function lirePageSession(contexte: ContexteSysteme, pageId: string) {
  const { data, error } = await contexte.supabase
    .from("content_pages")
    .select("id, slug, titre, statut, format, blocs_version, mis_a_jour_le")
    .eq("id", pageId)
    .maybeSingle();
  if (error) throw new ErreurMetier("ERREUR_SERVEUR", "La page n'a pas pu être lue, réessayez dans un instant.");
  return data;
}

export async function creerPageBlocsAction(titreSaisi: string, slugSaisi: string): Promise<EtatBlocs> {
  const titre = String(titreSaisi ?? "").trim();
  const slug = String(slugSaisi ?? "").trim().toLowerCase();
  if (!slugValide(slug)) {
    return { ok: false, erreur: "Le slug doit être en minuscules, sans espaces (ex. \"comment-commander\")." };
  }
  if (!titre || titre.length > 200) return { ok: false, erreur: "Le titre est obligatoire (200 caractères maximum)." };
  // L'adresse « accueil » est réservée à la page d'accueil, créée par son bouton dédié (« Créer l'accueil en blocs »).
  if (slug === SLUG_ACCUEIL) {
    return { ok: false, erreur: "L'adresse « accueil » est réservée à la page d'accueil du site : utilisez le bouton « Créer l'accueil en blocs »." };
  }

  try {
    const contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.brouillon, { contexte });
    const { data, error } = await contexte.supabase
      .from("content_pages")
      .insert({
        slug,
        titre,
        contenu: "",
        statut: "brouillon",
        format: "blocs",
        blocs_brouillon: pageVide() as unknown as Json,
        auteur_id: contexte.utilisateurId,
      })
      .select("id")
      .single();
    if (error) {
      return { ok: false, erreur: error.code === "23505" ? "Ce slug existe déjà." : messageBase(error, "Impossible de créer la page.") };
    }
    const fin = await finaliserEcriture(
      {
        invalider: () => invaliderCache([`page:${slug}`]),
        journaliser: () =>
          journaliserActionSysteme(contexte, {
            action: "contenu.page_creation",
            cibleType: "content_page",
            cibleId: data.id,
            motif: `${slug} (blocs)`,
          }),
      },
      AVERTISSEMENTS_TRACE.creation
    );
    revalidatePath("/system/contenu/pages");
    return { ok: true, id: data.id, ...fin };
  } catch (erreur) {
    return echec(erreur);
  }
}

export async function enregistrerBrouillonBlocsAction(pageId: string, json: unknown, jeton?: string): Promise<EtatBlocs> {
  if (typeof pageId !== "string" || !UUID.test(pageId)) return { ok: false, erreur: "Page introuvable." };
  if (jeton !== undefined && (typeof jeton !== "string" || jeton.length === 0 || jeton.length > 64)) return { ok: false, erreur: MESSAGE_CONCURRENCE };

  try {
    const contexte = await verifierPermission("contenu.editer");
    const { palier } = await verifierPalier("contenu:pages", MINIMUMS_STUDIO.brouillon, { contexte });
    const page = await lirePageSession(contexte, pageId);
    if (!page) return { ok: false, erreur: "Page introuvable." };
    if (page.format !== "blocs") return { ok: false, erreur: "Cette page n'est pas une page à blocs." };
    // Validée avec l'adresse de la page : les sections d'accueil ne sont permises que sur « accueil ».
    const validation = validerPage(json, { slug: page.slug });
    if (!validation.ok) return { ok: false, erreur: "Le brouillon n'est pas valide.", erreurs: validation.erreurs };
    const limite = palier < MINIMUMS_STUDIO.publier;
    if (limite && page.statut === "publie") return { ok: false, erreur: MESSAGE_EN_LIGNE };

    // Palier Contributeur : la condition « hors ligne » est DANS la mise à jour (une publication simultanée ne laisse
    // pas passer la modification d'une page en ligne), comme pour les pages de texte.
    let requete = contexte.supabase
      .from("content_pages")
      .update({ blocs_brouillon: validation.page as unknown as Json })
      .eq("id", pageId)
      .eq("format", "blocs");
    if (limite) requete = requete.eq("statut", "brouillon");
    // Jeton de concurrence DANS la même requête (atomique) : une page modifiée depuis l'ouverture n'est pas écrasée.
    if (jeton !== undefined) requete = requete.eq("mis_a_jour_le", jeton);
    const { data: modifiees, error } = await requete.select("id, mis_a_jour_le");
    if (error) return { ok: false, erreur: messageBase(error, "Impossible d'enregistrer le brouillon.") };
    if (!modifiees || modifiees.length === 0) {
      if (jeton !== undefined) return { ok: false, erreur: MESSAGE_CONCURRENCE };
      return { ok: false, erreur: limite ? MESSAGE_EN_LIGNE : "Page introuvable." };
    }

    // Pas d'invalidation du cache public : un brouillon n'y entre jamais.
    const fin = await finaliserEcriture(
      {
        journaliser: () =>
          journaliserActionSysteme(contexte, {
            action: "contenu.blocs_brouillon",
            cibleType: "content_page",
            cibleId: pageId,
            motif: `${validation.page.content.length} bloc(s)`,
          }),
      },
      AVERTISSEMENTS_TRACE.brouillon
    );
    revalidatePath(`/system/contenu/pages/${pageId}`);
    return { ok: true, jeton: modifiees[0].mis_a_jour_le, ...fin };
  } catch (erreur) {
    return echec(erreur);
  }
}

export async function publierBlocsAction(pageId: string, motif?: string, jeton?: string): Promise<EtatBlocs> {
  if (typeof pageId !== "string" || !UUID.test(pageId)) return { ok: false, erreur: "Page introuvable." };
  const motifPropre = typeof motif === "string" ? motif.trim() : "";
  if (motifPropre.length > MAX_MOTIF) return { ok: false, erreur: `Le motif ne peut pas dépasser ${MAX_MOTIF} caractères.` };

  try {
    const contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.publier, { contexte });
    // La session doit voir la page (RLS) avant toute lecture par la clé de service.
    const visible = await lirePageSession(contexte, pageId);
    if (!visible) return { ok: false, erreur: "Page introuvable." };
    if (visible.format !== "blocs") return { ok: false, erreur: "Cette page n'est pas une page à blocs." };

    const { data: page, error: erreurLecture } = await creerClientAdmin()
      .from("content_pages")
      .select("slug, format, blocs_brouillon, mis_a_jour_le")
      .eq("id", pageId)
      .maybeSingle();
    if (erreurLecture || !page) return { ok: false, erreur: "Le brouillon n'a pas pu être lu, réessayez dans un instant." };
    // Jeton d'ouverture périmé : le brouillon a changé ailleurs, on ne publie pas un contenu que la personne n'a pas vu.
    if (jetonPerime(jeton, page.mis_a_jour_le)) return { ok: false, erreur: MESSAGE_CONCURRENCE };
    const validation = validerPage(page.blocs_brouillon, { slug: page.slug });
    if (!validation.ok) return { ok: false, erreur: "Le brouillon ne peut pas être publié.", erreurs: validation.erreurs };

    // Une seule transaction en base : copie du brouillon lu (et validé) vers la version en ligne, numéro de version,
    // historique, statut, élagage à 20 versions. Si la page a changé depuis la lecture (jeton `mis_a_jour_le`), rien
    // n'est écrit.
    const { data: version, error } = await contexte.supabase.rpc("fn_publier_blocs", {
      p_page_id: pageId,
      p_blocs: page.blocs_brouillon as Json,
      p_jeton: page.mis_a_jour_le,
      p_motif: motifPropre || null,
    });
    if (error || typeof version !== "number") {
      return { ok: false, erreur: messageBase(error ?? {}, "Impossible de publier la page.") };
    }

    // La page est en ligne : le cache est invalidé AVANT la trace, quoi qu'il arrive à celle-ci (revue 6, I1).
    const fin = await finaliserEcriture(
      {
        invalider: () => invaliderCache([`page:${page.slug}`]),
        journaliser: () =>
          journaliserActionSysteme(contexte, {
            action: "contenu.blocs_publication",
            cibleType: "content_page",
            cibleId: pageId,
            // Mention explicite pour l'accueil du site (la page la plus vue) : « Accueil publié ».
            motif: [page.slug === SLUG_ACCUEIL ? "Accueil publié" : null, `version ${version}`, motifPropre || null].filter(Boolean).join(" : "),
          }),
      },
      AVERTISSEMENTS_TRACE.publication(version)
    );
    revalidatePath("/system/contenu/pages");
    revalidatePath(`/system/contenu/pages/${pageId}`);
    // Nouveau jeton (la publication modifie la ligne) ; s'il ne peut pas être relu, l'éditeur relit le brouillon.
    const { data: apres } = await creerClientAdmin().from("content_pages").select("mis_a_jour_le").eq("id", pageId).maybeSingle();
    return { ok: true, version, jeton: apres?.mis_a_jour_le, ...fin };
  } catch (erreur) {
    return echec(erreur);
  }
}

export async function restaurerVersionAction(pageId: string, version: number): Promise<EtatBlocs> {
  if (typeof pageId !== "string" || !UUID.test(pageId)) return { ok: false, erreur: "Page introuvable." };
  if (!Number.isInteger(version) || version < 1) return { ok: false, erreur: "Version introuvable." };

  try {
    const contexte = await verifierPermission("contenu.editer");
    await verifierPalier("contenu:pages", MINIMUMS_STUDIO.publier, { contexte });
    const cible = await lirePageSession(contexte, pageId);
    if (!cible) return { ok: false, erreur: "Page introuvable." };
    const { data: ancienne, error: erreurLecture } = await contexte.supabase
      .from("content_pages_versions")
      .select("blocs")
      .eq("page_id", pageId)
      .eq("version", version)
      .maybeSingle();
    if (erreurLecture) return { ok: false, erreur: "La version n'a pas pu être lue, réessayez dans un instant." };
    if (!ancienne) return { ok: false, erreur: "Version introuvable." };
    // Revalidée contre le schéma COURANT : une version trop ancienne n'entre pas dans le brouillon.
    const validation = validerPage(ancienne.blocs, { slug: cible.slug });
    if (!validation.ok) {
      return {
        ok: false,
        erreur: "Cette version ne respecte plus le format actuel des blocs : elle ne peut pas être restaurée.",
        erreurs: validation.erreurs,
      };
    }

    // Brouillon seulement : la version en ligne ne change qu'à la prochaine publication.
    const { data: modifiees, error } = await contexte.supabase
      .from("content_pages")
      .update({ blocs_brouillon: validation.page as unknown as Json })
      .eq("id", pageId)
      .eq("format", "blocs")
      .select("id");
    if (error) return { ok: false, erreur: messageBase(error, "Impossible de restaurer cette version.") };
    if (!modifiees || modifiees.length === 0) return { ok: false, erreur: "Page introuvable." };

    const fin = await finaliserEcriture(
      {
        journaliser: () =>
          journaliserActionSysteme(contexte, {
            action: "contenu.blocs_restauration",
            cibleType: "content_page",
            cibleId: pageId,
            motif: `version ${version} remise dans le brouillon`,
          }),
      },
      AVERTISSEMENTS_TRACE.restauration(version)
    );
    revalidatePath(`/system/contenu/pages/${pageId}`);
    return { ok: true, version, ...fin };
  } catch (erreur) {
    return echec(erreur);
  }
}

/** Historique des publications d'une page (palier 0), du plus récent au plus ancien. Erreurs de droits : lève. */
export async function listerVersions(pageId: string): Promise<VersionPage[]> {
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
  if (typeof pageId !== "string" || !UUID.test(pageId)) return [];
  const { data, error } = await contexte.supabase
    .from("content_pages_versions")
    .select("version, auteur_id, motif, cree_le")
    .eq("page_id", pageId)
    .order("version", { ascending: false });
  if (error || !data) return [];
  return data;
}

/**
 * Document de travail d'une page à blocs pour l'éditeur (palier 0 : lecture). `null` si la page n'existe pas, n'est pas
 * visible pour la personne ou n'est pas une page à blocs. Erreurs de droits : lève.
 */
export async function lireBrouillonBlocs(pageId: string): Promise<BrouillonBlocs | null> {
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
  if (typeof pageId !== "string" || !UUID.test(pageId)) return null;
  const visible = await lirePageSession(contexte, pageId);
  if (!visible || visible.format !== "blocs") return null;
  const { data, error } = await creerClientAdmin()
    .from("content_pages")
    .select("blocs_brouillon")
    .eq("id", pageId)
    .maybeSingle();
  if (error || !data) return null;
  const validation = validerPage(data.blocs_brouillon, { slug: visible.slug });
  return {
    id: visible.id,
    slug: visible.slug,
    titre: visible.titre,
    statut: visible.statut,
    blocs_version: visible.blocs_version,
    jeton: visible.mis_a_jour_le,
    brouillon: data.blocs_brouillon,
    erreurs: validation.ok ? [] : validation.erreurs,
  };
}
