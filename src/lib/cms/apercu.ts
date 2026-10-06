import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { slugValide, type PagePubliee } from "./lecture";

/**
 * Ne jamais mettre en cache : contient des brouillons.
 * Lecture d'une page sans filtre de statut, RÉSERVÉE à l'aperçu de l'équipe, après contrôle serveur de `contenu.editer`.
 */
export async function lirePageApercu(slug: string): Promise<(PagePubliee & { statut: string }) | null> {
  if (!slugValide(slug)) return null;
  try {
    const { data, error } = await creerClientAdmin()
      .from("content_pages")
      .select("slug, titre, contenu, publie_le, statut")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}
