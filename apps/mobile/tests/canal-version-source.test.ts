import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cheminDepuisModule } from './chemins.ts';

// Garde-fous du canal de version séparé (plan du 11 novembre 2026, risques R1 et R2) : l'ancienne appli Kotlin, qui n'a pas de clé de signature
// utilisable pour une mise à jour vers la nouvelle identité, doit continuer à lire /api/v1/version sans changement ni erreur.
const lire = (chemin: string) => readFileSync(cheminDepuisModule(chemin), 'utf8');

test('R2 : le client Kotlin de production ignore les champs inconnus de /api/v1/version', () => {
  const koin = lire('../../../mobile/shared/src/commonMain/kotlin/com/speedfood/app/di/Koin.kt');
  assert.match(koin, /HttpClient\s*\{[\s\S]{0,200}ContentNegotiation[\s\S]{0,80}ignoreUnknownKeys\s*=\s*true/, 'le HttpClient de production doit tolérer les clés inconnues');
  assert.match(koin, /single<VersionApi>\s*\{\s*KtorVersionApi\(get\(\),\s*get\(\)\)\s*\}/, 'la version est lue avec ce client');
});

test('R2 : le modèle Kotlin de la version ne dépend que des champs historiques', () => {
  const kt = lire('../../../mobile/shared/src/commonMain/kotlin/com/speedfood/app/data/MiseAJour.kt');
  const bloc = /data class VersionPubliee\(([\s\S]*?)\n\)/.exec(kt)?.[1] ?? '';
  const champs = [...bloc.matchAll(/val (\w+):/g)].map(m => m[1]);
  assert.deepEqual(champs, ['code', 'nom', 'notes', 'obligatoire', 'apkSha256', 'apkTaille']);
  assert.doesNotMatch(bloc, /mobile/, 'le client Kotlin ne doit pas lire le bloc mobile');
});

test('R1 : l\'installateur Kotlin lie la session à son propre identifiant, il ne peut donc pas installer la nouvelle appli', () => {
  const kt = lire('../../../mobile/androidApp/src/main/kotlin/com/speedfood/app/InstallateurApkAndroid.kt');
  assert.match(kt, /setAppPackageName\(contexte\.packageName\)/);
  // Conséquence : la nouvelle appli ne doit JAMAIS être servie sous /speedfood.apk (le fichier que l'ancienne appli télécharge).
  const version = lire('../../../packages/shared/src/application/version.ts');
  assert.doesNotMatch(version, /apkChemin:\s*["']\/speedfood\.apk["']/);
});
