import "server-only";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireAvecCache } from "./cache";

/**
 * Lecture publique des pages et bannières du CMS (Studio, palier 0). Point d'entrée UNIQUE du site public vers
 * `content_pages` / `content_banners` : le filtre `statut = 'publie'` est dans la requête, jamais un brouillon n'en sort

 * Ce module ne contient AUCUN chemin vers un brouillon (l'aperçu est dans `apercu.ts`) : il peut être mis en cache.
 * Client service-role (la RLS publique limite déjà à `publie`, le filtre explicite double la garantie). En cas d'erreur de
 * base : `null` / `[]`, jamais d'exception visible.
 */

export type FormatPage = "texte" | "blocs";

/**
 * Page publiée. `blocs_publie` (pages à blocs, palier 3) est le document PUBLIÉ, encore NON validé : l'appelant le passe à
 * `validerPage` (studio/registre.ts) avant tout rendu. Le document de travail de l'équipe n'est dans aucun type de ce module.
 */
export interface PagePubliee {
  slug: string;
  titre: string;
  contenu: string;
  publie_le: string | null;
  format: FormatPage;
  blocs_publie: unknown;
}

export interface BanniereAffichee {
  id: string;
  titre: string;
  texte: string;
  lien: string | null;
}

const SLUG_VALIDE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BANNIERES = 3;
const MAX_PAGES_NAVIGATION = 8;

export function slugValide(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG_VALIDE.test(slug);
}

/** Format lu en base : toute valeur autre que `blocs` est une page de texte (comportement d'avant le palier 3). */
export function formatPage(valeur: string | null | undefined): FormatPage {
  return valeur === "blocs" ? "blocs" : "texte";
}

/** Mise en cache (60 s, 10 s si vide) : seule la lecture des contenus publiés passe par le cache, voir cache.ts. */
export async function lirePagePubliee(slug: string): Promise<PagePubliee | null> {
  if (!slugValide(slug)) return null;
  // Le producteur LÈVE en cas d'erreur de base (jamais mise en cache comme « absence ») ; le repli null / [] est ici,
  // autour du cache, pour qu'aucune exception ne soit visible.
  try {
    return await lireAvecCache(`page:${slug}`, () => lirePageDepuisBase(slug));
  } catch {
    return null;
  }
}

async function lirePageDepuisBase(slug: string): Promise<PagePubliee | null> {
  const { data, error } = await creerClientAdmin()
    .from("content_pages")
    .select("slug, titre, contenu, publie_le, format, blocs_publie")
    .eq("slug", slug)
    .eq("statut", "publie")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, format: formatPage(data.format) };
}

export async function lireBannieresPubliees(): Promise<BanniereAffichee[]> {
  try {
    return await lireAvecCache("bannieres", lireBannieresDepuisBase);
  } catch {
    return [];
  }
}
async function lireBannieresDepuisBase(): Promise<BanniereAffichee[]> {
  const { data, error } = await creerClientAdmin()
    .from("content_banners")
    .select("id, titre, texte, lien")
    .eq("statut", "publie")
    .order("ordre", { ascending: true })
    .order("cree_le", { ascending: true })
    .limit(MAX_BANNIERES);
  if (error) throw error;
  return data ?? [];
}

export interface PagePourNavigation {
  slug: string;
  titre: string;
}

/**
 * Pages publiées pour le pied de page du site (colonne « Informations ») : c'est ce qui rend la
 * création d'une page UTILE — sans cela, une page publiée à `/p/slug` n'était liée depuis aucun
 * menu du site et restait invisible aux visiteurs.
 *
 * - La page d'accueil (slug réservé « accueil ») est exclue : c'est l'accueil lui-même, elle a
 *   déjà sa place (le logo).
 * - Plafonnée : un pied de page n'est pas un annuaire. Au-delà, les pages se atteignent par le
 *   contenu (boutons dans les pages à blocs).
 * - Invalidée (`navigation`) à chaque changement d'état publié : publication, dépublication,
 *   renommage, suppression.
 */
export async function lirePagesPublieesPourNavigation(): Promise<PagePourNavigation[]> {
  try {
    return await lireAvecCache("navigation", lireNavigationDepuisBase);
  } catch {
    return [];
  }
}

async function lireNavigationDepuisBase(): Promise<PagePourNavigation[]> {
  const { data, error } = await creerClientAdmin()
    .from("content_pages")
    .select("slug, titre")
    .eq("statut", "publie")
    .neq("slug", "accueil")
    .order("titre", { ascending: true })
    .limit(MAX_PAGES_NAVIGATION);
  if (error) throw error;
  return data ?? [];
}
