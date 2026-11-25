import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../web/src/lib/db/database.types';
import { lireMenu } from '../src/catalogue/lectures.ts';
import { lireIndexArticles } from '../src/catalogue/index-articles.ts';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';

const R1 = '00000000-0000-4000-8000-000000000001';
const R2 = '00000000-0000-4000-8000-000000000002';
const BASE = 'https://base-essai.invalid/storage/v1/object/public/medias/';
const parametres = async () => ({ disponibiliteFraicheurHeures: 6, commandePropositionDelaiMinutes: 30, prixPlatMaxGnf: 5000000 });
function db(repondre: (u: URL) => unknown) {
  return createClient<Database>('https://base-essai.invalid', 'anon-essai', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => new Response(JSON.stringify(repondre(new URL(String(url)))), { headers: { 'content-type': 'application/json' } }) } });
}
const restaurant = (id: string, nom: string) => ({ id, nom, ouvert: true, accepte_commandes: true, menu_categories: { nom: 'Italien et pizzas' }, neighborhoods: { nom: 'Kaloum', generique: false, communes: { nom: 'Kaloum' } } });
const maintenant = new Date().toISOString();
const article = (id: string, restaurant_id: string, nom: string, extra: Record<string, unknown> = {}) => ({ id, nom, description: null, prix: 30000, prix_promo: null, disponible: true, disponibilite_confirmee_le: maintenant, photo_url: null, restaurant_id, ...extra });

test('index d\'articles : restaurants publiés seulement, articles par rang, photos relatives, mention seulement pour les images IA', async () => {
  const vus: string[] = [];
  const index = await lireIndexArticles(db(u => {
    const table = u.pathname.split('/').pop()!; vus.push(table + '?' + u.searchParams.toString());
    assert.ok(!u.searchParams.get('select')?.includes('*'));
    if (table === 'restaurants') { assert.equal(u.searchParams.get('publie'), 'eq.true'); assert.equal(u.searchParams.get('suspendu_le'), 'is.null'); return [restaurant(R1, 'Pizza della Nonna'), restaurant(R2, 'Le Grand Marché')]; }
    assert.equal(table, 'menu_items'); assert.equal(u.searchParams.get('archive_le'), 'is.null');
    return [
      article('a1', R1, 'Pizza poulet', { description: '  Mozzarella et poulet  ', photo_url: BASE + 'demo/photos/pizza.jpg' }),
      article('a2', R1, 'Pizza reine', { photo_url: BASE + 'demo/photos/ia/lot2/reine.png', prix: 40000, prix_promo: 35000 }),
      article('a3', R2, 'Café', { disponible: false }),
      article('a4', '00000000-0000-4000-8000-0000000000ff', 'Article d\'un restaurant non publié'),
    ];
  }), parametres, true);
  assert.deepEqual(index.restaurants.map(r => r.nom), ['Pizza della Nonna', 'Le Grand Marché']);
  assert.equal(index.restaurants[0].lieu, 'Kaloum'); assert.equal(index.restaurants[0].categorie, 'Italien et pizzas');
  assert.equal(index.articles.length, 3, 'l\'article d\'un restaurant non publié est écarté');
  assert.deepEqual(index.articles.map(a => [a.nom, a.r]), [['Pizza poulet', 0], ['Pizza reine', 0], ['Café', 1]]);
  assert.equal(index.baseImages, BASE);
  assert.equal(index.articles[0].photo, 'demo/photos/pizza.jpg'); assert.equal(index.articles[0].illustrative, undefined);
  assert.equal(index.articles[1].photo, 'demo/photos/ia/lot2/reine.png'); assert.equal(index.articles[1].illustrative, true);
  assert.equal(index.articles[1].prixGnf, 35000, 'le prix payé (promo comprise)');
  assert.equal(index.articles[0].description, 'Mozzarella et poulet'); assert.equal(index.articles[2].description, undefined);
  assert.equal(index.articles[2].disponibilite, 'epuise');
  assert.ok(vus.some(v => v.startsWith('menu_items?')));
});

test('index d\'articles : mention coupée dans la console, plus aucune image marquée illustrative', async () => {
  const index = await lireIndexArticles(db(u => u.pathname.endsWith('/restaurants') ? [restaurant(R1, 'A')] : [article('a2', R1, 'Pizza reine', { photo_url: BASE + 'demo/photos/ia/lot2/reine.png' })]), parametres, false);
  assert.equal(index.articles[0].illustrative, undefined);
});

test('index d\'articles : panne de lecture ou prix invalide = erreur, jamais un index amputé', async () => {
  await assert.rejects(lireIndexArticles(db(() => { throw Error('panne'); }), parametres, true));
  await assert.rejects(lireIndexArticles(db(u => u.pathname.endsWith('/restaurants') ? [restaurant(R1, 'A')] : [article('a1', R1, 'X', { prix: -5 })]), parametres, true), /prix_catalogue_invalide/);
});

test('menu : imageIllustrative seulement quand l\'interrupteur est allumé et que la photo est une image IA', async () => {
  const fournir = (u: URL) => {
    if (u.pathname.endsWith('/restaurants')) return { ...restaurant(R1, 'A'), statut_mis_a_jour_le: maintenant };
    if (u.pathname.endsWith('/menu_sections')) return [];
    return [
      { id: 'p1', nom: 'IA', description: null, prix: 1000, prix_promo: null, disponible: true, disponibilite_confirmee_le: maintenant, photo_url: BASE + 'demo/photos/ia/x.png', section_id: null, menu_item_options: [] },
      { id: 'p2', nom: 'Vraie', description: null, prix: 1000, prix_promo: null, disponible: true, disponibilite_confirmee_le: maintenant, photo_url: BASE + 'demo/photos/x.jpg', section_id: null, menu_item_options: [] },
    ];
  };
  const allume = await lireMenu(R1, null, db(fournir), parametres, true);
  assert.deepEqual(allume!.plats.map(p => p.imageIllustrative), [true, undefined]);
  const coupe = await lireMenu(R1, null, db(fournir), parametres, false);
  assert.deepEqual(coupe!.plats.map(p => p.imageIllustrative), [undefined, undefined]);
  const parDefaut = await lireMenu(R1, null, db(fournir), parametres);
  assert.deepEqual(parDefaut!.plats.map(p => p.imageIllustrative), [undefined, undefined]);
});

test('route /articles : donnée publique avec cache court, introuvable si la dépendance manque', async () => {
  const index = { restaurants: [], articles: [], baseImages: '', luLe: '2026-11-25T00:00:00Z' };
  const app = creerApp(depsEssai({ catalogue: { restaurants: async () => { throw Error(); }, menu: async () => null, quartiers: async () => ({ quartiers: [], luLe: '2026-11-25T00:00:00Z' }), articles: async () => index } }));
  const r = await app.request('/api/v1/catalogue/articles');
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=120'); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await r.json(), { ok: true, ...index });
  const sans = creerApp(depsEssai({ catalogue: { restaurants: async () => { throw Error(); }, menu: async () => null, quartiers: async () => ({ quartiers: [], luLe: '2026-11-25T00:00:00Z' }) } }));
  assert.equal((await sans.request('/api/v1/catalogue/articles')).status, 404);
});
