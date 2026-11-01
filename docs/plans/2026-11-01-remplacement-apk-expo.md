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

Expo possède catalogue, panier brouillon et connexion personnelle réussie selon le retour de Malika. Envoi de commande, suivi réel avec annulation, historique et notifications ne sont pas encore repris ; les espaces professionnels présents dans Kotlin ne sont pas remplacés par cet écran client. La parité client et les essais sur appareils demandés par l’architecture ne sont pas établis. Publier ce paquet à la place de la version actuelle retirerait des fonctions : ne pas le faire silencieusement.

Préconditions serveur inchangées : alertes API et garde de création, essai TEST d’idempotence/concurrence autorisé séparément. Aucun nouvel essai d’écriture n’est autorisé implicitement par la préparation d’un fichier APK. Malika confirme « Compte connecté » après sa saisie personnelle. Historique, suivi, déconnexion et coffre natif restent à vérifier. Elle choisit explicitement de terminer les fonctions avant remplacement.

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
