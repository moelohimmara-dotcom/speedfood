import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerLecteurCatalogue } from '../src/catalogue/client.ts';
const id = '12345678-1234-4234-8234-123456789abc';
const restaurant = { id, nom: 'Restaurant de test', lieu: '', categorie: '', ouvert: false, accepteCommandes: false, statutMisAJourLe: null };
const page = { ok: true, restaurants: [restaurant], suivant: null, luLe: '2026-11-01T00:00:00Z' };
const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } });
test('catalogue mobile : GET public sans cookies, projection et pagination', async () => {
  const client = creerLecteurCatalogue(async (url, options) => {
    assert.ok(String(url).endsWith('?apres='+id)); assert.equal(options?.method, 'GET'); assert.equal(options?.credentials, 'omit');
    return json({ ...page, restaurants: [{ ...restaurant, telephone_prive: 'ne-pas-transmettre' }] });
  });
  assert.deepEqual((await client.restaurants(id)).restaurants, [restaurant]);
});
test('catalogue mobile : panne et réponse invalide ne sont jamais un catalogue fictif', async () => {
  for (const reponse of [new Response('', { status: 503 }), json({ ...page, ok: false }), json({ ...page, restaurants: [restaurant, restaurant] }), json({ ...page, suivant: 'non' })]) {
    await assert.rejects(creerLecteurCatalogue(async () => reponse).restaurants());
  }
});
test('catalogue mobile : prix fractionnaire et menu d’un autre restaurant refusés', async () => {
  const menu = { ok: true, restaurant, plats: [{ id, nom: 'Plat', description: '', prixGnf: 1.5, disponibilite: 'disponible', confirmeLe: null }], suivant: null, luLe: page.luLe };
  await assert.rejects(creerLecteurCatalogue(async () => json(menu)).menu(id));
  await assert.rejects(creerLecteurCatalogue(async () => json({ ...menu, restaurant: { ...restaurant, id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }, plats: [] })).menu(id));
});
test('catalogue mobile : délai borné, aucun second envoi', async () => {
  let appels = 0;
  const client = creerLecteurCatalogue(async (_url, options) => {
    appels++; return new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => reject(Error('delai'))); });
  }, 10);
  await assert.rejects(client.restaurants()); assert.equal(appels, 1);
});
