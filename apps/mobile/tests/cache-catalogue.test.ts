import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VALIDITE_CACHE_MS, creerCacheCatalogue, libelleAgeCache, valeurDepuisLignesBrutes, type StockageCache } from '../src/catalogue/cache-catalogue.ts';

function memoire(initial: Record<string, string> = {}, ecritureEchoue = false) {
  const donnees = new Map(Object.entries(initial));
  const stockage: StockageCache = {
    lire: async (cle) => donnees.get(cle) ?? null,
    ecrire: async (cle, valeur) => { if (ecritureEchoue) throw new Error('plein'); donnees.set(cle, valeur); },
  };
  return { stockage, donnees };
}
const identite = (v: unknown) => v as string;
const panne = async (): Promise<string> => { throw new Error('RESEAU'); };

test('cache catalogue : lecture fraiche rendue et gardee, age null', async () => {
  const { stockage, donnees } = memoire();
  const cache = creerCacheCatalogue(stockage, () => 1_000_000);
  const r = await cache.lire('restaurants', async () => 'frais', identite);
  assert.deepEqual(r, { donnees: 'frais', ageMs: null });
  assert.ok((donnees.get('restaurants') ?? '').includes('frais'));
});

test('cache catalogue : echec d ecriture du cache sans consequence (confort seulement)', async () => {
  const { stockage } = memoire({}, true);
  const cache = creerCacheCatalogue(stockage, () => 1_000_000);
  const r = await cache.lire('restaurants', async () => 'frais', identite);
  assert.equal(r.donnees, 'frais');
  assert.equal(r.ageMs, null);
});

test('cache catalogue : reseau coupe = derniere lecture rendue avec son anciennete', async () => {
  const garde = JSON.stringify({ le: 1_000_000, donnees: 'ancien' });
  const { stockage } = memoire({ restaurants: garde });
  const cache = creerCacheCatalogue(stockage, () => 1_000_000 + 5 * 60_000);
  const r = await cache.lire('restaurants', panne, identite);
  assert.equal(r.donnees, 'ancien');
  assert.equal(r.ageMs, 5 * 60_000);
});

test('cache catalogue : plus de 7 jours = erreur d origine, jamais un vieux menu servi', async () => {
  const garde = JSON.stringify({ le: 1_000_000, donnees: 'ancien' });
  const { stockage } = memoire({ restaurants: garde });
  const cache = creerCacheCatalogue(stockage, () => 1_000_000 + VALIDITE_CACHE_MS + 1);
  await assert.rejects(cache.lire('restaurants', panne, identite), /RESEAU/);
  const juste = creerCacheCatalogue(stockage, () => 1_000_000 + VALIDITE_CACHE_MS);
  assert.equal((await juste.lire('restaurants', panne, identite)).donnees, 'ancien');
});

test('cache catalogue : cache corrompu ou invalide = erreur d origine, rien d invente', async () => {
  for (const brut of ['pas du json', '{"le":"hier","donnees":"x"}', '{"le":1000}']) {
    const { stockage } = memoire({ restaurants: brut });
    const cache = creerCacheCatalogue(stockage, () => 2_000);
    await assert.rejects(cache.lire('restaurants', panne, identite), /RESEAU/, brut);
  }
  const { stockage } = memoire({ restaurants: JSON.stringify({ le: 1_000, donnees: 42 }) });
  const cache = creerCacheCatalogue(stockage, () => 2_000);
  await assert.rejects(cache.lire('restaurants', panne, (v) => { if (typeof v !== 'string') throw new Error('INVALIDE'); return v; }), /RESEAU/);
});

test('cache catalogue : valeur relue depuis les lignes brutes SQLite (tableaux de valeurs, pas des objets)', () => {
  // expo-sqlite `executeForRawResultAsync` rend une ligne par tableau de valeurs : la valeur est a l indice 0.
  assert.equal(valeurDepuisLignesBrutes([['{"le":1,"donnees":"x"}']]), '{"le":1,"donnees":"x"}');
  assert.equal(valeurDepuisLignesBrutes([['premiere', 'ignoree']]), 'premiere');
  // Forme objet acceptee aussi (autres pilotes) ; tout le reste rend null, jamais une valeur inventee.
  assert.equal(valeurDepuisLignesBrutes([{ valeur: 'objet' }]), 'objet');
  assert.equal(valeurDepuisLignesBrutes([]), null);
  assert.equal(valeurDepuisLignesBrutes([[42]]), null);
  assert.equal(valeurDepuisLignesBrutes([[null]]), null);
  assert.equal(valeurDepuisLignesBrutes([{}]), null);
  assert.equal(valeurDepuisLignesBrutes(null), null);
  assert.equal(valeurDepuisLignesBrutes('pas des lignes'), null);
});

test('cache catalogue : libelles d anciennete en clair', () => {
  assert.equal(libelleAgeCache(0), "à l'instant");
  assert.equal(libelleAgeCache(30_000), "à l'instant");
  assert.equal(libelleAgeCache(5 * 60_000), 'il y a 5 min');
  assert.equal(libelleAgeCache(2 * 3_600_000), 'il y a 2 h');
  assert.equal(libelleAgeCache(3 * 24 * 3_600_000), 'il y a 3 j');
});
