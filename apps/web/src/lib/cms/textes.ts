import "server-only";
import { cache } from "react";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireAvecCache } from "./cache";
import { defauts, resoudre, type CleEmplacement } from "./emplacements";

/**
 * Lecture des textes du site (emplacements de contenu, Studio palier 1). Client service-role : aucune policy n'ouvre la table
 * à `anon`. Une lecture par requête (`cache` de React) ; les surcharges passent par le cache Cloudflare (clé `textes`,
 * invalidée par la console). En cas d'erreur de base : textes par défaut, jamais d'exception visible.
 */

/** Le producteur LÈVE sur erreur de base (jamais mise en cache) ; le repli sur les défauts est autour du cache. */
async function lireSurchargesDepuisBase(): Promise<Record<string, string>> {
  const { data, error } = await creerClientAdmin().from("contenu_emplacements").select("cle, valeur");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((l) => [l.cle, l.valeur]));
}

export const lireTextes = cache(async (): Promise<Record<CleEmplacement, string>> => {
  try {
    return resoudre(await lireAvecCache("textes", lireSurchargesDepuisBase));
  } catch {
    return defauts();
  }
});

export async function texte(cle: CleEmplacement): Promise<string> {
  return (await lireTextes())[cle];
}
