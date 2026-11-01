# Remplacement de l’APK Android du site par Expo

## Mandat confirmé

Malika demande installation, publication et remplacement de l’application en production. Clarification explicite : **remplacer l’APK Android téléchargée depuis le site**, pas le site Cloudflare ni une publication Google Play/App Store. Autorisation de préparer et effectuer ce remplacement une fois le résultat vérifié ; elle ne supprime pas la règle de ne pas casser les parcours existants.

## État réel vérifié

- Production publique : APK **2.47.0, code 51**, 15 733 962 octets ; téléchargement HTTP 200 et empreinte conforme à /api/v1/version, contrôle code 0.
- Fichier du dépôt : paquet **com.speedfood.app**, minSdk 24, targetSdk 37 ; aapt confirme le manifeste. Vérification cryptographique apksigner : code 0. Certificat public SHA-256 **e81f0ac1276f445a83425606b3647a3dd0d37c21415d4a9e78bebae840cb1f7c**. Empreinte du fichier : **d44b55a85bc48c0060ec8fd26e894d3823ffd2125bc7f4a3dbaa2b7135070e9c**.
- Le guide APPLICATION-ANDROID.md décrit encore la 2.0.0 dans sa section historique : ce texte ne décrit plus l’APK actuelle. Source de version courante : packages/shared/src/application/version.ts, manifeste du paquet et contrôle public ci-dessus.
- Expo reste **com.speedfood.clientdemo**, version 0.1.0/code 1. Les bundles Hermes ne sont pas des APK. La génération Android locale a réussi, sans modifier l’identité de production.
- JDK 17 local, SDK Android 36/37 et émulateur speedfood_pixel disponibles. Aucun téléphone/émulateur autorisé connecté au contrôle initial. Clé et mot de passe de production non lus.

## Blocages fonctionnels du remplacement

Expo possède catalogue, panier brouillon et connexion personnelle réussie selon le retour de Malika. Historique et suivi initial en lecture sont désormais vérifiés sur le web par les captures de Malika. Envoi de commande, détail complet du suivi avec annulation et notifications ne sont pas encore repris ; les espaces professionnels présents dans Kotlin ne sont pas remplacés par cet écran client. La parité client et les essais sur appareils demandés par l’architecture ne sont pas établis. Publier ce paquet à la place de la version actuelle retirerait des fonctions : ne pas le faire silencieusement.

Préconditions serveur inchangées : alertes API et garde de création, essai TEST d’idempotence/concurrence autorisé séparément. Aucun nouvel essai d’écriture n’est autorisé implicitement par la préparation d’un fichier APK. Malika confirme « Compte connecté » après sa saisie personnelle. Historique et suivi initial sont vérifiés sur le web ; actualisation, déconnexion et coffre natif restent à vérifier. Elle choisit explicitement de terminer les fonctions avant remplacement.

## Préparation et ordre de livraison

1. Générer le projet Android Expo localement sans fichier de secrets ; construire un paquet de contrôle à identité séparée, vérifier sur émulateur/appareil. Ce paquet ne remplace pas les installations de production.
2. Finir et vérifier les parcours manquants et le passage des utilisateurs/professionnels concernés. Conserver Kotlin pendant la reprise. Tester stockage, session protégée, réseau coupé, reprise et fonctionnement réel, avec commande TEST sur feu vert distinct.
3. Préparer un candidat de remplacement : paquet com.speedfood.app, code strictement supérieur au code réellement distribué à cet instant, version affichée cohérente, même certificat, pas de débogage. Contrôler minSdk et targetSdk du fichier final : ne pas exclure silencieusement des téléphones ni abaisser le niveau ciblé. Les valeurs par défaut de dépendances ne remplacent pas le manifeste final.
4. Signature avec la clé existante, sans lecture du fichier de mots de passe par l’agent. Saisie personnelle/procédure masquée de Malika si nécessaire. Ne jamais générer une nouvelle clé pour contourner la signature existante.
5. Installer par-dessus la version actuelle sur un appareil de contrôle : identité, données conservées ou migration/reconnexion explicitement testée, parcours de commande/suivi et possibilité de réinstaller. L’installation Android exige l’action/confirmation du propriétaire du téléphone.
6. Quand le candidat est complet et vérifié : sauvegarder l’ancienne APK, remplacer public/speedfood.apk, calculer l’empreinte avec le script du dépôt, synchroniser VERSION_APPLICATION et les vérifications de version (actuellement liées à Kotlin, à adapter au nouveau producteur). Déployer le site autorisé puis vérifier /installer, téléchargement, signature, empreinte et route de version du site/API. Tenir compte de l’annonce automatique de mise à jour : publier le fichier n’est pas une simple prévisualisation.

## Contrôle préparé

apps/mobile/scripts/controler-remplacement-apk.mjs lit uniquement les métadonnées/certificats publics des APK, sans keystore ni mot de passe. Il refuse mauvaise identité, signature différente, version non croissante, débogage, hausse du minimum Android ou recul de cible Android. Ce contrôle est technique : il ne prouve pas la parité fonctionnelle. Domaine testé rouge/vert, mutations puis restauration ; test sur l’APK actuelle comme candidate : refus attendu (code 1, version non augmentée).

## Retour arrière

Aucun fichier public ni version de production modifié pendant la préparation. Conserver l’APK actuelle et ses métadonnées. Après une future installation de version supérieure, remettre l’ancien fichier sur le site ne force pas Android à rétrograder : prévoir aussi une version corrigée de code supérieur. Ne pas promettre un retour arrière sur téléphones déjà mis à jour sans l’avoir essayé.

## Relais du blocage natif

