import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../web/src/lib/db/database.types';
import { lireRestaurants, lireMenu } from '../src/catalogue/lectures.ts';
const id = '00000000-0000-4000-8000-000000000001';
const r = { id, nom: 'Essai', ouvert: false, accepte_commandes: false, statut_mis_a_jour_le: new Date().toISOString(), menu_categories: { nom: 'Cuisine' }, neighborhoods: { nom: 'Centre', generique: true, communes: { nom: 'Commune réelle' } }, telephone_prive: 'ne-doit-pas-sortir' };
function db(repondre: (u: URL) => unknown) {
  return createClient<Database>('https://base-essai.invalid', 'anon-essai', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => new Response(JSON.stringify(repondre(new URL(String(url)))), { headers: { 'content-type': 'application/json' } }) } });
}
const parametres = async () => ({ disponibiliteFraicheurHeures: 6, commandePropositionDelaiMinutes: 30, prixPlatMaxGnf: 5000000 });
test('source catalogue : projections, exclusions réelles et pagination stable explicite', async () => {
  const page = await lireRestaurants(id, db(u => {
    assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null');
    assert.equal(u.searchParams.get('donnees_demo'), 'eq.false'); assert.equal(u.searchParams.get('order'), 'id.asc');
    assert.equal(u.searchParams.get('limit'), '51'); assert.equal(u.searchParams.get('id'), 'gt.'+id);
    assert.ok(!u.searchParams.get('select')?.includes('*'));
    return Array.from({ length: 51 }, (_, i) => ({ ...r, id: `00000000-0000-4000-8000-${String(i+2).padStart(12, '0')}` }));
  }));
  assert.equal(page.restaurants.length, 50); assert.equal(page.suivant, page.restaurants[49].id);
  assert.equal(page.restaurants[0].lieu, 'Commune réelle'); assert.ok(!JSON.stringify(page).includes('ne-doit-pas-sortir'));
});
test('source menu : parent public obligatoire, archives exclues, prix et disponibilité partagés', async () => {
  const page = await lireMenu(id, null, db(u => {
    if (u.pathname.endsWith('/restaurants')) { assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('donnees_demo'), 'eq.false'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null'); return r; }
    assert.equal(u.searchParams.get('restaurant_id'), 'eq.'+id); assert.equal(u.searchParams.get('archive_le'), 'is.null'); assert.equal(u.searchParams.get('limit'), '101'); assert.equal(u.searchParams.get('order'), 'id.asc');
    return [
      { id, nom: 'Plat', description: null, prix: 35000, prix_promo: 30000, disponible: true, disponibilite_confirmee_le: new Date().toISOString() },
      { id: id.replace(/1$/, '2'), nom: 'Ancien', prix: 20000, prix_promo: null, disponible: true, disponibilite_confirmee_le: '2020-01-01T00:00:00Z' },
      { id: id.replace(/1$/, '3'), nom: 'Épuisé', prix: 10000, prix_promo: null, disponible: false, disponibilite_confirmee_le: null },
    ];
  }), parametres);
  assert.equal(page?.plats[0].prixGnf, 30000); assert.deepEqual(page?.plats.map(p => p.disponibilite), ['disponible', 'a_confirmer', 'epuise']);
  assert.equal(page?.suivant, null); assert.ok(!JSON.stringify(page).includes('telephone_prive'));
});
test('source catalogue : pas de menu pour un parent absent et pas de prix fractionnaire', async () => {
  let appels = 0;
  assert.equal(await lireMenu(id, null, db(() => { appels++; return null; }), parametres), null); assert.equal(appels, 1);
  await assert.rejects(lireMenu(id, null, db(u => u.pathname.endsWith('/restaurants') ? r : [{ id, nom: 'Plat', prix: 1.5, prix_promo: null }]), parametres), /prix_catalogue_invalide/);
});
