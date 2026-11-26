import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS_REPARTITION_EQUIPE, lireAccesEquipe, lireCommandesARepartir, lireCommandesEquipe, lireCoordonneesEquipe,
  lireDetailCommandeEquipe, preparerMotifEquipe,
} from '../src/connexion/commandes-equipe.ts';

const ID = '00000000-0000-4000-8000-0000000000e1';
const apercu = (surcharge: Record<string, unknown> = {}) => ({
  id: ID, reference: 'SF-E1', restaurantNom: 'Chez Fatou', restaurantId: null, statut: 'en_attente', mode: 'livraison',
  clientNom: 'Awa', telephoneAffiche: '622 *** ** 56', adresseAffichee: 'Adresse masquée', sousTotal: 45000,
  fraisLivraisonEstime: 5000, creeLe: '2026-11-10T10:00:00.000Z', ...surcharge,
});

test('equipe acces : role, permissions et menu lus ; entree sans ecran natif marquee site', () => {
  const a = lireAccesEquipe({
    ok: true, role: 'support', permissions: ['commande.consulter'],
    groupes: [{ libelle: 'Exploitation', entrees: [{ chemin: '/system/commandes', libelle: 'Commandes', natif: true }, { chemin: '/system/parametres', libelle: 'Paramètres', natif: false }] }],
  });
  assert.equal(a.role, 'support');
  assert.equal(a.groupes[0].entrees[0].natif, true);
  assert.equal(a.groupes[0].entrees[1].natif, false);
  assert.throws(() => lireAccesEquipe({ ok: true, role: '', permissions: [], groupes: [] }));
  assert.throws(() => lireAccesEquipe({ ok: false, role: 'support', permissions: [], groupes: [] }));
});

test('equipe commandes : apercus lus (coordonnees deja masquees), ligne invalide ecartee et comptee', () => {
  const l = lireCommandesEquipe({ ok: true, commandes: [apercu(), apercu({ id: 'pas-un-uuid' }), apercu({ id: '00000000-0000-4000-8000-0000000000e2', statut: 'bizarre' })] });
  assert.equal(l.commandes.length, 1);
  assert.equal(l.commandes[0].totalGnf, 50000);
  assert.equal(l.illisibles, 2);
  assert.throws(() => lireCommandesEquipe({ ok: true, commandes: 'x' }));
});

test('equipe detail : historique, propositions et transitions lus ; peutReveler relu', () => {
  const d = lireDetailCommandeEquipe({
    ok: true, peutReveler: true, transitions: ['acceptee', 'refusee'],
    commande: {
      ...apercu(),
      historique: [{ statutPrecedent: null, statutSuivant: 'en_attente', acteur: 'client', horodatage: '2026-11-10T10:00:00.000Z' }],
      propositions: [{ version: 1, sousTotalPrecedent: 45000, nouveauSousTotal: 40000, fraisLivraisonPrecedent: null, nouveauxFraisLivraison: 5000, conditionsModifiees: null, statut: 'en_attente', expireLe: null, creeLe: '2026-11-10T10:05:00.000Z', reponduLe: null }],
    },
  });
  assert.equal(d.peutReveler, true);
  assert.deepEqual(d.transitions, ['acceptee', 'refusee']);
  assert.equal(d.commande.historique[0].statutSuivant, 'en_attente');
  assert.equal(d.commande.propositions[0].nouveauSousTotal, 40000);
  assert.throws(() => lireDetailCommandeEquipe({ ok: true, peutReveler: 'oui', transitions: [], commande: apercu() }));
  assert.throws(() => lireDetailCommandeEquipe({ ok: true, peutReveler: false, transitions: ['statut_inconnu'], commande: apercu() }));
});

test('equipe coordonnees : revelees seulement dans la reponse dediee (devoilees vrai), jamais depuis un apercu', () => {
  const c = lireCoordonneesEquipe({ ok: true, coordonnees: { telephone: '+224 622 12 34 56', adresse: 'Kaporo, Conakry', devoilees: true } });
  assert.equal(c.telephone, '+224 622 12 34 56');
  assert.throws(() => lireCoordonneesEquipe({ ok: true, coordonnees: { telephone: '622 *** ** 56', adresse: 'Adresse masquée', devoilees: false } }), 'masquees refusees');
  assert.throws(() => lireCoordonneesEquipe({ ok: true, coordonnees: null }));
  const l = lireCommandesEquipe({ ok: true, commandes: [apercu()] });
  assert.ok(!JSON.stringify(l).includes('622 12 34 56'));
});

test('equipe motif et actions : motif obligatoire borne, actions de repartition en liste blanche', () => {
  assert.equal(preparerMotifEquipe('  client injoignable  '), 'client injoignable');
  assert.equal(preparerMotifEquipe('   '), null);
  assert.equal(preparerMotifEquipe('x'.repeat(501)), null);
  assert.equal(preparerMotifEquipe('x'.repeat(500))?.length, 500);
  assert.deepEqual(ACTIONS_REPARTITION_EQUIPE, ['accepter', 'refuser', 'prete', 'terminee', 'annuler']);
});

test('equipe repartition : commandes a repartir lues avec lignes et telephone du restaurant', () => {
  const l = lireCommandesARepartir({
    ok: true,
    commandes: [{
      id: ID, reference: 'SF-E1', statut: 'prete', mode: 'livraison', sousTotal: 45000, fraisLivraison: 5000,
      creeLe: '2026-11-10T10:00:00.000Z', estTest: true, restaurantId: '11111111-1111-4111-8111-111111111111',
      restaurantNom: 'Chez Fatou', telephoneRestaurant: '+224 620 00 00 00', lignes: [{ nom: 'Poulet', quantite: 2 }],
    }],
  });
  assert.equal(l.commandes[0].totalGnf, 50000);
  assert.equal(l.commandes[0].estTest, true);
  assert.equal(l.commandes[0].lignes[0].nom, 'Poulet');
});
