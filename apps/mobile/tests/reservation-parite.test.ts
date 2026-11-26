import test from 'node:test';
import assert from 'node:assert/strict';
import * as partage from '../../../packages/shared/src/contracts/reservation.ts';
import * as statuts from '../../../packages/shared/src/reservation/statuts.ts';
import * as mobile from '../src/connexion/reservation.ts';
import * as creneaux from '../src/domaine/creneaux-reservation.ts';

/**
 * M4a : l'application ne recopie AUCUNE règle du module partagé avec l'API. Ce test prouve que ce que l'application utilise EST le module partagé (même fonction, même constante),
 * que les libellés d'état viennent de lui, et que les bornes de temps des créneaux sont celles du serveur.
 */
const m = mobile as Record<string, unknown>;
const p = partage as Record<string, unknown>;

test('les lecteurs de corps et de réponses de l’application SONT ceux du module partagé (identité, pas copie)', () => {
  for (const nom of ['actionExigeMotif', 'lireJourReservation', 'lireReglageReservation', 'lireReponseCreationReservation', 'lireReponseDecisionReservation', 'lireReponseDisponibiliteReservation', 'lireReponseListeReservations', 'lireReponseReglageReservation', 'lireReponseReservationClient', 'lireReponseReservationsRestaurant']) {
    assert.equal(m[nom], p[nom], nom);
    assert.equal(typeof p[nom], 'function', nom);
  }
  assert.equal(mobile.libelleStatutReservation, statuts.libelleStatutReservation);
});

test('les bornes viennent du module partagé : personnes, nom, note, motif, capacité, délai, horizon, pas', () => {
  for (const nom of ['ACTIONS_RESERVATION_RESTAURANT', 'CAPACITE_COUVERTS_MAX', 'CAPACITE_COUVERTS_MIN', 'MOTIF_RESERVATION_MAX', 'MOTIF_RESERVATION_MIN', 'NB_PERSONNES_MAX', 'NB_PERSONNES_MIN', 'NOM_RESERVATION_MAX', 'NOM_RESERVATION_MIN', 'NOTE_RESERVATION_MAX', 'PAS_CRENEAU_MINUTES', 'DELAI_MIN_MINUTES', 'HORIZON_MAX_JOURS']) {
    assert.deepEqual(m[nom], p[nom], nom);
  }
  assert.equal(partage.PAS_CRENEAU_MINUTES, 15); assert.equal(partage.DELAI_MIN_MINUTES, 30); assert.equal(partage.HORIZON_MAX_JOURS, 60); assert.equal(partage.NB_PERSONNES_MAX, 12);
  assert.equal(creneaux.JOURS_PROPOSES, 14);
});

test('chaque état du module partagé a un libellé lisible en français (jamais le code brut) ; les états finaux sont ceux du module partagé', () => {
  for (const s of statuts.STATUTS_RESERVATION) {
    const l = mobile.libelleStatutReservation(s);
    assert.ok(l.length > 2 && !l.includes('_') && l !== s, s + ' → ' + l);
    assert.equal(mobile.reservationTerminee(s), statuts.estTerminal(s), s);
  }
  assert.equal(mobile.reservationTerminee('honoree'), true); assert.equal(mobile.reservationTerminee('demandee'), false);
});

test('l’annulation côté client suit les transitions du module partagé : seulement demandée ou confirmée, créneau à venir', () => {
  const futur = new Date(Date.now() + 86_400_000).toISOString(); const passe = new Date(Date.now() - 86_400_000).toISOString();
  for (const s of statuts.STATUTS_RESERVATION) {
    const attendu = statuts.transitionPermise(s, 'annulee_client');
    assert.equal(mobile.peutAnnulerReservation({ statut: s, creneau: futur }, Date.now()), attendu, s);
    assert.equal(mobile.peutAnnulerReservation({ statut: s, creneau: passe }, Date.now()), false, s + ' passé');
  }
});

test('la préparation locale des corps refuse exactement ce que le serveur refuse : mêmes messages que le module partagé', () => {
  for (const mauvais of [{}, { restaurantId: 'x' }, { action: 'inconnue' }, null, 'texte', []]) {
    const c = partage.lireCorpsCreationReservation(mauvais); const pc = mobile.preparerCreation(mauvais);
    assert.equal(pc.ok, c.ok);
    if (!pc.ok && !c.ok) assert.equal(pc.message, c.message);
    const d = partage.lireCorpsDecisionReservation(mauvais); const pd = mobile.preparerDecision(mauvais);
    assert.equal(pd.ok, d.ok);
    if (!pd.ok && !d.ok) assert.equal(pd.message, d.message);
    const r = partage.lireCorpsReglageReservation(mauvais); const pr = mobile.preparerReglage(mauvais);
    assert.equal(pr.ok, r.ok);
    if (!pr.ok && !r.ok) assert.equal(pr.message, r.message);
  }
  assert.equal(mobile.preparerDecision({ action: 'refuser', motif: 'ab' }).ok, false);
  assert.equal(mobile.preparerDecision({ action: 'confirmer', motif: 'texte' }).ok, false, 'un motif n’est jamais envoyé pour confirmer');
  assert.equal(mobile.preparerReglage({ capaciteCouverts: 501 }).ok, false);
});

test('chaque créneau proposé est accepté par le lecteur de corps du serveur (aucune règle de créneau recopiée de travers)', () => {
  const maintenant = Date.parse('2026-11-10T12:07:00.000Z');
  const tous = creneaux.joursProposes(maintenant).flatMap(j => creneaux.creneauxDuJour(j, maintenant));
  assert.ok(tous.length > 500);
  for (const c of tous) {
    const lu = partage.lireCorpsCreationReservation({ restaurantId: '11111111-1111-4111-8111-111111111111', creneau: c, nbPersonnes: 2, nom: 'Aminata', telephone: '620000001' });
    assert.ok(lu.ok, c);
  }
});
