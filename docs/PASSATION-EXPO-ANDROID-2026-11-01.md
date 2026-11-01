# Passation Expo Android/iOS — 1er novembre 2026

## Première tâche du prochain intervenant

**Corriger la compilation Android locale bloquée par la longueur des chemins C++ sous Windows. La correction n’est PAS encore réalisée ni validée.** Ne pas recommencer la migration, remplacer l’APK publique ou demander à Malika de refaire les contrôles web déjà fournis.

Lire CLAUDE.md, docs/PASSATION-REFONTE.md, puis ce document. Dépôt : C:/Users/moelo/dev/speedfood. Branche : etape-adr021-deblocage-commandes (suivie sur origin). Derniers commits avant cette passation : 2d262ab (historique/suivi), 61b3da7 (validation personnelle). Vérifier git status et git log : ne pas supposer que ces références sont encore les dernières. Le fichier utilisateur docs/PROMPT-CODEX-CHEF-DE-PROJET.md est non suivi : le préserver.

## Échec reproduit et preuve

Commande exécutée depuis apps/mobile/android :

```cmd
gradlew.bat :app:assembleDebug --no-daemon --console=plain -PreactNativeArchitectures=x86_64
```

Variables de processus utilisées : JAVA_HOME=C:/Users/moelo/.speedfood-tools/jdk-17.0.20.1+1 ; ANDROID_HOME=C:/Users/moelo/.bubblewrap/android_sdk ; EXPO_NO_DOTENV=1 ; EXPO_NO_TELEMETRY=1 ; CI=1. Ne lire aucun .env ni .dev.vars.

Résultat : **code 1**, BUILD FAILED in 38m 41s, 326 tâches exécutées. Tâche fautive : :app:buildCMakeDebug[x86_64]. Ninja de CMake 3.22.1 refuse :

```text
rngesturehandler_codegen_autolinked_build/CMakeFiles/react_codegen_rngesturehandler_codegen.dir/C_/Users/moelo/dev/speedfood/apps/mobile/node_modules/react-native-gesture-handler/shared/shadowNodes/react/renderer/components/rngesturehandler_codegen/RNGestureHandlerDetectorShadowNode.cpp.o
Filename longer than 260 characters
```

Journal complet local (non versionné) : C:/Users/moelo/dev/expo-apk-controle-build.log, lignes 706–747 au contrôle du 1er novembre. Projet natif généré et ignoré par Git : apps/mobile/android. Ce journal n’est pas nécessaire pour comprendre l’erreur ci-dessus ; ne pas en publier une copie brute.

## Correction à essayer, pas encore prouvée

1. Inspecter la configuration CMake réellement générée et ses chemins d’objets. Première piste : définir explicitement CMAKE_OBJECT_PATH_MAX pour que CMake raccourcisse les chemins d’objets par hachage avant la limite de Ninja. Essayer une limite de 240 caractères, en vérifiant le chemin final. Référence officielle : https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html. Cette variable est une piste technique, pas une garantie de résolution dans ce projet.
2. Appliquer d’abord l’argument CMake à la compilation de l’application générée, dans defaultConfig.externalNativeBuild.cmake.arguments de apps/mobile/android/app/build.gradle. Ne pas modifier les dépendances sous node_modules comme solution durable. Ne pas changer le registre Windows, désactiver une protection ou déplacer/supprimer le dépôt.
3. Si l’essai résout l’échec, rendre la configuration reproductible par un plugin Expo local enregistré dans apps/mobile/app.json (withAppBuildGradle, modification idempotente et ciblée). Le dossier android étant ignoré, une correction exclusivement dans ce dossier se perd au prochain prebuild. Ne pas ajouter de dépendance sans nécessité. Vérifier les API dans la documentation/version Expo locale avant d’écrire ce plugin.
4. Si le hachage ne suffit pas, mesurer précisément le préfixe restant trop long avant de proposer un dossier de compilation plus court. Ne pas procéder à un déplacement récursif ni à un nettoyage large. Préserver les fichiers existants, caches et données de Malika.

## Validation requise pour fermer cette correction

