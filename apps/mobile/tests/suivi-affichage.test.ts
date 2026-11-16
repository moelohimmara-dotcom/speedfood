import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELAI_RELECTURE_MS, ETAPES_SUIVI, doitRelire, estFinal, heureLisible, libelleStatutSuivi, messageRestaurantARepondu, previsionPreparation, etapeActuelle, tonStatut } from '../src/connexion/suivi-affichage.ts';
import { lireSuivi } from '../src/connexion/commandes.ts';
// Parité Kotlin (tranche 10.4, `SuiviScreen` et `SuiviViewModel`) : libellé et ton d'état, frise d'étapes, estimation de préparation, message après réponse du restaurant, relecture automatique.
test('libellés d’état : mots lisibles de l’ancienne appli, jamais le mot technique', () => {
  const l = libelleStatutSuivi;
  assert.equal(l('en_attente'), 'En attente du restaurant'); assert.equal(l('acceptee'), 'Acceptée, en préparation'); assert.equal(l('prete'), 'Prête');
  assert.equal(l('terminee'), 'Terminée'); assert.equal(l('refusee'), 'Refusée par le restaurant'); assert.equal(l('annulee'), 'Annulée');
  assert.equal(l('inconnu_xyz'), 'Statut en cours de mise à jour');
  assert.equal(l('en_attente', 'attente_confirmation_client'), 'Le restaurant propose un changement', 'une proposition en attente prime');
});
test('ton de la pastille : danger pour refusée ou annulée, succès pour acceptée, prête, terminée, neutre sinon', () => {
  assert.equal(tonStatut('refusee'), 'danger'); assert.equal(tonStatut('annulee'), 'danger');
  for (const s of ['acceptee', 'prete', 'terminee']) assert.equal(tonStatut(s), 'succes');
  assert.equal(tonStatut('en_attente'), 'neutre'); assert.equal(tonStatut('autre'), 'neutre');
});
test('frise : quatre étapes Envoyée, Acceptée, Prête, Terminée ; étape actuelle bornée à zéro ; pas de frise si refusée ou annulée', () => {
  assert.deepEqual(ETAPES_SUIVI.map(e => e.libelle), ['Envoyée', 'Acceptée', 'Prête', 'Terminée']);
  assert.equal(etapeActuelle('en_attente'), 0); assert.equal(etapeActuelle('acceptee'), 1); assert.equal(etapeActuelle('prete'), 2); assert.equal(etapeActuelle('terminee'), 3);
  assert.equal(etapeActuelle('statut_inconnu'), 0);
  assert.equal(etapeActuelle('refusee'), null); assert.equal(etapeActuelle('annulee'), null);
});
test('états finaux : terminée, refusée, annulée', () => {
  for (const s of ['terminee', 'refusee', 'annulee']) assert.equal(estFinal(s), true);
  for (const s of ['en_attente', 'acceptee', 'prete', 'x']) assert.equal(estFinal(s), false);
});
test('heure lisible : HH:MM en heure de Conakry (GMT), vide si illisible', () => {
  assert.equal(heureLisible('2026-11-16T14:05:00Z'), '14:05'); assert.equal(heureLisible('2026-11-16T00:09:59Z'), '00:09');
  assert.equal(heureLisible('2026-11-16T09:30:00+00:00'), '09:30');
  for (const mauvais of [null, undefined, '', '  ', 'pas une date']) assert.equal(heureLisible(mauvais as string | null), '');
});
test('estimation : « Prête vers HH:MM » si le restaurant a estimé ; sinon son délai habituel avant sa réponse ; sinon rien', () => {
  assert.equal(previsionPreparation({ statut: 'acceptee', pretEstimeeLe: '2026-11-16T14:05:00Z', delaiPreparationMinutes: 20 }), 'Prête vers 14:05 (estimation du restaurant)');
  assert.equal(previsionPreparation({ statut: 'en_attente', pretEstimeeLe: null, delaiPreparationMinutes: 20 }), 'Délai habituel de préparation : environ 20 min');
  assert.equal(previsionPreparation({ statut: 'en_attente', pretEstimeeLe: null, delaiPreparationMinutes: null }), null);
  assert.equal(previsionPreparation({ statut: 'acceptee', pretEstimeeLe: null, delaiPreparationMinutes: 20 }), null, 'après acceptation, le délai habituel n’est plus affiché');
});
test('après la réponse du restaurant : message d’assistance tant que la commande n’est pas finie ; rien avant ni après', () => {
  assert.match(messageRestaurantARepondu('acceptee')!, /appelez l’assistance Speedfood/);
  assert.match(messageRestaurantARepondu('prete')!, /modifier ou annuler/);
  assert.equal(messageRestaurantARepondu('en_attente'), null); assert.equal(messageRestaurantARepondu('terminee'), null); assert.equal(messageRestaurantARepondu('annulee'), null);
});
test('relecture automatique : toutes les 15 s, jusqu’à un état final ou une commande introuvable', () => {
  assert.equal(DELAI_RELECTURE_MS, 15000);
  assert.equal(doitRelire('en_attente'), true); assert.equal(doitRelire('acceptee'), true); assert.equal(doitRelire('prete'), true);
  for (const s of ['terminee', 'refusee', 'annulee']) assert.equal(doitRelire(s), false, s);
});
const brut = (extra: Record<string, unknown> = {}, restaurant: Record<string, unknown> = {}) => ({ ok: true, suivi: { reference: 'SF-ESSAI', statut: 'acceptee', etatDerive: 'acceptee', mode: 'livraison', estTest: false, restaurant: { nom: 'Essai', ...restaurant }, sousTotal: 25000, fraisLivraisonEstime: 3000, pretEstimeeLe: null, propositionActive: null, lignes: [], ...extra } });
test('lecture du suivi : sous-total, frais de livraison et délai habituel du restaurant', () => {
  const s = lireSuivi(brut({}, { delaiPreparationMinutes: 25 }) as Record<string, unknown>);
  assert.equal(s.sousTotalGnf, 25000); assert.equal(s.fraisLivraisonGnf, 3000); assert.equal(s.totalGnf, 28000); assert.equal(s.delaiPreparationMinutes, 25);
  assert.equal(lireSuivi(brut() as Record<string, unknown>).delaiPreparationMinutes, null, 'absent = null');
  assert.equal(lireSuivi(brut({}, { delaiPreparationMinutes: null }) as Record<string, unknown>).delaiPreparationMinutes, null);
});
test('lecture du suivi : un délai hors bornes (5 à 240) ou non entier est refusé', () => {
  for (const d of [4, 241, 1.5, '20', -1, 0]) assert.throws(() => lireSuivi(brut({}, { delaiPreparationMinutes: d }) as Record<string, unknown>), Error, String(d));
});
