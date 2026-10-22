# Application Android (native) et téléchargement depuis le site

Mise à jour du 21 octobre 2026. Page publique : `/installer`. Décision : ADR-019 ; plan : `docs/NATIF-PLAN.md`.

## Ce qui existe
- **Une vraie application Android** (Kotlin Multiplatform, interface Compose), dans `mobile/`. Paquet `com.speedfood.app`, version **2.0.0** (code 2), Android 7 minimum (API 24). Le fichier est `public/speedfood.apk`, téléchargé depuis `/installer` ; son empreinte SHA-256 est dans `public/speedfood.apk.sha256`.
- **Le « mode webview » est supprimé.** L'ancienne application (APK du 18 octobre, enveloppe « Trusted Web Activity » qui n'affichait que le site) n'existe plus : dossier `android/` (projet Bubblewrap), route `/api/assetlinks` et sa réécriture `/.well-known/assetlinks.json` supprimés. Plus aucune installation du site sur l'écran d'accueil n'est proposée sur `/installer`.
- **Même identité, même clé :** l'application native a le même identifiant et la même clé de signature que l'ancienne : installée par-dessus, elle la remplace sans désinstallation.
- **iPhone :** pas encore de fichier (exige un Mac ou un exécuteur macOS et un compte Apple Developer, voir `docs/NATIF-PLAN.md`). `/installer` le dit et renvoie vers le site dans Safari.
- **Contenu de la version 2.0.0 :** choix de l'espace (client / restaurateur) et liste des restaurants publiés. La commande, le suivi et les notifications arrivent dans les lots suivants du plan natif ; en attendant, la commande se fait sur le site.

## Clé de signature (critique)
- Fichier : `C:\Users\moelo\speedfood-signature\speedfood.keystore` (alias `speedfood`), mot de passe dans `mot-de-passe.txt` du même dossier. **Hors dépôt**, exclus par `.gitignore` (`*.keystore`, `*.jks`).
- **À sauvegarder** (clé USB, gestionnaire de mots de passe). Perdue, il devient impossible de publier une mise à jour installable par-dessus l'ancienne version : les utilisateurs devraient désinstaller.
- Empreinte SHA-256 du certificat : `E8:1F:0A:C1:27:6F:44:5A:83:42:56:06:B3:64:7A:3D:D0:D3:7C:21:41:5D:4A:9E:78:BE:BA:E8:40:CB:1F:7C`.

## Reconstruire et publier une version
1. Augmenter `versionCode` (et `versionName`) dans `mobile/androidApp/build.gradle.kts`.
2. Depuis `mobile/`, avec `JAVA_HOME` (JDK 17 **64 bits**, par exemple `C:\Users\moelo\.speedfood-tools\jdk-17.0.20.1+1`) et `ANDROID_HOME` (`C:\Users\moelo\.bubblewrap\android_sdk`) définis, et `mobile/speedfood.properties` rempli (valeurs publiques du site, voir `speedfood.properties.example`) :
   - définir `SPEEDFOOD_KEYSTORE` (chemin du fichier de clé) et `SPEEDFOOD_KEYSTORE_PASSWORD` (lu dans `mot-de-passe.txt`, **sans jamais l'afficher**) ;
   - `./gradlew :androidApp:assembleRelease`.
3. Vérifier la signature : `apksigner verify --print-certs androidApp/build/outputs/apk/release/androidApp-release.apk` (l'empreinte SHA-256 doit être celle ci-dessus).
4. Copier le fichier vers `public/speedfood.apk`, écrire son SHA-256 dans `public/speedfood.apk.sha256`, mettre à jour `src/lib/application/version.ts` (source unique : page `/installer`, route publique `/api/v1/version` et annonce ; un test vérifie qu'elle égale `versionCode`/`versionName`), puis déployer. Après le déploiement, bouton « Annoncer la version » dans `/system/mises-a-jour` : notification poussée « Mise à jour disponible » aux appareils enregistrés (une fois par version, tracée dans l'audit).
Aucun secret n'est stocké dans le dépôt : la signature se lit dans l'environnement (`mobile/androidApp/build.gradle.kts`).

## Contraintes à connaître
- Hors Google Play, Android affiche un avertissement « source inconnue » à l'installation. Publier sur Play exige un compte développeur payant (décision de Malika).
- Mise à jour : sans Play, l'application ne s'installe pas seule ; une nouvelle version se télécharge depuis `/installer`. Depuis la 2.8.0, l'application interroge `/api/v1/version` à l'ouverture : bandeau « Mise à jour disponible » (« Plus tard » masque la version, sauf si `obligatoire`) et notification dans le centre de notifications du téléphone (canal `mise_a_jour`, une fois par version). Les applications fermées sont prévenues par l'annonce poussée. Les versions antérieures à la 2.8.0 n'ont pas cette vérification : elles ne la reçoivent que par l'annonce poussée (2.7.0) ou en retournant sur `/installer`.
- Non testée sur un vrai téléphone depuis le poste de développement : la signature et le contenu du paquet sont vérifiés, pas le lancement.
