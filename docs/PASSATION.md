# Passation : reprendre Speedfood et continuer le travail

Document de référence pour qu'une équipe de développement reprenne le projet **sans l'auteur ni l'historique des conversations**. État au **22 octobre 2026** (application Android **2.26.0**, code de version 28). Il ne contient **aucune valeur secrète**, seulement des noms et des emplacements.

> Il complète `docs/REPRISE-SESSION.md` (10-16 octobre, surtout le site web) et remplace ses parties sur l'application mobile. Le journal détaillé reste `docs/STATUT-PROJET.md` ; les règles de sécurité restent dans `CLAUDE.md`. En cas de divergence entre un document et le code, **le code fait foi**.

---

## 0. En une page

**Speedfood** est un portail de commande de repas pour un pilote à **Conakry (Guinée)** : les clients parcourent les restaurants et commandent (retrait ou livraison, **aucun paiement dans l'application** : ils règlent le restaurant) ; les restaurateurs reçoivent et gèrent leurs commandes ; des livreurs livrent ; l'**équipe Speedfood** administre.

Trois produits dans un seul dépôt :

| Produit | Technologie | Où |
|---|---|---|
| **Site web** (public, consoles restaurateur et administration `/system`) + **API** | Next.js 16 (App Router, TypeScript), déployé sur **Cloudflare Workers** (OpenNext) | `src/`, `worker-entree.js`, `wrangler.jsonc` |
| **Base de données et authentification** | **Supabase** (Postgres, Auth, RLS) | `supabase/migrations/` (110 fichiers) |
| **Application Android native** (clients, restaurateurs, livreurs, équipe) | **Kotlin Multiplatform + Compose Multiplatform** | `mobile/` |

Production : `https://speedfood-app.moelohimmara.workers.dev` (Worker `speedfood-app`). Dépôt : `C:\Users\moelo\dev\speedfood`, branche `master`, distant GitHub `moelohimmara-dotcom/speedfood` (public). Base : projet Supabase `ggldjdizqrtpetdiohxy`.

**Où en est-on :** le parcours client, l'espace restaurateur, l'espace livreur et l'espace équipe existent dans l'application et sont reliés à la production. Les mises à jour de l'application se font **en un geste depuis l'application** (voir § 7). Les chantiers restants sont listés au § 10. Aucun paiement en ligne n'est actif (Chap Chap Pay : dossier non terminé).

---

## 1. Premier jour : checklist

1. Lire ce document, puis `CLAUDE.md` (règles non négociables, **courtes et strictes**), puis `docs/cadrage/TDR.md` et `docs/cadrage/ADR.md`.
2. Obtenir de Malika (propriétaire) : l'accès au dépôt GitHub, au compte **Cloudflare** (Worker `speedfood-app`), au projet **Supabase** `ggldjdizqrtpetdiohxy`, au projet **Firebase/Google Cloud** (§ 6), et **la clé de signature Android + son mot de passe** (§ 6, critique).
3. Installer : Node.js (version utilisée pendant le développement : 24), **JDK 17 64 bits**, Android SDK (plateforme et outils de build, émulateur facultatif), Git.
4. Web : `npm install`, copier `.env.example` en `.env.local` et le remplir (§ 6), `npm run dev`.
5. Mobile : copier `mobile/speedfood.properties.example` en `mobile/speedfood.properties` (valeurs **publiques**), `cd mobile && ./gradlew :shared:jvmTest :androidApp:assembleDebug`.
6. Vérifier que tout passe : `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run test:cloisonnement`, tests natifs (§ 8).
7. Lancer l'audit sur émulateur avec le **faux serveur** (§ 8) pour voir les quatre espaces avec des comptes factices **sans toucher à la production**.

---

## 2. Cartographie du dépôt

```
speedfood/
├─ CLAUDE.md, AGENTS.md        règles du projet (à respecter) ; AGENTS.md rappelle que Next.js 16 diffère des versions connues
├─ README.md                   démarrage rapide
├─ package.json                scripts npm (dev, lint, test:unit, test:cloisonnement, cf:build, cf:deploy…)
├─ wrangler.jsonc              configuration du Worker (assets, binding AI, tâche planifiée toutes les 5 minutes)
├─ worker-entree.js            point d'entrée du Worker : micro-cache des pages publiques + tâche planifiée (`scheduled`)
├─ open-next.config.ts, next.config.ts
├─ src/
│  ├─ app/                     pages et routes Next.js (App Router)
│  │  ├─ api/v1/               API de l'application mobile (jeton porteur) — voir § 4
│  │  ├─ api/application/      route d'annonce automatique des versions
│  │  ├─ system/               console d'administration web (équipe Speedfood)
│  │  ├─ restaurant/, restaurants/, panier/, compte/, installer/ …  parcours web
│  │  └─ globals.css, components.css, public*.css …  styles GLOBAUX (pas de modules CSS) — voir § 11
│  ├─ components/              composants React (site, accueil, console, studio…)
│  └─ lib/                     logique serveur et partagée : auth, commande, livraison, paiement, notation, push, system-admin, api (aides des routes v1), application (version publiée)…
├─ supabase/migrations/        schéma de la base (une migration appliquée = un fichier ici, dans le MÊME commit)
├─ scripts/                    outils : tests purs (`scripts/tests`), vérification de la base, export, icônes, `empreinte-apk.mjs`, `faux-serveur-application.mjs`
├─ public/                     fichiers servis tels quels, dont **`speedfood.apk`** et `speedfood.apk.sha256` (APK publiée)
├─ docs/                       toute la documentation (index au § 12) ; `docs/cadrage/` = mandat, architecture, sécurité, design
└─ mobile/                     application Kotlin Multiplatform
   ├─ shared/                  interface, données et logique (code commun)
   │  └─ src/commonMain/kotlin/com/speedfood/app/
   │     ├─ App.kt             coque CLIENT + démarrage (logo, visite guidée) + routes
   │     ├─ EspacePro.kt       coque des espaces PROFESSIONNELS (restaurateur, livreur, équipe)
   │     ├─ data/              API (interfaces + implémentations Ktor), modèles, services (session, espaces, panier…)
   │     ├─ ui/                écrans Compose et ViewModels
   │     ├─ design/            tokens visuels (couleurs, typographie)
   │     └─ di/Koin.kt         injection de dépendances
   │  └─ src/commonTest, jvmTest   tests (jvmTest contient aussi les captures d'écran du moteur Compose)
   ├─ androidApp/              coque Android : MainActivity, services (suivi du livreur, surveillance du restaurateur), Firebase, installation des mises à jour, biométrie
   ├─ iosApp/, desktopApp/     coques iOS et bureau (aperçu) : non publiées
   ├─ speedfood.properties     valeurs publiques (adresse du site, clé publique Supabase, identifiant OAuth Web) — **ignoré par Git**
   └─ androidApp/google-services.json   configuration Firebase — **ignorée par Git**
```

---

## 3. Architecture

### 3.1 Web et API
- **Next.js 16** : le fichier de garde des requêtes s'appelle **`proxy.ts`** (pas `middleware.ts`). Avant d'écrire du code Next.js, lire `node_modules/next/dist/docs/` (c'est une version avec ruptures).
- **Cloudflare Workers** via OpenNext. `worker-entree.js` ajoute (1) un micro-cache des pages publiques, (2) la tâche planifiée `scheduled()` toutes les **5 minutes** : entretien des paiements (`/api/paiement/entretien`) et **annonce automatique des nouvelles versions** de l'application (`/api/application/annonce-auto`), toutes deux protégées par le secret `PAIEMENT_ENTRETIEN_SECRET`.
- **Limite connue** : plan gratuit Cloudflare, limite de temps CPU (erreur 1102) : le site peut échouer vers 5 visiteurs simultanés. Choix assumé pour le pilote ; à traiter avant une campagne (mémoire du projet, `docs/DEPLOIEMENT-CLOUDFLARE.md`).
- **API de l'application** (`src/app/api/v1/*`) : authentification par **jeton porteur** Supabase (jamais les cookies du site), identité lue depuis le jeton, **jamais** d'identifiant d'utilisateur ou de restaurant envoyé par l'application. Chaque route revérifie le droit (RLS, rôle système, appartenance). Plafonds par compte (`src/lib/securite/limitation-debit.ts`).

### 3.2 Base de données (Supabase)
- RLS partout. Une règle apprise à la dure : les policies réservées aux membres portent **`to authenticated`**, sinon elles sont évaluées pour `anon` et cassent la lecture publique voisine.
- Toute migration appliquée (`apply_migration`) a **son fichier** dans `supabase/migrations/` dans le même commit. Après toute migration touchant RLS ou une fonction `SECURITY DEFINER`, lancer les **advisors de sécurité** et corriger.
- Tables clés : `restaurants`, `orders` (commandes), `livraisons`, `livreurs`, `restaurant_memberships` (qui gère quel restaurant), `system_admin_memberships` (rôles de l'équipe : `super_admin`, `operations`, `content_editor`, `support`), `appareils_push`, `annonces_versions`, `audit_events` (journal append-only). Voir `docs/MODELE-DONNEES.md`.
- Montants en **GNF, entiers** (jamais de flottant). Tous les prix sont recalculés côté serveur.

### 3.3 Application native
- **Une application, quatre espaces** : *client* (par défaut, sans compte pour parcourir), puis *restaurateur*, *livreur*, *équipe Speedfood*, chacun avec **sa propre coque** (barre du bas, onglets), ouverts **seulement** pour un compte qui y a droit. Règle complète : `docs/NAVIGATION-PAR-ROLE.md`.
- **Droits** : `GET /api/v1/moi` renvoie `{restaurateur, livreur, equipe}` pour le compte du jeton (affichage seulement ; chaque route revérifie).
- **État d'accès centralisé** (`data/Espaces.kt`, `EspaceService`) : un 401 ferme proprement la session (« Votre session a expiré » + « Me reconnecter »), un 403 dans un espace relit les droits, les droits sont relus à la reprise et toutes les 10 minutes, la déconnexion garde les commandes en cours. Un plugin Ktor dans `di/Koin.kt` signale les 401/403 à `ReactionAcces`. **Ne jamais traiter un refus d'accès comme une coupure réseau.**
- **Modèle de code** : pour chaque domaine, une interface `XxxApi` + `KtorXxxApi` (dans `data/`), un `XxxViewModel` (StateFlow d'un état scellé : Chargement / NonConnecte / Erreur / Pret), un écran Compose (`ui/`), un enregistrement dans `di/Koin.kt`, des tests Ktor `MockEngine`. Textes en français, noms en français.
- **Mises à jour** : l'application vérifie `/api/v1/version`, télécharge `/speedfood.apk`, vérifie son **SHA-256** (publié dans la réponse), puis installe via `PackageInstaller` (confirmation d'Android requise ; mise à jour réellement silencieuse impossible hors Google Play).
- **Hors ligne** : cache des restaurants, fiches, menus et quartiers (7 jours), panier conservé 48 h.

---

## 4. API `/api/v1` (application mobile)

Authentification : `Authorization: Bearer <jeton Supabase>` sauf mention « publique ». Les réponses sont `{ok:true,…}` ou `{ok:false, erreur:{code,message}}` (codes : `NON_AUTHENTIFIE`, `NON_AUTORISE`, `VALIDATION`, `CONFLIT_ETAT`, `TROP_DE_REQUETES`, `ERREUR_SERVEUR`).

| Espace | Routes (préfixe `/api/v1/`) | Droit |
|---|---|---|
| Public | `version`, `aide`, `livraison/estimation` (POST), `commandes` (POST/GET), `suivi` (POST), `suivi/proposition` | aucun (commande : compte exigé à l'envoi) |
| Compte | `moi`, `appareils` (+ `/essai`, `/retirer`), `client/espace`, `client/profil`, `client/adresses`, `client/favoris`, `client/compte` (suppression) | jeton |
| Restaurateur | `restaurant/commandes` (+ `/action`, `/document`, `/paiement`, `/proposition`), `restaurant/menu` (+ `/action`, `/photo`), `restaurant/statut`, `restaurant/activite` | membre d'un restaurant (+ second facteur si activé) |
| Livreur | `livreur/etat`, `livreur/en-ligne`, `livreur/position`, `livreur/offre`, `livreur/course`, `livreur/gains` | fiche livreur |
| Équipe | `equipe/moi`, `equipe/tableau`, `equipe/repartition` (+ `/action`), `equipe/commandes` (+ `/[id]`, `/statut`, `/coordonnees`), `equipe/livraisons` (+ `/action`), `equipe/livreurs/action`, `equipe/menus` (+ `/[id]`, `/confirmer`, `/disponibilite`), `equipe/avis` (+ `/moderation`), `equipe/paiements` (lecture seule), `equipe/referencements` (+ `/statut`) | rôle système + permission (`commande.support`, `restaurant.moderer`…), second facteur, audit |

Matrice des permissions : `docs/MATRICE-PERMISSIONS.md` et `src/lib/system-admin/permissions.ts`.

---

## 5. Données de test et audit sans toucher à la production

**Règle du projet : aucun compte, commande ni donnée de test n'est créé en production.** Pour auditer l'application :
1. `node scripts/faux-serveur-application.mjs` (port 8787) : simule l'authentification et toutes les routes `/api/v1`, avec les comptes `client@test.sf`, `resto@test.sf`, `livreur@test.sf`, `equipe@test.sf`, `multi@test.sf` (mot de passe quelconque). Les lectures publiques (restaurants, plats) sont relayées **en lecture seule** vers la vraie base. `GET /__revoquer` rend toutes les sessions invalides (test de la session expirée), `GET /__restaurer` les rétablit.
2. Construire l'APK « debug » en pointant `mobile/speedfood.properties` vers `http://10.0.2.2:8787` (`supabase.url` et `site.url`), puis **remettre les vraies valeurs**. La version debug autorise le HTTP en clair (`mobile/androidApp/src/debug/AndroidManifest.xml`) ; l'APK publiée ne l'autorise pas.
3. Émulateur : voir `docs/AUDIT-PARCOURS-2026-10-22.md` (méthode, constats) et la mémoire `emulateur-android-speedfood`.

---

## 6. Comptes, secrets et emplacements (noms seulement)

| Élément | Où | Remarque |
|---|---|---|
| Variables du site | `.env.local` (jamais commité), `.env.example` donne les noms | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`, `COMMANDE_PROPOSITION_DELAI_MINUTES`, `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, `PAIEMENT_SIMULATION_CLE`, `PAIEMENT_ENTRETIEN_SECRET`, `CHAPCHAP_CLE_API`, `CHAPCHAP_CLE_SIGNATURE` |
| Secrets du Worker | `npx wrangler secret put <NOM> --name speedfood-app` | mêmes noms + **`FCM_SERVICE_ACCOUNT`** (clé du compte de service Firebase pour les notifications poussées) ; vérifier avec `npx wrangler secret list --name speedfood-app`. Changer `COMMANDE_JETON_SECRET` invalide tous les liens de suivi existants |
| Signature Android | `C:\Users\moelo\speedfood-signature\speedfood.keystore` (+ `mot-de-passe.txt` dans le même dossier, alias `speedfood`) | **CRITIQUE : sans cette clé, plus aucune mise à jour possible par-dessus les installations existantes** (Android exige la même signature). Empreinte SHA-256 du certificat : `E8:1F:0A:C1:27:6F:44:5A:83:42:56:06:B3:64:7A:3D:D0:D3:7C:21:41:5D:4A:9E:78:BE:BA:E8:40:CB:1F:7C`. **À sauvegarder hors de ce poste dès la passation** (coffre de mots de passe) |
| Firebase | projet « Speedfood » (identifiant `first-metric-478413-e1`, compte Google de Malika) | notifications (FCM) et rapports de plantage ; `mobile/androidApp/google-services.json` ignoré par Git. Le projet Cloud contient aussi deux clients OAuth d'autres applications : ne pas les utiliser pour Speedfood |
| Connexion Google | client OAuth « Web » + client Android d'un projet Google dédié ; identifiant Web dans `speedfood.properties` (`google.webClientId`) ; fournisseur activé dans Supabase | interrupteur côté site : `connexion_google_active` dans `/system/parametres` (à cocher par Malika) |
| Paiement | Chap Chap Pay (`docs/CHAPCHAP-NOTES-API.md`, `docs/PAIEMENT-ARCHITECTURE.md`) | dossier KYC non terminé : paiement en ligne **inactif** |
| `mobile/local.properties`, `mobile/speedfood.properties` | postes de développement | ignorés par Git |

Règles : aucune valeur secrète dans le code, les commits, les journaux ni les documents ; `SUPABASE_SERVICE_ROLE_KEY` jamais préfixée `NEXT_PUBLIC_`.

---

## 7. Publier une nouvelle version de l'application

**Aucun déploiement en production sans feu vert explicite de Malika** (`CLAUDE.md`, `docs/cadrage/PROCEDURE-SECURITE.md`). Procédure :

1. Augmenter `versionCode` et `versionName` dans `mobile/androidApp/build.gradle.kts` **et** `code`, `nom`, `notes` dans `src/lib/application/version.ts` (un test vérifie qu'ils sont identiques).
2. Contrôles : `npx tsc --noEmit`, `npx eslint src`, `npm run test:unit`, `npm run test:cloisonnement`, `cd mobile && ./gradlew :shared:jvmTest :androidApp:assembleDebug`.
3. Construire l'APK signée (variables d'environnement `JAVA_HOME`, `ANDROID_HOME`, `SPEEDFOOD_KEYSTORE`, `SPEEDFOOD_KEYSTORE_PASSWORD` lue dans le fichier **sans l'afficher**) : `./gradlew :androidApp:assembleRelease`.
4. Vérifier avec `aapt dump badging` (version) et `apksigner verify --print-certs` (le SHA-256 du certificat doit être celui du § 6).
5. Copier `androidApp/build/outputs/apk/release/androidApp-release.apk` vers `public/speedfood.apk`, puis `node scripts/empreinte-apk.mjs` (écrit `public/speedfood.apk.sha256` **et** l'empreinte et la taille dans `src/lib/application/version.ts`).
6. Commit (voir § 11 pour le format), puis `npm run cf:deploy` en tâche de fond (environ 8 à 10 minutes ; une erreur 503 de l'API Cloudflare est transitoire : relancer).
7. Vérifier la production : `/api/v1/version` (nouveau code), `sha256sum` de `/speedfood.apk` = `public/speedfood.apk.sha256`, nouvelles routes qui répondent **401** sans jeton. Puis `git push origin master` (si « cannot lock ref » : réessayer).
8. L'annonce aux téléphones part **toute seule** dans les 5 minutes (tâche planifiée) ; le bouton « Annoncer la version » de `/system/mises-a-jour` reste disponible.
9. **Retour arrière** : l'APK précédente est dans l'historique Git (`git show <commit>:public/speedfood.apk`) ; remettre ce fichier, son empreinte et `version.ts` à l'état antérieur (le `versionCode` ne doit **jamais** baisser pour les appareils déjà à jour : publier plutôt un `versionCode` supérieur avec le correctif).

Détails et historique des versions : `docs/APPLICATION-ANDROID.md`.

---

## 8. Tests et qualité

| Quoi | Commande | Remarque |
|---|---|---|
| Types, lint | `npx tsc --noEmit`, `npx eslint src` | |
| Tests purs du web | `npm run test:unit` | un nouveau fichier de test se déclare dans `scripts/tests/lancer.mjs` (liste `copier(...)` **et** liste d'exécution), sinon il n'est jamais lancé ; vérifier le **code de sortie** (« ECHEC » s'écrit sans accent) |
| Cloisonnement des accès | `npm run test:cloisonnement` | |
| Tests de l'application | `cd mobile && ./gradlew :shared:jvmTest` | Ktor `MockEngine`, coroutines de test. **Piège** : une boucle infinie (`while(true){delay}`) sur le planificateur d'un `runTest` fait bloquer la suite ; utiliser un `CoroutineScope(UnconfinedTestDispatcher())` indépendant, annulé en fin de test |
| Concurrence / journée simulée | `npm run test:concurrence`, `npm run test:simulation` | contre la base : à manier avec précaution |
| Audit visuel | faux serveur + émulateur (§ 5) | **chaque version** doit être jouée avec les comptes factices : connexion, déconnexion, session révoquée, hors ligne |
| Captures du moteur Compose | `jvmTest/.../CapturesTest.kt` | utile mais **n'a pas remplacé** l'émulateur (elles avaient masqué une barre de panier) |

Garde-fous du dépôt : `scripts/verifier-requetes.mjs` signale les lectures non bornées (`.limit()` ou entrée justifiée) ; `cf:deploy` refuse de partir si une table attendue manque en base (`scripts/verifier-base.mjs`).

---

## 9. Ce qui a été livré (application, 21 → 22 octobre 2026)

| Version | Contenu |
|---|---|
| 2.0 à 2.4 | application native (remplace l'enveloppe web), commander, panier, suivi, espace livreur, logo animé et visite guidée |
| 2.5 à 2.7 | suivi du livreur en arrière-plan, console restaurateur (commandes, menu, paiements, alerte application fermée), notifications poussées Firebase |
| 2.8 à 2.10 | alerte « mise à jour disponible », connexion Google, photos des plats |
| 2.11 à 2.13 | espace équipe (répartition, support des commandes, livraisons et livreurs) |
| 2.14 à 2.17 | barre de navigation, Compte/Paramètres/Aide, espace client (profil, adresses, favoris, avis), panier conservé et mode hors ligne, commande plus simple, menus à reconfirmer |
| 2.18 | **mise à jour en un geste** (téléchargement vérifié par SHA-256) + annonce automatique ; promotion du téléchargement sur le site (bandeau Android, accueil, QR code, `/installer`) |
| 2.19 | **une interface par public** (espaces séparés, `/api/v1/moi`) |
| 2.20 | **phase A** : fiabilité de la session et des rôles |
| 2.21 | **phase B** : visite en 3 écrans, invitation aux notifications, suppression de compte, verrou biométrique optionnel des espaces pro |
| 2.22 | **lot C1** : carnet d'adresses dans la commande, cœur favori sur la fiche |
| 2.23 | **lot D1** : onglet Activité (restaurateur), Gains (livreur), bande d'identité, tableau d'équipe par priorité |
| 2.24 | **parité équipe** : modération des avis dans l'application |
| 2.25 | **parité équipe** : paiements en ligne en lecture seule (les décisions qui déplacent de l'argent restent sur le site) |
| 2.26 | **parité équipe** : demandes de référencement (lire, appeler, changer le statut ; la création de fiche reste sur le site) |

---

## 10. Ce qui reste (feuille de route)

Source de vérité : `docs/FEUILLE-DE-ROUTE-APPLICATION.md` (phases, critères d'acceptation) et `docs/FEUILLE-DE-ROUTE-ADMIN.md` (parité de la console web). Résumé :

**Phase C — découverte et commande** (le lot C1 est livré) : photos de plats (dépend du contenu), sections d'accueil (« Ouverts maintenant », « Les mieux notés »), cartes avec délai/frais/note, fiche plat avec options et quantité, frise de suivi enrichie, notification qui ouvre le bon écran, appel livreur/restaurant, carte, **note au restaurant** (demande une colonne en base : `orders` n'a pas ce champ), paiement mobile (Chap Chap Pay).
**Phase D — outils pro** (lot D1 livré) : horaires et réglage du son du restaurateur, historique complet paginé, **règle de rémunération** et gains réels du livreur (les « gains » actuels sont les frais de course, pas une paie), assistance livreur.
**Parité équipe** (ordre) : avis, paiements (lecture) et demandes de référencement (faits), puis restaurants et référencements, partenariats et liste d'attente, comptes, contenu et paramètres, audit.
**Phase B — reportés** : choix de la localité au premier lancement (utile dès qu'il y a plusieurs zones), connexion par code SMS (fournisseur et coût à décider), profil de référence de démarrage.
**Phase E — distribution** : **trois applications** (Speedfood, Speedfood Pro, Speedfood Livreur) sur le même module `shared/` pour éviter un refus de Google Play lié aux autorisations sensibles, dépôt sur **Google Play** (compte payant), mesure d'usage, configuration à distance. **Phase F** : iPhone (compte Apple Developer, exécuteur macOS).
**Site** : tenue en charge (limite CPU du Worker), voir § 3.1.

**Décisions attendues de Malika** : fournisseur SMS ; Google Play et séparation en trois applications (recommandé avant l'ouverture au public) ; photos et menus réels des restaurants (aujourd'hui un seul restaurant publié, plats « à confirmer ») ; avancement Chap Chap Pay ; règle de rémunération des livreurs ; libellé « à confirmer » (règle produit commune au site).
**À faire côté Malika** : cocher « connexion Google des clients » dans `/system/parametres` ; tester sur de vrais téléphones ; supprimer du dossier Téléchargements le fichier de clé du compte de service Firebase s'il y est encore ; fournir des comptes réels de test si un essai hors faux serveur est voulu.

---

## 11. Conventions et pièges (à lire)

**Conventions**
- Tout le texte visible est en **français** ; noms de code, de fichiers et commentaires aussi (style du dépôt). Montants GNF en entiers.
- **CSS global** (pas de modules) : un nom de classe réutilisé ailleurs s'applique aussi et casse la mise en page sans erreur. Préfixer par la page (`inscription-…`, `commande-…`), mettre le style dans la feuille, pas de `style={{…}}` pour la mise en page. Tokens visuels **verrouillés** (`docs/cadrage/DESIGN-SYSTEM.md`) : ne pas redéfinir ; couleur secondaire `#75695F` (contraste AA).
- Avant d'écrire dans une table, **lire ses contraintes** (`supabase/migrations/`) : une valeur hors contrainte fait échouer **toute** l'insertion, souvent sans message.
- **Tester de bout en bout** avant de dire « livré » : création → e-mail → connexion → page cible → lecture en base. Une page qui s'affiche ne prouve rien.
- Commits : un lot par commit, message en français décrivant le *quoi* et le *pourquoi*, terminé par la ligne `Co-Authored-By` de l'outil utilisé. Une migration appliquée = son fichier dans le même commit.

**Pièges déjà payés**
- Windows : PowerShell bloque les scripts `.ps1` (passer par `cmd /c`) ; `&&` n'existe pas dans le PowerShell 5 ; Git Bash réécrit les `/` initiaux des arguments (`MSYS_NO_PATHCONV=1`) ; fins de ligne CRLF/LF : préserver celles du fichier lors des modifications automatiques ; les apostrophes cassent les `python - <<EOF` : écrire un fichier de script puis l'exécuter.
- `taskkill /IM node.exe` tue **tous** les processus Node : cibler le PID du port.
- `git push` peut échouer par verrou transitoire : réessayer. `cf:deploy` peut échouer par 503 ou délai réseau : relancer.
- Fichier `google-services.json` absent : l'application se construit quand même, Firebase reste inactif.
- Un nouvel appareil de test : l'écran de démarrage met environ 20 s sur émulateur ; après démarrage, des boîtes « ne répond pas » du système peuvent masquer l'écran : les fermer.
- Android : la confirmation d'installation est imposée hors Google Play ; Google Play Protect peut proposer un scan à chaque APK inconnue.
- Le serveur d'authentification peut refuser un jeton encore valable par l'horloge (compte suspendu, mot de passe changé) : c'est exactement ce que gère `EspaceService` (§ 3.3).

---

## 12. Index de la documentation

| Besoin | Document |
|---|---|
| Règles, sécurité | `CLAUDE.md`, `docs/cadrage/AGENT-INSTRUCTIONS.md`, `docs/cadrage/PROCEDURE-SECURITE.md` |
| Mandat, décisions | `docs/cadrage/TDR.md`, `docs/cadrage/ADR.md`, `docs/cadrage/PLAN-EXECUTION.md` |
| Design | `docs/cadrage/DESIGN-SYSTEM.md`, `docs/CONSOLE-ADMIN-DESIGN.md` |
| Journal du projet | `docs/STATUT-PROJET.md`, `docs/REPRISE-SESSION.md` |
| Application mobile | `docs/NATIF-PLAN.md`, `docs/APPLICATION-ANDROID.md`, `docs/NAVIGATION-PAR-ROLE.md`, `docs/FEUILLE-DE-ROUTE-APPLICATION.md`, `docs/CHECKLIST-APPLICATION-PRO.md`, `docs/AUDIT-APPLICATION-2026-10-22.md`, `docs/AUDIT-PARCOURS-2026-10-22.md` |
| Administration (équipe) | `docs/FEUILLE-DE-ROUTE-ADMIN.md`, `docs/MATRICE-PERMISSIONS.md`, `docs/CONSOLE-FONDATIONS.md` |
| Données | `docs/MODELE-DONNEES.md`, `docs/AUDIT-SUPABASE.md`, `docs/CONSERVATION-ET-CONFIDENTIALITE.md`, `docs/RUNBOOK-EXPORT.md` |
| Livraison, paiement, notation | `docs/LIVRAISON.md`, `docs/LIVRAISON-LIVREURS-V2.md`, `docs/LIVREURS.md`, `docs/CADRE-JURIDIQUE-LIVREURS.md`, `docs/PAIEMENT-ARCHITECTURE.md`, `docs/CHAPCHAP-NOTES-API.md`, `docs/NOTATION.md` |
| Déploiement, incidents | `docs/DEPLOIEMENT-CLOUDFLARE.md`, `docs/PLAN-INCIDENT.md`, `docs/ALERTES-COMMANDES.md` |
| Audits et revues | `docs/AUDIT-SECURITE-2026-10-04.md`, `docs/REVUE-INDEPENDANTE-2026-10-17.md`, `docs/REVUE-2026-10-19.md` |

---

## 13. Comment ajouter une fonctionnalité de bout en bout (recette)

1. **Besoin** : repérer le document de cadrage concerné ; si une règle métier change, la décision se prend avec Malika.
2. **Base** (si nécessaire) : lire les contraintes ; migration + fichier dans le même commit ; advisors de sécurité.
3. **Serveur** : service dans `src/lib/…` (logique pure testable), route `src/app/api/v1/<espace>/…/route.ts` avec la bonne entrée d'authentification (`clientAuthentifie`, `restaurantAuthentifie`, `livreurAuthentifie`, `equipeAuthentifiee(request, permission)`), plafond, **audit** pour toute action d'équipe sensible. Test pur dans `scripts/tests/` (et déclaration dans `lancer.mjs`).
4. **Application** : modèles et `KtorXxxApi` dans `data/` (une réponse `ok:false` avec `NON_AUTHENTIFIE`/`NON_AUTORISE` doit lever `ErreurAcces`), ViewModel, écran, enregistrement Koin, destination de navigation dans `App.kt` (client) ou `EspacePro.kt` (pro). Tests `commonTest`.
5. **Faux serveur** : ajouter la route simulée dans `scripts/faux-serveur-application.mjs`, jouer le parcours dans l'émulateur.
6. **Documentation** : mettre à jour la feuille de route et cette passation si l'état change.
7. **Publication** : § 7 (avec le feu vert de Malika).
