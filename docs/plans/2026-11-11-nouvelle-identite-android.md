# Nouvelle identité Android après la perte de la clé de signature — plan du 11 novembre 2026

> **Plan seulement.** Rien n'est codé, signé, publié ni déployé par ce document. Chaque étape marquée « feu vert » exige un oui distinct de Malika dans la conversation. Aucun agent ne génère, ne lit ni ne stocke la clé : Malika la crée et tape son mot de passe elle-même.

## 1. Décision prise (11 novembre 2026)

La clé de signature de l'APK Kotlin actuelle (`com.speedfood.app`, version 2.47.0, code 51) est perdue : le dossier `C:\Users\moelo\speedfood-signature\` n'existe plus, aucune sauvegarde n'a été retrouvée (machine, OneDrive, D:, Windows.old vide, Google Drive). Certificat public de l'ancienne clé, pour mémoire : SHA-256 `e81f0ac1276f445a83425606b3647a3dd0d37c21415d4a9e78bebae840cb1f7c`.

Android refuse de remplacer une appli par une APK signée d'une autre clé. **Option A retenue par Malika : l'appli Expo devient la nouvelle appli Speedfood, avec un NOUVEL identifiant, une NOUVELLE clé, et le projet Firebase existant du compte Google `moelohimmara`.** L'ancienne appli Kotlin continue de fonctionner telle quelle jusqu'à une date de fin à fixer. Malika accepte que les utilisateurs actuels installent la nouvelle appli à la main.

## 2. Faits vérifiés dans le dépôt (lus le 11 novembre)

| Sujet | Constat | Où |
|---|---|---|
| Identité Expo actuelle | `com.speedfood.clientdemo` (Android et iOS), version 0.1.0 | `apps/mobile/app.json` |
| Identité « de production » prévue | `com.speedfood.app`, activée par `SPEEDFOOD_IDENTITE=production` : **inutilisable désormais**, c'est l'ancien identifiant | `apps/mobile/identite-candidat.cjs`, `.github/workflows/android-candidat.yml` (ligne de contrôle `name='com.speedfood.app'`) |
| Mise à jour de l'ancienne appli | Elle télécharge `/speedfood.apk`, vérifie l'empreinte, puis ouvre une session d'installation **liée à son propre identifiant** (`setAppPackageName(contexte.packageName)`). Une APK d'un autre identifiant sera donc **refusée par Android** : la mise à jour en un geste ne peut pas installer la nouvelle appli | `mobile/androidApp/src/main/kotlin/com/speedfood/app/InstallateurApkAndroid.kt` |
| Source unique de version | `packages/shared/src/application/version.ts` (`code` 51, `nom` 2.47.0, `apkSha256`, `apkTaille`), servie par `GET /api/v1/version` du site ET de l'API, lue par l'ancienne appli et par l'appli Expo | `apps/web/src/app/api/v1/version/route.ts`, `apps/api/src/routes/version.ts`, `apps/mobile/src/livraison/mise-a-jour.ts` |
| Page de téléchargement | `/installer`, fichier `/speedfood.apk` + `/speedfood.apk.sha256` ; `scripts/empreinte-apk.mjs` écrit l'empreinte | `apps/web/src/app/installer/page.tsx` |
| Contrôle de remplacement | `controler-remplacement-apk.mjs` refuse un autre identifiant et une autre signature : il suppose l'ancienne identité, **à adapter** | `apps/mobile/scripts/controler-remplacement-apk.mjs`, `apps/mobile/src/livraison/remplacement-apk.ts` |
| Signature par Malika | Script PowerShell qui aligne, demande le mot de passe en saisie masquée, signe, vérifie l'empreinte attendue (celle de l'ancienne clé : **à remplacer**) | `apps/mobile/scripts/signer-candidat.ps1`, `docs/SIGNATURE-CANDIDAT-EXPO.md` |
| Firebase (notifications) | `google-services.json` hors dépôt, posé à la compilation via le secret GitHub `GOOGLE_SERVICES_JSON_B64` ; côté serveur, secret `FCM_SERVICE_ACCOUNT` présent sur `speedfood-app` et `speedfood-api` | `.github/workflows/android-expo.yml`, relevé wrangler du 11 novembre |
| Connexion Google dans l'appli Expo | Aucune trace dans `apps/mobile/src` hors un commentaire : pas de client OAuth Android à créer pour l'instant (à reconfirmer au lot 3) | recherche du 11 novembre |

