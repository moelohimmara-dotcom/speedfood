import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lireAuditEquipe, lireComptesEquipe, lireMisesAJourEquipe, lireZonesAttente, nonPrevenues, zoneAMarquerPrevenue,
} from '../src/connexion/admin-equipe.ts';

const U1 = '00000000-0000-4000-8000-0000000000c1';
test('comptes equipe : annuaire lu, affiliations conservees, troncature signalee', () => {
  const r = lireComptesEquipe({
    ok: true, tronque: true,
    comptes: [{
      utilisateurId: U1, email: 'fatou@exemple.com', creeLe: '2026-10-01T00:00:00.000Z', roleSysteme: null,
      restaurants: [{ restaurantId: '11111111-1111-4111-8111-111111111111', nom: 'Chez Fatou', role: 'owner' }], test: false,
    }, { utilisateurId: 'pas-un-uuid', email: 'x@y.z', creeLe: '2026-10-01T00:00:00.000Z', roleSysteme: null, restaurants: [], test: true }],
  });
  assert.equal(r.comptes.length, 1);
  assert.equal(r.comptes[0].restaurants[0].role, 'owner');
  assert.equal(r.tronque, true);
  assert.equal(r.illisibles, 1);
  assert.throws(() => lireComptesEquipe({ ok: true, comptes: 'x', tronque: false }));
});

test('audit equipe : indicateurs, filtres proposes et journal lus', () => {
  const a = lireAuditEquipe({
    ok: true, tronque: false,
    indicateurs: [{ cle: 'commandes_en_attente', libelle: 'Commandes en attente', definition: 'En attente de confirmation', valeur: 3 }],
    actions: [{ code: 'restaurant.approbation', libelle: 'Approbation d’un restaurant' }],
    periodes: [{ valeur: null, libelle: 'Tout l’historique' }, { valeur: 7, libelle: '7 derniers jours' }],
    journal: [{
      id: '00000000-0000-4000-8000-0000000000c2', horodatage: '2026-11-10T10:00:00.000Z', action: 'restaurant.approbation', libelle: 'Approbation',
      acteurEmail: null, auteur: 'acteur inconnu', cibleType: 'restaurant', cibleId: '11111111-1111-4111-8111-111111111111',
      cible: 'Restaurant 11111111', cibleUrl: '/system/catalogue/restaurants/11111111-1111-4111-8111-111111111111', motif: null,
    }],
  });
  assert.equal(a.indicateurs[0].valeur, 3);
  assert.equal(a.journal[0].auteur, 'acteur inconnu');
  assert.equal(a.periodes[0].valeur, null);
  assert.equal(a.illisibles, 0);
  assert.throws(() => lireAuditEquipe({ ok: true, indicateurs: [], actions: [], periodes: [], journal: 'x', tronque: false }));
});

test('audit equipe : une ligne du journal illisible est ecartee et comptee, les autres restent affichees', () => {
  const ligneOk = {
    id: 'e1', horodatage: '2026-11-10T10:00:00.000Z', action: 'restaurant.approbation', libelle: 'Approbation',
    acteurEmail: null, auteur: 'acteur inconnu', cibleType: 'restaurant', cibleId: 'r1',
    cible: 'Restaurant r1', cibleUrl: null, motif: null,
  };
  const a = lireAuditEquipe({
    ok: true, tronque: false, indicateurs: [], actions: [], periodes: [],
    journal: [
      ligneOk,
      { ...ligneOk, id: 'e2', horodatage: 'pas une date' },
      { ...ligneOk, id: 42 },
      { ...ligneOk, id: 'e4', acteurEmail: 'x'.repeat(201) },
    ],
  });
  assert.deepEqual(a.journal.map(j => j.id), ['e1'], 'seule la ligne saine est gardee, dans l ordre');
  assert.equal(a.illisibles, 3, 'les trois lignes illisibles sont comptees, jamais affichees ni inventees');
  // Les sections generees par le serveur (indicateurs) restent strictes : une valeur fausse rejette toute la reponse.
  assert.throws(() => lireAuditEquipe({
    ok: true, tronque: false,
    indicateurs: [{ cle: 'c1', libelle: 'L', definition: '', valeur: 1.5 }],
    actions: [], periodes: [], journal: [ligneOk],
  }));
});

test('liste attente : zones lues, reste a prevenir calcule comme le serveur', () => {
  const z = lireZonesAttente({
    ok: true,
    zones: [{ niveau: 'quartier', id: '22222222-2222-4222-8222-222222222222', nom: 'Kaporo', contexte: 'Ratoma, Conakry', personnes: 12, prevenues: 5, derniere: '2026-11-09T10:00:00.000Z' }],
  });
  assert.equal(z.zones[0].personnes, 12);
  assert.equal(nonPrevenues(12, 5), 7);
  assert.equal(nonPrevenues(3, 9), 0);
  assert.equal(zoneAMarquerPrevenue(12, 5), true);
  assert.equal(zoneAMarquerPrevenue(5, 5), false);
  const ecartee = lireZonesAttente({ ok: true, zones: [{ niveau: 'planete', id: '22222222-2222-4222-8222-222222222222', nom: 'X', contexte: '', personnes: 1, prevenues: 0, derniere: '2026-11-09T10:00:00.000Z' }] });
  assert.equal(ecartee.zones.length, 0, 'niveau inconnu ecarte et compte');
  assert.equal(ecartee.illisibles, 1);
});

test('mises a jour equipe : version, annonce, interrupteurs et journal lus', () => {
  const m = lireMisesAJourEquipe({
    ok: true,
    version: { code: 100, nom: '3.0.0', notes: 'Première version Expo' },
    appareils: 42,
    annonce: { versionCode: 100, versionNom: '3.0.0', annonceeLe: '2026-11-12T09:00:00.000Z', appareils: 42, envoyes: 40 },
    fonctionnalites: [{ cle: 'commandes', libelle: 'Commandes', description: 'Passer commande', groupe: 'Client', active: true, miseAJourLe: '2026-11-01T00:00:00.000Z' }],
    misesAJour: [{ id: 'm1', date: '2026-11-01', titre: 'Nouvelle appli', resume: 'Refonte', verification: 'Essais', cle: 'commandes', active: true, raisonSansInterrupteur: null, groupe: 'Client' }],
  });
  assert.equal(m.version.nom, '3.0.0');
  assert.equal(m.annonce?.envoyes, 40);
  assert.equal(m.fonctionnalites[0].active, true);
  assert.equal(m.misesAJour[0].active, true);
  assert.throws(() => lireMisesAJourEquipe({ ok: true, version: { code: 1.5, nom: 'x', notes: '' }, appareils: 0, annonce: null, fonctionnalites: [], misesAJour: [] }));
});