Compilation Android échouée, code 1 : Ninja refuse un chemin C++ supérieur à 260 caractères. Correction NON réalisée. Procédure de reprise détaillée : [passation Expo Android/iOS](../PASSATION-EXPO-ANDROID-2026-11-01.md).

## Candidat de remplacement préparé (1er novembre 2026, nuit) — NON publié

**Fait (code et CI, rien en production) :**
- `apps/mobile/app.config.js` + `identite-candidat.cjs` : sans variable, la configuration de contrôle reste inchangée (`com.speedfood.clientdemo`) ; avec `SPEEDFOOD_IDENTITE=production`, paquet **`com.speedfood.app`**, `versionCode` et version lus dans `SPEEDFOOD_CODE`/`SPEEDFOOD_VERSION`, refus d'un code ≤ 51 (code publié). Vérifié par `expo config` (défaut, production, refus) ; 44 tests mobiles à code 0 ; mutation (suppression du refus) détectée puis restauration.
- `apps/mobile/candidat-android.json` : code **52** et version **3.0.0** proposés (à confirmer par Malika).
- Workflow `.github/workflows/android-candidat.yml` : ne tourne que sur une branche **`candidat-*`** (jamais `etape-*`/`master`) ; installe la plate-forme Android 37, compile en release avec `-Pandroid.compileSdkVersion=37 -Pandroid.targetSdkVersion=37`, puis **échoue** si `aapt` ne montre pas `com.speedfood.app`, le bon code et `targetSdkVersion 37`. Artefact `candidat-android-NON-SIGNE-PRODUCTION`. La compilation avec cible 37 n'a PAS encore été essayée (AGP/React Native peuvent l'avertir ou la refuser).
- Section iPhone de `/installer` (`apps/web/src/app/installer/page.tsx`) : explique qu'Apple n'autorise pas le téléchargement direct d'un fichier, annonce l'App Store, et guide « Sur l'écran d'accueil » dans Safari en attendant. Types et tests purs à code 0 ; page vue en local, sans défilement horizontal à 375 px. **Non déployée.**

**Reste à faire, dans l'ordre (aucune étape ne remplace le fichier public) :**
1. Pousser une branche `candidat-…` pour lancer la compilation ; lire l'identité et la cible dans l'annotation/les journaux.
2. **Signature par Malika** avec la clé existante (jamais lue par l'agent, jamais dans GitHub) : télécharger l'artefact, `zipalign` puis `apksigner sign --ks <keystore>` (invite masquée du mot de passe, saisie personnelle). Ne jamais générer une nouvelle clé.
3. `node apps/mobile/scripts/controler-remplacement-apk.mjs <apk signée>` : doit répondre « Compatibilité technique vérifiée, code 0 » (même certificat `e81f0ac1…cb1f7c`, code > 51, pas de débogage, minSdk non relevé, cible non reculée).
4. Installer par-dessus la Kotlin sur un appareil de contrôle (confirmation du propriétaire du téléphone) : données conservées ou reconnexion testée.
5. **Fonctions à terminer avant publication** (choix de Malika) : création de commande, détail du suivi/annulation/paiement, notifications, espaces restaurateur/livreur/équipe. Dépend d'ADR-021 (feux verts de production distincts).
6. **Mise à jour automatique des installations existantes** : la Kotlin interroge `/api/v1/version` (code, `apkSha256`, `apkTaille`) et installe l'APK publiée si le code est supérieur et l'empreinte conforme ; avec la même clé et un code supérieur, Android la remplacera. **L'application Expo n'a PAS encore de mécanisme de mise à jour interne** : après ce premier passage, les mises à jour suivantes seraient manuelles. À construire avant publication (lecture de `/api/v1/version`, téléchargement, contrôle SHA-256, installation via l'installateur Android), sans `expo-updates`/EAS (compte et coût à décider).
7. Publication (feu vert de Malika) : sauvegarder l'ancienne APK, remplacer `public/speedfood.apk`, `scripts/empreinte-apk.mjs`, synchroniser `VERSION_APPLICATION` (le test de parité avec `mobile/androidApp/build.gradle.kts` est lié à Kotlin : à adapter), déployer le site (Malika), vérifier `/installer`, signature, empreinte et `/api/v1/version`.

**iPhone :** Apple n'autorise pas le téléchargement direct. Sur le site : bouton vers l'App Store/TestFlight une fois un compte Apple Developer ouvert par Malika (coût et identité à sa décision) ; identifiant iOS de production `com.speedfood.app` à arrêter à ce moment.

## Résultat de la compilation du candidat (1er novembre 2026)

- Premier essai (commit `c78f3b5`) : échec à l'étape « Installer la plate-forme Android 37 », le paquet `platforms;android-37` n'existant pas sous ce nom dans le catalogue du gestionnaire du SDK. Rien n'avait été compilé.
- Correction (`0347cfb`) : l'étape cherche le nom exact dans le catalogue et échoue clairement s'il n'y en a pas. Second essai : **run réussi**. Le workflow contrôlant lui-même `com.speedfood.app`, `versionCode` 52 et `targetSdkVersion 37` (il échoue sinon), le succès les confirme ; journaux non relus ligne par ligne, APK non installée sur un appareil.
- Étape 1 de la liste ci-dessus : faite. Étape 2 (signature) : marche à suivre et script prêts, voir [SIGNATURE-CANDIDAT-EXPO.md](../SIGNATURE-CANDIDAT-EXPO.md) ; à exécuter par Malika.
- Bandeau de mise à jour (lot 1 de l'étape 6) : code, tests (49) et mutations OK, commit `0347cfb`. **Non vu à l'écran** : le `versionCode` est figé à la compilation, l'APK de contrôle n'en a pas, le bandeau y reste donc silencieux. Lot 2 (téléchargement, SHA-256, installation en un geste) non commencé.
