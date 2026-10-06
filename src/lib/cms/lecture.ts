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

export interface PagePubliee {
  slug: string;
  titre: string;
  contenu: string;
  publie_le: string | null;
}

export interface BanniereAffichee {
  id: string;
  titre: string;
  texte: string;
  lien: string | null;
}

const SLUG_VALIDE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BANNIERES = 3;

export function slugValide(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG_VALIDE.test(slug);
}

/** Mise en cache (60 s, 10 s si vide) : seule la lecture des contenus publiés passe par le cache, voir cache.ts. */
export async function lirePagePubliee(slug: string): Promise<PagePubliee | null> {
  if (!slugValide(slug)) return null;
  return lireAvecCache(`page:${slug}`, () => lirePageDepuisBase(slug));
}

async function lirePageDepuisBase(slug: string): Promise<PagePubliee | null> {
  try {
    const { data, error } = await creerClientAdmin()
      .from("content_pages")
      .select("slug, titre, contenu, publie_le")
      .eq("slug", slug)
      .eq("statut", "publie")
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function lireBannieresPubliees(): Promise<BanniereAffichee[]> {
  return lireAvecCache("bannieres", lireBannieresDepuisBase);
}

async function lireBannieresDepuisBase(): Promise<BanniereAffichee[]> {
  try {
    const { data, error } = await creerClientAdmin()
      .from("content_banners")
      .select("id, titre, texte, lien")
      .eq("statut", "publie")
      .order("ordre", { ascending: true })
      .order("cree_le", { ascending: true })
      .limit(MAX_BANNIERES);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
