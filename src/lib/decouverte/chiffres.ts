import { creerClientPublic } from "@/lib/db/public";

export interface ChiffresEnDirect {
  restaurantsOuverts: number;
  platsConfirmes: number;
}

/** Fenêtre de la preuve affichée : un plat compte s'il a été confirmé par son restaurant depuis moins d'une heure. */
export const FENETRE_CONFIRMATION_HEURES = 1;

/**
 * Chiffres de la page d'accueil (lot C), calculés à chaque affichage dans la base : jamais saisis à la main.
 * Les restaurants de démonstration (`donnees_demo`) ne comptent jamais : ce serait une fausse preuve.
 * La RLS ne laisse voir que les restaurants publiés et non suspendus. En cas d'erreur, on renvoie `null` et la page
 * n'affiche aucun chiffre plutôt qu'un chiffre faux.
 */
export async function lireChiffresEnDirect(maintenant: Date = new Date()): Promise<ChiffresEnDirect | null> {
  const supabase = creerClientPublic();
  const depuis = new Date(maintenant.getTime() - FENETRE_CONFIRMATION_HEURES * 3600_000).toISOString();
  const [ouverts, confirmes] = await Promise.all([
    supabase.from("restaurants").select("id", { count: "exact", head: true }).eq("ouvert", true).eq("accepte_commandes", true).eq("donnees_demo", false),
    supabase
      .from("menu_items")
      .select("id, restaurants!inner(donnees_demo)", { count: "exact", head: true })
      .eq("restaurants.donnees_demo", false)
      .eq("disponible", true)
      .is("archive_le", null)
      .gte("disponibilite_confirmee_le", depuis),
  ]);
  if (ouverts.error || confirmes.error) {
    return null;
  }
  return { restaurantsOuverts: ouverts.count ?? 0, platsConfirmes: confirmes.count ?? 0 };
}
