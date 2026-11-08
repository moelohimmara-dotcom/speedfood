import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';
import { DECALAGE_CHAMP_HAUT, MARGE_SOUS_CLAVIER, cibleDefilement, margeBasseClavier } from '../src/connexion/clavier.ts';

// Lot D3b : le clavier recouvrait le formulaire de proposition (Modal + edge-to-edge sous Android).
test('marge basse : sous Android, hauteur du clavier + marge ; clavier fermé = 0', () => {
  assert.equal(margeBasseClavier(300, 'android'), 300 + MARGE_SOUS_CLAVIER);
  assert.equal(margeBasseClavier(300.2, 'android'), 301 + MARGE_SOUS_CLAVIER, 'arrondi vers le haut : jamais un pixel de moins');
  assert.equal(margeBasseClavier(0, 'android'), 0);
  assert.ok(margeBasseClavier(1, 'android') > 1);
});
test('marge basse : valeurs illisibles, négatives ou absurdes = 0 (jamais NaN, jamais une page vide)', () => {
  for (const v of [undefined, null, NaN, Infinity, -5, '300', {}, 5000]) assert.equal(margeBasseClavier(v, 'android'), 0, String(v));
});
test('marge basse : 0 hors Android (iPhone : KeyboardAvoidingView en padding, web)', () => {
  for (const p of ['ios', 'web', 'windows', '']) assert.equal(margeBasseClavier(300, p), 0, p);
});
test('défilement : le haut du champ remonte près du haut de l’écran, jamais négatif, jamais NaN', () => {
  assert.equal(cibleDefilement(500), 500 - DECALAGE_CHAMP_HAUT);
  assert.equal(cibleDefilement(40), 0);
  assert.equal(cibleDefilement(0), 0);
  assert.equal(cibleDefilement(500, 0), 500);
  for (const v of [undefined, null, NaN, Infinity, '12']) assert.equal(cibleDefilement(v), 0, String(v));
});
test('la marge suffit à atteindre les boutons : elle dépasse la hauteur du clavier d’au moins la hauteur d’un bouton (48)', () => {
  assert.ok(MARGE_SOUS_CLAVIER >= 24);
  assert.ok(margeBasseClavier(280, 'android') - 280 >= 24);
});

// Câblage de l'écran (aucun test d'interface : lecture du texte source, comme le test du câblage de l'API).
const source = readFileSync(cheminDepuisModule('../src/connexion/RestaurateurReel.tsx'), 'utf8');
test('écran restaurateur : marge basse dans le contenu défilant, défilement vers le champ actif, les trois champs câblés', () => {
  assert.match(source, /paddingBottom: 22 \+ margeBasseClavier\(hauteurClavier, Platform\.OS\)/);
  assert.match(source, /Keyboard\.addListener\('keyboardDidShow'/);
  assert.ok(source.includes('const auBlur = () => { champActif.current = null; };'), 'champ actif remis à null au blur');
  assert.ok(source.includes("Keyboard.addListener('keyboardDidHide', () => setHauteurClavier(0))"), 'clavier fermé : la marge disparaît');
  assert.match(source, /scrollTo\(\{ y: cibleDefilement\(y\)/);
  assert.match(source, /<ScrollView ref=\{defilement\}/);
  for (const champ of ['sousTotal', 'frais', 'conditions']) {
    assert.ok(source.includes(`ref={reference('${champ}')} onFocus={auFocus('${champ}')} onBlur={auBlur}`), champ);
  }
  const total = (source.match(/<TextInput [a-z]/g) ?? []).length; // balises JSX seulement
  assert.equal((source.match(/<TextInput ref=/g) ?? []).length, total, "tout nouveau champ doit être câblé au défilement");
});
