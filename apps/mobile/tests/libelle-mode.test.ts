import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { libelleModeClient } from '../src/domaine/libelle-mode.ts';
import { libelleModeClient as libelleDuSite } from '../../../packages/shared/src/commande/mode.ts';

test('trois mots du client : Livraison, À emporter, Sur place (la valeur retrait s’affiche « À emporter »)', () => {
  assert.equal(libelleModeClient('livraison'), 'Livraison');
  assert.equal(libelleModeClient('retrait'), 'À emporter');
  assert.equal(libelleModeClient('sur_place'), 'Sur place');
});

test('sur place : « · table X » seulement si la table est connue (absente, nulle, vide ou blanche = rien)', () => {
  assert.equal(libelleModeClient('sur_place', '7'), 'Sur place · table 7');
  for (const t of [undefined, null, '', '   ']) assert.equal(libelleModeClient('sur_place', t), 'Sur place');
  assert.equal(libelleModeClient('livraison', '7'), 'Livraison');
  assert.equal(libelleModeClient('retrait', '7'), 'À emporter');
});

test('valeur inconnue : « À emporter », comme le site', () => {
  for (const v of ['', 'x', 'Retrait', 'table']) assert.equal(libelleModeClient(v), 'À emporter');
});

test('le même texte que le site, pour chaque mode et chaque table', () => {
  for (const mode of ['livraison', 'retrait', 'sur_place', 'inconnu']) for (const table of [undefined, null, '', ' 12 ', 'A 12']) {
    assert.equal(libelleModeClient(mode, table), libelleDuSite(mode, table), `${mode} / ${String(table)}`);
  }
});

const lire = (rel: string) => readFileSync(new URL('../src/' + rel, import.meta.url), 'utf8');

test('écrans : le mode est toujours affiché par libelleModeClient, plus aucun ancien libellé', () => {
  const compte = lire('connexion/CompteReel.tsx'), resto = lire('connexion/RestaurateurReel.tsx');
  assert.match(compte, /libelleModeClient\(o\.mode/);
  assert.match(resto, /libelleModeClient\(o\.mode, o\.tableNumero\)/);
  for (const [nom, source] of [['CompteReel', compte], ['RestaurateurReel', resto]] as const) {
    assert.ok(!/'Retrait'/.test(source), nom + ' : ancien libellé « Retrait »');
    assert.ok(!/'Sur place' \+/.test(source), nom + ' : libellé composé à la main');
  }
});

test('choix du mode de la commande : « À emporter » et « Livraison » ; pas de « Sur place » dans l’appli (il exige la clé du QR de table)', () => {
  const ecran = lire('catalogue/CommandeReelle.tsx');
  assert.match(ecran, /titre="À emporter"[^\n]*m\.saisir\('mode', 'retrait'\)/);
  assert.match(ecran, /titre="Livraison"[^\n]*m\.saisir\('mode', 'livraison'\)/);
  assert.ok(!/titre="Retrait"/.test(ecran), 'ancien libellé « Retrait »');
  assert.ok(!/titre="Sur place"/.test(ecran), 'aucun choix « Sur place » dans l’appli');
  assert.ok(!/saisir\('mode', 'sur_place'\)/.test(ecran));
});
