import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireScoreRestaurateur } from '../src/connexion/score-restaurateur.ts';

test('score restaurateur : réponse complète relue, note absente acceptée', () => {
  const lu = lireScoreRestaurateur({ ok: true, score: { mois: '2026-11-01', score: 81, palier: 'excellent', moisBasConsecutifs: 0, indicateurs: { acceptationDelai: 75, preparationTenue: 100, exactitude: 80, note: null, ficheComplete: 50, disponibilite: 100 } } });
  assert.equal(lu?.score, 81);
  assert.equal(lu?.palier, 'excellent');
  assert.equal(lu?.note, null);
  assert.equal(lu?.acceptationDelai, 75);
});

test('score restaurateur : avant le premier calcul, null ; réponse illisible refusée', () => {
  assert.equal(lireScoreRestaurateur({ ok: true, score: null }), null);
  assert.throws(() => lireScoreRestaurateur({ ok: true, score: { mois: '2026-11-01', score: 120, palier: 'excellent', moisBasConsecutifs: 0, indicateurs: {} } }));
  assert.throws(() => lireScoreRestaurateur({ ok: true, score: { mois: '2026-11-01', score: 40, palier: 'super', moisBasConsecutifs: 0, indicateurs: {} } }));
});
