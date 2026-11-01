import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerApp } from '../src/app.ts';
import { depsEssai } from './deps-essai.ts';
const id = '12345678-1234-4234-8234-123456789abc';
test('catalogue public : lecture paginée, sans identité, CORS et sans cache', async () => {
  let curseur: string | null = null;
  const app = creerApp(depsEssai({ catalogue: { restaurants: async apres => { curseur = apres; return { restaurants: [], suivant: null, luLe: '2026-11-01T00:00:00Z' }; }, menu: async () => null } }));
  const r = await app.request(`/api/v1/catalogue/restaurants?apres=${id}`);
  assert.equal(r.status, 200); assert.equal(curseur, id);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal((await r.json()).ok, true);
});
test('catalogue : curseurs et identifiants invalides refusés avant lecture', async () => {
  let appels = 0;
  const app = creerApp(depsEssai({ catalogue: { restaurants: async () => { appels++; throw Error(); }, menu: async () => { appels++; throw Error(); } } }));
  for (const chemin of ['/restaurants?apres=incorrect', '/restaurants/invalide/menu', `/restaurants/${id}/menu?apres=non`]) {
    assert.equal((await app.request('/api/v1/catalogue'+chemin)).status, 400);
  }
  assert.equal(appels, 0);
});
test('catalogue : absent ou panne ne devient jamais un menu vide réussi', async () => {
  const app = creerApp(depsEssai({ catalogue: { restaurants: async () => { throw Error('detail-interne'); }, menu: async () => null } }));
  assert.equal((await app.request(`/api/v1/catalogue/restaurants/${id}/menu`)).status, 404);
  const panne = await app.request('/api/v1/catalogue/restaurants');
  assert.equal(panne.status, 500); assert.ok(!(await panne.text()).includes('detail-interne'));
});
