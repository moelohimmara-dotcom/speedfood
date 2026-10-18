# Application Android (APK) et installation

Mise en place le 18 octobre 2026. Page publique : `/installer`.

## Ce qui existe
- **Android** : une *Trusted Web Activity* (Bubblewrap 1.24.1) qui affiche le site en plein écran. Paquet `com.speedfood.app`, version 1.0.0 (code 1), Android 7 minimum (API 24, exigé par la bibliothèque). Le fichier est `public/speedfood.apk`, téléchargé depuis `/installer`.
- **iPhone / ordinateur** : pas de fichier ; installation du site (PWA) depuis Safari, Chrome ou Edge. `src/app/manifest.ts`, `public/sw.js` et `public/icons/` existent déjà.
- **Lien site ↔ application** : `/.well-known/assetlinks.json`, servi par `src/app/api/assetlinks/route.ts` via une réécriture de `next.config.ts`. Il contient l'empreinte SHA-256 du certificat de signature. Sans lui, Android affiche une barre d'adresse dans l'application.

## Contraintes à connaître
- L'application est liée à l'adresse `speedfood-app.moelohimmara.workers.dev`. **Si un domaine propre est adopté, il faut régénérer l'APK** (`host`, `webManifestUrl`, `fullScopeUrl` dans `android/twa-manifest.json`) et le redistribuer. Les anciens APK continueraient de pointer vers l'ancienne adresse.
- L'application affiche le site : toute mise à jour du site est visible sans nouvel APK. Un nouvel APK n'est nécessaire que pour changer l'icône, le nom, l'adresse ou la version Android visée.
- Hors Google Play : Android affiche un avertissement « source inconnue » à l'installation. Publier sur Play exige un compte développeur payant (hors périmètre, décision de Malika).
- Non testée sur un vrai téléphone depuis le poste de développement : la signature et le contenu du paquet sont vérifiés (`apksigner`, `aapt2`), pas le lancement.

## Clé de signature (critique)
- Fichier : `C:\Users\moelo\speedfood-signature\speedfood.keystore` (alias `speedfood`), mot de passe dans `mot-de-passe.txt` du même dossier. **Hors dépôt**, exclus par `.gitignore` (`*.keystore`, `*.jks`).
- **À sauvegarder** (clé USB, gestionnaire de mots de passe). Perdue, il devient impossible de publier une mise à jour installable par-dessus l'ancienne version : les utilisateurs devraient désinstaller.
- Empreinte SHA-256 : `E8:1F:0A:C1:27:6F:44:5A:83:42:56:06:B3:64:7A:3D:D0:D3:7C:21:41:5D:4A:9E:78:BE:BA:E8:40:CB:1F:7C`. Si la clé est recréée, mettre à jour `EMPREINTE_SHA256` dans la route `assetlinks`.

## Reconstruire l'APK (PowerShell, depuis `android/`)
Outils installés par Bubblewrap dans `C:\Users\moelo\.bubblewrap` (JDK 17, SDK Android) ; licences SDK acceptées le 18/10/2026.
1. Augmenter `appVersionCode` et `appVersion` dans `android/twa-manifest.json`.
2. `Remove-Item Env:NoDefaultCurrentDirectoryInExePath` si la variable est définie (sinon `gradlew.bat` est introuvable).
3. Définir `BUBBLEWRAP_KEYSTORE_PASSWORD` et `BUBBLEWRAP_KEY_PASSWORD` depuis `mot-de-passe.txt` (ne jamais les afficher), puis `npx @bubblewrap/cli@1.24.1 update --skipVersionUpgrade` et `build --skipPwaValidation`.
4. Copier `app-release-signed.apk` vers `public/speedfood.apk`, vérifier avec `apksigner verify --print-certs`, déployer.
Écrire `twa-manifest.json` **sans BOM** (PowerShell 5.1 `Set-Content -Encoding utf8` en ajoute un : JSON invalide).
L'étape `.aab` (Google Play) échoue faute de `jarsigner` dans le PATH ; sans effet sur l'APK.
