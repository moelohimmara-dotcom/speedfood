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
// Parité Kotlin (tranche 10.1) : champs riches FACULTATIFS. Un ancien serveur qui ne les envoie pas donne exactement l'ancienne lecture ; un champ présent mais douteux est refusé en bloc.
const idP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', idS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', idO = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const riche = { ...restaurant, photoUrl: 'https://exemple.invalid/p.jpg', logoUrl: null, note: 4.5, avisTotal: 12, horaires: '8h à 22h', consignes: 'Sonnez deux fois', moyensPaiement: ['Orange Money', 'Espèces'] };
const platRiche = { id: idP, nom: 'Poulet', description: 'Braisé', prixGnf: 30000, disponibilite: 'disponible', confirmeLe: null, prixNormalGnf: 35000, photoUrl: 'https://exemple.invalid/poulet.jpg', sectionId: idS, options: [{ id: idO, nom: 'Piment', prixGnf: 500 }] };
const menuRiche = { ok: true, restaurant: { ...riche, id }, plats: [platRiche], sections: [{ id: idS, nom: 'Plats', position: 1 }], suivant: null, luLe: page.luLe };
test('catalogue riche : restaurant et menu lus en entier, champs inconnus ignorés', async () => {
  const lu = await creerLecteurCatalogue(async () => json({ ...menuRiche, restaurant: { ...riche, id, secret: 'non' }, plats: [{ ...platRiche, secret: 'non' }] })).menu(id);
  assert.deepEqual(lu.restaurant, { ...riche, id });
  assert.deepEqual(lu.plats[0], platRiche); assert.deepEqual(lu.sections, [{ id: idS, nom: 'Plats', position: 1 }]);
  assert.ok(!JSON.stringify(lu).includes('secret'));
  const liste = await creerLecteurCatalogue(async () => json({ ...page, restaurants: [riche] })).restaurants();
  assert.equal(liste.restaurants[0].note, 4.5);
});
test('catalogue riche : un ancien serveur sans champs riches donne la lecture d’avant (aucune clé inventée)', async () => {
  const ancien = { ok: true, restaurant, plats: [{ id: idP, nom: 'Plat', description: '', prixGnf: 100, disponibilite: 'disponible', confirmeLe: null }], suivant: null, luLe: page.luLe };
  const lu = await creerLecteurCatalogue(async () => json(ancien)).menu(id);
  assert.ok(!('note' in lu.restaurant) && !('photoUrl' in lu.restaurant)); assert.ok(!('options' in lu.plats[0]) && !('prixNormalGnf' in lu.plats[0])); assert.equal(lu.sections, undefined);
});
test('catalogue riche : valeur douteuse sur un champ présent = refus en bloc', async () => {
  const mauvaisRestaurants: Record<string, unknown>[] = [
    { photoUrl: 'http://pas-https.invalid/p.jpg' }, { photoUrl: 'javascript:alert(1)' }, { photoUrl: 'https://a b.invalid' }, { logoUrl: 12 },
    { note: -1 }, { note: 5.1 }, { note: '4' }, { avisTotal: -1 }, { avisTotal: 1.5 }, { horaires: 'x'.repeat(301) }, { consignes: 'x'.repeat(1001) },
    { moyensPaiement: 'Orange' }, { moyensPaiement: Array(13).fill('A') }, { moyensPaiement: [12] },
  ];
  for (const m of mauvaisRestaurants) await assert.rejects(creerLecteurCatalogue(async () => json({ ...page, restaurants: [{ ...restaurant, ...m }] })).restaurants(), Error, JSON.stringify(m));
  const mauvaisPlats: Record<string, unknown>[] = [
    { prixNormalGnf: 1.5 }, { prixNormalGnf: 20000 }, { prixNormalGnf: -1 }, { photoUrl: 'ftp://x.invalid/a' }, { sectionId: 'pas-un-uuid' },
    { options: 'x' }, { options: Array(31).fill({ id: idO, nom: 'A', prixGnf: 0 }) }, { options: [{ id: idO, nom: 'A', prixGnf: 1.5 }] }, { options: [{ id: idO, nom: 'A', prixGnf: -1 }] },
    { options: [{ id: 'x', nom: 'A', prixGnf: 0 }] }, { options: [{ id: idO, nom: '', prixGnf: 0 }] }, { options: [{ id: idO, nom: 'A', prixGnf: 0 }, { id: idO, nom: 'B', prixGnf: 0 }] },
  ];
  for (const m of mauvaisPlats) await assert.rejects(creerLecteurCatalogue(async () => json({ ...menuRiche, plats: [{ ...platRiche, ...m }] })).menu(id), Error, JSON.stringify(m));
  const mauvaisesSections: unknown[] = ['x', Array(51).fill({ id: idS, nom: 'A', position: 1 }), [{ id: idS, nom: 'A', position: 1.5 }], [{ id: idS, nom: '', position: 1 }], [{ id: idS, nom: 'A', position: 1 }, { id: idS, nom: 'B', position: 2 }], [{ id: 'x', nom: 'A', position: 1 }]];
  for (const s of mauvaisesSections) await assert.rejects(creerLecteurCatalogue(async () => json({ ...menuRiche, sections: s })).menu(id), Error, JSON.stringify(s).slice(0, 60));
});
test('catalogue riche : le cache hors ligne revalide les mêmes champs', async () => {
  const { validerPageMenu, validerPageRestaurants } = await import('../src/catalogue/client.ts');
  assert.equal(validerPageMenu({ ...menuRiche, restaurant: { ...riche, id } }).plats[0].options?.[0].nom, 'Piment');
  assert.throws(() => validerPageMenu({ ...menuRiche, plats: [{ ...platRiche, photoUrl: 'http://x.invalid/a.jpg' }] }));
  assert.equal(validerPageRestaurants({ restaurants: [riche], suivant: null, luLe: page.luLe }).restaurants[0].logoUrl, null);
  assert.throws(() => validerPageRestaurants({ restaurants: [{ ...riche, note: 9 }], suivant: null, luLe: page.luLe }));
});
test('catalogue mobile : délai borné, aucun second envoi', async () => {
  let appels = 0;
  const client = creerLecteurCatalogue(async (_url, options) => {
    appels++; return new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => reject(Error('delai'))); });
  }, 10);
  await assert.rejects(client.restaurants()); assert.equal(appels, 1);
});
