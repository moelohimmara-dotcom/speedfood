import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';

// Décision du 12 novembre 2026 : la version PUBLIQUE de la nouvelle appli doit s'installer sur tous les téléphones réels que l'ancienne appli Kotlin supportait,
// donc arm64-v8a ET armeabi-v7a (beaucoup de téléphones d'entrée de gamme tournent en 32 bits). x86 et x86_64 ne servent qu'aux émulateurs : pas dans l'APK publique.
const workflow = readFileSync(cheminDepuisModule('../../../.github/workflows/android-candidat.yml'), 'utf8');

test('le candidat est compilé pour arm64-v8a et armeabi-v7a, jamais pour les architectures d\'émulateur', () => {
  const archi = /-PreactNativeArchitectures=([A-Za-z0-9_,-]+)/.exec(workflow)?.[1] ?? '';
  const liste = archi.split(',').sort();
  assert.deepEqual(liste, ['arm64-v8a', 'armeabi-v7a']);
});

test('la CI refuse un candidat qui n\'embarque pas les deux architectures de téléphone', () => {
  assert.match(workflow, /unzip -l[^\n]*lib\/arm64-v8a\//);
  assert.match(workflow, /unzip -l[^\n]*lib\/armeabi-v7a\//);
  assert.match(workflow, /x86_64|x86/, 'la CI vérifie aussi l\'absence des bibliothèques d\'émulateur');
});
