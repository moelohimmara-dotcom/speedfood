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
