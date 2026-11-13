import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireTableauEquipe } from '../src/connexion/tableau-equipe.ts';
import { lirePaiementsEquipe } from '../src/connexion/paiements-equipe.ts';

test('tableau equipe : blocs presents lus, blocs absents = pas le droit (jamais un zero invente)', () => {
  const t = lireTableauEquipe({
    ok: true, role: 'support',
    commandes: { activesDuJour: 4, enAttente: 2, propositionsEnAttente: 1 },
    exploitation: { aConfirmer: 3, etablissementsSansTelephone: 1, coursesSansLivreur: 2, livreursEnLigne: 5, candidatsLivreurs: 1 },
  });
  assert.equal(t.role, 'support');
  assert.equal(t.commandes?.activesDuJour, 4);
  assert.equal(t.exploitation?.livreursEnLigne, 5);
  assert.equal(t.catalogue, null);
  const minimal = lireTableauEquipe({ ok: true, role: 'lecture' });
  assert.equal(minimal.commandes, null);
  assert.equal(minimal.exploitation, null);
  assert.equal(minimal.catalogue, null);
});

test('tableau equipe : bloc ou structure invalide = refus', () => {
  assert.throws(() => lireTableauEquipe({ ok: false, role: 'support' }));
  assert.throws(() => lireTableauEquipe({ ok: true, role: '' }));
  assert.throws(() => lireTableauEquipe({ ok: true, role: 'support', commandes: { activesDuJour: -1, enAttente: 0, propositionsEnAttente: 0 } }));
  assert.throws(() => lireTableauEquipe({ ok: true, role: 'support', catalogue: { enAttenteValidation: 0, publies: 0, suspendus: 0, aCorriger: 0 } }));
});

const paiement = (surcharge: Record<string, unknown> = {}) => ({
  id: 'p1', commandeReference: 'SF-AAA111', restaurantNom: 'Chez Fatou', etat: 'en_attente', operateur: 'orange_money', fournisseur: 'simulation',
  totalGnf: 50000, restaurantGnf: 45000, livreurGnf: 5000, speedfoodBrutGnf: 5000, fraisMobileGnf: 500, rembourseGnf: 0, creeLe: '2026-11-10T10:00:00.000Z',
  versements: [{ beneficiaire: 'restaurant', etat: 'a_verser', montantGnf: 45000, erreurCode: null }],
  litiges: [], ...surcharge,
});
const paiements = (surcharge: Record<string, unknown> = {}) => ({
  ok: true,
  reglages: { actif: false, fournisseur: 'simulation', valeursValidees: false },
  compteurs: { enAttente: 1, versementsATraiter: 1, litigesAHumain: 0 },
  paiements: [paiement()],
  ...surcharge,
});

test('paiements equipe : lecture complete, aucun numero de versement retenu', () => {
  const p = lirePaiementsEquipe(paiements({ paiements: [paiement({ telephoneVersement: '+224 622 00 00 00', numeroMasque: '622 ** ** 00' })] }));
  assert.equal(p.compteurs.enAttente, 1);
  assert.equal(p.paiements[0].totalGnf, 50000);
  assert.equal(p.paiements[0].versements[0].montantGnf, 45000);
  const texte = JSON.stringify(p);
  assert.ok(!texte.includes('622') && !texte.includes('telephone'));
});

test('paiements equipe : paiement invalide ecarte et compte, structure invalide refusee', () => {
  const p = lirePaiementsEquipe(paiements({ paiements: [paiement({ totalGnf: -5 }), paiement({ id: 'p2', versements: [{ beneficiaire: 'x', etat: 'a_verser', montantGnf: 1.5, erreurCode: null }] })] }));
  assert.equal(p.paiements.length, 0);
  assert.equal(p.illisibles, 2);
  assert.throws(() => lirePaiementsEquipe({ ok: false }));
  assert.throws(() => lirePaiementsEquipe(paiements({ compteurs: { enAttente: -1, versementsATraiter: 0, litigesAHumain: 0 } })));
  assert.throws(() => lirePaiementsEquipe(paiements({ reglages: { actif: 'oui', fournisseur: 'simulation', valeursValidees: false } })));
});
