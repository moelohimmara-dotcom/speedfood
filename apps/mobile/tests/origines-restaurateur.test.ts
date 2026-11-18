import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { CHEMINS_RESTAURATEUR_SUR_LE_SITE, origineRestaurateur } from '../src/connexion/origines-restaurateur.ts';
import { ORIGINE_CATALOGUE } from '../src/catalogue/client.ts';
import { SITE_WEB } from '../src/connexion/aide.ts';

const racine = new URL('../../../', import.meta.url);
const lire = (relatif: string) => readFileSync(new URL(relatif, racine), 'utf8');

// Tous les chemins `/api/v1/restaurant/...` écrits dans l'application.
const dossier = new URL('apps/mobile/src/', racine);
function fichiers(url: URL): URL[] {
  return readdirSync(url, { withFileTypes: true }).flatMap(e => e.isDirectory() ? fichiers(new URL(e.name + '/', url)) : /\.(ts|tsx)$/.test(e.name) ? [new URL(e.name, url)] : []);
}
const chemins = new Set<string>();
for (const f of fichiers(dossier)) for (const m of readFileSync(f, 'utf8').matchAll(/['"`](\/api\/v1\/restaurant\/[a-z][a-z/]*)['"`]/g)) chemins.add(m[1]);

test('chemins restaurateur : l’application en appelle plusieurs, tous relevés', () => {
  assert.ok(chemins.size >= 12, 'au moins les douze chemins connus : ' + [...chemins].join(', '));
  for (const attendu of ['/api/v1/restaurant/historique', '/api/v1/restaurant/activite', '/api/v1/restaurant/commandes/document', '/api/v1/restaurant/etat']) assert.ok(chemins.has(attendu), attendu);
});

test('chemins restaurateur : chaque chemin existe sur l’hôte vers lequel l’application l’envoie', () => {
  const routesApi = new Set([...lire('apps/api/src/routes/restaurant.ts').matchAll(/route\.(?:get|post)\(\s*["']([^"']+)["']/g)].map(m => '/api/v1/restaurant' + m[1]));
  assert.ok(routesApi.size >= 8, 'routes de l’API relevées : ' + [...routesApi].join(', '));
  const manquants: string[] = [];
  for (const chemin of chemins) {
    const origine = origineRestaurateur(chemin);
    if (origine === SITE_WEB) {
      if (!existsSync(new URL('apps/web/src/app' + chemin + '/route.ts', racine))) manquants.push(chemin + ' (site)');
    } else if (origine === ORIGINE_CATALOGUE) {
      if (!routesApi.has(chemin)) manquants.push(chemin + ' (API)');
    } else manquants.push(chemin + ' (hôte inconnu)');
  }
  assert.deepEqual(manquants, [], 'une route appelée par l’application est absente de son hôte : un appel répondrait « Route inconnue » (404)');
});

test('chemins restaurateur : seuls les chemins absents de l’API vont vers le site', () => {
  const routesApi = new Set([...lire('apps/api/src/routes/restaurant.ts').matchAll(/route\.(?:get|post)\(\s*["']([^"']+)["']/g)].map(m => '/api/v1/restaurant' + m[1]));
  for (const chemin of CHEMINS_RESTAURATEUR_SUR_LE_SITE) assert.ok(!routesApi.has(chemin), chemin + ' existe sur l’API : inutile de le dérouter vers le site');
  assert.equal(origineRestaurateur('/api/v1/restaurant/statut'), ORIGINE_CATALOGUE);
  assert.equal(origineRestaurateur('/api/v1/restaurant/etat'), SITE_WEB);
  assert.equal(origineRestaurateur('/api/v1/restaurant/activite'), SITE_WEB);
});

test('chemins restaurateur : l’appel restaurateur choisit l’hôte par le chemin', () => {
  const client = lire('apps/mobile/src/connexion/client.ts');
  assert.match(client, /fetcher\(origineRestaurateur\(chemin\)\+chemin,/, 'appelRestaurateur utilise origineRestaurateur');
  const corps = client.slice(client.indexOf('async function appelRestaurateur'), client.indexOf('async function appelRestaurateur') + 900);
  assert.ok(!/ORIGINE_CATALOGUE\+chemin/.test(corps), 'plus d’hôte fixe dans appelRestaurateur');
});
