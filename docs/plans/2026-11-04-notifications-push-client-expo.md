# Notifications push du client dans l'appli Expo — plan

> **Pour les agents :** exécuter lot par lot (un sous-agent sonnet implémente, un sous-agent opus relit la sécurité, essai réel sur émulateur avant de dire « livré »). Aucune écriture sur le vrai restaurant, aucun déploiement et aucun secret sans l'accord explicite de Malika à ce moment-là.

**Objectif :** un client connecté dans l'appli Expo reçoit une notification sur son téléphone quand le restaurant accepte, refuse, termine ou annule sa commande, ou quand elle est prête, et un appui sur la notification ouvre le suivi.

**Architecture :** on réutilise tout le serveur existant (table `appareils_push`, textes génériques de `apps/web/src/lib/push/fcm.ts`, envoi Firebase de `fcm-envoi.ts`, crochet `apresTransitionCommande` → `signalerChangementCommande`). On ajoute : une route d'enregistrement de l'appareil dans `apps/api`, et dans `apps/mobile` la demande d'autorisation, la lecture du jeton Firebase de l'installation et son envoi à l'API.

**Technologies :** Expo SDK 57 (`expo-notifications`, jeton natif Firebase, pas le service Expo Push), Firebase Cloud Messaging v1, Hono sur Cloudflare Workers, Supabase.

## Ce que le code a déjà (vérifié à la lecture, pas encore à l'essai)
- `appareils_push` : un jeton par installation, rattaché au compte, sans policy (écriture réservée au serveur), 10 appareils au plus par compte, suppression après 5 échecs ou jeton expiré.
- Textes génériques par étape (`commande_acceptee`, `commande_prete`, `commande_terminee`, `commande_refusee`, `commande_annulee`), canal Android `suivi_commande`. Aucune donnée de client dans la notification.
- Le crochet est appelé à chaque transition faite par le site ET par l'API (l'API réutilise `traiterCommande` du site). La préférence du client (« Me prévenir quand ma commande avance ») est respectée.
- Routes `POST /api/v1/appareils` et `/appareils/retirer` : **site seulement**.

## Ce qui manque
1. Route d'enregistrement et de retrait de l'appareil dans `apps/api` (même contrôles que le site : Bearer strict, plafond par compte, jeton borné et contrôlé, `plateforme` dans une liste).
2. Dans l'appli : `expo-notifications`, autorisation demandée au bon moment (après la première commande, pas à l'ouverture), canal `suivi_commande`, enregistrement du jeton à la connexion, retrait à la déconnexion, appui sur la notification → écran de suivi.
3. Un fichier `google-services.json` pour l'identifiant Android de l'appli Expo (`com.speedfood.clientdemo`). Le projet Firebase n'a enregistré que `com.speedfood.app` (appli Kotlin).
4. Le secret `FCM_SERVICE_ACCOUNT` sur le Worker de l'API (il n'est pas dans la liste des secrets de l'API) et, à confirmer, sur le Worker du site. Sans lui, l'envoi est silencieux, sans erreur.

