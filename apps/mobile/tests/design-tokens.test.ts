import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couleurs, dureeMouvement, durees, espacements, rayons } from '../src/design/tokens.ts';

test('design : échelles mobiles alignées sur le site (espacements, rayons, durées)', () => {
  assert.deepEqual(espacements, { x1: 4, x2: 8, x3: 12, x4: 16, x5: 20, x6: 24, x8: 32 });
  assert.deepEqual(rayons, { sm: 8, md: 14, lg: 20, xl: 24, pill: 999 });
  assert.deepEqual(durees, { rapide: 120, base: 200, interfaceMax: 300, editoriale: 600 });
});

test('design : couleurs verrouillées inchangées, danger aligné sur le site', () => {
  assert.equal(couleurs.rouge, '#D9362B');
  assert.equal(couleurs.secondaire, '#75695F');
  assert.equal(couleurs.danger, '#C62828');
  assert.equal(couleurs.dangerFond, '#FBEAEA');
});

test('design : mouvement réduit = durée zéro, plafond éditorial toujours respecté', () => {
  assert.equal(dureeMouvement(true, 300), 0);
  assert.equal(dureeMouvement(true, 120), 0);
  assert.equal(dureeMouvement(false, 300), 300);
  assert.equal(dureeMouvement(false, 5000), 600);
  assert.equal(dureeMouvement(false, -50), 0);
});