- Avant code : conserver un cas qui reproduit l’échec. Test du plugin sur le vrai modèle Gradle : ajout unique de l’argument, seconde application identique, refus explicite d’un modèle inconnu. Mutation : retirer l’injection et constater que le test échoue, puis restaurer.
- Relancer assembleDebug x86_64 et exiger code 0 ; vérifier le fichier APK réellement produit et son manifeste/certificat public. Une réussite des exports Hermes ne prouve pas cette compilation native.
- Installer le paquet de contrôle com.speedfood.clientdemo sur émulateur/appareil autorisé, avec Metro si APK debug ; vérifier démarrage, catalogue réel, panier SQLite après fermeture/réouverture, connexion personnelle, historique, suivi et déconnexion. Pas de saisie de mot de passe par l’agent ni d’extraction des jetons.
- Ne pas prétendre qu’une APK debug x86_64 est une livraison ARM autonome, signée pour la production ou compatible iPhone. Signature de production et essais iOS restent distincts. Pas de compte/service payant créé implicitement.
- Mettre à jour les trois documents de statut, ce document et le compte rendu, avec codes de sortie, preuves et limites ; commiter sur etape-*. Retour arrière du correctif : retirer le plugin/argument et revenir à la configuration de contrôle antérieure, sans toucher à la production.

## Ce qui fonctionne déjà et ne doit pas être refait

Expo : catalogue réel via API, panier brouillon local SQLite/Drizzle séparé de la démo, connexion existante, historique et suivi en lecture. Malika a elle-même saisi ses identifiants. Ses captures vérifient l’historique TEST SF-SC78P/SF-WMQXU et le suivi SF-SC78P à 25 000 GNF, « En attente du restaurant », état lu à 19:46:51. Bouton d’actualisation présent. Le clic d’actualisation et la déconnexion ne sont pas vérifiés par ces captures. Voir docs/CONTROLE-HISTORIQUE-SUIVI-EXPO-2026-11-01.md.

Suite mobile 41/41, API 261/261, types API/mobile, build API, paquet exact workerd, dry-run et exports Android/iOS/web : codes 0 au lot précédent ; deux mutations détectées puis restaurées. Ne pas présenter ces résultats historiques comme de nouveaux contrôles sans les relancer.

Aperçu de cette session : http://localhost:8093/ ; disponibilité à revérifier. Les ports 8090 et anciens onglets peuvent montrer une autre version. La session web vit en mémoire : un rechargement déconnecte. Un seul onglet par origine pour le stockage SQLite OPFS ; aucune remise à zéro automatique pour débloquer un fichier occupé.

## Production et limites à préserver

- API déployée à 100 % : 7d38bee0-09ce-48da-8a9b-7c36d71f3df2 au dernier contrôle. Site : 30e67783-8587-4545-9841-82c2ff4bb386 au contrôle précédent. Revérifier les métadonnées avant toute livraison ; ne pas télécharger le code distant ou lire les valeurs secrètes.
- SITE_JETONS conservé. CORS GET commandes et POST suivi exact (lecture) ; aucune ouverture de annuler/proposition. Aucun changement de garde, de secret ou de relais dans le lot historique.
- Garde CREATION_COMMANDE_API absente, alertes API FCM/VAPID manquantes au dernier contrôle. Ancien essai d’idempotence croisée échoué : ne pas supprimer le verrou C:/Users/moelo/dev/etat-idempotence-speedfood.json ni rejouer une écriture. Un nouvel essai TEST exige son feu vert distinct.
- Malika veut **terminer les fonctions avant remplacement**. Création de commande, détail complet du suivi/actions/paiement, notifications et reprise des espaces professionnels restent à terminer. Ne pas distribuer une version réduite en remplacement.
- APK actuelle du site inchangée : 2.47.0/code 51, com.speedfood.app, minSdk 24, targetSdk 37. Expo de contrôle : com.speedfood.clientdemo/code 1 ; compilation générée cible 36, donc ne satisfait pas le contrôle de remplacement. Ne pas abaisser silencieusement la cible Android. Voir docs/plans/2026-11-01-remplacement-apk-expo.md et apps/mobile/scripts/controler-remplacement-apk.mjs.
- Aucun APK/IPA Expo de remplacement validé, aucune installation Android ni mise à jour en place vérifiée. Ne lire aucun keystore ou fichier de mots de passe. Même signature et code supérieur seront indispensables au remplacement futur.
- Déploiements de lots prêts autorisés par Malika ; aucune autorisation implicite de changer les secrets/API_RELAIS, créer une vraie commande, engager un coût ou pousser master. Pas de push forcé.

## Résumé pour reprendre

Le web réel catalogue → compte → historique → suivi initial a été contrôlé, sans nouvelle commande. Le prochain travail est un correctif local de compilation native Windows, avec essai de raccourcissement CMake reproductible dans Expo. L’APK Kotlin reste en production tant que la parité fonctionnelle et les essais Android/iOS ne sont pas terminés.

## Essais du 1er novembre (après-midi) — correction toujours NON réalisée

