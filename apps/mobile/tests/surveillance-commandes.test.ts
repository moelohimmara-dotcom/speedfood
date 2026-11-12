import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAPPEL_MS, SurveillanceCommandes } from '../src/connexion/surveillance-commandes.ts';
import type { CommandeRestaurateur, ListeRestaurateur } from '../src/connexion/restaurateur.ts';

const MAINTENANT = Date.parse('2026-10-21T12:00:00.000Z');
const commande = (id: string, surcharge: Partial<CommandeRestaurateur> = {}): CommandeRestaurateur => ({
  id, reference: 'SF-' + id.toUpperCase(), statut: 'en_attente', mode: 'retrait', tableNumero: null,
  clientNom: 'Aminata', clientTelephone: '+224622123456', clientAdresse: null,
  totalGnf: 10000, sousTotalGnf: 10000, fraisGnf: 0, creeLe: new Date(MAINTENANT).toISOString(), estTest: true,
  lignes: [], propositionEnAttente: false, propositionMontants: null,
  paiementStatut: 'non_demande', paiementMode: null, paiementReference: null, paiementVisible: false,
  documents: { recu: null, facture: null }, livraison: null, ...surcharge,
});
const liste = (commandes: CommandeRestaurateur[], restaurant: ListeRestaurateur['restaurant'] = { id: '11111111-1111-4111-8111-111111111111', nom: 'Chez Awa', ouvert: true, accepteCommandes: true }): ListeRestaurateur => ({
  restaurant, commandes, illisibles: 0, livraisonsIllisibles: 0,
});

test('surveillance : au demarrage, les commandes deja la ne declenchent pas d alerte', () => {
  const s = new SurveillanceCommandes();
  const tour = s.tourListe(liste([commande('a')]), MAINTENANT);
  assert.equal(tour.genre, 'suite');
  assert.equal(tour.genre === 'suite' && tour.aTraiter.length, 1);
  assert.equal(tour.genre === 'suite' && tour.alerter, false);
});

test('surveillance : une commande qui attend depuis plus d une minute au demarrage alerte (service relance apres coupure)', () => {
  const s = new SurveillanceCommandes();
  const vieille = commande('vieille', { creeLe: new Date(MAINTENANT - 5 * 60_000).toISOString() });
  const tour = s.tourListe(liste([vieille]), MAINTENANT);
  assert.equal(tour.genre === 'suite' && tour.alerter, true);
});

test('surveillance : nouvelle commande = alerte, puis rappel chaque minute tant qu il en reste', () => {
  const s = new SurveillanceCommandes();
  let maintenant = MAINTENANT;
  s.tourListe(liste([commande('a')]), maintenant);
  maintenant += 10_000;
  const nouvelle = s.tourListe(liste([commande('a'), commande('b')]), maintenant);
  assert.equal(nouvelle.genre === 'suite' && nouvelle.nouvelles, 1);
  assert.equal(nouvelle.genre === 'suite' && nouvelle.alerter, true);
  assert.equal(nouvelle.genre === 'suite' && nouvelle.rappel, false);
  maintenant += 10_000;
  const calme = s.tourListe(liste([commande('a'), commande('b')]), maintenant);
  assert.equal(calme.genre === 'suite' && calme.alerter, false, 'pas de nouvelle alerte 10 s apres');
  maintenant += RAPPEL_MS;
  const rappel = s.tourListe(liste([commande('a'), commande('b')]), maintenant);
  assert.equal(rappel.genre === 'suite' && rappel.rappel, true);
  assert.equal(rappel.genre === 'suite' && rappel.nouvelles, 0);
});

test('surveillance : commande traitee = plus d alerte ; restaurant ferme sans rien a traiter = arret', () => {
  const s = new SurveillanceCommandes();
  let maintenant = MAINTENANT;
  s.tourListe(liste([commande('a')]), maintenant);
  maintenant += 90_000;
  const traitee = s.tourListe(liste([commande('a', { statut: 'acceptee' })]), maintenant);
  assert.equal(traitee.genre === 'suite' && traitee.aTraiter.length, 0);
  assert.equal(traitee.genre === 'suite' && traitee.alerter, false);
  const ferme = liste([], { id: '11111111-1111-4111-8111-111111111111', nom: 'Chez Awa', ouvert: false, accepteCommandes: false });
  assert.equal(s.tourListe(ferme, maintenant).genre, 'arret');
});

test('surveillance : restaurant ferme mais une commande attend encore = on continue', () => {
  const s = new SurveillanceCommandes();
  const ferme = liste([commande('a')], { id: '11111111-1111-4111-8111-111111111111', nom: 'Chez Awa', ouvert: false, accepteCommandes: false });
  assert.equal(s.tourListe(ferme, MAINTENANT).genre, 'suite');
});

test('surveillance : panne = attente (on reessaie), acces refuse ou plus de session = arret, sans consommer le premier tour', () => {
  const s = new SurveillanceCommandes();
  assert.equal(s.tourPanne('panne').genre, 'attente');
  assert.equal(s.tourPanne('acces_refuse').genre, 'arret');
  assert.equal(s.tourPanne('session_absente').genre, 'arret');
  const tour = s.tourListe(liste([commande('a')]), MAINTENANT);
  assert.equal(tour.genre === 'suite' && tour.alerter, false, 'le premier tour reussi reste un demarrage');
});
