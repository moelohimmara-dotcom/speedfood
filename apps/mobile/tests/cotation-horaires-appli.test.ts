import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgesAffichables, libelleCoteRestaurant, libelleHoraire } from '../src/catalogue/menu-groupes.ts';
import { validerIndexArticles, validerPageRestaurants } from '../src/catalogue/client.ts';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Lundi 23 novembre 2026, heure de Conakry = UTC.
const a = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 23, h, m));

test('cote affichée : cote lissée avec nombre d\'avis, « Nouveau » sous 5 avis, repli sur l\'ancienne note, rien sans avis', () => {
  assert.equal(libelleCoteRestaurant({ cote: 4.6, avisTotal: 230, fiabiliteCote: 'fiable', note: 4.7 }), '4,6 ★ (200+)');
  assert.equal(libelleCoteRestaurant({ cote: 4.8, avisTotal: 620, fiabiliteCote: 'fiable', note: 4.9 }), '4,8 ★ (500+)');
  assert.equal(libelleCoteRestaurant({ cote: 4.4, avisTotal: 3, fiabiliteCote: 'nouveau', note: 5 }), 'Nouveau');
  assert.equal(libelleCoteRestaurant({ cote: 4.4, avisTotal: 12, note: 4.5 }), '4,4 ★ (12)', 'fiabilité déduite du nombre d\'avis quand le serveur ne la donne pas');
  assert.equal(libelleCoteRestaurant({ note: 4.5, avisTotal: 12 }), '★ 4,5 (12)', 'ancien serveur : ancienne note');
  assert.equal(libelleCoteRestaurant({ cote: null, note: null, avisTotal: 0 }), null);
  assert.equal(libelleCoteRestaurant({ cote: 4.5, note: 4.5, avisTotal: 0 }), null, 'jamais de cote sans avis');
});

test('badges : deux au plus, dans l\'ordre de valeur, inconnus ignorés', () => {
  assert.deepEqual(badgesAffichables(['nouveau', 'menu_frais', 'tres_apprecie']), ['Très apprécié', 'Menu frais']);
  assert.deepEqual(badgesAffichables(['valeur_sure', 'inconnu']), ['Valeur sûre']);
  assert.deepEqual(badgesAffichables(undefined), []);
  assert.deepEqual(badgesAffichables(['nouveau', 'menu_frais', 'tres_apprecie'], 3), ['Très apprécié', 'Menu frais', 'Nouveau']);
});

test('horaire : le texte du restaurateur éclaire, l\'interrupteur « Ouvert » l\'emporte toujours', () => {
  const r = (ouvert: boolean, horaires: string | null | undefined) => ({ ouvert, horaires });
  assert.equal(libelleHoraire(r(true, 'Tous les jours, 11h-23h'), a(14)), 'Ouvert jusqu\'à 23h');
  assert.equal(libelleHoraire(r(true, 'Tous les jours, 11h-23h'), a(22, 30)), 'Ferme bientôt (23h)');
  assert.equal(libelleHoraire(r(false, 'Tous les jours, 18h-02h'), a(14)), 'Ouvre à 18h');
  assert.equal(libelleHoraire(r(false, 'Tous les jours, 11h-23h'), a(14)), null, 'fermé par le restaurateur pendant ses horaires : on ne dit pas « ouvert jusqu\'à »');
  assert.equal(libelleHoraire(r(true, 'Tous les jours, 18h-02h'), a(14)), null, 'ouvert par le restaurateur hors horaires : on ne le contredit pas');
  assert.equal(libelleHoraire(r(true, 'sur rendez-vous'), a(14)), null);
  assert.equal(libelleHoraire(r(true, null), a(14)), null);
});

const restaurant = (extra: Record<string, unknown>) => ({ id: U(1), nom: 'R', lieu: 'Kaloum', categorie: 'Français', ouvert: true, accepteCommandes: true, statutMisAJourLe: null, ...extra });
test('lecture : cote, fiabilité et badges acceptés, valeurs douteuses refusées', () => {
  const page = (extra: Record<string, unknown>) => ({ restaurants: [restaurant(extra)], suivant: null, luLe: '2026-11-26T08:00:00.000Z' });
  const lu = validerPageRestaurants(page({ cote: 4.6, fiabiliteCote: 'fiable', badges: ['tres_apprecie'] })).restaurants[0];
  assert.deepEqual([lu.cote, lu.fiabiliteCote, lu.badges], [4.6, 'fiable', ['tres_apprecie']]);
  assert.equal(validerPageRestaurants(page({ cote: null })).restaurants[0].cote, null);
  for (const mauvais of [{ cote: 7 }, { cote: 'x' }, { fiabiliteCote: 'bof' }, { badges: 'x' }, { badges: [1] }]) assert.throws(() => validerPageRestaurants(page(mauvais)), /CATALOGUE_INVALIDE/);
});

test('index : cote, badges et horaires des restaurants lus strictement', () => {
  const index = (extra: Record<string, unknown>) => ({ restaurants: [{ id: U(1), nom: 'R', lieu: '', categorie: '', ouvert: true, accepteCommandes: true, ...extra }], articles: [], baseImages: '', luLe: '2026-11-26T08:00:00.000Z' });
  const lu = validerIndexArticles(index({ cote: 4.5, badges: ['menu_frais'], horaires: 'Tous les jours, 11h-23h' })).restaurants[0];
  assert.deepEqual([lu.cote, lu.badges, lu.horaires], [4.5, ['menu_frais'], 'Tous les jours, 11h-23h']);
  assert.throws(() => validerIndexArticles(index({ cote: 9 })), /CATALOGUE_INVALIDE/);
  assert.throws(() => validerIndexArticles(index({ horaires: 5 })), /CATALOGUE_INVALIDE/);
});