Chemin relatif de l'objet fautif mesuré : **289 caractères** (limite de Ninja : 260). Préfixe qui pèse : `C_/Users/moelo/dev/speedfood/apps/mobile/` (41 caractères) ; il faut retirer au moins 30 caractères.

1. **`CMAKE_OBJECT_PATH_MAX` : ÉCARTÉ.** L'argument a bien atteint CMake (visible dans `CMakeCache.txt`, valeurs 240 puis 128), mais le chemin de l'objet est resté identique et Ninja a échoué pareil (`assembleDebug` x86_64, code 1, 2 min 47 s puis 1 min 53 s). Un plugin Expo local et ses tests avaient été écrits sur cette hypothèse ; ils ont été supprimés (rien de commité). Ne pas réessayer cette piste.
2. **Lecteur virtuel `subst` : non concluant.**
   - `X:` → `apps/mobile` : l'autolinking Expo ne trouve pas `package.json` depuis la racine d'un lecteur ; avec `NODE_PATH` vers le `node_modules` racine, Gradle avance jusqu'à `:expo-constants:createExpoConfig`, qui échoue (le plugin `expo-splash-screen` du `node_modules` racine n'est pas reconnu depuis ce chemin).
   - `X:` → `apps` (projet dans `X:\mobile`) : économie de 31 caractères (258), mais les paquets hissés à la racine ne sont plus atteignables normalement : même échec.
   - `X:` → racine du dépôt économiserait seulement 26 caractères (263 > 260) : insuffisant seul.
   Le lecteur a été supprimé (`subst X: /d`). Aucun fichier déplacé, registre intact. Contrôle de référence : le même script de configuration Expo s'exécute correctement depuis le chemin réel.
3. **Pistes restantes, à décider :**
   - **Compiler sur GitHub Actions (Linux, aucune limite de 260)** : le dépôt utilise déjà Actions pour iOS ; produit l'APK de contrôle sans toucher au poste Windows. Recommandé.
   - Raccourcir le chemin de dépôt à un niveau ≤ ~10 caractères avant `node_modules` ET hisser gesture-handler à la racine : lourd, touche aux dépendances.
   - Activer les chemins longs de Windows (registre) : interdit par la présente passation sans accord explicite de Malika.

Journaux locaux non versionnés : `C:/Users/moelo/dev/expo-apk-controle-build2.log` et `build3.log`.

## Compilation GitHub Actions réussie (1er novembre 2026, soir)

- Workflow `.github/workflows/android-expo.yml` (commit `d0fb4fd`), exécution https://github.com/moelohimmara-dotcom/speedfood/actions/runs/41345599009 : **toutes les étapes en succès** (installation, 41 tests mobiles, `expo prebuild`, `assembleDebug` arm64-v8a + x86_64, empreinte/manifeste, dépôt de l'artefact). Le contrôle général « Contrôles » de la même branche est aussi vert.
- Artefact **`speedfood-expo-debug-apk`** : 54 009 493 octets, non expiré (conservé 7 jours). Le téléchargement exige une connexion GitHub de Malika ; l'agent n'a pas lu le journal de l'étape « Empreinte et manifeste » (API des journaux authentifiée) : SHA-256, paquet et versions SDK sont à lire dans l'interface de l'exécution.
- **Reste NON vérifié :** installation sur émulateur/appareil, démarrage, catalogue réel, panier SQLite après réouverture, connexion personnelle, historique, suivi, déconnexion. APK debug (signature de debug, Metro requis), pas une livraison de production ni un remplacement de com.speedfood.app ; cible Android 36 toujours insuffisante pour le contrôle de remplacement.
- Problème de chemins Windows : contourné par la compilation Linux, pas corrigé sur le poste local.

## Installation sur l'émulateur (1er novembre 2026, soir)

