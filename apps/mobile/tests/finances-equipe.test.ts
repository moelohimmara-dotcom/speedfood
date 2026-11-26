import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEBUT_PERIODE_FINANCES, FIN_PERIODE_FINANCES, libelleStatutVersement, lireFinancesEquipe, tauxAffiche,
} from '../src/connexion/finances-equipe.ts';

const E1 = '11111111-1111-4111-8111-111111111111';
const ligne = (surcharge: Record<string, unknown> = {}) => ({
  etablissementId: E1, etablissementNom: 'Chez Fatou', ventesGnf: 500000, commissionGnf: 50000, fraisLivraisonGnf: 30000,
  remboursementsGnf: 0, netAReverserGnf: 480000, taux: 0.1, effectifLe: '2026-10-01',
  versement: { statut: 'a_verser', reference: null, dateVersement: null }, ...surcharge,
});
const finances = (surcharge: Record<string, unknown> = {}) => ({
  ok: true,
  parametres: { tauxDefaut: 0.1, rythme: 'hebdomadaire', devise: 'GNF' },
  contrats: [{ etablissementId: E1, etablissementNom: 'Chez Fatou', taux: 0.1, effectifLe: '2026-10-01' }],
  releve: [ligne()],
  ...surcharge,
});

test('finances equipe : lecture complete, montants entiers, taux en taux', () => {
  const f = lireFinancesEquipe(finances());
  assert.deepEqual(f.parametres, { tauxDefaut: 0.1, rythme: 'hebdomadaire', devise: 'GNF' });
  assert.equal(f.contrats.length, 1);
  assert.equal(f.releve[0].netAReverserGnf, 480000);
  assert.equal(f.releve[0].versement.statut, 'a_verser');
  assert.equal(f.illisibles, 0);
});

test('finances equipe : ligne ou contrat invalide ecarte et compte, structure invalide refusee', () => {
  const f = lireFinancesEquipe(finances({
    contrats: [{ etablissementId: 'pas-un-uuid', etablissementNom: 'X', taux: 0.1, effectifLe: '2026-10-01' }],
    releve: [ligne({ ventesGnf: 1.5 }), ligne({ etablissementId: '22222222-2222-4222-8222-222222222222' })],
  }));
  assert.equal(f.contrats.length, 0);
  assert.equal(f.releve.length, 1);
  assert.equal(f.illisibles, 2);
  assert.throws(() => lireFinancesEquipe({ ok: false }));
  assert.throws(() => lireFinancesEquipe(finances({ parametres: { tauxDefaut: 1.5, rythme: 'hebdomadaire', devise: 'GNF' } })));
  assert.throws(() => lireFinancesEquipe(finances({ parametres: { tauxDefaut: -0.1, rythme: 'hebdomadaire', devise: 'GNF' } })));
  assert.throws(() => lireFinancesEquipe(finances({ releve: 'x' })));
});

test('finances equipe : libelles de versement et taux effectif affiche', () => {
  assert.equal(libelleStatutVersement('a_verser'), 'À verser');
  assert.equal(libelleStatutVersement('verse'), 'Versé');
  assert.equal(libelleStatutVersement('en_attente'), 'en attente');
  assert.equal(tauxAffiche(0.1), '10 %');
  assert.equal(tauxAffiche(0.075), '7 %');
});

test('finances equipe : releve reel (tauxCommission, sans effectifLe) lu sans etre ecarte', () => {
  const f = lireFinancesEquipe(finances({ releve: [ligne({ taux: undefined, tauxCommission: 0.08, effectifLe: undefined })] }));
  assert.equal(f.releve.length, 1);
  assert.equal(f.releve[0].taux, 0.08);
  assert.equal(f.illisibles, 0);
});

test('finances equipe : periode par defaut de l ancienne appli', () => {
  assert.equal(DEBUT_PERIODE_FINANCES, '2026-10-01');
  assert.equal(FIN_PERIODE_FINANCES, '2026-11-01');
});
