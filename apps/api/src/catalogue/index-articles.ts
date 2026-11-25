import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../web/src/lib/db/database.types';
import { etatDisponibilite } from '@speedfood/shared/disponibilite/etat';
import type { ArticleIndexPublic, IndexArticlesPublic, RestaurantIndexPublic } from '@speedfood/shared/contracts/catalogue';
import { estImageIllustrative } from '@speedfood/shared/menu/image-illustrative';

/**
 * Index de recherche d'articles pour l'appli : tous les articles publiés, en lecture publique, par pages de 1000 (la base plafonne chaque réponse).
 * Mêmes exclusions que le catalogue : restaurant publié et non suspendu, article non archivé. Rien de privé n'en sort (ni coût, ni stock, ni compte).
 */
const PAGE = 1000;
const PLAFOND_PAGES = 30;
type LigneRestaurant = { latitude?: number | null; longitude?: number | null; id: string; nom: string; ouvert: boolean; accepte_commandes: boolean; avis_somme?: number | null; avis_total?: number | null; menu_categories: { nom: string } | null; neighborhoods: { nom: string; generique: boolean; communes: { nom: string } | null } | null };
type LigneArticle = { id: string; nom: string; description: string | null; prix: number; prix_promo: number | null; disponible: boolean; disponibilite_confirmee_le: string | null; photo_url: string | null; restaurant_id: string; allergenes?: string[] | null };

/** Même formule que la liste des restaurants : note au dixième, `null` sans avis ou si la donnée est incohérente. */
function noteMoyenne(somme: unknown, total: unknown): number | null {
  if (!Number.isSafeInteger(somme) || !Number.isSafeInteger(total) || (total as number) <= 0 || (somme as number) < 0) return null;
  const note = Math.floor(((somme as number) * 10) / (total as number)) / 10;
  return note <= 5 ? note : null;
}
function urlImage(v: unknown): string | null { return typeof v === 'string' && v.length <= 2000 && /^https:\/\/[^\s\x00-\x1f]+$/.test(v) ? v : null; }

export async function lireIndexArticles(db: SupabaseClient<Database>, parametres: () => Promise<{ disponibiliteFraicheurHeures: number }>, illustrative: boolean): Promise<IndexArticlesPublic> {
  const restaurants: RestaurantIndexPublic[] = [];
  const rang = new Map<string, number>();
  for (let p = 0; p < PLAFOND_PAGES; p++) {
    const { data, error } = await db.from('restaurants').select('id, nom, ouvert, accepte_commandes, latitude, longitude, avis_somme, avis_total, menu_categories(nom), neighborhoods(nom, generique, communes(nom))' as string).eq('publie', true).is('suspendu_le', null).order('id').range(p * PAGE, (p + 1) * PAGE - 1);
    if (error || !data) throw new Error('catalogue_indisponible');
    for (const r of data as unknown as LigneRestaurant[]) {
      rang.set(r.id, restaurants.length);
      restaurants.push({ id: r.id, nom: r.nom, lieu: (r.neighborhoods?.generique ? r.neighborhoods.communes?.nom : r.neighborhoods?.nom) ?? '', categorie: r.menu_categories?.nom ?? '', ouvert: r.ouvert, accepteCommandes: r.accepte_commandes, ...(Number.isFinite(r.latitude) && Number.isFinite(r.longitude) ? { latitude: r.latitude as number, longitude: r.longitude as number } : {}), note: noteMoyenne(r.avis_somme, r.avis_total), avisTotal: Number.isSafeInteger(r.avis_total) && (r.avis_total as number) > 0 ? (r.avis_total as number) : 0 });
    }
    if (data.length < PAGE) break;
    if (p === PLAFOND_PAGES - 1) throw new Error('catalogue_trop_volumineux');
  }
  const { disponibiliteFraicheurHeures } = await parametres();
  const maintenant = new Date();
  const lignes: LigneArticle[] = [];
  // Allergènes déclarés : lus quand la colonne existe ; sinon (base pas encore migrée) l'index se lit sans eux, tous « non renseignés » : jamais une panne de la recherche.
  let colonnes = 'id, nom, description, prix, prix_promo, disponible, disponibilite_confirmee_le, photo_url, restaurant_id, allergenes';
  for (let p = 0; p < PLAFOND_PAGES; p++) {
    let reponse = await db.from('menu_items').select(colonnes as string).is('archive_le', null).order('id').range(p * PAGE, (p + 1) * PAGE - 1);
    if (reponse.error && /allergenes/.test(String(reponse.error.message ?? '')) && colonnes.includes('allergenes')) {
      colonnes = colonnes.replace(', allergenes', '');
      reponse = await db.from('menu_items').select(colonnes as string).is('archive_le', null).order('id').range(p * PAGE, (p + 1) * PAGE - 1);
    }
    const { data, error } = reponse as unknown as { data: unknown[] | null; error: unknown };
    if (error || !data) throw new Error('catalogue_indisponible');
    for (const a of data as unknown as LigneArticle[]) if (rang.has(a.restaurant_id)) lignes.push(a);
    if (data.length < PAGE) break;
    if (p === PLAFOND_PAGES - 1) throw new Error('catalogue_trop_volumineux');
  }
  // Base commune des adresses d'images (tout ce qui précède « /medias/ ») : chaque photo n'en garde que la fin.
  const modele = lignes.map(a => urlImage(a.photo_url)).find((u): u is string => u !== null);
  const coupe = modele ? modele.indexOf('/medias/') : -1;
  const baseImages = modele && coupe >= 0 ? modele.slice(0, coupe + '/medias/'.length) : '';
  const articles: ArticleIndexPublic[] = lignes.map(a => {
    const prix = a.prix_promo !== null && a.prix_promo < a.prix ? a.prix_promo : a.prix;
    if (!Number.isSafeInteger(prix) || prix < 0) throw new Error('prix_catalogue_invalide');
    const photo = urlImage(a.photo_url);
    const lu: ArticleIndexPublic = { id: a.id, r: rang.get(a.restaurant_id)!, nom: a.nom, prixGnf: prix, disponibilite: etatDisponibilite({ disponible: a.disponible, confirmeLe: a.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant).type };
    const description = (a.description ?? '').trim();
    if (description !== '') lu.description = description.slice(0, 200);
    if (Array.isArray(a.allergenes)) lu.allergenes = a.allergenes.filter((x): x is string => typeof x === 'string');
    if (photo) lu.photo = baseImages && photo.startsWith(baseImages) ? photo.slice(baseImages.length) : photo;
    if (illustrative && estImageIllustrative(photo)) lu.illustrative = true;
    return lu;
  });
  return { restaurants, articles, baseImages, luLe: maintenant.toISOString() };
}
