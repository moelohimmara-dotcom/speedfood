import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateHeureHistorique, libelleModeHistorique, lirePageHistorique, preparerPageHistorique, resumeHistorique,
} from '../src/connexion/historique-restaurateur.ts';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const brute = (id: string, surcharge: Record<string, unknown> = {}) => ({
  id, reference: 'SF-' + id.slice(-1).toUpperCase(), statut: 'terminee', mode: 'retrait',
  sousTotal: 45000, fraisLivraisonEstime: 5000, creeLe: '2026-11-03T10:20:00.000Z', nbLignes: 2, ...surcharge,
});
const page = (commandes: unknown[] = [brute(A)], surcharge: Record<string, unknown> = {}) => ({ ok: true, commandes, page: 1, total: 1, pageSuivante: null, ...surcharge });

test('historique : page lue, total = sous-total + frais, ordre conserve', () => {
  const p = lirePageHistorique(page([brute(A), brute(B, { statut: 'annulee', mode: 'livraison' })], { total: 2 }));
  assert.deepEqual(p.commandes.map(c => c.id), [A, B]);
  assert.equal(p.commandes[0].totalGnf, 50000);
  assert.equal(p.commandes[1].statut, 'annulee');
  assert.equal(p.pageSuivante, null);
  assert.equal(p.illisibles, 0);
});

test('historique : aucun champ client ni jeton retenu (le serveur n en envoie pas, l appli n en garde pas)', () => {
  const p = lirePageHistorique(page([brute(A, { clientNom: 'Awa', clientTelephone: '+224 622 00 00 00', jeton: 'x'.repeat(40) })]));
  const texte = JSON.stringify(p);
  assert.ok(!texte.includes('Awa') && !texte.includes('622') && !texte.includes('jeton'));
});

test('historique : ligne a valeur inconnue ou hors bornes ecartee et comptee, voisines conservees', () => {
  const cas: Array<Record<string, unknown>> = [
    { statut: 'en_attente' }, { statut: 'acceptee' }, { mode: 'drone' }, { sousTotal: 1.5 }, { sousTotal: -1 },
    { fraisLivraisonEstime: -5 }, { id: 'pas-un-uuid' }, { creeLe: 'hier' }, { nbLignes: -1 }, { nbLignes: 2.5 }, { reference: '' },
  ];
  for (const surcharge of cas) {
    const p = lirePageHistorique(page([brute(A, surcharge), brute(B)], { total: 2 }));
    assert.deepEqual(p.commandes.map(c => c.id), [B], JSON.stringify(surcharge));
    assert.equal(p.illisibles, 1, JSON.stringify(surcharge));
  }
  const doublon = lirePageHistorique(page([brute(A), brute(A)], { total: 2 }));
  assert.deepEqual(doublon.commandes.map(c => c.id), [A]);
  assert.equal(doublon.illisibles, 1);
});

test('historique : structure d ensemble invalide = refus total', () => {
  assert.throws(() => lirePageHistorique({ ok: false, commandes: [], page: 1, total: 0, pageSuivante: null }));
  assert.throws(() => lirePageHistorique(page([], { page: 0 })));
  assert.throws(() => lirePageHistorique(page([], { page: 1.5 })));
  assert.throws(() => lirePageHistorique(page([], { total: -1 })));
  assert.throws(() => lirePageHistorique(page([], { total: 2.5 })));
  assert.throws(() => lirePageHistorique(page([], { pageSuivante: 1 })));
  assert.throws(() => lirePageHistorique(page([], { pageSuivante: '2' })));
  assert.throws(() => lirePageHistorique({ ok: true, commandes: 'x', page: 1, total: 0, pageSuivante: null }));
  const trop = Array.from({ length: 101 }, (_, i) => brute(A, { reference: 'SF-' + i }));
  assert.throws(() => lirePageHistorique(page(trop, { total: 101 })));
});

test('historique : page suivante valide seulement si elle avance', () => {
  const p = lirePageHistorique(page([brute(A)], { page: 2, total: 30, pageSuivante: 3 }));
  assert.equal(p.pageSuivante, 3);
  assert.throws(() => lirePageHistorique(page([brute(A)], { page: 2, total: 30, pageSuivante: 2 })));
});

test('historique : demande de page bornee avant le reseau', () => {
  assert.deepEqual(preparerPageHistorique(1, 20), { page: 1, taille: 20 });
  assert.deepEqual(preparerPageHistorique(3, 100), { page: 3, taille: 100 });
  assert.equal(preparerPageHistorique(0, 20), null);
  assert.equal(preparerPageHistorique(-1, 20), null);
  assert.equal(preparerPageHistorique(1.5, 20), null);
  assert.equal(preparerPageHistorique(1, 0), null);
  assert.equal(preparerPageHistorique(1, 101), null);
  assert.equal(preparerPageHistorique(1, 20.5), null);
});

test('historique : libelles et formats (repris de l ancienne appli)', () => {
  assert.equal(resumeHistorique(12, 87), '12 commandes sur 87');
  assert.equal(resumeHistorique(0, 0), '0 commandes sur 0');
  assert.equal(libelleModeHistorique('livraison'), 'Livraison');
  assert.equal(libelleModeHistorique('retrait'), 'Retrait');
  assert.equal(libelleModeHistorique('sur_place'), 'Sur place');
  assert.equal(dateHeureHistorique('2026-10-23T18:20:00.000Z'), '23/10/2026 à 18:20');
  assert.equal(dateHeureHistorique('2026-10-23'), '23/10/2026');
  assert.equal(dateHeureHistorique(''), '');
  assert.equal(dateHeureHistorique('pas-une-date'), 'pas-une-date');
});
