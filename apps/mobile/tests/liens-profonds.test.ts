import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';
import { lireLienProfond } from '../src/connexion/liens-profonds.ts';
import { abonnerLienEnAttente, deposerLienEnAttente, prendreLienEnAttente } from '../src/connexion/lien-en-attente.ts';
import { DIAPOS_CLIENT, DIAPOS_RESTAURATEUR, doitProposerVisite, etapeSuivante } from '../src/connexion/visite.ts';

test('liens profonds : restaurant et commande des hotes Speedfood connus', () => {
  assert.deepEqual(lireLienProfond('https://speedfood-app.moelohimmara.workers.dev/r/abc-123'), { genre: 'restaurant', id: 'abc-123' });
  assert.deepEqual(lireLienProfond('https://www.speedfood.dev/r/abc'), { genre: 'restaurant', id: 'abc' });
  assert.deepEqual(lireLienProfond('http://speedfood.dev/commande/jeton-xyz'), { genre: 'commande', jeton: 'jeton-xyz' });
  assert.deepEqual(lireLienProfond('  https://speedfood.dev/r/abc?partage=whatsapp#haut  '), { genre: 'restaurant', id: 'abc' });
});

test('liens profonds : tout autre hote, schema ou chemin est refuse (aucune navigation arbitraire)', () => {
  const refuses = [
    'https://exemple.com/r/abc',
    'https://speedfood.dev.evil.com/r/abc',
    'speedfood://r/abc',
    'https://speedfood.dev/restaurant/abc',
    'https://speedfood.dev/r/',
    'https://speedfood.dev/r/a/b',
    'https://speedfood.dev/compte',
    'https://speedfood.dev/r/' + 'x'.repeat(161),
    'https://speedfood.dev/r/a b',
    'https://speedfood.dev/r/a\\b',
    '',
    'pas une adresse',
  ];
  for (const url of refuses) assert.equal(lireLienProfond(url), null, url);
});

test('liens profonds : Android declare les liens HTTPS des hotes connus (sinon le lien reste au navigateur)', () => {
  const config = JSON.parse(readFileSync(cheminDepuisModule('../app.json'), 'utf8')) as {
    expo: { scheme?: string; android?: { intentFilters?: { action?: string; autoVerify?: boolean; category?: string[]; data?: { scheme?: string; host?: string; pathPrefix?: string }[] }[] } };
  };
  assert.equal(config.expo.scheme, 'speedfood-demo');
  const filtres = config.expo.android?.intentFilters ?? [];
  const vues = filtres.filter(f => f.action === 'VIEW');
  assert.ok(vues.length >= 1, 'au moins un filtre VIEW doit etre declare');
  for (const filtre of vues) {
    assert.equal(filtre.autoVerify, false, 'pas de lien verifie pretendu : le site ne publie pas assetlinks.json');
    assert.ok(filtre.category?.includes('BROWSABLE'), 'categorie BROWSABLE requise');
    assert.ok(filtre.category?.includes('DEFAULT'), 'categorie DEFAULT requise');
  }
  const donnees = vues.flatMap(f => f.data ?? []);
  for (const hote of ['speedfood.dev', 'www.speedfood.dev', 'speedfood-app.moelohimmara.workers.dev']) {
    for (const prefixe of ['/r/', '/commande/']) {
      assert.ok(
        donnees.some(d => d.scheme === 'https' && d.host === hote && d.pathPrefix === prefixe),
        `lien declare manquant : https://${hote}${prefixe}...`,
      );
    }
  }
});

test('lien en attente : depose puis pris une seule fois ; abonne prevenu aussitot', () => {
  prendreLienEnAttente();
  const recus: string[] = [];
  const desabonner = abonnerLienEnAttente((url) => recus.push(url));
  deposerLienEnAttente('https://speedfood.dev/r/abc');
  assert.deepEqual(recus, ['https://speedfood.dev/r/abc'], 'l abonne est prevenu au depot');
  assert.equal(prendreLienEnAttente(), 'https://speedfood.dev/r/abc');
  assert.equal(prendreLienEnAttente(), null, 'un lien pris est consomme : jamais rejoue');
  desabonner();
  deposerLienEnAttente('https://speedfood.dev/commande/j1');
  assert.deepEqual(recus, ['https://speedfood.dev/r/abc'], 'apres desabonnement, plus aucune notification');
  assert.equal(prendreLienEnAttente(), 'https://speedfood.dev/commande/j1', 'le depot reste en attente pour le prochain monteur');
  prendreLienEnAttente();
});

test('lien en attente : un depot vide ou blanc est ignore, rien n est invente', () => {
  prendreLienEnAttente();
  deposerLienEnAttente('');
  deposerLienEnAttente('   ');
  assert.equal(prendreLienEnAttente(), null);
});

test('visite guidee : deux series de deux ecrans, fidelement reprises', () => {
  assert.equal(DIAPOS_CLIENT.length, 2);
  assert.equal(DIAPOS_RESTAURATEUR.length, 2);
  assert.equal(DIAPOS_CLIENT[0].titre, 'Les restaurants de votre zone');
  assert.equal(DIAPOS_CLIENT[1].titre, 'Commandez, puis suivez');
  assert.equal(DIAPOS_RESTAURATEUR[0].titre, 'Speedfood tient votre fiche avec vous');
  assert.equal(DIAPOS_RESTAURATEUR[1].titre, 'Des plats toujours à jour');
});

test('visite guidee : proposee seulement si jamais vue ; progression bornee', () => {
  assert.equal(doitProposerVisite(false), true);
  assert.equal(doitProposerVisite(true), false);
  assert.deepEqual(etapeSuivante(0, 2), { page: 1, terminee: false });
  assert.deepEqual(etapeSuivante(1, 2), { page: 1, terminee: true });
  assert.deepEqual(etapeSuivante(5, 2), { page: 1, terminee: true });
});
