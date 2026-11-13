import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veilleNative } from '../modules/speedfood-veille/src/index.ts';

test('veille native : absente hors telephone, tout se degrade sans erreur (jamais un ecran casse)', async () => {
  assert.equal(veilleNative.disponible(), false);
  assert.equal(await veilleNative.demarrerVeilleRestaurateur(), false);
  assert.equal(await veilleNative.alerterVeilleRestaurateur(2, 'SF-TEST'), false);
  assert.equal(await veilleNative.demarrerSuiviLivreur(), false);
  await veilleNative.arreterVeilleRestaurateur();
  await veilleNative.arreterSuiviLivreur();
  const retirer = veilleNative.ecouterPositions(() => undefined);
  retirer();
});
