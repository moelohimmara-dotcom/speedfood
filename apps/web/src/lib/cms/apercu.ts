import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { formatPage, slugValide, type PagePubliee } from "./lecture";

/** Page lue pour l'aperçu : statut réel et, pour une page à blocs, le document de travail (NON validé). */
export type PageApercu = PagePubliee & { statut: string; blocs_brouillon: unknown };

/**
 * Ne jamais mettre en cache : contient des brouillons.
 * Lecture d'une page sans filtre de statut, RÉSERVÉE à l'aperçu de l'équipe, après contrôle serveur de `contenu.editer`.
 * Clé de service : `blocs_brouillon` n'est lisible par aucun rôle de l'API (droits de colonne, migration pages_blocs).
 */
export async function lirePageApercu(slug: string): Promise<PageApercu | null> {
  if (!slugValide(slug)) return null;
  try {
    const { data, error } = await creerClientAdmin()
      .from("content_pages")
      .select("slug, titre, contenu, publie_le, statut, format, blocs_publie, blocs_brouillon")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return { ...data, format: formatPage(data.format) };
  } catch {
    return null;
  }
}
