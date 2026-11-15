# Bilan complet et passation — Speedfood (14 novembre 2026)

Document de référence pour reprendre le projet. Il dit **ce qui a été fait**, **ce qui ne l'est pas encore et pourquoi**, et **comment continuer sans rien casser**. Rédigé par Muse (chef de projet développement) à la demande de Malika Himmara, propriétaire du produit.

- Dépôt : `moelohimmara-dotcom/speedfood` (ce dépôt, dossier `speedfood doc` sur le poste de Malika).
- Branche de vérité déployée : `master` (à jour au commit `87747ff` au moment d'écrire).
- Branche de travail de la session : `lot2-restaurateur` (même niveau que `master`).
- Branches techniques : `etape-lot2-controle` (déclenche la compilation Android de contrôle), `candidat-*` (déclenchent la compilation du candidat de remplacement). **Ne jamais fusionner une branche `etape-*` ou un commit « test CI » dans `master`.**
- Matrice fonctionnelle détaillée (65 lignes Kotlin → Expo) : [plans/2026-11-12-parite-kotlin-expo.md](plans/2026-11-12-parite-kotlin-expo.md) — c'est elle qui fait foi ligne par ligne.

---

## 1. État en production (vérifié en ligne le 14 novembre 2026)

| Élément | État |
|---|---|
| Nouvelle application (Expo, `com.speedfood.mobile`) | **3.0.1, code 101**, signée avec la nouvelle clé de Malika, présentée comme application principale sur `/installer` |
| Ancienne application (Kotlin, `com.speedfood.app`) | **2.47.0, code 51**, fichier et bloc de version **inchangés octet pour octet** — ses mises à jour automatiques ne sont pas perturbées |
| API (`speedfood-api`, Cloudflare Workers) | Redéployée, répond sur `https://speedfood-api.moelohimmara.workers.dev` |
| Site (`speedfood-app`, Cloudflare Workers) | Redéployé, répond sur `https://speedfood-app.moelohimmara.workers.dev` |
| APK de la nouvelle appli | Objet R2 `speedfood-mobile-3.0.1.apk` (bucket `speedfood-apk`), servi par le site via `/speedfood-mobile.apk` (redirection 302) |
| Bloc de version `/api/v1/version` | Ancien bloc historique intact ; bloc `mobile` séparé : code **101**, nom **3.0.1**, empreinte et taille de l'APK signée |
| Page `/installer` | Nouvelle application en premier et en principale ; ancienne présentée comme « Ancienne application Android », toujours téléchargeable |

Empreintes publiques de contrôle (déjà publiées par le site, ce ne sont pas des secrets) :

- APK signée 3.0.1 : SHA-256 `4cae07ead479fb4b5a911245827a99eb099a99ff1fedefc682153a52f1b82098`, 65 685 603 octets.
- Certificat de la nouvelle clé : SHA-256 `256b6efe37199cb1dd630a634f6c854b6ca4259e5461330febd416edb69806b5`.
- Ancienne APK : SHA-256 `d44b55a85bc48c0060ec8fd26e894d3823ffd2125bc7f4a3dbaa2b7135070e9c` — **ne doit jamais changer**.

---

## 2. Travaux effectués (session de reprise, novembre 2026)

### 2.1 Reprise en main et outillage

- Projet retrouvé sur le PC, état des lieux complet (code, doc, historique), règles de travail posées avec Malika : un lot à la fois, tests écrits avant le code, aucune publication sans preuve, aucun déploiement sans son feu vert.
- Émulateur Android rendu accessible : AVD `speedfood-essai` (appareil `emulator-5554`), raccourci Bureau « Ouvrir Emulateur Speedfood ».
- Compte de test connecté sur l'émulateur (client + restaurateur « barbie food » + livreur de test + équipe `super_admin`) ; sa session a survécu à toutes les installations grâce à `adb install -r` (jamais de désinstallation).

### 2.2 Parité Kotlin → Expo : lots codés et prouvés

- Lot 1 (client, sécurité) essayé sur émulateur : la parité est passée de 20 à **23 lignes « Reprise » sur 65** (règle stricte du §1 de la matrice : même écran + même route/contrat + tests verts + essai émulateur, et vrai téléphone pour les familles critiques).
- Lots 2 à 8 codés **tests d'abord** : restaurateur (C5/C7/C8/C10/C11 logique), livreur (D5/D6/D7/D8/D10), accès (A10/A12/B12/B13), et toute la famille Équipe E1 à E15. Connexions Facebook/Google (A4/A5/A6) codées en parcours navigateur PKCE, boutons affichés seulement si le service d'authentification active le fournisseur.
- Deux routes du site qui n'existaient pas ont été créées selon les patrons existants : `/api/v1/livreur/historique` et `/api/v1/livreur/file` (elles servent le livreur **via le site**, voir piège n° 8).
- Prototype natif Android `apps/mobile/modules/speedfood-veille` (service de premier plan restaurateur C11/C12, suivi de position livreur D9) : aucun jeton côté natif, la session TypeScript garde lectures et envois. **Compilé avec succès en CI** ; essai réel restant (voir §3).
- Essais groupés sur émulateur avec les APK de contrôle : A10, A12 et B13 passées « Reprise » ; C5, C7, C8, C10, D1, D2, D5, D6, D7, D8, D10 et les 18 modules Équipe ouverts un par un (données réelles). Détails ligne par ligne dans la matrice et son journal.

### 2.3 Pannes réelles trouvées par les essais et corrigées

1. **Compilation Android bloquée** : un caractère invisible (BOM, octets EF BB BF) au début de `apps/mobile/modules/speedfood-veille/package.json` faisait échouer le paquet JavaScript « release » (`createBundleReleaseJsAndAssets`). Trouvée par bissection CI puis reproduction locale (`expo export`), corrigée (commit `a8220c7`). Le code Kotlin n'y était pour rien.
2. **Cache hors ligne (B13) muet** : `executeForRawResultAsync` d'expo-sqlite rend des **tableaux de valeurs**, pas des objets ; le code lisait `.valeur` dessus, donc le cache ne se relisait jamais. Extraction testée `valeurDepuisLignesBrutes` (commit `84656d6`), re-prouvé en vrai mode avion.
3. **Liens profonds (A12) inopérants en deux temps** : d'abord aucun `intentFilters` HTTPS côté Android (le lien restait au navigateur, commit `f3573e2`) ; ensuite le routeur Expo affichait « Unmatched Route » avant l'écran catalogue — routes d'entrée `/r/[id]` et `/commande/[jeton]`, dépôt « lien en attente » et interception dans le layout (commit `837a82c`). Prouvé à chaud, à froid, et sur restaurant inconnu.
4. **Journal d'audit équipe (E12) « illisible »** : une seule entrée exotique rejetait tout le journal. Les entrées illisibles sont désormais écartées et comptées, comme sur les écrans voisins (commit `3b5ff56`) ; re-prouvé (« 2 entrée(s)… écartées », entrées lisibles affichées).
5. **Libellé « Ajouter undefined aux favoris »** sur la fiche ouverte par lien profond : repli « ce restaurant » (commit `1316d5b`).
6. **Construction du site cassée en amont** : Google Fonts sert désormais la police Bricolage par des adresses sans extension, illisibles par le chargeur de Next 16. Police auto-hébergée (fichier variable officiel, graisses 700-800, variable `--font-bricolage` inchangée) et build repassé en **webpack** (commit `3bd50c3`).

### 2.4 Refonte design (demande et choix de Malika)

- Constat : trop de boutons texte, presque pas d'icônes. Choix validés par Malika : écrans client d'abord, **icône + mot court**, intro logo **courte et douce**.
- 19 icônes ajoutées au même style de trait (`src/design/Icone.tsx`) ; bouton canonique : icône avant le libellé, variantes « tuile » et « icône seule » (nom accessible toujours complet).
- Accueil : rangée **Panier / Compte / Aide / Visite**, cartes restaurant avec icônes position et flèche ; compte client iconé.
- Espaces pro : onglets restaurateur (Commandes, Service, Menu, Historique, Activité), actions livreur (éclair, liste, document, message), 18 modules équipe chacun avec son icône, « Ajouter un plat » iconé.
- Intro du logo (`src/design/IntroLogo.tsx`) : environ 1,2 seconde, fondu et léger zoom, **respecte le mouvement réduit** du téléphone, par-dessus le catalogue déjà monté.
- Prouvé sur émulateur (intro, tuiles, compte, onglets, modules). Tests : **783/783** côté application.

### 2.5 Publication de la nouvelle application

- Identité de remplacement préparée de longue date : `com.speedfood.mobile`, jamais à la place de l'ancienne (`docs/SIGNATURE-CANDIDAT-EXPO.md` fait foi pour la procédure).
- Candidat compilé en CI (branche `candidat-*`, Android 37, **arm64 + armeabi-v7a uniquement**), **signé par Malika seule** (script `signer-candidat.ps1`, mot de passe tapé en saisie masquée, jamais vu ni stocké par l'agent), contrôlé par `controler-remplacement-apk.mjs` (code 0).
- Coexistence prouvée : ancienne et nouvelle applications installées côte à côte sur l'émulateur.
- Deux publications : **3.0.0** (code 100) puis **3.0.1** (code 101, nouveau design). À chaque fois : envoi R2, bloc `mobile` de `version.ts` mis à jour (empreinte + taille), API puis site redéployés, vérifications publiques (empreinte de l'APK téléchargée depuis l'adresse publique = fichier signé ; ancienne APK inchangée).
- Avec le feu vert explicite de Malika : page `/installer` passée en **présentation principale** (plus aucune mention « version d'essai »), message aux utilisateurs porté par les notes de version affichées dans l'application.
- Le code déployé a été **fusionné dans `master`** en avance rapide (aucune réécriture d'historique) ; les Contrôles CI sont verts sur `master`.

---

## 3. Ce qui n'est pas terminé — et pourquoi

La matrice compte **23 « Reprise » sur 65**. Le reste n'est pas du code manquant dans la plupart des cas : c'est de la **preuve** qui manque, ou une **décision** qui appartient à Malika. Ne jamais confondre « Codée », « compilée », « essayée », « déployée » et « reprise ».

| Zone | Restant | Ce qui le débloque |
|---|---|---|
| Téléphone réel (natif) | C11 sonnerie, C12 veille 1er plan, C13, D9 GPS, B15 réception push, A7 verrou biométrique | Un vrai téléphone Android entre les mains de quelqu'un |
| Familles critiques | C8, C10, D1–D10, E1–E15 vues sur émulateur | Même essai sur vrai téléphone (§1 de la matrice) |
| Scénarios jetables | A2 inscription, A3 mot de passe oublié, A8 suppression de compte | Un compte créé pour être jeté |
| Écritures réelles | C5 émettre reçu/facture, B7 répondre à un prix, C7 envoyer/retirer une photo | Une commande et un plat d'essai (numérotation et menu réels sinon) |
| Décisions produit | A9 écran de choix de profil | Décision de Malika |
| Fournisseurs sociaux | A4/A5 Facebook, A6 Google | Application Meta rendue publique ; Google est **inactif** côté site aujourd'hui |
| Équipe (écritures) | Modérations, statuts, marquages vus en lecture seule | Exercer chaque écriture sur données d'essai |
| Livreur (données) | D5/D6 re-prouvées côté client depuis le déploiement des routes | Refaire l'essai connecté sur émulateur puis téléphone |
| Lot 9 final | Revue 65/65, téléphones 64 **et** 32 bits, retrait de l'ancienne appli | Tout ce qui précède + décision explicite de retrait |
| iPhone | Rien de commencé (la page `/installer` l'annonce « en préparation ») | Chantier séparé, App Store |
| Google Play | Non abordé (distribution directe par le site aujourd'hui) | Décision de Malika |

Commentaires honnêtes, pour éviter les malentendus :

- **Le natif n'a jamais tourné sur un appareil.** Le module `speedfood-veille` compile en CI, point. La sonnerie, le réveil d'écran, le service de premier plan et le GPS ne seront prouvés que sur un téléphone réel. Malika a choisi de ne pas brancher son téléphone en débogage USB : elle télécharge l'APK depuis `/installer` et essaie en autonomie. Ses retours valent essais, à condition de les consigner dans la matrice.
- **L'APK candidate (ARM uniquement) ne démarre pas sur l'émulateur x86_64** : `couldn't find DSO to load: libreactnative.so`. C'est attendu, pas une panne. Pour essayer du code sur émulateur, utiliser l'APK de **contrôle** (workflow Android Expo), jamais le candidat.
- **Les essais équipe ont été faits en lecture seule.** Aucune modération, aucun changement de statut, aucun marquage n'a été exercé : ces gestes écrivent pour de vrai. Il faudra des données d'essai et des gestes supervisés.
- **C5 n'a jamais émis de document.** Les boutons ont été vus sur des commandes terminées ; cliquer numéroterait un vrai document dans la comptabilité du restaurant. À faire uniquement sur une commande d'essai.
- **Le « message aux utilisateurs » actuel se limite aux notes de version** affichées par le bandeau de mise à jour dans l'application, plus la page `/installer`. Il n'existe pas encore de campagne d'annonce (console site) ni de bascule forcée : l'ancienne application reste pleinement utilisable, et son retrait n'est **pas** décidé.
- **Aucun compte jetable n'a été créé**, aucun vrai lien de réinitialisation envoyé, aucun compte réel supprimé. Ces essais demandent une adresse et un numéro dédiés, fournis par Malika.
- La présentation « principale » de `/installer` est en ligne, mais **le remplacement n'est pas terminé** tant que le lot 9 n'est pas clos : ne pas retirer l'ancienne application, ne pas toucher à `/speedfood.apk`, ne pas fusionner quoi que ce soit d'autre sans relire la matrice.

---

## 4. Consigne de prise en main (pour tout développeur)

### 4.1 Les règles qui ne se négocient pas

1. **Aucun déploiement, aucune publication, aucune signature de production sans le feu vert explicite de Malika** pour l'action exacte. La signature se fait **par elle seule** : elle tape le mot de passe de sa clé en saisie masquée ; personne d'autre ne le voit, ne le lit, ne le stocke.
2. **Ne jamais toucher à `/speedfood.apk`, ni aux champs historiques** (`code`, `nom`, `notes`, `obligatoire`, `apkSha256`, `apkTaille`) du bloc de version : l'ancienne application compare cette empreinte avant chaque mise à jour.
3. **Jamais `git add -A`** : ajouter les fichiers un par un, commits séparés par lot, messages en français. Aucune réécriture d'historique (pas de rebase/amend/reset des commits publiés).
4. **Tests écrits avant le code** pour toute fonction ; lecture stricte des réponses serveur ; un seul essai par écriture, jamais de relance automatique ; les lignes illisibles sont écartées **et comptées**, jamais inventées.
5. **« Reprise »** (matrice §1) exige les cinq conditions : ancien comportement lu, même route/contrat, fonction codée, tests verts, essai réel (émulateur ; vrai téléphone pour commande, paiement, livreur, équipe). Tout le reste se dit « Codée » ou « À confirmer ».
6. **Aucun secret dans le code, les commits, les journaux ou le chat** : pas de clé, de mot de passe, de jeton, de fichier `google-services.json`. Le jeton de session ne quitte jamais le TypeScript (le natif ne reçoit que des ordres).

### 4.2 Poste de travail (état sur la machine de Malika)

| Outil | Emplacement / version |
|---|---|
| Git | `C:\Program Files\Git\cmd\git.exe` (hors PATH ; dépôt parfois vu « dubious ownership » → `git -c safe.directory='C:/Users/moelo/Documents/Jarvis/speedfood doc' …`) |
| Node du système | `C:\Program Files\nodejs` (v26 — convient au mobile, **pas** au build du site) |
| Node 22 (site) | Portable dans `C:\Users\moelo\adb-tmp\node22\node-v22.23.5-win-x64` — à re-télécharger depuis nodejs.org si absent |
| JDK 17 | `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot` |
| Android SDK | `C:\Users\moelo\android-sdk` (build-tools 36.0.0 : `aapt.exe`, `zipalign.exe`, `lib\apksigner.jar`) |
| Wrangler | Déjà authentifié sur le compte Cloudflare de Malika (OAuth local) — ne jamais afficher ni copier ce jeton |
| Émulateur | AVD `speedfood-essai`, appareil `emulator-5554` ; raccourci Bureau « Ouvrir Emulateur Speedfood » |

### 4.3 Commandes de vérification (à lancer avant tout commit)

Application mobile (`apps/mobile`, Node du système) :

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
cd apps\mobile
npm test                 # attendu : 783/783 (novembre 2026)
& 'C:\Program Files\nodejs\node.exe' .\node_modules\typescript\bin\tsc --noEmit   # depuis apps\mobile uniquement (voir ci-dessous)
& 'C:\Program Files\nodejs\node.exe' ..\..\node_modules\expo\bin\cli export --platform android --output-dir <dossier temporaire>
```

Attention au typecheck : utiliser le TypeScript **du workspace mobile** (`apps/mobile/node_modules/typescript/bin/tsc --noEmit`), pas celui de la racine, qui donne de fausses erreurs sur d'anciens fichiers de tests.

Site (`apps/web`, **Node 22 obligatoire** pour le build) :

```powershell
$env:PATH = 'C:\Users\moelo\adb-tmp\node22\node-v22.23.5-win-x64;' + $env:PATH
cd apps\web
npm run test:unit        # attendu : vert
node ..\..\node_modules\next\dist\bin\next build --webpack   # le build est forcé en webpack (voir piège n° 5)
```

API (`apps/api`) : `npm test` et `npm run typecheck`. Piège connu : sous Node 26, `tests/alerte-site.test.ts` échoue parce qu'un avertissement de dépréciation de Node pollue la sortie capturée — il passe avec Node 22 (celui de la CI) ou `NODE_OPTIONS=--no-deprecation`. Ce n'est pas une régression.

### 4.4 Branches et intégration continue

| Branche | Rôle |
|---|---|
| `master` | Vérité déployée. N'y pousser que du travail terminé, testé, et — pour ce qui se déploie — effectivement déployé ou prêt à l'être |
| `lot2-restaurateur` | Branche de travail courante de la reprise |
| `etape-*` | Déclenche « Android Expo (compilation de contrôle) » ; **ne jamais fusionner** |
| `candidat-*` | Déclenche « Android Expo (candidat de remplacement, NON publié) » |

Workflows GitHub : `Contrôles` (tests + types), `Android Expo (compilation de contrôle)` (APK x86_64 + ARM, signée débogage, **pour essais seulement**), `Android Expo (candidat de remplacement, NON publié)` (identité `com.speedfood.mobile`, SDK 37, ARM uniquement). Les artefacts GitHub exigent une authentification : sans elle, l'API répond 401 — c'est normal.

Si une compilation Android échoue sans journaux lisibles : le workflow de contrôle publie l'extrait d'erreur Gradle en annotation (étape « Compiler les APK »). Lire les annotations du job avant de deviner.

### 4.5 Essayer sur l'émulateur

1. Compiler par la CI de contrôle (branche `etape-*`), télécharger l'artefact `speedfood-expo-debug-apk`, prendre **`release/app-release.apk`** (autonome ; l'APK `debug` exige un serveur Metro et affiche « Unable to load script » sans lui).
2. Installer **sans effacer les données** : `adb -s emulator-5554 install -r <apk>`. Ne jamais désinstaller ni effacer : le compte de test connecté (client, restaurateur, livreur, équipe) doit survivre.
3. Le téléphone émulé est un **x86_64** : le candidat ARM n'y démarre pas (voir §3). Pour le candidat, seuls un vrai téléphone ou l'installation côte à côte (sans lancement) sont possibles sur l'émulateur.

### 4.6 Publier une nouvelle version de l'application (procédure complète)

1. Terminer le code sur la branche de travail ; tests verts (mobile + site si touché) ; fusionner dans `master` en avance rapide.
2. Si le contenu change : incrémenter `apps/mobile/candidat-android.json` (`code` + 1, `version`), committer, créer une branche `candidat-<nom>` depuis la branche de travail, pousser, attendre le run « candidat » vert.
3. Télécharger l'artefact `candidat-android-NON-SIGNE-PRODUCTION`, extraire `app-release.apk` dans `C:\Users\moelo\Downloads\candidat-expo\app-release.apk`.
4. **Malika signe** (elle seule, mot de passe en saisie masquée) :
   `scripts\signer-candidat.ps1 -Apk …\app-release.apk -Sortie …\speedfood-signe-<version>.apk -Sdk C:\Users\moelo\android-sdk\build-tools\36.0.0`
   Le script refuse toute autre clé que la sienne (empreinte du certificat vérifiée).
5. Contrôler sans la clé : `node --experimental-strip-types scripts/controler-remplacement-apk.mjs <apk signée>` → attendu « Compatibilité technique vérifiée, code 0 ». Vérifier aussi l'empreinte du certificat avec `apksigner verify --print-certs`.
6. Envoyer sur R2 : `wrangler r2 object put speedfood-apk/speedfood-mobile-<version>.apk --remote --file <apk signée>` (**`--remote` est indispensable** : sans lui, wrangler écrit dans un stockage local d'émulation).
7. Mettre à jour **uniquement le bloc `mobile`** de `packages/shared/src/application/version.ts` (code, nom, notes, `apkSha256`, `apkTaille`, `apkUrl`), tests du site, commit, fusion `master`.
8. Déployer l'**API** : `cd apps/api ; node build.mjs ; wrangler deploy`. Puis le **site** (Node 22) : `cd apps/web ; npm run cf:deploy` (le garde `verifier-base` contrôle les 85 tables avant tout).
9. Vérifier en ligne, dans l'ordre : `/api/v1/version` sur les deux hôtes (ancien bloc inchangé, bloc mobile nouveau) ; téléchargement de `/speedfood-mobile.apk` avec empreinte SHA-256 identique au fichier signé ; `/speedfood.apk` toujours à l'empreinte historique ; `/installer` répond 200.

### 4.7 Pièges connus (tous rencontrés pour de vrai)

| # | Symptôme | Cause | Réflexe |
|---|---|---|---|
| 1 | Le paquet release échoue sans erreur Kotlin | Un BOM (EF BB BF) en tête d'un JSON lu par Metro | Scanner les JSON du mobile à la recherche d'un BOM |
| 2 | Le cache hors ligne ne rend jamais rien | expo-sqlite rend des tableaux bruts, pas des objets | `valeurDepuisLignesBrutes` dans `cache-catalogue.ts` |
| 3 | Un lien HTTPS n'ouvre pas l'appli | `intentFilters` absents, puis routeur qui intercepte | `app.json` (hôtes connus) + dépôt « lien en attente » du layout |
| 4 | Un écran entier « illisible » à cause d'une ligne | Lecture trop stricte sur des données réelles | Écarter et **compter** la ligne (patron comptes/zones/audit) |
| 5 | Build du site : polices ou module Turbopack introuvable | Google a changé le format des adresses de polices ; Turbopack casse dans cet état | Police Bricolage auto-hébergée + `next build --webpack` (déjà forcé dans `package.json`) |
| 6 | Build du site qui échoue en local seulement | Node 26 au lieu de Node 22 | Toujours builder/déployer le site avec Node 22 |
| 7 | L'APK candidate se ferme sur l'émulateur | Candidat ARM uniquement, émulateur x86_64 | Normal : vrai téléphone, ou APK de contrôle pour l'émulateur |
| 8 | Routes livreur en 404 côté API | `file`/`historique`/`gains` sont servis par le **site** (`SITE_WEB`), pas par l'API | Déployer le site, vérifier sur l'hôte `speedfood-app` |
| 9 | Téléchargement d'artefact GitHub en 401 | L'API des artefacts exige un jeton | Passer par l'accès Git déjà enregistré sur le poste (sans jamais l'afficher) |
| 10 | `adb` échoue dans certains terminaux | Restrictions du bac à sable (socket) | Lancer `adb` depuis un terminal autorisé du poste |

### 4.8 Par où continuer (ordre conseillé)

1. **Essais sur vrai téléphone** (retours de Malika depuis `/installer`, à consigner dans la matrice) : ouverture, connexion, catalogue, commande, espaces restaurateur/livreur/équipe, notification reçue, sonnerie, verrou.
2. **Scénarios jetables** fournis par Malika (e-mail et numéro dédiés) : inscription, mot de passe oublié, suppression ; commande d'essai pour émettre un document et répondre à une proposition ; plat d'essai pour la photo.
3. **Décisions de Malika** : écran de choix de profil (A9), application Meta rendue publique (Facebook), activation éventuelle de Google.
4. **Lot 9** : revue ligne par ligne des 65 fonctions, téléphones 64 et 32 bits, puis — seulement avec sa décision explicite — retrait de l'ancienne application et bascule complète.

### 4.9 Documents à lire ensuite

- [plans/2026-11-12-parite-kotlin-expo.md](plans/2026-11-12-parite-kotlin-expo.md) — matrice des 65 fonctions, états et journal des preuves.
- [SIGNATURE-CANDIDAT-EXPO.md](SIGNATURE-CANDIDAT-EXPO.md) — identité, signature et contrôle du candidat (procédure de référence).
- [APPLICATION-ANDROID.md](APPLICATION-ANDROID.md) et [DEPLOIEMENT-CLOUDFLARE.md](DEPLOIEMENT-CLOUDFLARE.md) — historique des publications et déploiements.
- [PASSATION-CHANTIER-SPEEDFOOD-APP.md](PASSATION-CHANTIER-SPEEDFOOD-APP.md) et [REPRISE-EQUIPE-DEV.md](REPRISE-EQUIPE-DEV.md) — passations précédentes (contexte, ne font plus foi pour l'état actuel).
- `CLAUDE.md` et `AGENTS.md` à la racine — règles de travail du dépôt.

---

*Fin du bilan. En cas de doute sur un état, croire la matrice et les vérifications en ligne plutôt que ce document : il photographie le projet au 14 novembre 2026.*


