import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireActiviteRestaurateur } from '../src/connexion/activite-restaurateur.ts';

const recente = (surcharge: Record<string, unknown> = {}) => ({
  reference: 'SF-AAA111', mode: 'retrait', totalGnf: 25000, creeLe: '2026-11-10T12:00:00.000Z', ...surcharge,
});
const activite = (surcharge: Record<string, unknown> = {}) => ({
  ok: true,
  aujourdhui: { recues: 3, terminees: 2, chiffreGnf: 50000 },
  semaine: { recues: 20, terminees: 15, chiffreGnf: 375000 },
  repartition: { recues: 20, terminees: 15, refusees: 2, annulees: 1, enCours: 2 },
  recentes: [recente()],
  ...surcharge,
});

test('activite : lecture complete, chiffres entiers conserves', () => {
  const a = lireActiviteRestaurateur(activite());
  assert.deepEqual(a.aujourdhui, { recues: 3, terminees: 2, chiffreGnf: 50000 });
  assert.deepEqual(a.semaine, { recues: 20, terminees: 15, chiffreGnf: 375000 });
  assert.deepEqual(a.repartition, { recues: 20, terminees: 15, refusees: 2, annulees: 1, enCours: 2 });
  assert.equal(a.recentes.length, 1);
  assert.equal(a.recentes[0].totalGnf, 25000);
  assert.equal(a.illisibles, 0);
});

test('activite : aucun champ supplementaire retenu (ni client, ni jeton)', () => {
  const a = lireActiviteRestaurateur(activite({ recentes: [recente({ clientNom: 'Awa', clientTelephone: '+224 622 00 00 00', jeton: 'x'.repeat(40) })], restaurantId: 'secret' }));
  const texte = JSON.stringify(a);
  assert.ok(!texte.includes('Awa') && !texte.includes('622') && !texte.includes('jeton') && !texte.includes('secret'));
});

test('activite : recente invalide ecartee et comptee, voisines conservees', () => {
  const cas: Array<Record<string, unknown>> = [
    { mode: 'drone' }, { totalGnf: -1 }, { totalGnf: 1.5 }, { creeLe: 'hier' }, { reference: '' },
  ];
  for (const surcharge of cas) {
    const a = lireActiviteRestaurateur(activite({ recentes: [recente(surcharge), recente({ reference: 'SF-BBB222' })] }));
    assert.deepEqual(a.recentes.map(r => r.reference), ['SF-BBB222'], JSON.stringify(surcharge));
    assert.equal(a.illisibles, 1, JSON.stringify(surcharge));
  }
});

test('activite : structure invalide = refus total', () => {
  assert.throws(() => lireActiviteRestaurateur({ ok: false }));
  assert.throws(() => lireActiviteRestaurateur(activite({ aujourdhui: { recues: -1, terminees: 0, chiffreGnf: 0 } })));
  assert.throws(() => lireActiviteRestaurateur(activite({ aujourdhui: { recues: 1.5, terminees: 0, chiffreGnf: 0 } })));
  assert.throws(() => lireActiviteRestaurateur(activite({ semaine: null })));
  assert.throws(() => lireActiviteRestaurateur(activite({ repartition: { recues: 20, terminees: 15, refusees: 2, annulees: 1 } })));
  assert.throws(() => lireActiviteRestaurateur(activite({ recentes: 'x' })));
  const trop = Array.from({ length: 16 }, (_, i) => recente({ reference: 'SF-' + i }));
  assert.throws(() => lireActiviteRestaurateur(activite({ recentes: trop })));
});

test('activite : semaine vide lisible (restaurant sans commande)', () => {
  const a = lireActiviteRestaurateur(activite({
    aujourdhui: { recues: 0, terminees: 0, chiffreGnf: 0 },
    semaine: { recues: 0, terminees: 0, chiffreGnf: 0 },
    repartition: { recues: 0, terminees: 0, refusees: 0, annulees: 0, enCours: 0 },
    recentes: [],
  }));
  assert.equal(a.recentes.length, 0);
  assert.equal(a.semaine.chiffreGnf, 0);
});
