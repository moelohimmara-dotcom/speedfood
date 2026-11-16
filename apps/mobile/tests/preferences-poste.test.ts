import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLE_POSTE_FIXE_LIVREUR, CLE_POSTE_FIXE_RESTAURATEUR, CLE_SON_RESTAURATEUR, doitSonner, ecranLivreurAllume, ecranRestaurateurAllume, ecrirePreference, lireActifParDefaut, lireInactifParDefaut,
  type StockagePreferences,
} from '../src/connexion/preferences-poste.ts';
// Parité Kotlin (tranche 10.6, G19 et G23) : `PosteFixe` du livreur, `PreferencesRestaurateur` (son et poste fixe).
const memoire = (init: Record<string, string> = {}): StockagePreferences & { valeurs: Record<string, string> } => {
  const valeurs = { ...init };
  return { valeurs, lire: async c => valeurs[c] ?? null, ecrire: async (c, v) => { valeurs[c] = v; } };
};
const casse: StockagePreferences = { lire: async () => { throw Error('stockage'); }, ecrire: async () => { throw Error('stockage'); } };
test('clés identiques à celles de l’ancienne appli', () => {
  assert.equal(CLE_SON_RESTAURATEUR, 'restaurateur_son_commandes');
  assert.equal(CLE_POSTE_FIXE_RESTAURATEUR, 'restaurateur_poste_fixe');
  assert.equal(CLE_POSTE_FIXE_LIVREUR, 'livreur_poste_fixe');
});
test('restaurateur : son et poste fixe actifs tant qu’on ne les a pas coupés (absent, illisible ou autre valeur = actif)', async () => {
  assert.equal(await lireActifParDefaut(memoire(), CLE_SON_RESTAURATEUR), true);
  assert.equal(await lireActifParDefaut(memoire({ [CLE_SON_RESTAURATEUR]: 'non' }), CLE_SON_RESTAURATEUR), false);
  assert.equal(await lireActifParDefaut(memoire({ [CLE_SON_RESTAURATEUR]: 'oui' }), CLE_SON_RESTAURATEUR), true);
  assert.equal(await lireActifParDefaut(memoire({ [CLE_SON_RESTAURATEUR]: 'bizarre' }), CLE_SON_RESTAURATEUR), true);
  assert.equal(await lireActifParDefaut(casse, CLE_POSTE_FIXE_RESTAURATEUR), true, 'stockage en panne : on reste actif, l’alerte ne se tait jamais par accident');
});
test('livreur : poste fixe inactif tant qu’on ne l’a pas choisi (seul « oui » l’active)', async () => {
  assert.equal(await lireInactifParDefaut(memoire(), CLE_POSTE_FIXE_LIVREUR), false);
  assert.equal(await lireInactifParDefaut(memoire({ [CLE_POSTE_FIXE_LIVREUR]: 'oui' }), CLE_POSTE_FIXE_LIVREUR), true);
  assert.equal(await lireInactifParDefaut(memoire({ [CLE_POSTE_FIXE_LIVREUR]: 'non' }), CLE_POSTE_FIXE_LIVREUR), false);
  assert.equal(await lireInactifParDefaut(memoire({ [CLE_POSTE_FIXE_LIVREUR]: 'x' }), CLE_POSTE_FIXE_LIVREUR), false);
  assert.equal(await lireInactifParDefaut(casse, CLE_POSTE_FIXE_LIVREUR), false);
});
test('écriture : « oui » ou « non », et un stockage en panne ne lève rien', async () => {
  const m = memoire();
  assert.equal(await ecrirePreference(m, CLE_SON_RESTAURATEUR, false), true);
  assert.equal(m.valeurs[CLE_SON_RESTAURATEUR], 'non');
  assert.equal(await ecrirePreference(m, CLE_SON_RESTAURATEUR, true), true);
  assert.equal(m.valeurs[CLE_SON_RESTAURATEUR], 'oui');
  assert.equal(await ecrirePreference(casse, CLE_SON_RESTAURATEUR, false), false);
});
test('écran allumé : livreur seulement en poste fixe ET en course ; restaurateur selon le poste fixe ; sonnerie selon le son', () => {
  assert.equal(ecranLivreurAllume(true, true), true);
  assert.equal(ecranLivreurAllume(true, false), false, 'en ligne sans course : l’écran peut s’éteindre');
  assert.equal(ecranLivreurAllume(false, true), false, 'sans poste fixe : jamais forcé');
  assert.equal(ecranLivreurAllume(false, false), false);
  assert.equal(ecranRestaurateurAllume(true), true); assert.equal(ecranRestaurateurAllume(false), false);
  assert.equal(doitSonner(true), true); assert.equal(doitSonner(false), false);
});
const source = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('câblage (source) : le module natif sait garder l’écran allumé et chaque écran applique ses préférences', () => {
  assert.match(source('../modules/speedfood-veille/android/src/main/java/com/speedfood/veille/SpeedfoodVeilleModule.kt'), /AsyncFunction\("GarderEcranAllume"\)/);
  assert.match(source('../modules/speedfood-veille/android/src/main/java/com/speedfood/veille/SpeedfoodVeilleModule.kt'), /FLAG_KEEP_SCREEN_ON/);
  assert.match(source('../modules/speedfood-veille/src/index.ts'), /async garderEcranAllume\(/);
  const resto = source('../src/connexion/RestaurateurReel.tsx');
  assert.match(resto, /veilleNative\.garderEcranAllume\(ecranRestaurateurAllume\(/);
  assert.match(resto, /if \(doitSonner\(sonRef\.current\)\) void veilleNative\.alerterVeilleRestaurateur\(/);
  for (const t of ['LIBELLE_SON', 'LIBELLE_POSTE_FIXE_RESTAURATEUR']) assert.match(resto, new RegExp(t));
  const livreur = source('../src/connexion/LivreurReel.tsx');
  assert.match(livreur, /veilleNative\.garderEcranAllume\(ecranLivreurAllume\(/);
  assert.match(livreur, /LIBELLE_POSTE_FIXE_LIVREUR/);
});
test('module natif : il est déclaré à la compilation (build.gradle) et chaque service de premier plan a sa permission de type', () => {
  const gradle = source('../modules/speedfood-veille/android/build.gradle');
  assert.match(gradle, /id 'com\.android\.library'/);
  assert.match(gradle, /id 'expo-module-gradle-plugin'/);
  assert.match(gradle, /namespace "com\.speedfood\.veille"/);
  const manifeste = source('../modules/speedfood-veille/android/src/main/AndroidManifest.xml');
  assert.match(manifeste, /foregroundServiceType="dataSync"/);
  assert.match(manifeste, /android\.permission\.FOREGROUND_SERVICE_DATA_SYNC/);
  assert.match(manifeste, /foregroundServiceType="location"/);
  assert.match(manifeste, /android\.permission\.FOREGROUND_SERVICE_LOCATION/);
});
