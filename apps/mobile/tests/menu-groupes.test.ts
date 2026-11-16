import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grouperMenu, enPromo, libelleNote, libelleStatut, libelleSupplements, prixAvecSupplements, titreEtatRestaurant } from '../src/catalogue/menu-groupes.ts';
// Parité Kotlin (tranche 10.1) : `Menu.groupes()`, prix promo, note, suppléments affichés. Fonctions pures.
const p = (id: string, sectionId: string | null = null, extra: object = {}) => ({ id, nom: 'Plat ' + id, description: '', prixGnf: 1000, disponibilite: 'disponible' as const, confirmeLe: null, sectionId, ...extra });
test('sections dans l’ordre de position, plats sans section en dernier sous « Autres plats »', () => {
  const g = grouperMenu([{ id: 's2', nom: 'Plats', position: 2 }, { id: 's1', nom: 'Entrées', position: 1 }], [p('a', 's2'), p('b', 's1'), p('c'), p('d', 'inconnue')]);
  assert.deepEqual(g.map(x => x.titre), ['Entrées', 'Plats', 'Autres plats']);
  assert.deepEqual(g[2].plats.map(x => x.id), ['c', 'd'], 'une section inconnue compte comme sans section');
});
test('sans aucune section, le titre est « Plats » et non « Autres plats »', () => {
  assert.deepEqual(grouperMenu([], [p('a'), p('b')]).map(x => x.titre), ['Plats']);
  assert.deepEqual(grouperMenu(undefined, [p('a')]).map(x => x.titre), ['Plats'], 'ancien serveur : pas de sections');
});
test('une section vide n’apparaît pas ; aucun plat = aucun groupe', () => {
  assert.deepEqual(grouperMenu([{ id: 's1', nom: 'Vide', position: 1 }], [p('a', 's1')]).map(x => x.titre), ['Vide']);
  assert.deepEqual(grouperMenu([{ id: 's1', nom: 'Vide', position: 1 }], []), []);
});
test('ordre des plats conservé dans chaque groupe', () => {
  const g = grouperMenu([{ id: 's1', nom: 'A', position: 1 }], [p('3', 's1'), p('1', 's1'), p('2', 's1')]);
  assert.deepEqual(g[0].plats.map(x => x.id), ['3', '1', '2']);
});
test('promo : seulement si le prix normal dépasse le prix payé', () => {
  assert.equal(enPromo({ prixGnf: 30000, prixNormalGnf: 35000 }), true);
  assert.equal(enPromo({ prixGnf: 30000, prixNormalGnf: 30000 }), false);
  assert.equal(enPromo({ prixGnf: 30000 }), false, 'ancien serveur');
});
test('note : « ★ 4,5 (12) » seulement avec au moins un avis, jamais de note inventée', () => {
  assert.equal(libelleNote({ note: 4.5, avisTotal: 12 }), '★ 4,5 (12)');
  assert.equal(libelleNote({ note: 5, avisTotal: 1 }), '★ 5 (1)');
  assert.equal(libelleNote({ note: null, avisTotal: 0 }), null);
  assert.equal(libelleNote({ note: 4, avisTotal: 0 }), null, 'une note sans avis n’est pas affichée');
  assert.equal(libelleNote({}), null);
});
test('suppléments : « En supplément : Piment (+500), Sauce », rien sans supplément', () => {
  assert.equal(libelleSupplements([{ id: 'a', nom: 'Piment', prixGnf: 500 }, { id: 'b', nom: 'Sauce', prixGnf: 0 }]), 'En supplément : Piment (+500 GNF), Sauce');
  assert.equal(libelleSupplements([]), null); assert.equal(libelleSupplements(undefined), null);
});
test('prix avec suppléments : prix payé du plat plus les suppléments choisis', () => {
  assert.equal(prixAvecSupplements(30000, [{ id: 'a', nom: 'Piment', prixGnf: 500 }, { id: 'b', nom: 'Œuf', prixGnf: 2000 }]), 32500);
  assert.equal(prixAvecSupplements(30000, []), 30000);
});
test('état du restaurant : trois situations, libellés de l’ancienne appli', () => {
  assert.deepEqual(titreEtatRestaurant({ ouvert: true, accepteCommandes: true }), { texte: 'Ouvert', ton: 'succes' });
  assert.deepEqual(titreEtatRestaurant({ ouvert: true, accepteCommandes: false }), { texte: 'Commandes en pause', ton: 'neutre' });
  assert.deepEqual(titreEtatRestaurant({ ouvert: false, accepteCommandes: true }), { texte: 'Fermé', ton: 'danger' });
  assert.deepEqual(titreEtatRestaurant({ ouvert: false, accepteCommandes: false }), { texte: 'Fermé', ton: 'danger' });
});
test('statut : confirmé récemment, à confirmer, jamais confirmé, rien pour un restaurant fermé', () => {
  const maintenant = new Date('2026-11-16T12:00:00Z');
  const il = (h: number) => new Date(maintenant.getTime() - h * 3_600_000).toISOString();
  const ouvert = { ouvert: true, accepteCommandes: true };
  assert.equal(libelleStatut({ ...ouvert, statutMisAJourLe: il(0.25) }, maintenant), 'Statut confirmé il y a 15 min');
  assert.equal(libelleStatut({ ...ouvert, statutMisAJourLe: il(6) }, maintenant), 'Statut confirmé il y a 6 h', 'exactement 6 h = encore frais');
  assert.equal(libelleStatut({ ...ouvert, statutMisAJourLe: il(7) }, maintenant), 'Statut à confirmer (dernière confirmation il y a 7 h)');
  assert.equal(libelleStatut({ ...ouvert, statutMisAJourLe: null }, maintenant), 'Statut à confirmer');
  assert.equal(libelleStatut({ ...ouvert, statutMisAJourLe: 'pas une date' }, maintenant), 'Statut à confirmer');
  assert.equal(libelleStatut({ ouvert: false, accepteCommandes: false, statutMisAJourLe: il(1) }, maintenant), null);
  assert.equal(libelleStatut({ ...ouvert, statutMisAJourLe: il(-3) }, maintenant), 'Statut confirmé à l\'instant', 'date future = maintenant');
});
