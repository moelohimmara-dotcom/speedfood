import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ONGLETS, etatPourOnglet, libelleBadge, libelleOnglet, ongletActif } from '../src/catalogue/onglets.ts';
// Parité Kotlin (G18) : barre d'onglets du client « Restaurants, Commandes, Panier, Compte ». Logique pure : l'onglet actif se déduit de l'état des écrans, et chaque appui donne l'état voulu.
test('quatre onglets dans l’ordre de l’ancienne appli, chacun avec une icône', () => {
  assert.deepEqual(ONGLETS.map(o => o.id), ['restaurants', 'commandes', 'panier', 'compte']);
  assert.deepEqual(ONGLETS.map(o => o.libelle), ['Restaurants', 'Commandes', 'Panier', 'Compte']);
  assert.equal(new Set(ONGLETS.map(o => o.icone)).size, 4, 'quatre icônes différentes');
});
test('chaque appui sur un onglet donne l’état des écrans voulu', () => {
  assert.deepEqual(etatPourOnglet('restaurants'), { panierOuvert: false, compteOuvert: false, demandeCompte: null });
  assert.deepEqual(etatPourOnglet('panier'), { panierOuvert: true, compteOuvert: false, demandeCompte: null });
  assert.deepEqual(etatPourOnglet('compte'), { panierOuvert: false, compteOuvert: true, demandeCompte: null });
  assert.deepEqual(etatPourOnglet('commandes'), { panierOuvert: false, compteOuvert: true, demandeCompte: { reference: null } });
});
test('l’onglet actif se déduit de l’état : aller-retour avec etatPourOnglet', () => {
  for (const o of ONGLETS) assert.equal(ongletActif(etatPourOnglet(o.id)), o.id);
});
test('autres chemins d’ouverture : une notification ou une commande envoyée montre « Commandes », une demande d’espace pro montre « Compte »', () => {
  assert.equal(ongletActif({ panierOuvert: false, compteOuvert: true, demandeCompte: { reference: 'SF-ABCDE' } }), 'commandes');
  assert.equal(ongletActif({ panierOuvert: false, compteOuvert: true, demandeCompte: { reference: null } }), 'commandes');
  assert.equal(ongletActif({ panierOuvert: false, compteOuvert: true, demandeCompte: { reference: null, espaceRestaurateur: true } }), 'compte');
  assert.equal(ongletActif({ panierOuvert: false, compteOuvert: true, demandeCompte: null }), 'compte');
});
test('le panier garde la priorité s’il est ouvert, rien d’ouvert = Restaurants', () => {
  assert.equal(ongletActif({ panierOuvert: true, compteOuvert: true, demandeCompte: null }), 'panier');
  assert.equal(ongletActif({ panierOuvert: false, compteOuvert: false, demandeCompte: { reference: 'x' } }), 'restaurants', 'une demande sans écran ouvert ne change rien');
});
test('pastille du panier : absente à zéro, « 99+ » au-delà de 99', () => {
  assert.equal(libelleBadge(0), null); assert.equal(libelleBadge(-3), null); assert.equal(libelleBadge(1), '1'); assert.equal(libelleBadge(99), '99'); assert.equal(libelleBadge(100), '99+');
});
test('nom accessible : l’onglet dit son rôle et le nombre d’articles du panier', () => {
  assert.equal(libelleOnglet('restaurants', 5), 'Restaurants'); assert.equal(libelleOnglet('panier', 0), 'Panier, vide');
  assert.equal(libelleOnglet('panier', 1), 'Panier, 1 article'); assert.equal(libelleOnglet('panier', 3), 'Panier, 3 articles');
});
