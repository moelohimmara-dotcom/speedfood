import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILTRES, SEUIL_SECTIONS, TOUTES_ZONES, filtrerRestaurants, libelleZone, nombreParZone, normaliser, restaurantsDansZone, sectionsAccueil, zoneEffective, zonesDisponibles } from '../src/catalogue/accueil.ts';
import type { RestaurantPublic } from '../../../packages/shared/src/contracts/catalogue.ts';
// Parité Kotlin (tranche 10.3, `Zone.kt`, `Accueil.kt`, `RechercheEtListe`) : zones où il y a vraiment des restaurants, filtre, recherche sans accents, sections de l'accueil.
let n = 0;
const r = (lieu: string, extra: Partial<RestaurantPublic> = {}): RestaurantPublic => ({ id: 'r' + ++n, nom: 'Resto ' + n, lieu, categorie: 'Grillades', ouvert: true, accepteCommandes: true, statutMisAJourLe: null, ...extra });

test('zones : seulement celles où il y a des restaurants, de A à Z, la plus fournie par défaut (égalité : ordre alphabétique)', () => {
  const liste = [r('Kipé'), r('Kipé'), r('Matam'), r('Kaloum')];
  const zones = zonesDisponibles(liste);
  assert.deepEqual(zones.map(z => z.nom), ['Kaloum', 'Kipé', 'Matam']);
  assert.deepEqual(zones.filter(z => z.parDefaut).map(z => z.nom), ['Kipé']);
  assert.deepEqual(zonesDisponibles([]), []);
  assert.equal(zonesDisponibles([r('Matam'), r('Kaloum')]).find(z => z.parDefaut)?.nom, 'Kaloum');
  assert.deepEqual(zonesDisponibles([r(''), r('  ')]), [], 'un lieu vide n’est pas une zone');
});
test('zone effective : « toutes » si choisi, la zone mémorisée si elle existe encore, sinon la zone par défaut, mais seulement avec au moins deux zones', () => {
  const zones = zonesDisponibles([r('Kipé'), r('Kipé'), r('Matam')]);
  assert.equal(zoneEffective(zones, TOUTES_ZONES), null);
  assert.equal(zoneEffective(zones, 'Matam')?.nom, 'Matam');
  assert.equal(zoneEffective(zones, 'Disparue')?.nom, 'Kipé', 'zone mémorisée disparue : retour à la zone par défaut');
  assert.equal(zoneEffective(zones, null)?.nom, 'Kipé');
  assert.equal(zoneEffective(zonesDisponibles([r('Kipé')]), null), null, 'une seule zone : aucun filtre');
});
test('restaurants d’une zone et nombre par zone (sans casse)', () => {
  const liste = [r('Kipé'), r('kipé'), r('Matam')];
  const zones = zonesDisponibles(liste);
  assert.equal(restaurantsDansZone(liste, zones.find(z => z.nom === 'Matam') ?? null).length, 1);
  assert.equal(restaurantsDansZone(liste, null).length, 3);
  assert.equal(nombreParZone(liste, zones)['Matam'], 1);
});
test('libellé de la pastille de zone', () => {
  const zones = zonesDisponibles([r('Kipé'), r('Matam')]);
  assert.equal(libelleZone(zones[0]), 'Zone : Kipé · Changer'); assert.equal(libelleZone(null), 'Zone : toutes · Changer');
});
test('normaliser : minuscules, sans accents, espaces réduits', () => { assert.equal(normaliser('  Kipé   ÇA  Œuf '), 'kipe ca ouf'); });
test('filtres : Tous, Ouverts, On peut commander', () => {
  assert.deepEqual(FILTRES.map(f => f.libelle), ['Tous', 'Ouverts', 'On peut commander']);
  const a = r('Kipé'); const b = r('Kipé', { accepteCommandes: false }); const c = r('Kipé', { ouvert: false, accepteCommandes: false });
  assert.deepEqual(filtrerRestaurants([a, b, c], '', 'tous'), [a, b, c]);
  assert.deepEqual(filtrerRestaurants([a, b, c], '', 'ouverts'), [a, b]);
  assert.deepEqual(filtrerRestaurants([a, b, c], '', 'commandables'), [a]);
});
test('recherche : nom, quartier ou cuisine, tous les mots, sans casse ni accents', () => {
  const a = r('Kipé', { nom: 'Chez Fatoumata', categorie: 'Cuisine guinéenne' }); const b = r('Matam', { nom: 'Pizza Roma', categorie: 'Pizzas' });
  assert.deepEqual(filtrerRestaurants([a, b], 'KIPE', 'tous'), [a]);
  assert.deepEqual(filtrerRestaurants([a, b], 'guineenne fatou', 'tous'), [a]);
  assert.deepEqual(filtrerRestaurants([a, b], 'pizza matam', 'tous'), [b]);
  assert.deepEqual(filtrerRestaurants([a, b], 'introuvable', 'tous'), []);
  assert.deepEqual(filtrerRestaurants([a, b], '   ', 'tous'), [a, b]);
});
test('sections : seulement sans recherche ni filtre et avec au moins 4 restaurants ; « Ouverts maintenant » puis « Les mieux notés » (3 au plus, avec une note)', () => {
  assert.equal(SEUIL_SECTIONS, 4);
  const liste = [r('K', { note: 3.2, avisTotal: 5 }), r('K', { note: 4.8, avisTotal: 9 }), r('K', { note: null }), r('K', { accepteCommandes: false, note: 4.1, avisTotal: 2 }), r('K', { note: 4.5, avisTotal: 1 })];
  const s = sectionsAccueil(liste, '', 'tous')!;
  assert.equal(s.ouverts.length, 4);
  assert.deepEqual(s.mieuxNotes.map(x => x.note), [4.8, 4.5, 4.1]);
  assert.equal(sectionsAccueil(liste.slice(0, 3), '', 'tous'), null, 'moins de 4 : liste simple');
  assert.equal(sectionsAccueil(liste, 'resto', 'tous'), null, 'recherche : liste simple');
  assert.equal(sectionsAccueil(liste, '', 'ouverts'), null, 'filtre : liste simple');
});