## 3. Choix à confirmer avant l'étape 3 (permanents une fois publiés)

| Choix | Proposition | Pourquoi |
|---|---|---|
| Identifiant Android et iOS | `com.speedfood.mobile` | Neutre (l'appli regroupe client, restaurateur et livreur). Différent de `com.speedfood.app` donc cohabitation sans désinstallation, et de `clientdemo` qui sent le test. **Définitif** : il ne pourra plus changer sans refaire cette migration |
| Nom affiché | « Speedfood » | Celui déjà prévu par `identite-candidat.cjs` |
| Schéma de lien | `speedfood` à la place de `speedfood-demo` | Cohérence ; seulement si aucun lien existant ne dépend de l'ancien |
| Premier `versionCode` | 100, `versionName` 3.0.0 | Au-dessus de 51 (le code de l'ancienne appli), pour ne jamais être confondu avec elle |
| Validité de la clé | 10 000 jours (environ 27 ans) | Une clé qui expire casse les mises à jour |

## 4. Plan par phases

Légende : **M** = Malika, **C** = Claude, **G** = feu vert distinct requis.

### Phase 1. Nouvelle clé et sauvegardes (M, avant toute compilation)
1. M : installer un JDK (C peut proposer `winget install Microsoft.OpenJDK.17`, avec accord) pour disposer de `keytool`.
2. M : créer le dossier `C:\Users\moelo\speedfood-signature-v2\` puis générer la clé, en saisissant elle-même le mot de passe (invite masquée) :
   `keytool -genkeypair -v -keystore speedfood-prod.keystore -alias speedfood -keyalg RSA -keysize 2048 -validity 10000`
3. M : noter les empreintes publiques (SHA-1 et SHA-256) avec `keytool -list -v -keystore speedfood-prod.keystore -alias speedfood`. Ces empreintes sont publiques, C peut les consigner dans le dépôt.
4. M : **sauvegarder le fichier et le mot de passe en au moins deux endroits hors de la machine**, séparés l'un de l'autre : gestionnaire de mots de passe (fichier joint) ET support physique (clé USB rangée à part), ou coffre chiffré dans un second service. Ne jamais mettre la clé dans Git, GitHub, OneDrive non chiffré, ni dans un e-mail non protégé.
5. **Porte de sortie de phase 1 (obligatoire) :** M restaure la copie de sauvegarde ailleurs, relance `keytool -list` dessus et confirme que l'empreinte SHA-256 est identique. Tant que ce test n'est pas passé, aucune APK ne sera publiée avec cette clé.

### Phase 2. Firebase, projet existant du compte `moelohimmara` (M, C guide)
1. M : dans la console Firebase du projet Speedfood, **ajouter une application Android** avec l'identifiant choisi (phase 3 choix), et enregistrer les empreintes SHA-1 et SHA-256 de la nouvelle clé. Faire de même pour iOS si l'envoi de notifications iOS est voulu (hors périmètre de ce plan).
2. M : télécharger le nouveau `google-services.json`. Ne pas le mettre dans le dépôt (`.gitignore`).
3. M : encoder en base64 et remplacer le secret GitHub `GOOGLE_SERVICES_JSON_B64` (seule Malika clique « Ajouter un secret »). C ne lit pas le fichier.
4. C : vérifier que `FCM_SERVICE_ACCOUNT` des deux Workers appartient bien à ce même projet Firebase (comparaison du nom de projet par Malika dans la console ; C ne lit pas la valeur). Si oui, aucun secret serveur à changer : l'envoi de notifications passe par le projet, pas par l'identifiant de l'appli.
5. Ancien identifiant : laisser l'application Android Kotlin enregistrée dans Firebase tant que l'ancienne appli vit.

### Phase 3. Code (C, branche `candidat-*`, sans toucher `master`)
1. Remplacer `PAQUET_PRODUCTION` par le nouvel identifiant dans `identite-candidat.cjs`, régler `CODE_PUBLIE` en conséquence et ajuster `apps/mobile/tests/identite-candidat.test.ts`.
2. `app.json` et `app.config.js` : identifiant iOS identique, nom affiché, schéma de lien (si confirmé).
3. Workflow `android-candidat.yml` : remplacer le contrôle `name='com.speedfood.app'` par le nouvel identifiant.
4. Contrôle de remplacement : l'ancien contrôle suppose « même identifiant, même certificat ». Ajouter un mode **nouvelle identité** : identifiant attendu = le nouveau, certificat attendu = l'empreinte de la nouvelle clé (donnée en paramètre, jamais lue dans un keystore), code strictement supérieur à 51, cible et minimum Android sans recul, non débogable. Garder l'ancien mode intact. Tests d'abord, puis mutations comme dans le reste du dépôt.
5. `signer-candidat.ps1` : empreinte attendue passée en paramètre (plus de valeur figée), pour que le script refuse toute autre clé que la nouvelle.
6. **Canal de mise à jour séparé** (nécessaire, voir risque R1) : étendre la réponse de `/api/v1/version` avec un champ optionnel `mobile` (code, nom, notes, obligatoire, empreinte, taille, adresse de l'APK). Le champ historique `code`/`nom`/`apkSha256` reste inchangé, donc l'ancienne appli ne voit rien de nouveau. L'appli Expo lit `version.mobile`. Vérifier par un test que l'ancienne appli ignore un champ inconnu (le client Kotlin de production doit tolérer les clés inconnues : **non vérifié**, à tester sur `MiseAJour.kt` avant de modifier la route).
7. Documentation : mettre à jour `docs/APPLICATION-ANDROID.md`, `docs/SIGNATURE-CANDIDAT-EXPO.md` (nouveau dossier de clé, plus de mention de l'ancienne clé comme référence) et la passation.
8. Contrôles : `typecheck`, `test:api` (Node 22), tests mobile, tests du site (échec connu de `design.test.mts` hors périmètre), `build:api` sous le plafond de 1 400 000 octets.

### Phase 4. Candidat signé et essai sur appareil (C prépare, M signe)
1. C : pousser la branche `candidat-*` ; le workflow compile l'APK non signée, artefact conservé 7 jours.
2. M : télécharger l'artefact, signer avec `signer-candidat.ps1` (saisie masquée du mot de passe, vérification de l'empreinte attendue).
3. C : lancer le contrôle de remplacement en mode nouvelle identité sur l'APK signée.
4. Essai sur émulateur ou téléphone **où l'ancienne appli est installée** : installer la nouvelle APK **à côté** (`adb install`, sans `-r`). Les deux doivent coexister. Ne jamais désinstaller ni vider l'ancienne appli sur l'émulateur de contrôle (règle de la passation).
5. Parcours à rejouer avec des données de test uniquement : ouverture, catalogue réel, connexion, commande TEST (`est_test`), suivi, espace restaurateur, espace livreur, réception d'une notification Firebase réelle. Toute écriture réelle chez « barbie food » exige son propre oui de Malika.
6. Consigner dans le journal ce qui a été réellement vu et ce qui ne l'a pas été.

### Phase 5. Publication (G, étape par étape)
Ordre, chaque point après un feu vert distinct :
1. Déposer la nouvelle APK sous un **nom différent** de l'ancienne, par exemple `public/speedfood-mobile.apk`, avec son empreinte (`scripts/empreinte-apk.mjs` adapté). **Ne pas remplacer `public/speedfood.apk`** : l'ancienne appli continue d'y pointer.
2. Renseigner le champ `mobile` de `packages/shared/src/application/version.ts` (code 100, nom 3.0.0, empreinte, taille) ; le test de parité avec `mobile/androidApp/build.gradle.kts` ne concerne que les champs historiques, ne pas les changer. Garder l'ancien code 51.
3. Page de téléchargement : proposer la nouvelle appli, avec un texte clair (« nouvelle application, installez-la puis supprimez l'ancienne »). Conserver un accès à l'ancienne tant qu'elle vit.
4. Déployer le site (Malika), puis l'API si la route de version y est aussi modifiée. Vérifier : `/installer`, empreinte du fichier, `/api/v1/version` (ancien bloc inchangé, nouveau bloc présent), installation sur un téléphone réel.
5. Rien d'autre n'est allumé (`API_RELAIS` inchangé, aucune migration).

### Phase 6. Transition et fin de l'ancienne appli (M décide, C prépare les textes)
1. Message aux utilisateurs actuels (par exemple WhatsApp) : installer la nouvelle appli depuis le site, se reconnecter, puis supprimer l'ancienne. Aucune donnée n'est perdue côté serveur (comptes, commandes), seules les données locales de l'ancienne appli ne passent pas.
2. Fixer une date de fin pour l'ancienne appli. Après cette date seulement, envisager de faire pointer la source unique de version vers la nouvelle appli.
3. Les anciens jetons de notification de l'ancienne appli restent en base ; le nettoyage existant (`appareils_push_retraits`) les retirera quand ils échoueront. Vérifier qu'un utilisateur ayant les deux applis ne reçoit pas deux fois la même notification ; sinon retirer l'ancienne.

### Phase 7. Pérennité (M)
1. Test de restauration de la clé refait après un mois.
2. Inscrire l'emplacement des deux sauvegardes dans un endroit hors machine (jamais le mot de passe lui-même dans un fichier non protégé).
3. Étudier plus tard la publication sur Google Play avec « Play App Signing » (Google conserve la clé de signature, la clé d'envoi est remplaçable) : c'est la protection durable contre une nouvelle perte. Non prévu dans ce plan ; ne pas le faire sans décision de Malika.

## 5. Risques et retour arrière

| Réf | Risque | Parade |
|---|---|---|
| R1 | Si la source unique de version est modifiée, l'ancienne appli propose une « mise à jour » qu'Android refusera (identifiant différent) : erreur visible chez les utilisateurs actuels | Canal `mobile` séparé (phase 3, point 6) ; ne pas toucher `code`, `nom`, `apkSha256` historiques ; ne pas remplacer `speedfood.apk` |
| R2 | Le client de production de l'ancienne appli peut ne pas tolérer un champ JSON inconnu | Test sur `MiseAJour.kt` avant de modifier la route ; si un risque subsiste, créer une route distincte (`/api/v1/version-mobile`) au lieu d'un champ |
| R3 | Nouvelle clé perdue à son tour | Porte de sortie de phase 1 (restauration testée) avant toute publication ; deux sauvegardes séparées |
| R4 | Notifications absentes sur la nouvelle appli | Phase 2 : nouvelle application Android dans Firebase, empreintes enregistrées, nouveau `google-services.json` ; essai avec une notification réelle en phase 4 |
| R5 | Utilisateurs avec les deux applis | Message de transition ; date de fin de l'ancienne ; contrôle des doublons de notification |
| R6 | La nouvelle appli casse un parcours que l'ancienne gérait (parité inachevée : équipe, livreur complet, paiements) | Aucun remplacement forcé : l'ancienne reste disponible jusqu'à parité jugée suffisante par Malika |
| Retour arrière | Retirer `speedfood-mobile.apk`, remettre `version.ts` sans le champ `mobile`, redéployer le site | L'ancienne appli et son fichier n'ont jamais été modifiés, donc rien à restaurer chez eux |

## 6. Ce qui n'est pas vérifié à ce jour

- Le comportement exact du client Kotlin face à un champ `mobile` inconnu.
- La présence d'un JDK et de `keytool` sur la machine (non installés à ce jour).
- Aucun essai de coexistence des deux applications sur un appareil.
- Le comportement des notifications avec la nouvelle application Firebase.
- Parité fonctionnelle de l'appli Expo avec Kotlin (voir `docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md`, §4).
- iOS : hors périmètre de ce plan (pas de distribution validée).

## Journal
- 11 novembre 2026 : plan écrit après la perte de la clé et la décision de Malika (option A, projet Firebase existant). Aucun code modifié.
