import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURS_PROPOSES, ajouterJours, creneauxDuJour, heuresDuJour, jourDeCreneau, joursProposes, libelleCreneau, libelleHeure, libelleJour, libelleJourProche, quartsDeLHeure,
} from '../src/domaine/creneaux-reservation.ts';
import { DELAI_MIN_MINUTES, HORIZON_MAX_JOURS, PAS_CRENEAU_MINUTES, DERNIER_CRENEAU_MINUTES, PREMIER_CRENEAU_MINUTES, creneauDansPlage, heuresDeLaPlage, lireCorpsCreationReservation } from '../../../packages/shared/src/contracts/reservation.ts';

const MIN = 60_000;
const t = (iso: string) => Date.parse(iso);
const RESTAURANT = '11111111-1111-4111-8111-111111111111';

/** Fait tourner le calcul avec le fuseau du téléphone réglé ailleurs : le résultat ne doit JAMAIS changer. */
function souFuseau<T>(fuseau: string, f: () => T): T {
  const avant = process.env.TZ;
  process.env.TZ = fuseau;
  try { return f(); } finally { if (avant === undefined) delete process.env.TZ; else process.env.TZ = avant; }
}
const FUSEAUX = ['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati'];

test('constantes : le pas est de 15 minutes, 14 jours proposés, le délai et l’horizon viennent du module partagé', () => {
  assert.equal(PAS_CRENEAU_MINUTES, 15);
  assert.equal(JOURS_PROPOSES, 14);
  assert.equal(DELAI_MIN_MINUTES, 30);
  assert.ok(HORIZON_MAX_JOURS >= JOURS_PROPOSES);
});

test('14 jours à venir : aujourd’hui (heure de Conakry = UTC) puis les 13 suivants, chacun au format AAAA-MM-JJ', () => {
  const jours = joursProposes(t('2026-11-10T09:30:00Z'));
  assert.equal(jours.length, 14);
  assert.equal(jours[0], '2026-11-10'); assert.equal(jours[1], '2026-11-11'); assert.equal(jours[13], '2026-11-23');
  assert.ok(jours.every(j => /^\d{4}-\d{2}-\d{2}$/.test(j)));
  assert.equal(new Set(jours).size, 14);
});

test('frontière de minuit : à 23 h 50 UTC le « jour » est encore le 10, à 00 h 00 UTC c’est le 11, quel que soit le fuseau du téléphone', () => {
  for (const fuseau of FUSEAUX) {
    souFuseau(fuseau, () => {
      assert.equal(joursProposes(t('2026-11-10T23:59:59Z'))[0], '2026-11-10', fuseau);
      assert.equal(joursProposes(t('2026-11-11T00:00:00Z'))[0], '2026-11-11', fuseau);
      assert.equal(joursProposes(t('2026-12-31T23:30:00Z'))[1], '2027-01-01', fuseau);
    });
  }
});

test('ajouterJours : passage de mois, d’année et d’année bissextile (UTC, sans heure d’été)', () => {
  assert.equal(ajouterJours('2026-11-30', 1), '2026-12-01');
  assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
  assert.equal(ajouterJours('2028-02-28', 1), '2028-02-29');
  assert.equal(ajouterJours('2026-03-01', -1), '2026-02-28');
  assert.equal(ajouterJours('2026-03-29', 1), '2026-03-30');
  for (const fuseau of FUSEAUX) souFuseau(fuseau, () => { assert.equal(ajouterJours('2026-03-28', 2), '2026-03-30', fuseau); assert.equal(ajouterJours('2026-10-24', 2), '2026-10-26', fuseau); });
});

test('créneaux d’un jour futur : 52 créneaux, tous les 15 minutes, de 10:00 à 22:45, au format ISO UTC canonique', () => {
  const liste = creneauxDuJour('2026-11-12', t('2026-11-10T09:30:00Z'));
  assert.equal(liste.length, 52);
  assert.equal(liste[0], '2026-11-12T10:00:00.000Z'); assert.equal(liste[1], '2026-11-12T10:15:00.000Z'); assert.equal(liste[51], '2026-11-12T22:45:00.000Z');
  for (const c of liste) assert.equal(new Date(c).toISOString(), c);
  for (let i = 1; i < liste.length; i++) assert.equal(Date.parse(liste[i]) - Date.parse(liste[i - 1]), PAS_CRENEAU_MINUTES * MIN);
});

