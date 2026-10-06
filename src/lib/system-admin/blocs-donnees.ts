"use server";

import { ErreurMetier } from "@/lib/contracts/erreurs";
import { creerClientPublic } from "@/lib/db/public";
import { normaliser } from "@/lib/decouverte/classement";
import { verifierPermission } from "./contexte";
import { verifierPalier } from "./paliers-serveur";
import { MINIMUMS_STUDIO } from "./paliers";

/**
 * Lectures de l'éditeur de pages à blocs (palier 3, tâche 8) pour choisir un restaurant, un quartier ou une famille de
 * cuisine. Permission `contenu.editer` et palier ≥ 0 sur `contenu:pages` vérifiés à chaque appel. Les restaurants sont lus
 * avec le client ANONYME : la RLS de la base ne laisse passer que les restaurants publiés et non suspendus, exactement ce
 * que verra le public. Aucun identifiant reçu du navigateur n'est une autorisation : ils ne servent que de filtre de lecture.
 */

export interface RestaurantChoisissable {
  id: string;
  nom: string;
  quartier: string;
  categorie: string;
}

export interface ResultatRestaurants {
  ok: boolean;
  restaurants: RestaurantChoisissable[];
  erreur?: string;
}

export interface OptionTaxonomie {
  id: string;
  nom: string;
}

export interface ResultatTaxonomies {
  ok: boolean;
  quartiers: OptionTaxonomie[];
  categories: OptionTaxonomie[];
  erreur?: string;
}

const MAX_RESULTATS = 20;
const MAX_LECTURE = 500;
const MAX_TERME = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function exigerDroits() {
  const contexte = await verifierPermission("contenu.editer");
  await verifierPalier("contenu:pages", MINIMUMS_STUDIO.lire, { contexte });
}

function enResultat(erreur: unknown): { ok: false; erreur: string } {
  if (erreur instanceof ErreurMetier) return { ok: false, erreur: erreur.message };
  throw erreur;
}

const COLONNES = "id, nom, neighborhoods(nom), menu_categories(nom)";

/** Restaurants PUBLIÉS dont le nom contient le terme (sans tenir compte des accents ni de la casse), 20 au plus. */
export async function rechercherRestaurantsPublies(terme: string): Promise<ResultatRestaurants> {
  try {
    await exigerDroits();
    const recherche = normaliser(String(terme ?? "").slice(0, MAX_TERME));
    const { data, error } = await creerClientPublic().from("restaurants").select(COLONNES).order("nom").limit(MAX_LECTURE);
    if (error || !data) return { ok: false, restaurants: [], erreur: "La recherche n'a pas pu être faite, réessayez dans un instant." };
    const restaurants = data
      .filter((r) => !recherche || normaliser(r.nom).includes(recherche))
      .slice(0, MAX_RESULTATS)
      .map((r) => ({ id: r.id, nom: r.nom, quartier: r.neighborhoods?.nom ?? "", categorie: r.menu_categories?.nom ?? "" }));
    return { ok: true, restaurants };
  } catch (erreur) {
    return { ...enResultat(erreur), restaurants: [] };
  }
}

/** Un restaurant publié par son identifiant (pour afficher le choix enregistré) ; `null` s'il n'est pas (ou plus) publié. */
export async function lireRestaurantPublie(id: string): Promise<RestaurantChoisissable | null> {
  await exigerDroits();
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const { data } = await creerClientPublic().from("restaurants").select(COLONNES).eq("id", id).maybeSingle();
  return data ? { id: data.id, nom: data.nom, quartier: data.neighborhoods?.nom ?? "", categorie: data.menu_categories?.nom ?? "" } : null;
}

/** Quartiers et familles de cuisine (tables publiques) pour les filtres d'une liste de restaurants. */
export async function listerTaxonomiesPubliques(): Promise<ResultatTaxonomies> {
  try {
    await exigerDroits();
    const supabase = creerClientPublic();
    const [quartiers, categories] = await Promise.all([
      supabase.from("neighborhoods").select("id, nom").order("ordre").order("nom").limit(200),
      supabase.from("menu_categories").select("id, nom").order("ordre").order("nom").limit(200),
    ]);
    if (quartiers.error || categories.error) return { ok: false, quartiers: [], categories: [], erreur: "Les listes n'ont pas pu être lues, réessayez dans un instant." };
    return { ok: true, quartiers: quartiers.data ?? [], categories: categories.data ?? [] };
  } catch (erreur) {
    return { ...enResultat(erreur), quartiers: [], categories: [] };
  }
}
