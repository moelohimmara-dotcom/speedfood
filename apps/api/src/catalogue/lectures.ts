import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../web/src/lib/db/database.types';

import { etatDisponibilite } from '@speedfood/shared/disponibilite/etat';
import type { RestaurantPublic, PageRestaurants, PageMenu } from '@speedfood/shared/contracts/catalogue';

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
