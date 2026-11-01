# Historique et suivi Expo — 1er novembre 2026

## Périmètre

Lecture de GET commandes du compte authentifié puis POST suivi avec sa clé dans le corps. Identité stricte serveur inchangée. Clés dans la seule mémoire du gestionnaire : retirées des objets des composants et effacées au changement de session. Aucun stockage de commandes dans SQLite ni valeur secrète dans une URL. Limite 50 commandes, projection contrôlée, GNF entiers, délais existants de 15 secondes, aucune relance automatique. Le premier suivi affiche état, restaurant, total et estimation ; lignes détaillées, paiement et actions ne sont pas repris. Proposition signalée avec invitation à consulter le site, sans lien contenant une clé.

## Preuves

- Trois nouveaux tests mobiles initialement rouges (code 1, méthodes absentes), puis verts. Suite mobile complète : 41/41, code 0.
- Tests CORS initialement rouges : routes nouvelles sans prévol (404 au lieu de 204). Puis quatre tests ciblés verts et suite API 261/261, code 0.
- Deux mutations : laisser passer la clé vers le composant ; étendre/mal router le CORS suivi. Tests ciblés code 1 dans les deux cas, sources restaurées et tests ciblés verts.
- Types API et mobile, build API 1174 Kio, paquet exact sous workerd avec sortie réseau interdite et dry-run Wrangler : codes 0.
- Exports Hermes Android/iOS et web : code 0. Ces exports ne sont pas des APK/IPA.
- API livrée : 7d38bee0-09ce-48da-8a9b-7c36d71f3df2, 100 % confirmé par métadonnées. SITE_JETONS et noms/types des secrets conservés. Aucun changement de secret, garde ou API_RELAIS.
- Après livraison : santé/catalogue 200, historique sans identité 401, prévols historiques/suivi 204, suivi vide 400, réponses privées no-store, sous-routes annuler/proposition sans CORS ; code 0. Aucune commande créée.
- Aperçu localhost:8093 : connexion personnelle confirmée par Malika. Ses captures vérifient ensuite l’historique réel (SF-SC78P et SF-WMQXU, mentions TEST, restaurant et montants) et la lecture initiale du suivi SF-SC78P : « En attente du restaurant », 25 000 GNF, état lu à 19:46:51 et bouton « Actualiser ce suivi », sans erreur visible. Aucune extraction de session ni saisie d’identifiants par l’agent. Le clic d’actualisation, la déconnexion, les appareils Android/iOS et le coffre natif restent NON vérifiés par ces captures.

<!-- Commentaire de validation, 1er novembre 2026 : historique et lecture initiale du suivi vérifiés sur le vrai compte par les captures fournies par Malika. Aucune commande créée pour ce contrôle. Cette validation web ne vaut pas validation native ni autorisation de remplacer l’APK actuelle. Prochaine étape : corriger la compilation Android bloquée par un chemin C++ de plus de 260 caractères. -->

## Android natif et limites

Première compilation locale assembleDebug x86_64 : code 1 après 38 min 41 s. Ninja refuse un chemin de fichier C++ supérieur à 260 caractères dans le code généré gesture-handler. Aucun APK installé ou publié. Corriger la longueur des chemins de compilation avant reprise du contrôle natif ; ne pas changer de signature ou supprimer des données pour contourner. Le paquet de contrôle garde son identité séparée. L’APK 2.47.0/code 51 reste distribuée. iPhone physique, coffre natif et mise à jour Android non vérifiés.

## Relecture et retour arrière

Spécification : lecture seule, rattachement serveur au compte, clé non rendue, limites explicites, pas de simulation présentée comme réelle. Qualité : projections, effacement, refus tardif après déconnexion, erreurs sans détail brut, actualisation manuelle. Aucune architecture ni migration nouvelle.

API : revenir au code de la version cd5d0ef8-c2ea-4761-adcb-29349126087e en conservant la configuration actuelle (vérifier que la version est toujours disponible). Mobile : retirer historique/suivi et garder connexion/catalogue/panier ; base locale inchangée. Aucun remplacement de l’APK publique.
