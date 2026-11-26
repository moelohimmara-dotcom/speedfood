import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), 'utf8');

// Corrections issues de la revue du lot 10.
test('suivi livreur : un démarrage périmé arrête le service si aucune exécution plus récente n’est en marche (arrêt survenu pendant l’attente du démarrage natif)', () => {
  const s = lire('../src/connexion/suivi-livreur.ts');
  assert.match(s, /if \(perimee\(\)\) \{ if \(demarre && !enMarche\) void veilleNative\.arreterSuiviLivreur\(\); return; \}/);
  assert.doesNotMatch(s, /demarre && !vivant/, 'l’ancienne condition laissait le service tourner quand le composant restait vivant');
});
test('menu : les pages suivantes gardent les sections de la première page', () => {
  const s = lire('../src/catalogue/CatalogueReel.tsx');
  assert.match(s, /sections: page\.sections \?\? \(apres \? ancien\?\.sections : undefined\)/);
});