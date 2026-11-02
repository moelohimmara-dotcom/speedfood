import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../web/src/lib/db/database.types';

import { etatDisponibilite } from '@speedfood/shared/disponibilite/etat';
import type { RestaurantPublic, PageRestaurants, PageMenu, ListeQuartiers } from '@speedfood/shared/contracts/catalogue';

const CHAMPS = 'id, nom, ouvert, accepte_commandes, statut_mis_a_jour_le, menu_categories(nom), neighborhoods(nom, generique, communes(nom))' as const;
type LigneRestaurant = { id: string; nom: string; ouvert: boolean; accepte_commandes: boolean; statut_mis_a_jour_le: string; menu_categories: { nom: string } | null; neighborhoods: { nom: string; generique: boolean; communes: { nom: string } | null } | null };
function projeter(r: LigneRestaurant): RestaurantPublic {
  return { id: r.id, nom: r.nom, lieu: (r.neighborhoods?.generique ? r.neighborhoods.communes?.nom : r.neighborhoods?.nom) ?? '', categorie: r.menu_categories?.nom ?? '', ouvert: r.ouvert, accepteCommandes: r.accepte_commandes, statutMisAJourLe: r.statut_mis_a_jour_le };
}
export async function lireRestaurants(apres: string | null, db: SupabaseClient<Database>): Promise<PageRestaurants> {
  let q = db.from('restaurants').select(CHAMPS).eq('publie', true).is('suspendu_le', null).eq('donnees_demo', false).order('id').limit(51);
  if (apres) q = q.gt('id', apres);
  const { data, error } = await q;
  if (error || !data) throw new Error('catalogue_indisponible');
  const page = data.slice(0, 50).map(projeter);
  return { restaurants: page, suivant: data.length > 50 ? page.at(-1)!.id : null, luLe: new Date().toISOString() };
}
export async function lireMenu(id: string, apres: string | null, db: SupabaseClient<Database>, parametres: () => Promise<{ disponibiliteFraicheurHeures: number }>): Promise<PageMenu | null> {
  const { data: restaurant, error: erreurRestaurant } = await db.from('restaurants').select(CHAMPS).eq('id', id).eq('publie', true).is('suspendu_le', null).eq('donnees_demo', false).maybeSingle();
  if (erreurRestaurant) throw new Error('catalogue_indisponible');
  if (!restaurant) return null;
  let q = db.from('menu_items').select('id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le').eq('restaurant_id', id).is('archive_le', null).order('id').limit(101);
  if (apres) q = q.gt('id', apres);
  const [{ data, error }, { disponibiliteFraicheurHeures }] = await Promise.all([q, parametres()]);
  if (error || !data) throw new Error('catalogue_indisponible');
  const maintenant = new Date();
  const plats = data.slice(0, 100).map(p => {
    const prix = p.prix_promo !== null && p.prix_promo < p.prix ? p.prix_promo : p.prix;
    if (!Number.isSafeInteger(prix) || prix < 0) throw new Error('prix_catalogue_invalide');
    return { id: p.id, nom: p.nom, description: p.description ?? '', prixGnf: prix, disponibilite: etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant).type, confirmeLe: p.disponibilite_confirmee_le };
  });
  return { restaurant: projeter(restaurant), plats, suivant: data.length > 100 ? plats.at(-1)!.id : null, luLe: maintenant.toISOString() };
}

/** Collateur créé UNE fois : la comparaison locale par chaîne en recréerait un à chaque comparaison (limite CPU du Worker, erreur 1102). */
const COLLATEUR_FR = new Intl.Collator('fr');
const TAILLE_PAGE_ZONES = 1000;
const PLAFOND_PAGES_ZONES = 20;
/** Lit TOUTES les lignes d'une table de zones, page par page (la base plafonne chaque réponse) ; tri stable, `id` en dernier. Toute erreur ou dépassement du plafond lève : jamais une liste amputée présentée comme complète. */
async function lireToutesLesLignes<T>(page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const lignes: T[] = [];
  for (let p = 0; p < PLAFOND_PAGES_ZONES; p++) {
    const { data, error } = await page(p * TAILLE_PAGE_ZONES, (p + 1) * TAILLE_PAGE_ZONES - 1);
    if (error || !data) throw new Error('catalogue_indisponible');
    lignes.push(...data);
    if (data.length < TAILLE_PAGE_ZONES) return lignes;
  }
  throw new Error('catalogue_trop_volumineux');
}
/**
 * Quartiers de livraison : mêmes règles que le site (`lireHierarchieZones`, apps/web/src/lib/site/zones.ts) — région, préfecture, commune et quartier actifs,
 * quartier non générique, rattachés par identifiant — libellé « Quartier, Commune », trié par libellé en français. Requêtes recopiées, aucun import du site.
 */
export async function lireQuartiers(db: SupabaseClient<Database>): Promise<ListeQuartiers> {
  const [regions, prefectures, communes, quartiers] = await Promise.all([
    lireToutesLesLignes(async (de, a) => db.from('regions').select('id').eq('actif', true).order('nom').order('id').range(de, a)),
    lireToutesLesLignes(async (de, a) => db.from('prefectures').select('id, region_id').eq('actif', true).order('nom').order('id').range(de, a)),
    lireToutesLesLignes(async (de, a) => db.from('communes').select('id, nom, prefecture_id').eq('actif', true).order('nom').order('id').range(de, a)),
    lireToutesLesLignes(async (de, a) => db.from('neighborhoods').select('id, nom, commune_id').eq('actif', true).eq('generique', false).order('nom').order('id').range(de, a)),
  ]);
  const regionsActives = new Set(regions.map(r => r.id));
  const prefecturesActives = new Set(prefectures.filter(p => p.region_id !== null && regionsActives.has(p.region_id)).map(p => p.id));
  const communesActives = new Map(communes.filter(c => c.prefecture_id !== null && prefecturesActives.has(c.prefecture_id)).map(c => [c.id, c.nom]));
  const liste = quartiers
    .filter(q => q.commune_id !== null && communesActives.has(q.commune_id))
    .map(q => ({ id: q.id, libelle: `${q.nom}, ${communesActives.get(q.commune_id as string)}` }))
    .sort((a, b) => COLLATEUR_FR.compare(a.libelle, b.libelle));
  return { quartiers: liste, luLe: new Date().toISOString() };
}
