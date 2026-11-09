import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (relatif: string) => readFileSync(new URL(relatif, import.meta.url), 'utf8');

test('phase 2 : un seul bouton — les écrans métier délèguent au composant canonique', () => {
  const boutonAction = lire('../src/connexion/BoutonAction.tsx');
  assert.match(boutonAction, /import \{ Bouton \} from '\.\.\/design\/Composants'/);
  assert.match(boutonAction, /<Bouton /);
  assert.doesNotMatch(boutonAction, /StyleSheet\.create/, 'aucun style de bouton propre restant');

  for (const fichier of ['../src/catalogue/CatalogueReel.tsx', '../src/connexion/CompteReel.tsx']) {
    const source = lire(fichier);
    assert.doesNotMatch(source, /function Action\(/, `${fichier} : plus d’Action locale`);
    assert.match(source, /Bouton/, `${fichier} : le bouton canonique est utilisé`);
  }
});

test('phase 2 : squelette de chargement partagé, mouvement réduit respecté', () => {
  const composants = lire('../src/design/Composants.tsx');
  assert.match(composants, /export function Squelette/);
  assert.match(composants, /useMouvementReduit/);
  assert.match(composants, /dureeMouvement/);
  const livreur = lire('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /<Squelette/, 'l’écran livreur montre le squelette pendant la lecture');
});
