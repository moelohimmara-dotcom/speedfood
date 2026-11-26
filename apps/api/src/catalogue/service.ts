import { creerClientPublic } from '../../../web/src/lib/db/public';
import { creerClientAdmin } from '../../../web/src/lib/db/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../web/src/lib/db/database.types';
import { obtenirParametresApplication } from '../../../web/src/lib/parametres/lire';
import { lireRestaurants as restaurants, lireMenu as menu, lireQuartiers as quartiers } from './lectures';
import { lireIndexArticles } from './index-articles';
import type { IndexArticlesPublic } from '@speedfood/shared/contracts/catalogue';
export const lireRestaurants = async (apres: string | null) => restaurants(apres, creerClientPublic(), creerClientAdmin() as unknown as SupabaseClient<Database>, await mentionImageIllustrative());
/** Interrupteur « Image illustrative » (console, Mises à jour) : lu avec le client de service, gardé 60 s dans l'isolat. Lecture impossible : allumé (une panne ne coupe pas la mention). */
let mentionLue: { le: number; active: boolean } | null = null;
async function mentionImageIllustrative(): Promise<boolean> {
  if (mentionLue && Date.now() - mentionLue.le < 60_000) return mentionLue.active;
  let active = true;
  try {
    const { data, error } = await (creerClientAdmin() as unknown as SupabaseClient<Database>).from('fonctionnalites').select('cle, active').eq('cle', 'mention_image_illustrative').maybeSingle();
    if (!error && data) active = data.active !== false;
  } catch { /* état inconnu : allumé */ }
  mentionLue = { le: Date.now(), active };
  return active;
}
export const lireMenu = async (id: string, apres: string | null) => menu(id, apres, creerClientPublic(), obtenirParametresApplication, await mentionImageIllustrative());
/** Index des articles pour la recherche de l'appli : construit au plus une fois toutes les 2 minutes par isolat (la lecture complète n'est jamais refaite à chaque frappe ni à chaque ouverture). */
let indexLu: { le: number; valeur: IndexArticlesPublic } | null = null;
let indexEnCours: Promise<IndexArticlesPublic> | null = null;
export async function lireArticles(): Promise<IndexArticlesPublic> {
  if (indexLu && Date.now() - indexLu.le < 120_000) return indexLu.valeur;
  indexEnCours ??= (async () => lireIndexArticles(creerClientPublic(), obtenirParametresApplication, await mentionImageIllustrative()))().then(v => { indexLu = { le: Date.now(), valeur: v }; return v; }).finally(() => { indexEnCours = null; });
  return indexEnCours;
}
export const lireQuartiers = () => quartiers(creerClientPublic());
