import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motifNonCommandable } from '../src/catalogue/parcours-client.ts';
import { enteteAccueil } from '../src/catalogue/accueil-vivant.ts';

/** Audit du parcours client (28/11/2026) : heure de Conakry, restaurant fermé, chargement de la liste, panier vide. */
const lire = (p: string) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
// Samedi 28/11/2026 à 8 h 30 à Conakry (UTC+0, sans heure d'été).
const huitHeures = new Date('2026-11-28T08:30:00Z');
const onzeHeures = new Date('2026-11-28T11:00:00Z');
const r = (ouvert: boolean, horaires: string, accepteCommandes = true) => ({ ouvert, accepteCommandes, horaires });

test('heure : l’en-tête lit l’heure de Conakry de l’horloge fournie (UTC+0)', () => {
  const titre = (d: Date) => enteteAccueil({ maintenant: d, restaurants: [{ ouvert: true, accepteCommandes: true }], listeComplete: true }).titre;
  assert.match(titre(huitHeures), /Il est 8 h à Conakry/);
  assert.match(titre(new Date('2026-11-28T02:05:00Z')), /Il est 2 h à Conakry/);
  const hook = lire('catalogue/useMaintenant.ts');
  assert.match(hook, /setInterval\(relire, intervalleMs\)/); assert.match(hook, /etat === 'active'\) relire\(\)/, 'relue au retour au premier plan');
  assert.doesNotMatch(lire('catalogue/CatalogueReel.tsx'), /enteteAccueil\(\{ maintenant: new Date\(\)/);
});

test('restaurant fermé : motif près du bouton, avec l’heure d’ouverture quand elle est connue ; passage fermé → ouvert avec une horloge de test', () => {
  const horaires = 'Tous les jours, 10h-22h';
  assert.equal(motifNonCommandable(r(false, horaires), huitHeures), 'Commandable dès 10h');
  assert.equal(motifNonCommandable(r(true, horaires), onzeHeures), null, 'ouvert et prend des commandes : rien à expliquer');
  assert.equal(motifNonCommandable(r(false, ''), huitHeures), 'Restaurant fermé : commande impossible pour le moment');
  assert.equal(motifNonCommandable(r(true, horaires, false), onzeHeures), 'Commandes en pause pour le moment');
  assert.equal(motifNonCommandable(r(false, horaires), new Date('2026-11-28T23:00:00Z')), 'Commandable demain dès 10h');
});

test('carte de plat : « Au menu » (et non « Disponible ») quand on ne peut pas commander ; motif écrit et lu par TalkBack', () => {
  const fiche = lire('catalogue/FicheRestaurant.tsx');
  assert.match(fiche, /!commandable && p\.disponibilite === 'disponible' \? \{ texte: 'Au menu'/);
  assert.match(fiche, /`\$\{p\.nom\} : \$\{motif \?\? 'commande indisponible'\}`/, 'le nom accessible du bouton grisé donne le motif');
  assert.match(fiche, /motifTexte\}>\{motif\}<\/Text>/);
  assert.match(lire('catalogue/CatalogueReel.tsx'), /motif=\{motifNonCommandable\(menu\.restaurant, maintenant\)\}/);
});

test('liste : la suite se charge en bas, la recherche et les filtres ne bougent plus', () => {
  const cat = lire('catalogue/CatalogueReel.tsx');
  assert.match(cat, /const chargeSuite = charge && !selection && restaurants\.length > 0;/);
  assert.match(cat, /\{charge && !chargeSuite && <View accessibilityLiveRegion="polite"/);
  assert.ok(cat.indexOf('Chargement d’autres restaurants…') > cat.indexOf('accessibilityLabel="Rechercher un plat'), 'l’indicateur de suite est SOUS la recherche');
});

test('panier vide : « Parcourir les restaurants » ramène au catalogue (zone gardée : l’état vit dans le catalogue)', () => {
  assert.match(lire('catalogue/PanierReelVue.tsx'), /titre="Parcourir les restaurants"/);
  assert.match(lire('catalogue/CatalogueReel.tsx'), /parcourir=\{\(\) => \{ choisirOnglet\('restaurants'\); if \(selection\) retour\(\); \}\}/);
});
