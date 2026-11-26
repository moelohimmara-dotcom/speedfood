import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { creerOuvreurEnSerie } from '../src/stockage/file-ouverture.ts';
import { STOCKAGE_CACHE_ABSENT, ouvrirCacheOuVide, type StockageCache } from '../src/catalogue/cache-catalogue.ts';

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// Essai du 18/11/2026, premier lancement sur une installation neuve : « Panier non restauré » puis « Le catalogue est indisponible », réparés par « Réessayer ».

test('ouvertures en série : jamais deux ouvertures en même temps, dans l’ordre des appels', async () => {
  let enCours = 0, maxEnCours = 0; const ordre: string[] = [];
  const ouvrir = creerOuvreurEnSerie(async (nom: string) => { enCours++; maxEnCours = Math.max(maxEnCours, enCours); await new Promise(r => setTimeout(r, 15)); ordre.push(nom); enCours--; return nom + '!'; });
  const resultats = await Promise.all([ouvrir('panier'), ouvrir('cache'), ouvrir('commandes')]);
  assert.deepEqual(resultats, ['panier!', 'cache!', 'commandes!']);
  assert.deepEqual(ordre, ['panier', 'cache', 'commandes']);
  assert.equal(maxEnCours, 1, 'une seule base s’ouvre à la fois');
});

test('ouvertures en série : un échec ne bloque pas la suivante et n’est rendu qu’à son appelant', async () => {
  const ouvrir = creerOuvreurEnSerie(async (nom: string) => { if (nom === 'cassee') throw Error('base cassée'); return nom; });
  const [a, b, c] = await Promise.allSettled([ouvrir('panier'), ouvrir('cassee'), ouvrir('cache')]);
  assert.equal(a.status, 'fulfilled'); assert.equal(c.status, 'fulfilled');
  assert.equal(b.status, 'rejected');
  assert.equal(await ouvrir('apres'), 'apres', 'et la file continue de servir');
});

test('cache du catalogue : ouvert après un échec passager, sans que l’écran ne voie rien', async () => {
  let essais = 0; const stockage: StockageCache = { lire: async () => 'x', ecrire: async () => undefined };
  const attentes: number[] = [];
  const r = await ouvrirCacheOuVide(async () => { essais++; if (essais < 2) throw Error('base pas prête'); return stockage; }, async ms => { attentes.push(ms); });
  assert.equal(r, stockage); assert.equal(essais, 2); assert.deepEqual(attentes, [300]);
});

test('cache du catalogue : base inutilisable = cache vide, le catalogue se lit quand même (plus d’erreur « indisponible » à cause du cache)', async () => {
  const erreurs: unknown[][] = []; const consoleErreur = console.error; console.error = (...a: unknown[]) => { erreurs.push(a); };
  try {
    const r = await ouvrirCacheOuVide(async () => { throw Error('SQLITE_CANTOPEN'); }, async () => undefined);
    assert.equal(r, STOCKAGE_CACHE_ABSENT);
  } finally { console.error = consoleErreur; }
  assert.equal(erreurs.length, 1); assert.equal(erreurs[0][0], 'cache_catalogue_indisponible');
  assert.equal(await STOCKAGE_CACHE_ABSENT.lire('restaurants:'), null);
  await assert.doesNotReject(STOCKAGE_CACHE_ABSENT.ecrire('restaurants:', '{}'));
});

test('câblage : le catalogue ouvre son cache par ouvrirCacheOuVide, toutes les bases passent par la file', () => {
  assert.ok(lire('../src/catalogue/CatalogueReel.tsx').includes('creerCacheCatalogue(await ouvrirCacheOuVide(ouvrirStockageCacheCatalogue))'));
  const racine = new URL('../src/', import.meta.url);
  const fichiers = (url: URL): URL[] => readdirSync(url, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'app' ? [] : fichiers(new URL(e.name + '/', url))) : /\.(ts|tsx)$/.test(e.name) ? [new URL(e.name, url)] : []);
  const directs = fichiers(racine).map(f => f.pathname.split('/src/')[1]).filter(f => f !== 'stockage/ouverture-serie.ts' && /\bopenDatabaseAsync\(/.test(lire('../src/' + f)));
  assert.deepEqual(directs, [], 'ouvrir une base en direct contourne la file');
  for (const f of ['stockage/panier-reel-sqlite.ts', 'catalogue/cache-catalogue-natif.ts', 'stockage/commandes-envoyees.ts', 'stockage/commandes-appareil.ts'])
    assert.ok(lire('../src/' + f).includes('ouvrirBaseEnSerie('), f);
});