test('aujourd’hui : seulement les créneaux à 30 minutes ou plus de l’instant présent (30 minutes pile permis, comme le serveur)', () => {
  const maintenant = t('2026-11-10T09:30:00Z');
  const liste = creneauxDuJour('2026-11-10', maintenant);
  assert.equal(liste[0], '2026-11-10T10:00:00.000Z', '9 h 30 + 30 min = 10 h 00 pile : permis');
  assert.ok(!liste.includes('2026-11-10T09:45:00.000Z'));
  assert.equal(liste.length, 52, 'de 10:00 à 22:45');
  for (const c of liste) assert.ok(Date.parse(c) >= maintenant + DELAI_MIN_MINUTES * MIN);
  // 9 h 31 : 10 h 00 est à 29 min : refusé ; le premier est 10 h 15.
  assert.equal(creneauxDuJour('2026-11-10', t('2026-11-10T09:31:00Z'))[0], '2026-11-10T10:15:00.000Z');
  // 9 h 29 : 10 h 00 est à 31 min : permis.
  assert.equal(creneauxDuJour('2026-11-10', t('2026-11-10T09:29:00Z'))[0], '2026-11-10T10:00:00.000Z');
});

test('frontière de minuit : tard le soir il ne reste aucun créneau aujourd’hui et les premiers de demain sont après minuit + délai', () => {
  const tard = t('2026-11-10T23:50:00Z');
  assert.deepEqual(creneauxDuJour('2026-11-10', tard), []);
  assert.deepEqual(heuresDuJour('2026-11-10', tard), []);
  assert.equal(creneauxDuJour('2026-11-11', tard)[0], '2026-11-11T10:00:00.000Z', 'jamais de créneau de nuit : le premier de demain est 10 h 00');
  const justeAvant = t('2026-11-10T23:30:00Z');
  assert.deepEqual(creneauxDuJour('2026-11-10', justeAvant), [], '23 h 30 + 30 min = 00 h 00 le lendemain : rien aujourd’hui');
  assert.equal(creneauxDuJour('2026-11-11', justeAvant)[0], '2026-11-11T10:00:00.000Z');
  assert.deepEqual(creneauxDuJour('2026-11-10', t('2026-11-10T22:14:00Z')), ['2026-11-10T22:45:00.000Z'], '22 h 14 + 30 = 22 h 44 : reste 22 h 45, le dernier');
  assert.deepEqual(creneauxDuJour('2026-11-10', t('2026-11-10T22:16:00Z')), [], '22 h 16 + 30 = 22 h 46 : plus rien aujourd’hui');
});

test('un jour déjà passé n’offre aucun créneau', () => {
  assert.deepEqual(creneauxDuJour('2026-11-09', t('2026-11-10T00:05:00Z')), []);
  assert.deepEqual(creneauxDuJour('2026-11-01', t('2026-11-10T09:00:00Z')), []);
});

test('jour invalide : aucun créneau (jamais d’exception, jamais de 30 février)', () => {
  for (const mauvais of ['', 'demain', '2026-02-30', '2026-13-01', '2026-11-1', '10/11/2026']) assert.deepEqual(creneauxDuJour(mauvais, t('2026-11-10T09:00:00Z')), [], mauvais);
  assert.deepEqual(heuresDuJour('2026-02-30', t('2026-11-10T09:00:00Z')), []);
});

test('heures proposées et quarts d’heure d’une heure', () => {
  const maintenant = t('2026-11-10T09:30:00Z');
  const heures = heuresDuJour('2026-11-10', maintenant);
  assert.equal(heures[0], 10); assert.equal(heures.at(-1), 22); assert.equal(heures.length, 13);
  assert.deepEqual(quartsDeLHeure('2026-11-12', 23, maintenant), [], 'aucun créneau à 23 h');
  assert.deepEqual(quartsDeLHeure('2026-11-12', 22, maintenant).map(c => c.slice(11, 16)), ['22:00', '22:15', '22:30', '22:45']);
  assert.deepEqual(quartsDeLHeure('2026-11-10', 10, maintenant), ['2026-11-10T10:00:00.000Z', '2026-11-10T10:15:00.000Z', '2026-11-10T10:30:00.000Z', '2026-11-10T10:45:00.000Z']);
  assert.deepEqual(quartsDeLHeure('2026-11-10', 9, maintenant), []);
  const encore = t('2026-11-10T09:46:00Z');
  assert.deepEqual(quartsDeLHeure('2026-11-10', 10, encore), ['2026-11-10T10:30:00.000Z', '2026-11-10T10:45:00.000Z'], 'les quarts trop proches disparaissent');
  assert.deepEqual(quartsDeLHeure('2026-11-12', 24, maintenant), []);
  assert.deepEqual(quartsDeLHeure('2026-11-12', -1, maintenant), []);
});

test('le même résultat dans tous les fuseaux : jamais l’heure locale du téléphone', () => {
  const maintenant = t('2026-11-10T09:30:00Z');
  const attendu = JSON.stringify({ jours: joursProposes(maintenant), liste: creneauxDuJour('2026-11-10', maintenant), heures: heuresDuJour('2026-11-11', maintenant), l: libelleCreneau('2026-11-11T19:15:00.000Z'), j: libelleJour('2026-11-11'), h: libelleHeure('2026-11-11T19:15:00.000Z') });
  for (const fuseau of FUSEAUX) souFuseau(fuseau, () => {
    const obtenu = JSON.stringify({ jours: joursProposes(maintenant), liste: creneauxDuJour('2026-11-10', maintenant), heures: heuresDuJour('2026-11-11', maintenant), l: libelleCreneau('2026-11-11T19:15:00.000Z'), j: libelleJour('2026-11-11'), h: libelleHeure('2026-11-11T19:15:00.000Z') });
    assert.equal(obtenu, attendu, fuseau);
  });
  // Sanity : le fuseau a bien changé (sinon ce test ne prouverait rien) — Date locale décalée dans au moins un des fuseaux.
  const heuresLocales = FUSEAUX.map(f => souFuseau(f, () => new Date('2026-11-10T20:00:00Z').getHours()));
  assert.ok(new Set(heuresLocales).size > 1, 'le réglage du fuseau n’a aucun effet sur ce poste : ce test ne prouve rien');
});