- APK debug téléchargée depuis l'artefact (zip 54 009 493 octets, `app-debug.apk` 152 491 288 octets, SHA-256 `FDF95A79…44582`). Manifeste (aapt2) : `com.speedfood.clientdemo`, versionCode 1, versionName 0.1.0, compileSdk et targetSdk 36, code natif arm64-v8a + x86_64. Installée sur l'émulateur `speedfood_pixel` à côté de `com.speedfood.app` (Kotlin, inchangée) : `adb install -r` « Success ».
- **Démarrage VÉRIFIÉ par capture** : écran « Speedfood — Une envie. Un bon repas. », catalogue réel (restaurant « barbie food », Grillades · Kaporo Centre), panier « restauré sur cet appareil », boutons Voir mon panier / Mon compte Speedfood.
- **Piège payé (APK debug)** : elle charge son code depuis Metro. (1) `expo start --localhost` écoute sur `::1` (IPv6) alors que `adb reverse` redirige vers `127.0.0.1` : l'application affichait « Unable to load script ». Solution : lancer Metro avec `NODE_OPTIONS=--dns-result-order=ipv4first` (écoute alors sur 127.0.0.1) puis `adb reverse tcp:8081 tcp:8081`. (2) La première compilation du bundle prend ~46 s ; l'application peut abandonner avant : réchauffer le bundle (`/.expo/.virtual-metro-entry.bundle?platform=android&dev=true`) puis relancer. Une préférence `debug_http_host=localhost:8081` a aussi été écrite dans les préférences de l'application (sans effet démontré).
- **Pas encore vérifié** : panier après fermeture/réouverture, connexion personnelle (mot de passe saisi par Malika uniquement), historique, suivi, déconnexion ; APK **release** autonome (sans Metro) non compilée ; iOS non essayé.

## APK release autonome essayée sur l'émulateur (1er novembre 2026, nuit)

- Workflow `android-expo.yml` mis à jour (commit `c58ca37`) : exécution https://github.com/moelohimmara-dotcom/speedfood/actions/runs/41348610327, **succès en 25 min 45 s** (`assembleDebug` + `assembleRelease`). Artefact `speedfood-expo-debug-apk` : 89 226 691 octets, contient `app-debug.apk` (152 491 288 octets) et `app-release.apk` (71 039 330 octets, SHA-256 `22E0DAAF…C02FC`). Le SHA-256 de l'`app-debug.apk` diffère de celui de la première exécution : la compilation n'est pas reproductible à l'octet.
- Manifeste de la release (aapt2) : `com.speedfood.clientdemo`, versionCode 1, versionName 0.1.0, compileSdk/targetSdk 36, arm64-v8a + x86_64. **Signée avec la clé de debug du modèle Expo : contrôle uniquement, jamais une livraison.**
- Installée par-dessus la debug sur `speedfood_pixel` (`adb install -r` « Success »), Metro arrêté et `adb reverse` retiré : **l'application démarre seule et affiche le vrai catalogue** (barbie food, « Dernière lecture : 01/11/2026 21:22:11 »), panier restauré à 0 article. Capture : `C:/Users/moelo/dev/expo-release-1.png` (hors dépôt).
- **Encore NON vérifié :** panier après fermeture/réouverture avec des articles, connexion personnelle (mot de passe saisi par Malika uniquement), historique, suivi, déconnexion ; iOS ; remplacement en place de `com.speedfood.app` (autre identifiant, signature de production, code de version supérieur, cible Android exigée par le contrôle de remplacement).

## Panier Android et compilation iPhone (1er novembre 2026, nuit)

- **Panier APK release (émulateur Android) : vérifié.** Article « Jus d'orange melangé au bissap » (25 000 GNF) ajouté au brouillon local : « 1 article(s) » ; application arrêtée complètement (`force-stop`, processus confirmé arrêté), relancée : « 1 article(s) » conservé. Brouillon local, aucune commande réelle ; l'article est resté dans le panier de l'émulateur.
- **iPhone (simulateur) : compilation RÉUSSIE sur GitHub Actions.** Workflow `.github/workflows/ios-expo.yml` (commit `e73b660`), exécution https://github.com/moelohimmara-dotcom/speedfood/actions/runs/41352202667 : toutes les étapes en succès en ~17 min (macOS 15, 41 tests mobiles, `expo prebuild --platform ios` avec CocoaPods, `xcodebuild` Release pour le simulateur, sans compte Apple ni signature, lancement dans le simulateur). Artefact `captures-iphone-expo` (14 717 381 octets, conservé 7 jours) : deux captures et `app-simulateur.zip` (14 474 741 octets, application pour SIMULATEUR uniquement).
- **Capture iPhone vérifiée (iPhone à encoche dynamique, 9:45)** : même écran que sur Android : « Une envie. Un bon repas. », catalogue réel (barbie food, Grillades · Kaporo Centre), panier restauré, boutons Voir mon panier / Mon compte Speedfood. Fichiers locaux hors dépôt : `C:/Users/moelo/dev/iphone-expo-controle/`.
- **Limites iOS :** simulateur seulement, pas d'appareil réel ; pas d'IPA signée ; aucun compte Apple Developer, certificat ni profil de provisionnement ; ni TestFlight ni App Store. Connexion, historique, suivi, panier persistant non essayés sur iPhone (le simulateur ne se pilote pas par `simctl` sans outil de test).
