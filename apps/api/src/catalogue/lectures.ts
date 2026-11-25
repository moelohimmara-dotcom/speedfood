import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../web/src/lib/db/database.types';

import { etatDisponibilite } from '@speedfood/shared/disponibilite/etat';
import type { RestaurantPublic, PageRestaurants, PageMenu, ListeQuartiers } from '@speedfood/shared/contracts/catalogue';

// Colonnes de la liste (légère) et de la fiche (liste + consignes et moyens de paiement). `avis_somme` et `avis_total` existent en base (migration notation) mais pas encore dans
// les types générés : les requêtes sont donc typées à la main (`LigneRestaurant`) au lieu de s'appuyer sur l'inférence.
const COLONNES_LISTE = 'id, nom, ouvert, accepte_commandes, statut_mis_a_jour_le, photo_url, logo_url, avis_somme, avis_total, horaires, menu_categories(nom), neighborhoods(nom, generique, communes(nom))';
const COLONNES_FICHE = COLONNES_LISTE + ', consignes, moyens_paiement';
type LigneRestaurant = {
  id: string; nom: string; ouvert: boolean; accepte_commandes: boolean; statut_mis_a_jour_le: string;
  photo_url?: string | null; logo_url?: string | null; avis_somme?: number | null; avis_total?: number | null; horaires?: string | null; consignes?: string | null; moyens_paiement?: string[] | null;
  menu_categories: { nom: string } | null; neighborhoods: { nom: string; generique: boolean; communes: { nom: string } | null } | null;
};
/** Une adresse d'image n'est transmise qu'en HTTPS, sans espace ni caractère de contrôle, de 2000 caractères au plus ; sinon `null`. */
function urlImage(v: unknown): string | null { return typeof v === 'string' && v.length <= 2000 && /^https:\/\/[^\s\x00-\x1f]+$/.test(v) ? v : null; }
function texteFacultatif(v: unknown, max: number): string | null { if (typeof v !== 'string') return null; const t = v.trim(); return t.length > 0 && t.length <= max ? t : null; }
/** Note moyenne au dixième, formule de l'ancienne appli (division entière puis /10) ; `null` sans avis, et `null` aussi si le résultat sort de l'échelle 0 à 5 (donnée incohérente : jamais une note inventée). */
function noteMoyenne(somme: unknown, total: unknown): number | null {
  if (!Number.isSafeInteger(somme) || !Number.isSafeInteger(total) || (total as number) <= 0 || (somme as number) < 0) return null;
  const note = Math.floor(((somme as number) * 10) / (total as number)) / 10;
  return note <= 5 ? note : null;
}
function projeter(r: LigneRestaurant, fiche = false): RestaurantPublic {
  const base: RestaurantPublic = {
    id: r.id, nom: r.nom, lieu: (r.neighborhoods?.generique ? r.neighborhoods.communes?.nom : r.neighborhoods?.nom) ?? '', categorie: r.menu_categories?.nom ?? '', ouvert: r.ouvert, accepteCommandes: r.accepte_commandes, statutMisAJourLe: r.statut_mis_a_jour_le,
    photoUrl: urlImage(r.photo_url), logoUrl: urlImage(r.logo_url), note: noteMoyenne(r.avis_somme, r.avis_total), avisTotal: Number.isSafeInteger(r.avis_total) && (r.avis_total as number) > 0 ? (r.avis_total as number) : 0, horaires: texteFacultatif(r.horaires, 300),
  };
  if (!fiche) return base;
  const moyens = Array.isArray(r.moyens_paiement) ? r.moyens_paiement.filter(m => typeof m === 'string' && m.trim().length > 0 && m.length <= 60).slice(0, 12) : [];
  return { ...base, consignes: texteFacultatif(r.consignes, 1000), moyensPaiement: moyens };
}
export async function lireRestaurants(apres: string | null, db: SupabaseClient<Database>): Promise<PageRestaurants> {
  let q = db.from('restaurants').select(COLONNES_LISTE as string).eq('publie', true).is('suspendu_le', null).eq('donnees_demo', false).order('id').limit(51);
  if (apres) q = q.gt('id', apres);
  const { data: brut, error } = await q;
  if (error || !brut) throw new Error('catalogue_indisponible');
  const data = brut as unknown as LigneRestaurant[];
  const pageBrute = data.slice(0, 50);
  // Offres de l'accueil : un plat disponible en promotion suffit. Lecture bornée aux identifiants affichés, paginée par identifiant
  // pour ne jamais évincer une vraie promotion derrière un plafond ; une erreur de lecture rend le catalogue indisponible, jamais de fausses offres.
  const avecPromos = new Set<string>();
  if (pageBrute.length > 0) {
    const ids = pageBrute.map(r => r.id);
    const TAILLE_PAGE_PROMOS = 500;
    const PAGES_MAX_PROMOS = 20;
    for (let page = 0; page < PAGES_MAX_PROMOS && avecPromos.size < ids.length; page++) {
      const debut = page * TAILLE_PAGE_PROMOS;
      const { data: promos, error: erreurPromos } = await db.from('menu_items').select('restaurant_id, prix, prix_promo').in('restaurant_id', ids).eq('disponible', true).is('archive_le', null).not('prix_promo', 'is', null).order('id').range(debut, debut + TAILLE_PAGE_PROMOS - 1);
      if (erreurPromos || !promos) throw new Error('catalogue_indisponible');
      const lignes = promos as unknown as Array<{ restaurant_id: string; prix: number; prix_promo: number | null }>;
      for (const p of lignes) {
        if (p.prix_promo !== null && p.prix_promo < p.prix) avecPromos.add(p.restaurant_id);
      }
      if (lignes.length < TAILLE_PAGE_PROMOS) break;
      if (page === PAGES_MAX_PROMOS - 1) throw new Error('catalogue_indisponible');
    }
  }
  const page = pageBrute.map(r => ({ ...projeter(r), aDesPromos: avecPromos.has(r.id) }));
  return { restaurants: page, suivant: data.length > 50 ? page.at(-1)!.id : null, luLe: new Date().toISOString() };
}
type LigneOption = { id: string; nom: string; prix: number; disponible: boolean };
type LignePlat = { id: string; nom: string; description: string | null; prix: number; prix_promo: number | null; disponible: boolean; disponibilite_confirmee_le: string | null; photo_url?: string | null; section_id?: string | null; menu_item_options?: LigneOption[] | null };
export async function lireMenu(id: string, apres: string | null, db: SupabaseClient<Database>, parametres: () => Promise<{ disponibiliteFraicheurHeures: number }>): Promise<PageMenu | null> {
  const { data: brutRestaurant, error: erreurRestaurant } = await db.from('restaurants').select(COLONNES_FICHE as string).eq('id', id).eq('publie', true).is('suspendu_le', null).eq('donnees_demo', false).maybeSingle();
  if (erreurRestaurant) throw new Error('catalogue_indisponible');
  const restaurant = brutRestaurant as unknown as LigneRestaurant | null;
  if (!restaurant) return null;
  let q = db.from('menu_items').select('id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, section_id, menu_item_options(id, nom, prix, disponible)').eq('restaurant_id', id).is('archive_le', null).order('id').order('nom', { referencedTable: 'menu_item_options' }).limit(101);
  if (apres) q = q.gt('id', apres);
  // Les sections ne sont lues et envoyées qu'avec la première page : les pages suivantes n'en refont ni la lecture ni le transport (l'appli garde celles de la première page).
  const sectionsRequete = apres ? Promise.resolve({ data: null, error: null }) : db.from('menu_sections').select('id, nom, position').eq('restaurant_id', id).order('position', { ascending: true }).limit(50);
  const [{ data: brut, error }, { data: lignesSections, error: erreurSections }, { disponibiliteFraicheurHeures }] = await Promise.all([q, sectionsRequete, parametres()]);
  if (error || !brut || erreurSections || (!apres && !lignesSections)) throw new Error('catalogue_indisponible');
  const data = brut as unknown as LignePlat[];
  const maintenant = new Date();
  const plats = data.slice(0, 100).map(p => {
    const prix = p.prix_promo !== null && p.prix_promo < p.prix ? p.prix_promo : p.prix;
    if (!Number.isSafeInteger(prix) || prix < 0 || !Number.isSafeInteger(p.prix) || p.prix < 0) throw new Error('prix_catalogue_invalide');
    const options = (p.menu_item_options ?? []).filter(o => o.disponible === true).map(o => {
      if (!Number.isSafeInteger(o.prix) || o.prix < 0) throw new Error('prix_catalogue_invalide');
      return { id: o.id, nom: o.nom, prixGnf: o.prix };
    });
    return { id: p.id, nom: p.nom, description: p.description ?? '', prixGnf: prix, disponibilite: etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant).type, confirmeLe: p.disponibilite_confirmee_le, prixNormalGnf: p.prix, photoUrl: urlImage(p.photo_url), sectionId: p.section_id ?? null, options };
  });
  const sections = apres ? undefined : [...(lignesSections ?? [])].sort((a, b) => a.position - b.position).map(s => ({ id: s.id, nom: s.nom, position: s.position }));
  return { restaurant: projeter(restaurant, true), plats, suivant: data.length > 100 ? plats.at(-1)!.id : null, luLe: maintenant.toISOString(), ...(sections ? { sections } : {}) };
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
