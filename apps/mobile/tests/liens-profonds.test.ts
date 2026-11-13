import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireLienProfond } from '../src/connexion/liens-profonds.ts';
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
