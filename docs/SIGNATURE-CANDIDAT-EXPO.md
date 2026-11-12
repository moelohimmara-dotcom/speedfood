> **Mise à jour du 11 novembre 2026 : nouvelle identité.** La clé de l'ancienne appli Kotlin (`com.speedfood.app`) est perdue. La future appli Speedfood (Expo) a un **autre identifiant, `com.speedfood.mobile`**, et une **nouvelle clé** créée par Malika. Elle s'installe **à côté** de l'ancienne, elle ne la remplace pas. Plan complet : [plans/2026-11-11-nouvelle-identite-android.md](plans/2026-11-11-nouvelle-identite-android.md). Aucun remplacement ni publication de production n'est autorisé par cette note.
>
> Point d'entrée actuel : [PASSATION-CHANTIER-SPEEDFOOD-APP.md](PASSATION-CHANTIER-SPEEDFOOD-APP.md).

# Signer la nouvelle appli (à faire par Malika)

La clé est `C:\Users\moelo\speedfood-signature-v2\speedfood-prod.keystore` (alias `speedfood`). Elle est **hors dépôt** et sauvegardée en deux endroits. Aucun agent ne lit cette clé ni son mot de passe : vous seule tapez le mot de passe. Empreintes publiques du certificat :

- SHA-1 : `56:78:E5:41:91:A2:E7:61:00:58:BA:D8:4C:3E:5C:AB:77:B1:55:A1`
- SHA-256 : `25:6B:6E:FE:37:19:9C:B1:DD:63:0A:63:4F:6C:85:4B:6C:A4:25:9E:54:61:33:0F:EB:D4:16:ED:B6:98:06:B5`

## 0. Outils nécessaires sur la machine
- Un JDK 17 (installé : `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`).
- Les **outils de compilation Android** (`build-tools` 36.0.0 ou plus récent) qui contiennent `zipalign.exe` et `lib\apksigner.jar`. Ils ne sont pas encore installés sur cette machine : à installer avant l'étape 2 (Android Studio, ou les outils en ligne de commande Android).

## 1. Télécharger l'APK non signée
1. Pousser la branche `candidat-*` : le workflow « Android Expo (candidat de remplacement, NON publié) » compile l'APK.
2. Ouvrir la page GitHub du run réussi, section « Artifacts » : télécharger `candidat-android-NON-SIGNE-PRODUCTION` (un zip, conservé 7 jours).
3. Extraire le zip dans un dossier neuf, par exemple `C:\Users\moelo\Downloads\candidat-expo`.

## 2. Signer (une seule commande)
Dans PowerShell, en remplaçant le nom du fichier `.apk` extrait et le dossier `build-tools` :

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\moelo\Documents\Jarvis\speedfood doc\apps\mobile\scripts\signer-candidat.ps1" -Apk C:\Users\moelo\Downloads\candidat-expo\<fichier>.apk -Sortie C:\Users\moelo\Downloads\candidat-expo\speedfood-signe.apk -Sdk <dossier build-tools>
```

Le script aligne l'APK (zipalign), demande le mot de passe en **saisie masquée**, signe, puis vérifie l'empreinte du certificat. Si elle diffère de celle de la **nouvelle** clé (`256b6efe…06b5`), il **supprime** l'APK signée et s'arrête : c'est qu'une mauvaise clé a été utilisée.

Ne jamais utiliser l'ancienne clé (perdue) ni en générer une autre sans décision de Malika : une clé qui change à nouveau obligerait à refaire toute la migration.

## 3. Contrôle de la nouvelle identité (peut être lancé par l'agent, sans clé)
Depuis `apps/mobile`, avec `ANDROID_HOME` et `JAVA_HOME` définis :

```bash
node --experimental-strip-types scripts/controler-remplacement-apk.mjs C:/Users/moelo/Downloads/candidat-expo/speedfood-signe.apk
```

Attendu : « Compatibilité technique vérifiée, code 0 ». Il refuse un mauvais identifiant (`com.speedfood.mobile` attendu), une autre signature que la nouvelle clé, un numéro de version qui ne dépasse pas 51, un APK de débogage, une hausse du minimum Android, un recul de la cible, et un identifiant identique à celui de l'ancienne appli (elles ne pourraient pas cohabiter). L'option `--mise-a-jour` rétablit l'ancien contrôle (même identifiant, même clé), seulement utile si l'ancienne clé est un jour retrouvée.

## 4. Essai d'installation à côté de l'ancienne
Sur l'émulateur ou un téléphone de test où l'ancienne appli (code 51) est installée : `adb install speedfood-signe.apk` (sans `-r`). Android doit installer la nouvelle appli **sans toucher à l'ancienne** : les deux icônes coexistent. Ne jamais désinstaller ni vider l'ancienne appli sur l'émulateur de contrôle. Vérifier ensuite que la nouvelle appli s'ouvre et que le catalogue s'affiche.

## 5. Ce qui reste interdit sans votre feu vert
Déposer l'APK sur le site, modifier `VERSION_APPLICATION`, déployer le site ou l'API. **Ne pas remplacer `apps/web/public/speedfood.apk`** : l'ancienne appli y pointe encore (voir le plan, risque R1).
