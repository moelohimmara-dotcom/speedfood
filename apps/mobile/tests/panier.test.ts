import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ajouterAuPanier, changerQuantite, totalPanier, rechercherRestaurants, panierVide } from '../src/domaine/panier.ts';
import { restaurants, plats } from '../src/donnees/demo.ts';

test('un seul restaurant et des prix entiers : ajout, quantité, total', () => {
  const p = ajouterAuPanier(panierVide(), plats[0]);
  const deux = ajouterAuPanier(p, plats[0]);
  assert.equal(deux.lignes.length, 1);
  assert.equal(deux.lignes[0].quantite, 2);
  assert.equal(totalPanier(deux, plats), plats[0].prixGnf * 2);
  assert.equal(changerQuantite(deux, plats[0].id, 0).restaurantId, null);
});
test('un autre restaurant ne remplace jamais silencieusement le panier', () => {
  const p = ajouterAuPanier(panierVide(), plats[0]);
  const autre = plats.find(plat => plat.restaurantId !== plats[0].restaurantId)!;
  assert.throws(() => ajouterAuPanier(p, autre), /AUTRE_RESTAURANT/);
  assert.equal(p.lignes.length, 1);
});
test('plat indisponible, quantités fractionnaires et prix fractionnaires refusés', () => {
  assert.throws(() => ajouterAuPanier(panierVide(), { ...plats[0], disponible: false }), /INDISPONIBLE/);
  assert.throws(() => ajouterAuPanier(panierVide(), { ...plats[0], prixGnf: 1.5 }), /PRIX/);
  assert.throws(() => changerQuantite(ajouterAuPanier(panierVide(), plats[0]), plats[0].id, 1.5), /QUANTITE/);
});
test('recherche sans accents, par restaurant ou par plat, et filtre de zone', () => {
  assert.ok(rechercherRestaurants(restaurants, plats, 'poulet', null).length > 0);
  assert.deepEqual(rechercherRestaurants(restaurants, plats, 'zzzintrouvable', null), []);
  assert.ok(rechercherRestaurants(restaurants, plats, '', 'Kipé').every(r => r.zone === 'Kipé'));
});
test('aucune autorisation de commande réelle dans les données démonstration', () => {
  assert.ok(restaurants.every(r => r.demonstration === true));
  assert.ok(plats.every(p => Number.isSafeInteger(p.prixGnf) && p.prixGnf >= 0));
});