## Décisions de Malika (avant de commencer le lot E3)
- **A. Identifiant Android de l'appli Expo.** Pour remplacer un jour l'APK Kotlin « par-dessus » (mise à jour sans désinstaller), l'appli Expo devra porter `com.speedfood.app` et la même clé de signature. Pour l'essai de ce lot on peut rester sur `com.speedfood.clientdemo` : il faut alors **enregistrer cette appli dans le projet Firebase existant** (geste de Malika dans la console Firebase, rien à payer). Recommandation : enregistrer `clientdemo` maintenant pour l'essai ; décider du passage à `com.speedfood.app` au moment de la bascule.
- **B. Clé de service Firebase.** Malika la génère elle-même dans la console Firebase (Claude y a été bloqué par la protection de l'environnement : ne pas contourner), puis la pose avec `wrangler secret put FCM_SERVICE_ACCOUNT` sur le Worker de l'API (et du site si absente), sans jamais afficher le fichier.
- **C. iPhone.** Hors de ce lot : un envoi vers iPhone natif demande un compte Apple (non disponible). Le client iPhone passe par le suivi dans l'appli et, plus tard, par la notification web de la PWA. À confirmer.

## Lots

### E1 — API : enregistrer et retirer l'appareil (sans toucher à l'appli)
- Créer : `apps/api/src/routes/appareils.ts` (POST `/api/v1/appareils`, POST `/api/v1/appareils/retirer`), contrats dans `packages/shared/src/contracts/appareils.ts`, branchement dans `apps/api/src/app.ts` ou `worker.ts` selon le motif des routes existantes ; tests `apps/api/tests/appareils-routes.test.ts`.
- Contrôles dans l'ordre : Bearer strict → plafond par compte → corps JSON → jeton (`jetonAppareilValide`) et plateforme (`android` | `ios`) → `enregistrerAppareil` / `retirerAppareil`. Le compte vient toujours du jeton, jamais du corps ; un jeton connu change de propriétaire (comme sur le site) ; jamais de jeton d'appareil dans une réponse ni un journal.
- Tests : refus sans Bearer, jeton mal formé, plateforme inconnue, plafond avant validation, compte pris du Bearer et non du corps, retrait sans effet sur le jeton d'un autre compte. Mutations : retirer le contrôle du jeton ; prendre `utilisateurId` dans le corps ; accepter une plateforme hors liste ; renvoyer le jeton dans la réponse.
- Commandes (racine) : `npm run typecheck`, `test:api`, `test:unit`, `test:cloisonnement`, `build:api` (Worker sous 1 400 000 octets, actuel 1 280 010). Exit 0 exigé.
- Documenter dans `docs/API-UNIQUE.md` et `docs/PASSATION-REFONTE.md`.

### E2 — Appli : demander l'autorisation, enregistrer l'appareil, ouvrir le suivi
- **État (4 novembre 2026) : code et tests livrés, NON vérifié sur appareil (E3 obligatoire).** Cochés : [x] `expo-notifications` ~57.0.23 (installé depuis la racine, verrou unique) et plugin dans `app.json` ; [x] `autorisation.ts` (demandée une fois, après la première commande réelle, jamais à l'ouverture) ; [x] `enregistrement.ts` (un seul essai, jamais de réessai, échec réseau silencieux, absence de Firebase sans plantage) ; [x] retrait à la déconnexion AVANT l'effacement de la session (6 s au plus, jamais bloquant) ; [x] réenregistrement à l'ouverture avec session (si l'autorisation est déjà accordée) et au renouvellement du jeton ; [x] `ouverture.ts` (liste blanche des 5 types, lancement à froid, une seule ouverture par notification) ; [x] canal Android `suivi_commande` créé au démarrage ; [x] premier plan : bandeau affiché sans relire le suivi ; [x] `google-services.json` référencé seulement s'il existe (`avecFirebase`, `.gitignore` complété) ; [ ] essai réel sur émulateur (E3).
- Créer : `apps/mobile/src/notifications/` (`autorisation.ts` logique pure et testable, `enregistrement.ts` appel API avec le même schéma « un seul essai, jamais de réessai automatique », `ouverture.ts` appui → suivi), modifier `app.json` (plugin `expo-notifications`, icône et couleur), `package.json`.
- Règles : l'autorisation est demandée UNE fois, après qu'une commande réelle a été envoyée (jamais à l'ouverture) ; refus = l'appli continue, le suivi manuel (« Actualiser ») reste ; le jeton n'est jamais affiché ni journalisé ; déconnexion → retrait de l'appareil (échec silencieux, le serveur nettoie les jetons morts) ; un échec réseau d'enregistrement n'empêche rien.
- Tests unitaires avec mutations (demander à l'ouverture ; réessayer sans action ; garder le jeton après déconnexion ; ouvrir un autre écran que le suivi).
- Commandes : depuis `apps/mobile` `npm test` et `npx tsc --noEmit`, puis racine `npm run typecheck`.

### E3 — Essai réel sur l'émulateur (après les décisions A et B)
**Résultat de l'essai réel E3 (5 novembre 2026, émulateur Android 14 avec services Google, APK de la CI n° 26 contenant Firebase) :**
- Vérifié : l'APK contient Firebase (projet et identifiant d'application dans ) ; commande de test SF-282WF chez barbie food (retrait, 25 000 GNF, marquée test) ; la demande d'autorisation apparaît juste après l'envoi de la première commande réelle, et seulement là ; après « Allow », une ligne  apparaît (android, version 0.1.0, jeton de 142 caractères, jamais affiché) ; l'acceptation par le restaurateur donne, une seconde après,  mis à jour (0 échec) et la notification « Commande acceptée / Le restaurant prépare votre commande. » (canal ) sur l'émulateur ; « prête » puis « terminée » : envoi accepté par Firebase à chaque fois (0 échec) ; notification « Commande terminée / Merci d'avoir commandé avec Speedfood. » reçue ; appui sur la notification, application FERMÉE : l'appli se rouvre sur « Mon compte » avec la commande SF-282WF « Terminée ». API déployée par Malika (routes  : 401 sans connexion). Le secret FCM_SERVICE_ACCOUNT est posé sur l'API et déjà présent sur le site.
- Constats : (1) l'émulateur a perdu sa connexion longue aux services Google après la première notification : les notifications « prête » et « terminée » n'ont été reçues qu'après une coupure/remise du mode avion, et seule « terminée » a été vue ; la notification « prête » n'a pas été vue, cause non élucidée (connexion de l'émulateur probable, mécanisme de remplacement non écarté) ; à refaire sur un vrai téléphone. (2) Un appui sur la notification alors que l'écran est déjà « Mon compte » (panneau restaurateur ouvert) ne change rien : la fenêtre « Mon compte » est déjà ouverte ; comportement à décider. (3) Le compte de test est aussi restaurateur : l'appareil Kotlin du même compte a reçu l'alerte de nouvelle commande ( à 11:39:38), ce qui prouve aussi l'envoi côté restaurateur. (4) La CI ne fournit  que par le secret GitHub  (étape ajoutée à , sans effet si le secret manque) ; la première compilation (n° 25) a démarré avant l'enregistrement du secret et n'avait pas Firebase.
- NON vérifié : refus de l'autorisation, déconnexion puis retrait de l'appareil (une déconnexion obligerait Malika à se reconnecter), deuxième appareil, client sans compte, notification d'annulation et de refus, notification application au premier plan (bandeau) sur la durée, vrai téléphone, iPhone.

- Prérequis par Malika : appli enregistrée dans Firebase + `google-services.json` placé dans `apps/mobile/` (ignoré par Git), secret `FCM_SERVICE_ACCOUNT` posé sur l'API (et le site), API déployée par Malika avec E1. Compilation de l'APK par la CI (≈ 20 min), installation sur l'émulateur (image Google Play, obligatoire pour Firebase).
- Parcours (une seule commande de test sur « barbie food », chaque écriture avec le « oui » de Malika) : se connecter, passer une commande, accepter l'autorisation de notification, vérifier en base une ligne dans `appareils_push` (sans afficher le jeton), faire accepter la commande depuis l'espace restaurateur, constater la notification sur l'émulateur, appuyer dessus (le suivi s'ouvre), puis « prête » et « terminée » ; contrôle `validate_only` avant le premier envoi réel.
- Aussi à vérifier : notification reçue application fermée ; refus d'autorisation ; déconnexion → plus de notification ; deuxième appareil ; client sans compte (aucun effet) ; vraies commandes intactes.

## Hors de ce lot
Notification au restaurateur dans l'appli Expo (nouvelle commande : lot suivant, même socle), espace livreur et équipe, iPhone natif, remplacement de l'APK Kotlin.

## Risques
- L'émulateur doit avoir les services Google (image « Play Store » : c'est celle installée) ; sans eux aucun jeton n'est délivré.
- Silence du serveur sans le secret : la preuve de réussite se lit sur l'émulateur ET dans `appareils_push.derniere_reussite_le`.
- Les tests unitaires ne prouvent pas le natif (leçon D4c) : E3 est obligatoire avant de dire « livré ».