test('libellés en français, en heure de Conakry (UTC), sans dépendre de la langue du système', () => {
  assert.equal(libelleJour('2026-11-10'), 'mardi 10 novembre');
  assert.equal(libelleJour('2026-11-11'), 'mercredi 11 novembre');
  assert.equal(libelleJour('2027-01-01'), 'vendredi 1er janvier');
  assert.equal(libelleJour('2026-12-31'), 'jeudi 31 décembre');
  assert.equal(libelleJour('2026-02-30'), '');
  assert.equal(libelleHeure('2026-11-11T09:05:00.000Z'), '09:05');
  assert.equal(libelleHeure('2026-11-11T19:15:00.000Z'), '19:15');
  assert.equal(libelleHeure('pas une date'), '');
  assert.equal(libelleCreneau('2026-11-11T19:15:00.000Z'), 'mercredi 11 novembre à 19:15');
  assert.equal(libelleCreneau('2026-11-11T23:45:00.000Z'), 'mercredi 11 novembre à 23:45');
  assert.equal(libelleCreneau('2026-11-12T00:00:00.000Z'), 'jeudi 12 novembre à 00:00');
  assert.equal(libelleCreneau('n’importe quoi'), '');
  assert.equal(libelleJourProche('2026-11-10', t('2026-11-10T09:30:00Z')), 'Aujourd’hui · mardi 10 novembre');
  assert.equal(libelleJourProche('2026-11-11', t('2026-11-10T09:30:00Z')), 'Demain · mercredi 11 novembre');
  assert.equal(libelleJourProche('2026-11-13', t('2026-11-10T09:30:00Z')), 'vendredi 13 novembre');
  assert.equal(libelleJourProche('2026-11-11', t('2026-11-10T23:59:00Z')), 'Demain · mercredi 11 novembre');
});

test('jourDeCreneau : le jour UTC d’un créneau, ou null', () => {
  assert.equal(jourDeCreneau('2026-11-11T23:45:00.000Z'), '2026-11-11');
  assert.equal(jourDeCreneau('2026-11-12T00:00:00.000Z'), '2026-11-12');
  assert.equal(jourDeCreneau('bof'), null);
});

test('chaque créneau proposé est accepté par le contrôle strict du serveur (même module partagé)', () => {
  const maintenant = t('2026-11-10T09:30:00Z');
  let n = 0;
  for (const jour of joursProposes(maintenant)) for (const creneau of creneauxDuJour(jour, maintenant)) {
    const lu = lireCorpsCreationReservation({ restaurantId: RESTAURANT, creneau, nbPersonnes: 2, nom: 'Aminata', telephone: '622123456', note: null });
    assert.ok(lu.ok, creneau + ' ' + (lu.ok ? '' : lu.message));
    n++;
  }
  assert.ok(n > 500);
  // Tous restent dans l’horizon de 60 jours du serveur.
  for (const jour of joursProposes(maintenant)) for (const creneau of creneauxDuJour(jour, maintenant)) assert.ok(Date.parse(creneau) <= maintenant + HORIZON_MAX_JOURS * 24 * 60 * MIN);
});

test('plage 10:00 à 22:45 : une seule constante partagée ; les heures de l’application sont exactement celles du serveur, aucune hors plage', () => {
  const maintenant = t('2026-11-10T09:30:00Z');
  const duJour = creneauxDuJour('2026-11-12', maintenant).map(c => c.slice(11, 16));
  assert.deepEqual(duJour, heuresDeLaPlage(), 'parité avec la constante partagée');
  assert.equal(PREMIER_CRENEAU_MINUTES, 600); assert.equal(DERNIER_CRENEAU_MINUTES, 22 * 60 + 45);
  for (const [h, attendu] of [['09:45', false], ['10:00', true], ['22:45', true], ['23:00', false], ['00:00', false]] as const) {
    assert.equal(creneauDansPlage(Date.parse('2026-11-12T' + h + ':00Z')), attendu, h);
    const lu = lireCorpsCreationReservation({ restaurantId: RESTAURANT, creneau: '2026-11-12T' + h + ':00.000Z', nbPersonnes: 2, nom: 'Aminata', telephone: '622123456', note: null });
    assert.equal(lu.ok, attendu, h);
  }
});
