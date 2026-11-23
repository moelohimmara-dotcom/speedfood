import { creerClientPublic } from "@/lib/db/public";

export interface ChiffresEnDirect {
  restaurantsOuverts: number;
  platsConfirmes: number;
}

/** Fenêtre de la preuve affichée : un plat compte s'il a été confirmé par son restaurant depuis moins d'une heure. */
export const FENETRE_CONFIRMATION_HEURES = 1;

/**
 * Chiffres de la page d'accueil (lot C), calculés à chaque affichage dans la base : jamais saisis à la main.
 * Le contenu de démonstration (`donnees_demo`) compte comme le reste tant qu'il est affiché (23 novembre 2026) : le masquer
 * depuis la console le retire des chiffres comme du catalogue.
 * La RLS ne laisse voir que les restaurants publiés et non suspendus. En cas d'erreur, on renvoie `null` et la page
 * n'affiche aucun chiffre plutôt qu'un chiffre faux.
 */
export async function lireChiffresEnDirect(maintenant: Date = new Date()): Promise<ChiffresEnDirect | null> {
  const supabase = creerClientPublic();
  const depuis = new Date(maintenant.getTime() - FENETRE_CONFIRMATION_HEURES * 3600_000).toISOString();
  const [ouverts, confirmes] = await Promise.all([
    supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("ouvert", true).eq("accepte_commandes", true),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("disponible", true)
      .is("archive_le", null)
      .gte("disponibilite_confirmee_le", depuis),
  ]);
  if (ouverts.error || confirmes.error) {
    return null;
  }
  return { restaurantsOuverts: ouverts.count ?? 0, platsConfirmes: confirmes.count ?? 0 };
}
