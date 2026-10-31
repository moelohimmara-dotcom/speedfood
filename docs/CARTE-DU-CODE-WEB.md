# Carte commentée du code du site : `apps/web/` (31 octobre 2026)

But : permettre à un agent qui reprend le projet sans historique de se repérer dans le site Next.js. Ce document décrit **où est quoi, qui appelle quoi, quels pièges** ; il ne remplace ni `docs/PASSATION.md`, ni `docs/REPRISE-SESSION.md`, ni `docs/STATUT-PROJET.md` (à lire avant). Tout a été relevé dans le code le 31 octobre 2026 (lecture de l'en-tête des fichiers, `grep` des imports). Ce qui n'a pas été vérifié est marqué « à vérifier ». En cas de contradiction avec le code, le code gagne (voir `CLAUDE.md`).

Chemins : sauf mention, tout est relatif à `apps/web/`. Les anciens documents écrivent `src/…`, `scripts/…`, `public/…` : lire `apps/web/src/…` (voir `docs/ORGANISATION-DU-DEPOT.md`).

Sommaire : 1 Vue d'ensemble · 2 `src/lib/*` (35 dossiers) · 3 `src/app/` · 4 Composants et CSS · 5 `scripts/` et tests · 6 Conventions · 7 Pièges transverses.

---

## 1. Vue d'ensemble

### 1.1 Pile technique

| Couche | Choix | Où |
|---|---|---|
| Framework | Next.js **16.3.8**, App Router, React 19.2.8, TypeScript `strict`, alias `@/*` → `src/*` | `package.json`, `tsconfig.json` |
| Hébergement | **Cloudflare Workers** via **OpenNext** (`@opennextjs/cloudflare`), Worker `speedfood-app` | `wrangler.jsonc`, `open-next.config.ts`, `worker-entree.js` |
| Base et authentification | **Supabase** (Postgres + RLS + Auth + Storage), projet unique ; clients `@supabase/ssr` et `@supabase/supabase-js` | `src/lib/db/*`, migrations dans `../../supabase/migrations/` |
| Limitation de débit | **Upstash Redis** (API REST, facultatif) avec repli sur une fonction SQL (`fn_limiter_debit`) | `src/lib/securite/` ; mise en place : `docs/REDIS-UPSTASH.md` |
| IA | Workers AI (binding `AI`, « Chef IA » : photo de menu → plats) | `src/lib/menu/chefIaModele.ts`, `wrangler.jsonc` |
| Anti-robot | Cloudflare Turnstile | `src/lib/securite/turnstile.ts`, `src/components/Turnstile.tsx` |
| Éditeur de pages | Puck (`@puckeditor/core`) pour les pages à blocs du Studio | `src/lib/studio/`, `src/components/studio/editeur/` |
| Validation | `zod` 4.6.5 (le Studio et les contrats l'utilisent) | partout |
| Cartes, QR, confettis | `leaflet`, `qrcode-generator`, `canvas-confetti` | composants |
| Paquet partagé | `@speedfood/shared` (`../../packages/shared/`) : règles pures, voir 1.5 | `next.config.ts` (`transpilePackages`) |
| Mobile | hors de ce dossier : `../../mobile/` (Kotlin Multiplatform) | l'application appelle `src/app/api/v1/*` |
| API unique (non déployée) | `../../apps/api/` (Hono sur Workers), réutilise `apps/web/src` via l'alias `@/` | `docs/API-UNIQUE.md` |

`AGENTS.md` (dans `apps/web/`) rappelle que cette version de Next.js a des ruptures : lire `node_modules/next/dist/docs/` **depuis la racine du dépôt** (paquets hissés par l'espace de travail npm) avant de s'appuyer sur un souvenir.

### 1.2 Le Worker de production (`worker-entree.js`)

`wrangler.jsonc` désigne `worker-entree.js` comme `main`. Il enveloppe `.open-next/worker.js` (produit par `opennextjs-cloudflare build`) et ajoute :

1. **Micro-cache des pages publiques** en mémoire de l'isolat (`src/lib/worker/microcache.ts`, règles pures testées par `scripts/tests/microcache.test.mts`) : il ne sert que les visiteurs **sans cookie de session** (`sb-…-auth-token`), sans cookie de suivi, en GET, sur une liste d'adresses ; TTL 30 s (accueil, liste, fiches) ou 60 s (localités). Les visiteurs simultanés d'une même page se partagent un seul rendu (map `enCours`). Réponse avec `Set-Cookie`, ou non 200 / non HTML : jamais conservée. Raison : la limite CPU du plan gratuit (erreur 1102, voir `docs/REVUE-2026-10-19.md` §1 et la mémoire « Limite CPU du Worker »).
2. **Tâche planifiée `scheduled`** (cron `*/5 * * * *`, voir `triggers` dans `wrangler.jsonc`). Elle appelle en interne, avec l'en-tête `x-entretien-secret` (secret `PAIEMENT_ENTRETIEN_SECRET`, sinon elle ne fait rien) :
   - `POST /api/paiement/entretien` : expiration des paiements abandonnés, reprise des versements ;
   - `POST /api/application/annonce-auto` : annonce de la version publiée aux téléphones (une fois par version) ;
   - `POST /api/application/alertes-equipe?action=lister|confirmer` : alertes e-mail de l'équipe (inscriptions suspendues pour doublon), envoyées par `worker-smtp.js` (SMTP Google) si les secrets SMTP existent ;
   - `POST /api/application/purge-candidatures` : une fois par jour (03 h 00–03 h 05 UTC), efface images et menus des candidatures refusées depuis 30 jours.
3. Réexporte les classes à état exigées par OpenNext (`DOQueueHandler`, `DOShardedTagCache`, `BucketCachePurge`).

Le cache incrémental OpenNext est « assets statiques » (pas de R2, pas de coût) : `open-next.config.ts`.

### 1.3 Comment une requête circule

```
Navigateur / application mobile
  → Cloudflare → worker-entree.js : fetch()
       → micro-cache (visiteur anonyme, page publique) ? oui : réponse partagée
       → sinon handler OpenNext (Next.js)
            → src/proxy.ts            (garde de requêtes, voir 1.4)
            → route : page (Server Component) | Server Action ("use server") | route.ts (src/app/api/**)
                 → src/lib/<domaine>/…  (règles pures + services « server-only »)
                      → src/lib/db/*    (client Supabase : session | jeton | anon | service-role)
                           → Supabase (RLS appliquée, sauf clé de service)
```

Trois chemins d'identité (à ne jamais mélanger) :

- **Site, session** : cookie Supabase ; `creerClientServeur()` (`src/lib/db/server.ts`, clé anon + cookies : la RLS s'applique).
- **Application native** : en-tête `Authorization: Bearer <jeton>` ; `creerClientJeton(jeton)` (`src/lib/db/jeton.ts`) : requêtes envoyées *avec l'identité du jeton*, donc RLS aussi. Entrées communes dans `src/lib/api/v1*.ts` (1.6).
- **Clé de service** : `creerClientAdmin()` (`src/lib/db/admin.ts`, **contourne la RLS entièrement**). Réservé au code serveur qui a *déjà* vérifié l'autorisation (permission système, jeton de suivi, appartenance au restaurant). Un identifiant reçu du navigateur n'est jamais une autorisation (`CLAUDE.md`).
- **Anonyme** : `creerClientPublic()` (`src/lib/db/public.ts`, clé anon sans session) pour la lecture publique (restaurants publiés seulement, grâce à la RLS).

Le **suivi de commande** a un quatrième mécanisme : le *jeton de suivi* (secret du client) ; sur le web il est échangé une fois contre un cookie `HttpOnly` (`/api/suivi/session`, `src/lib/commande/sessionSuivi.ts`), jamais renvoyé au navigateur ensuite ; dans l'application il sert de clé d'accès à `/api/v1/suivi*`.

### 1.4 `src/proxy.ts` (et non `middleware.ts`, déprécié en Next 16)

Matcher : tout sauf `_next/static`, `_next/image`, `favicon.ico` et les images. Comportement, dans l'ordre :

1. Si `NEXT_PUBLIC_SUPABASE_URL` / `…ANON_KEY` manquent : laisse passer.
2. **Chemin rapide** : sans cookie `sb-…-auth-token`, aucun client Supabase, aucun appel (économie de CPU). Sinon `createServerClient` rafraîchit la session (`getUser`) et réécrit les cookies avec `optionsCookieSession` (`src/lib/db/cookies.ts`).
3. Sans utilisateur sur `/restaurant`, `/restaurant/*` ou `/livreur` : redirection `/connexion?suite=<chemin>`.
4. Sans utilisateur sur `/system` ou `/system/*` : **404 HTML** identique à une page inconnue (ne révèle pas l'existence de la console équipe).
5. Avec utilisateur sur ces chemins protégés : si un facteur TOTP confirmé existe et que le niveau n'est pas `aal2` → `/connexion/verification` ; si les questions de sécurité facultatives sont activées et non répondues (RPC `fn_questions_etat`) → `/connexion/questions`.

**Le proxy n'est jamais la seule barrière** : `obtenirContexteRestaurant` (`src/lib/auth/contexte.ts`) refait le contrôle dans chaque page `/restaurant`, `obtenirContexteSysteme` / `exigerPermissionPage` / `verifierPermission` (`src/lib/system-admin/contexte.ts`) dans chaque page et action `/system`. Le contrôle est aussi doublé côté base (migration `double_authentification_aal2`).

### 1.5 Paquet partagé `@speedfood/shared` et raccords

`../../packages/shared/src/` (dossiers `api`, `application`, `commande`, `contracts`, `disponibilite`, `paiement`) contient des règles **pures** (aucun import de `@/`, `server-only`, `next`, `react`, `@supabase`, `node:*`, `process.env`, `"use client"/"use server"`). Le test `scripts/tests/paquet-partage.test.mts` le vérifie à chaque `test:unit`. À l'ancienne place dans `src/lib`, il reste un **raccord d'une ligne** (`export * from "@speedfood/shared/…"`). Raccords actuels (13) : `api/v1-regles.ts`, `application/version.ts`, `commande/estimation.ts`, `commande/mode.ts`, `commande/telephone.ts`, `contracts/{commande,erreurs,index,menu,restaurant,statuts}.ts`, `disponibilite/etat.ts`, `paiement/regles.ts`. Outil de déplacement : `scripts/deplacer-vers-partage.mjs <dossier/fichier> [--essai]`. Détails : `../../packages/shared/README.md`.

### 1.6 Les trois « couches » d'une fonctionnalité

La plupart des domaines suivent le même découpage de fichiers (vérifié dans les en-têtes) :

| Suffixe / forme | Contenu | Directive |
|---|---|---|
| `*-regles.ts`, `regles.ts`, fichiers « Pur, sans dépendance : testable seul (npm run test:unit) » | Logique pure, sans base ni Next ; **c'est ce que couvre `test:unit`** | aucune |
| `*-service.ts`, `service*.ts`, lectures `*-lecture.ts` | Accès base (souvent clé de service), **un seul chemin** partagé entre console du site et API `/api/v1` | `import "server-only"` |
| `actions.ts`, `*-actions.ts` | Server Actions : identité tirée de la **session**, jamais d'un paramètre | `"use server"` |

Une Server Action n'exporte que des fonctions asynchrones : les constantes et types vont dans le fichier de règles voisin.

### 1.7 Le relais du site vers l'API (`apps/api`)

État : **éteint par défaut** (`API_RELAIS` absent, vide ou `non`). Ne jamais l'allumer ni déployer l'API sans feu vert de Malika (`CLAUDE.md`, plan 1b / 1c).

- Garde unique : `relaisSiActif(request, module, options?)` dans `src/lib/api/relais.ts`, décision pure dans `src/lib/api/relais-regles.ts` (`moduleRelaye`, `decisionRelais`, `relayer`). `API_RELAIS` = `tout` ou liste de modules séparés par des virgules ; il faut aussi `API_URL` (base acceptable, voir `baseApiAcceptable`) et `RELAIS_SECRET` (≥ 32 caractères ASCII imprimables, `SECRET_RELAIS_VALIDE`). Mal configuré : un seul `console.error("relais_mal_configure")` par isolat, puis la route traite elle-même.
- Chaque route relayée commence par `const relais = await relaisSiActif(request, "<module>"); if (relais) return relais;`. Options : `{ lecture: true }` (POST qui ne fait que lire : repli permis), `{ delaiMs }` (délai par défaut 2 500 ms, max 60 000 ms).
- Modules et routes (14 `route.ts`) : `public` → `v1/version`, `v1/aide`, `v1/connexion/fournisseurs` ; `moi` → `v1/moi` ; `client` → `v1/client/{espace,profil,adresses,favoris,compte}` ; `livraison` → `v1/livraison/estimation` ; `suivi` → `v1/suivi` (lecture), `v1/suivi/annuler` (8 s), `v1/suivi/proposition` (8 s) ; `commandes` → `v1/commandes` (POST 15 s, GET défaut).
- Côté API : `../../apps/api/src/app.ts` monte `routes/{version,aide,fournisseurs,moi,client,estimation,suivi,commandes}.ts` ; elle vérifie le secret de relais et l'IP transmise (`identite/relais.ts`) et reprend les services du site (`@/lib/commande`, `@/lib/client`, `@/lib/securite`, …). `cales/next-headers.ts` fait croire à `headers()` de Next qu'il tourne dans le site.
- Tests : `scripts/tests/relais.test.mts`, `gardes-relais.test.mts` ; côté API : `npm run test:api` (racine).
- Secrets à ne jamais afficher : `RELAIS_SECRET`, `COMMANDE_JETON_SECRET` (voir `docs/API-UNIQUE.md`).

---

## 2. `src/lib/*`

Légende : **SO** = fichiers `server-only` ; **US** = `"use server"` ; **pur** = testable sans base. « Appelants » = répertoires de `src/app` / `src/components` / autres `lib` qui importent le dossier (relevé par `grep`, ordre de grandeur). « Tests » = suites de `scripts/tests/` (voir 5.1) qui importent *directement* le dossier ; **tout fichier SO/US qui touche la base n'a en général pas de test unitaire** : il est couvert par la RLS (`test:cloisonnement`) et par les scripts d'essai sur la vraie base (`scripts/essai-*.mjs`, 5.4).

### alertes/ — alerte sonore des nouvelles commandes (console restaurateur)
Rôle : détecter l'arrivée de commandes à traiter et choisir le mode d'alerte. 100 % pur.
- `commandes.ts` : détecter les arrivées, mesurer l'attente. `mode-service.ts` : mode de service (pur).
- Appelants : `app/restaurant`, `components/AlerteCommandes.tsx`, `components/restaurant/ModeService.tsx`.
- Tests : `alertes.test.mts`, `modeservice.test.mts`.

### api/ — entrées de l'API `/api/v1/*` et relais
Rôle : factoriser l'authentification par jeton et les services partagés site / API.
- `v1.ts` : `repondre`, `repondreErreur`, `utilisateurDuJeton`, `lireCorpsJson` (réponses JSON sans cache). `v1-regles.ts` : raccord vers le paquet partagé.
- `v1-client.ts` (`clientAuthentifie`), `v1-livreur.ts` (`livreurAuthentifie`, `actionLivreur`, plafond par compte), `v1-restaurant.ts` (`restaurantAuthentifie`, contexte restaurant, niveau `aal1/aal2` lu dans le jeton), `v1-equipe.ts` (`equipeAuthentifiee`, `contexteSystemeDepuisApi`) : entrée commune de chaque famille de routes (jeton porteur, limitation de débit par compte, corps JSON).
- `relais.ts` / `relais-regles.ts` : voir 1.7. `moi-service.ts` : « quels espaces ce compte peut-il ouvrir ? » partagé entre `/api/v1/moi` et l'API. `bilans.ts` : bilans « Activité » (restaurateur) et « Gains » (livreur), calculs purs.
- Appelants : `app/api` (77 fichiers), `lib/system-admin`.
- Piège : une famille de routes = une fonction `*Authentifie` ; ne pas relire l'identité autrement.
- Tests : `api-v1.test.mts`, `bilans.test.mts`, `relais.test.mts`, `gardes-relais.test.mts`.

### application/ — version de l'application Android
- `version.ts` : raccord vers `packages/shared/src/application/version.ts` (numéro de version et empreinte SHA-256 de l'APK, **écrits par `scripts/empreinte-apk.mjs`**, qui écrit aussi `public/speedfood.apk.sha256`). L'application compare l'empreinte avant de s'auto-mettre à jour.
- Appelants : `app/api/v1/version`, `app/installer`, `components/accueil`, `app/system` (mises à jour).
- Tests : `version-app.test.mts` (vérifie que les empreintes concordent).

### auth/ — comptes, sessions, double authentification
- `contexte.ts` (SO) : `obtenirContexteRestaurant(cheminActuel)` = utilisateur connecté + rattaché à un restaurant, sinon redirection. `acces.ts` (pur) : deux pistes d'entrée, « client » et « restaurateur ». `redirection.ts` (pur) : n'accepte que `/chemin` interne (pas `//hote`) pour le paramètre `suite` (anti-redirection ouverte). `doubleAcces.ts` : le compte a-t-il aussi l'autre type d'accès ?
- `actions.ts` (US) : inscription (compte créé mais inactif tant que l'e-mail n'est pas confirmé), connexion, déconnexion. `recuperation.ts` (US) : mot de passe oublié (réponse sans révéler si le compte existe).
- `mfa.ts` (US), `mfa-etat.ts` (SO) : TOTP. `questions.ts` (pur), `questions-serveur.ts` (SO), `questions-actions.ts` (US) : questions de sécurité facultatives (voir `docs/QUESTIONS-SECURITE.md`).
- Appelants : `app/restaurant`, `app/connexion`, `app/compte`, `app/system`, `app/entrer`, `app/auth`.
- Piège : à l'inscription la confirmation e-mail est exigée, **aucune session n'existe** : la RLS interdit d'écrire le profil ; les coordonnées vont dans les métadonnées du compte et `assurerProfilClient` (`client/profil-serveur.ts`) les reprend à la première visite authentifiée (`CLAUDE.md`).
- Tests : `acces.test.mts`, `securite.test.mts` (redirection), `questions.test.mts`.

### client/ — espace client (compte facultatif)
- `profil.ts` (pur : avatar dans une liste fermée, pseudo 3–24 caractères), `profil-serveur.ts` (SO : `assurerProfilClient`), `coordonnees.ts` (préremplissage), `quartier.ts` (US), `espace.ts` (pur, « Mes commandes »), `espace-service.ts` (SO : profil, adresses, favoris, avis pour `/api/v1/client/*`), `actions-espace.ts` (US : l'identité vient toujours de la session), `mes-commandes.ts` (SO : `orders.client_user_id`), `notifications.ts` + `notifications-regles.ts` (suivi par push), `recommander.ts` (pur : « commander à nouveau »), `reglage.ts` (interrupteur de la connexion Facebook, désactivé par défaut), `actions.ts` (US : départ de la connexion Facebook).
- Appelants : `app/compte` (11), `app/api` (7), `app/commande`, `components/BoutonFavori|BoutonRecommander|CadreSite`.
- Pièges : contraintes de `client_profils` (pseudo, avatar) : une valeur hors contrainte fait échouer **toute** l'insertion en silence (cas vécu le 10/10/2026).
- Tests : `profil.test.mts`, `espace-client.test.mts`, `notifications-client.test.mts`, `recommander.test.mts`, `reglages.test.mts`.

### cms/ — contenus publiés (pages, bannières, textes)
- `lecture.ts` (SO) : **point d'entrée unique** du site public vers les pages et bannières publiées. `cache.ts` (SO) + `cache-regles.ts` (pur) : cache des contenus publiés dans la Cache API du Worker (`caches.default`), clé et fraîcheur calculées par les règles (voir `docs/CACHE-STUDIO.md`). `apercu.ts` : lecture pour l'aperçu équipe (statut réel et brouillon). `emplacements.ts` : catalogue des « emplacements » de texte du site. `textes.ts` (SO, clé de service : aucune policy n'ouvre la table). `apercu-textes.ts`, `texte-riche.ts` : purs (texte riche minimal → arbre de blocs).
- Appelants : `components/accueil` (7), `components/site`, `app/system`, `app/page.tsx`, `app/p/[slug]`.
- Pièges : le public ne voit que le contenu **publié et validé** ; l'aperçu (`?apercu=1`) est réservé à l'équipe avec `contenu.editer`. Voir `docs/TEXTES-SITE.md`.
- Tests : `cache.test.mts`, `emplacements.test.mts`, `apercu-textes.test.mts`, `texteriche.test.mts`.

### commande/ — cœur de la commande (invité, restaurant, suivi)
Plus gros domaine métier (ADR-005, ADR-006, ADR-011).
- Création : `validation.ts` (pur, partagé navigateur/serveur ; contient `PRIX_MAX_GNF`), `calculs.ts` (SO : **recalcul serveur de tous les prix et totaux**, entiers uniquement), `creation-coeur.ts` (cœur indépendant de Next : reçoit un « planificateur de tâche après réponse », `after` côté site, `waitUntil` côté API), `creation-service.ts` (enveloppe du site), `creation.ts`, `actions.ts` (US : parcours invité), `jetons.ts` (identifiants et jeton de suivi), `telephone.ts`, `estimation.ts`, `mode.ts` (raccords partagés).
- Cycle de vie : `transitions.ts` (SO ; machine d'états, `contracts/statuts.ts`), `service-restaurant.ts` (SO : actions du restaurant, **un seul chemin** site + API), `actions-restaurant.ts` (US, console), `service-paiement.ts` (SO : paiement et documents côté restaurant), `propositions.ts` + `reprise.ts` (propositions révisées `order_proposals`), `annulation-client.ts` (annulation par le client tant que la commande n'est pas acceptée), `a-traiter.ts` (pur) / `a-traiter-lecture.ts` (compteur unique des commandes qui attendent), `requetes.ts` (modèles de lecture), `commun.ts` (client Supabase typé quel que soit son mode).
- Suivi : `sessionSuivi.ts` (cookie HttpOnly), `actions-session.ts` (US : actions du parcours `/suivi`), `table-memoire.ts` (mémoire navigateur du n° de table, commodité seulement).
- Appelants : `app/api` (15), `app/suivi`, `app/restaurant`, `app/restaurants`, `app/commande`, `lib/system-admin` (31 fichiers : support), `livraison`, `client`.
- Pièges : (1) prix et montants **toujours recalculés côté serveur** ; (2) montants GNF = entiers (`Number.isInteger` partout) ; (3) l'identifiant de restaurant reçu du navigateur n'autorise rien ; (4) anti-robot Turnstile et limites de débit dans `securite/` ; (5) téléphone validé par `telephone.ts`.
- Tests : `validation-commande.test.mts`, `estimation.test.mts`, `atraiter.test.mts`, `reprise.test.mts`, `annulation-client.test.mts` (statuts), `documents.test.mts` (mode) ; concurrence réelle : `npm run test:concurrence` (5.2).

### console/ — logique des consoles (confirmation, notifications, recherche)
- `confirmation.ts`, `notifications.ts`, `recherche.ts` : purs (palette de recherche rapide, fournisseurs de confirmation/toasts). Consommés par `components/console/` (`ConsoleProviders` est monté dans `app/layout.tsx`, donc aussi sur le site public).
- Tests : `console.test.mts`.

### contracts/ — contrats de données (raccords)
- `commande.ts`, `erreurs.ts` (`ErreurMetier` avec `code` et `champs`), `index.ts`, `menu.ts`, `restaurant.ts`, `statuts.ts` (transitions de commande, `transitionAutorisee`) : **tous des raccords d'une ligne** vers `packages/shared/src/contracts/`.
- Appelants : `app/api` (31), `lib/system-admin` (22), `lib/commande`.
- Tests : `paquet-partage.test.mts`, `annulation-client.test.mts`.

### db/ — clients Supabase
- `server.ts` (session, RLS), `jeton.ts` (identité d'un jeton porteur), `public.ts` (anon), `admin.ts` (**service-role, contourne la RLS**), `cookies.ts` (options des cookies de session), `lecture-complete.ts` (lecture d'une liste *par pages* : l'API plafonne à 1 000 lignes sans erreur), `database.types.ts` (types générés, ne pas éditer à la main).
- Piège : tout `.from(...).select(...)` doit être borné ou déclaré : `scripts/verifier-requetes.mjs` (5.3).
- Tests : aucun direct (à vérifier).

### decouverte/ — recherche, classement, aide au choix
- `classement.ts` (pur, classement explicable, SPEC-PILOTE §4), `recommandation.ts` (pur, voir `docs/NOTATION.md` §9), `alternatives.ts` (alternatives quand un plat est épuisé), `chiffres.ts`, `pagination.ts`, `zone-proche.ts` (quartier le plus proche d'un GPS), `recherche.ts` (SO : restaurants publiés), `signaux.ts` (SO : note, prix, fréquentation), `aide-choix.ts` (pur) / `aide-choix-service.ts` (SO) / `aide-choix-actions.ts` (US) (voir `docs/AIDE-AU-CHOIX.md`), `gamme-gestion.ts` (SO) / `gamme-actions.ts` (US) : demandes de changement de gamme.
- Appelants : `app/restaurants`, `app/aide-au-choix`, `app/system`, `components/site|notation`.
- Tests : `decouverte.test.mts`, `alternatives.test.mts`, `aide-choix.test.mts`, `recommandation.test.mts`, `pagination.test.mts`.

### design/ — petits helpers visuels
- `tuile.ts` (tuile typographique de repli quand un plat n'a pas de photo), `paletteMarque.ts` (couleurs d'accent de la personnalisation de marque).
- Tests : `tuile.test.mts`, `design.test.mts` (jetons Studio).

### disponibilite/ — fraîcheur des plats
- `etat.ts` : raccord vers le paquet partagé (disponibilité horodatée : « confirmé il y a… »).
- Appelants : `app/restaurant`, `app/system`, `app/restaurants`, `components/StampFraicheur.tsx`, `VignettePlat.tsx`.
- Tests : `decouverte.test.mts`.

### fonctionnalites/ — interrupteurs de fonctionnalités
- `lire.ts` (SO) : lecture de la table `fonctionnalites` (pilotée par le super administrateur, écran `/system/mises-a-jour`). Lue par le cadre du site : d'où `export const dynamic = "force-dynamic"` sur l'accueil.
- Tests : aucun direct.

### geographie/ — Guinée administrative
- `quartiers.ts` : région → préfecture → commune (ou sous-préfecture) → quartier ; Conakry détaillé. Pur.
- Appelants : `app/system/catalogue/geographie`, `app/restaurant`, `app/compte`, `components/geographie/SelecteurQuartier.tsx`. Outil de collecte : `scripts/geocodage-quartiers.mjs`.
- Tests : `geographie.test.mts`.

### identite/ — « un numéro, un titulaire »
- `numeros.ts` (SO) : unicité des numéros de téléphone des profils professionnels (candidatures, livreurs). Décisions de l'équipe : `system-admin/numeros-actions.ts`.

### illustrations/ — illustrations modifiables sans SVG brut
- `modele.ts` (paramètres, **jamais de SVG brut** venant de la base), `motifs.ts` (liste fermée des motifs), `automatique.ts` (choix automatique d'après un nom), `icones.generated.ts` (**généré** par `scripts/illustrations/extraire-icones.mjs` : ne pas modifier à la main, voir `docs/LICENCES-ICONES.md`).
- Appelants : `components/illustrations/*`, `app/restaurant`, `RestaurantCard`, `VignettePlat`.
- Tests : `reglages.test.mts`.

### livraison/ — livraison et livreurs
- Statuts et règles pures : `statuts.ts`, `dispatch.ts` (attribution des offres, `docs/LIVRAISON.md` §2), `frais.ts` (frais au kilomètre, entiers GNF), `code.ts` (code de remise à 4 chiffres), `mouvement.ts` (déplacement des livreurs de démonstration), `livreurs-regles.ts`, `garde-fou-speedfood.ts` (voir `docs/LIVRAISON-LIVREURS-V2.md`).
- Services SO : `service.ts` (création de la livraison quand une commande est acceptée), `apres-commande.ts` (appelé **après** la transition, jamais avant), `lecture.ts`, `estimation-service.ts` (un seul chemin site + API), `livreur.ts` (ce que voit le livreur ; **jamais** les coordonnées du client avant l'étape voulue), `livreurs-service.ts` (fiches, lien d'activation, approbation, suspension), `service-livreur.ts` (actions du livreur), `vues.ts` (jamais le code de remise), `admin-lectures.ts`, `simulation.ts` (livreurs de démonstration).
- Actions US : `actions.ts` (estimation), `actions-livreur.ts`, `actions-restaurant.ts`, `actions-activation.ts` (identité = session), `registre-restaurant.ts` (« Mes livreurs »).
- Appelants : `app/restaurant` (8), `app/api` (7), `app/system` (5), `app/livreur`, `app/suivi`, `app/commande`, `lib/notation`.
- Tests : `livraison-dispatch.test.mts`, `livraison-frais.test.mts`, `livraison-mouvement.test.mts`, `livreurs-regles.test.mts`, `garde-fou-speedfood.test.mts`, `livraison.test.mts` (zones côté site). Essai réel : `scripts/essai-livreurs-restaurant.mjs`.

### menu/ — menu du restaurant
- `service-menu.ts` (SO : lecture et modifications, un seul chemin console + `/api/v1/restaurant/menu*`), `actions.ts` (US), `regles-plat.ts` (pur : prix promo ≤ prix normal), `ouverture.ts` (menu du jour, horaires), `saisieRapide.ts` (dictée, prix en boutons, liste collée), `photo-plat.ts` (SO : photo depuis l'application), `reduireImage.ts` (**navigateur** seulement), `chefMenu.ts` (pur : lecture d'une photo de menu) + `chefIaModele.ts` (SO : accès Workers AI), voir `docs/CHEF-IA.md`.
- Piège : le quota Workers AI est par **projet** ; d'où `limiterChefIa` par restaurant.
- Tests : `menu-plat.test.mts`, `menujour.test.mts`, `saisie.test.mts`, `chefia.test.mts`.

### mouvement/ — animation « le plat vole vers le panier »
- `vol.ts` : copie ronde de la photo vers la barre de panier (navigateur). Appelant : `components/panier`. Voir `docs/MOUVEMENT-PUBLIC.md`.

### notation/ — avis et notes
- `regles.ts` (pur), `service.ts` (SO : **toutes** les écritures passent ici avec la clé de service, l'identité est vérifiée avant), `actions.ts` (US : depuis `/suivi`, le lien de suivi vient du cookie HttpOnly), `actions-gestion.ts` (US : réponse du restaurant, note sur le client), `gestion.ts` (SO : restaurant, livreur, exploitation), `lecture-publique.ts` (SO : jamais d'identifiant de compte ni de numéro), `rattachement.ts` (SO : rattache une commande passée sans compte au compte de la personne qui détient le jeton). Voir `docs/NOTATION.md`.
- Tests : `notation.test.mts`.

### paiement/ — paiement (déclaratif et en ligne)
- Racine : `regles.ts` (raccord partagé : moyens et statuts de paiement), `documents-regles.ts` (pur : reçus et factures), `documents.ts` (SO : documents d'une commande, le jeton de suivi est la clé).
- `en-ligne/` (voir `docs/PAIEMENT-ARCHITECTURE.md`) : `fournisseur.ts` (**interface unique** d'une passerelle), `chapchap.ts` (adaptateur Chap Chap Pay, `docs/CHAPCHAP-NOTES-API.md`), `simulation.ts` (passerelle de démonstration, aucun réseau), `machine.ts` (machine à états), `repartition.ts` (répartition, entiers GNF, frais de paiement arrondis au GNF supérieur), `ecritures.ts` (livre de comptes en écriture double, ajout seul), `litiges.ts` (décisions automatiques à règles objectives), `remboursement-manuel.ts` (lot L12), `signature.ts` (HMAC-SHA256), `service.ts` (orchestration), `depot-supabase.ts` (SO, clé de service : la RLS est volontairement sans accès), `fabrique.ts` (SO : assemble service + passerelle choisie dans les réglages), `suivi.ts` (SO : vue client), `actions.ts` (US, authentifiées par le jeton de suivi), `admin-lectures.ts` (SO ; numéros de compte masqués), `types.ts`.
- Appelants : `app/api/paiement/*`, `app/system/paiements|parametres/paiement`, `app/suivi`, `app/restaurant`.
- Pièges : (1) entiers GNF, aucun flottant ; (2) notification du prestataire : signature vérifiée dans `/api/paiement/notification/[fournisseur]` ; (3) l'entretien (expirations, reprise des versements) vient de la tâche planifiée ; (4) la KYC Chap Chap Pay n'est pas finie : la passerelle réelle n'est pas utilisable en production (voir mémoire « Constats API Chap Chap Pay » ; à vérifier dans `docs/STATUT-PROJET.md`).
- Tests : `paiement.test.mts`, `paiement-en-ligne.test.mts`, `paiement-service.test.mts` (dépôt en mémoire `scripts/tests/depot-memoire.ts`), `remboursement-manuel.test.mts`, `documents.test.mts`. Réel : `scripts/essai-paiement-reel.mjs`, `chapchap-essai-test.mjs`, `chapchap-lecture.mjs`.

### panier/
- `gestion.ts` (pur : lignes, quantités, totaux d'affichage ; la vérité reste le recalcul serveur), `complements.ts` (compléments proposés). Route associée : `GET /api/panier/complements`. Appelants : `components/panier`.
- Tests : `panier.test.mts`, `complements.test.mts`.

### parametres/ — paramètres globaux
- `lire.ts` (SO : table singleton `parametres_application`), `assistance.ts` (SO : contact d'assistance, validation), `assistance-format.ts` (pur, « 24 h », « 3 jours »), `promesse.ts` (SO) + `promesse-defauts.ts` (textes de l'accueil par défaut). Réglés dans `/system/parametres`.
- Tests : `reglages.test.mts`.

### partage/ — liens courts, partage, scans
- `liens.ts` (pur : partage WhatsApp, SPEC-PILOTE §3.5), `origine.ts` (SO : adresse du site, repli = production actuelle, variable `SITE_URL` si domaine définitif), `scans.ts` (sources des visites d'un lien court ; **doit rester aligné sur la fonction SQL `fn_compter_scan`**). Route : `app/r/[code]/route.ts`.
- Tests : `partage.test.mts`, `documents.test.mts`.

### push/ — notifications poussées
- Web : `vapid.ts` (pur : VAPID, RFC 8292), `envoi.ts` (SO : abonnements d'un restaurant). Natif : `fcm.ts` (pur) + `fcm-envoi.ts` (SO : compte de service `FCM_SERVICE…`, secret), `appareils.ts` (SO : appareils des applications), `annonce-version.ts` (SO : annonce de version à tous les appareils), `session.ts` (SO : refuse une requête modifiante dont l'en-tête `Origin` n'est pas le site).
- Appelants : `app/api` (7), `app/restaurant/alertes*`, `app/compte/alertes*`.
- Tests : `push.test.mts`, `fcm.test.mts`.

### referencement/ — candidatures de restaurateurs
- `candidature.ts` (pur) / `candidature-service.ts` (SO : dépôt depuis l'application, lot R1), `menu-photo.ts` (SO : photo de menu → brouillon, via Chef IA), `purge.ts` (SO : purge des refusées après `JOURS_CONSERVATION…`, appelée par la tâche planifiée).
- Appelants : `app/api/v1/candidature*`, `app/api/application/purge-candidatures`.
- Tests : `candidature.test.mts`.

### restaurant/ — réglages du restaurant (console)
- `hub.ts` (pur : tâches de l'accueil), `position.ts` (pur : deux coordonnées vont ensemble, dans la zone), `paiement.ts` (moyens de paiement déclarés, liste fermée), `vue-fiche.ts` (SO : visiteur / propriétaire / membre sur la fiche publique), `actions.ts`, `documents-actions.ts`, `illustrations.ts`, `livraison.ts`, `quartier.ts`, `zones-desservies.ts` (US : écriture par la session du membre, la RLS fait foi).
- Appelants : `app/restaurant` (9), `components/restaurant`, `app/restaurants`.
- Tests : `hub.test.mts`, `reglages.test.mts` (paiement, position).

### securite/ — limites de débit, IP, anti-robot
- `limitation-debit.ts` (SO) : une constante `LIMITE_…` par action (nom, max, fenêtre en secondes) et une fonction `limiter…()` ; clé de compteur = **empreinte HMAC** (aucune IP ni téléphone en clair). Compteur Redis si configuré, sinon `fn_limiter_debit` en base. **Si le compteur est indisponible, on laisse passer** (et on journalise le nom de la règle) plutôt que de bloquer les commandes.
- `redis-client.ts` (pipeline REST Upstash, sans dépendance), `redis-limites.ts` (pur : fenêtre fixe, quota mensuel), `ip.ts` (pur : normalisation IPv6), `turnstile.ts` (SO).
- Appelants : `app/api` (10), `lib/api`, `site`, `notation`, `commande`, `table`.
- Piège : ajouter une action publique = ajouter sa règle ici (valeurs « à ajuster avec l'usage réel du pilote », plafonds relevés après la simulation du 19/10/2026).
- Tests : `redis.test.mts`, `ip.test.mts`, `securite.test.mts`.

### site/ — pages publiques (accueil, quartiers, partenariat, zones)
- `accueil.ts` (SO : données de l'accueil et des quartiers, base publique), `rubriques.ts` (une seule liste alimente en-tête, tiroir et pied), `quartiers.ts` (identifiant d'URL sans accent), `zones.ts` (zones de recherche), `zone-position.ts` / `zone-alerte.ts` (purs), `livraison.ts` (pur) / `livraison-lecture.ts`, `partenariat.ts` (pur) / `partenariat-actions.ts` (US), `referencement.ts` (pur) / `referencement-actions.ts` (US : remplace l'inscription libre, ADR-020).
- Tests : `zone-position.test.mts`, `zone-alerte.test.mts`, `livraison.test.mts`, `partenariat.test.mts`, `referencement.test.mts`.

### storage/ — images (bucket `medias`)
- `images.ts` (SO : téléversement, bucket Storage `medias`), `chemins.ts` (chemin de stockage depuis une URL publique). Appelants : `lib/system-admin`, `referencement`, `menu`, `restaurant`. Tests : aucun direct.

### studio/ — Studio (pages à blocs, jetons de design)
Modèle par paliers (`docs/STUDIO-SUPERADMIN.md`, `STUDIO-DETTES.md`).
- Registre et validation (pur, zod) : `registre.ts` (**liste fermée des blocs**, schémas, `validerPage`, bornes `MAX_BLOCS_PAGE` 200 / `MAX_OCTETS_PAGE` 204 800), `reglages.ts` (« mode mixte »), `accueil.ts` (accueil en blocs, repli sur la page d'origine), `concurrence.ts` (jeton de concurrence du brouillon), `apres-ecriture.ts`, `editeur-donnees.ts` (Puck ↔ document), `francisation.ts` (Puck en français), `image-champ.ts`, `panneau-blocs.ts`, `possibilites.ts`.
- SO : `donnees-dynamiques.ts` (cartes et listes de restaurants, lues à *chaque* affichage), `droit-apercu.ts`, `jetons-lecture.ts` (CSS des jetons, injecté par `app/layout.tsx` via `cssJetonsSite()`), `jetons.ts` ; US : `jetons-actions.ts` (clé de service, `parametres.editer` + palier).
- Piège : les jetons de design deviennent du CSS `:root` injecté en `dangerouslySetInnerHTML` ; `cssDepuisJetons` n'émet jamais `; { } < >` et `validerValeurJeton` refuse `url()` ; **ne pas élargir sans relire `app/layout.tsx` (commentaire de `StyleJetons`)**.
- Appelants : `components/studio` (10), `app/system/contenu`, `app/p/[slug]`, `app/page.tsx`, `app/layout.tsx`.
- Tests : `studio.test.mts`, `blocs.test.mts`, `editeur.test.mts`, `accueil.test.mts`, `apresecriture.test.mts`, `design.test.mts`.

### system-admin/ — console équipe `/system` (111 fichiers)
Domaine le plus gros ; mêmes trois couches (`*-regles` pur, `*-service` SO, `*-actions` US). Grandes familles :
- **Contrôle d'accès** : `contexte.ts` (`chargerContexteSysteme`, `obtenirContexteSysteme` → 404 sans rôle, `verifierPermission`, `exigerPermissionPage`), `permissions.ts` (**matrice versionnée** `VERSION_MATRICE`, rôles `super_admin | operations | content_editor | support`, `PERMISSIONS_PAR_ROLE`, `GROUPES_SYSTEME`), `paliers.ts` / `paliers-serveur.ts` / `acces-paliers.ts` (habilitations par paliers du Studio), `roles.ts`, `navigation.ts`, `coordonnees.ts` (masquage des coordonnées clients ; la permission réelle s'écrit `coordonees.voir`, **orthographe du code, à ne pas « corriger » sans migration**). Voir `docs/MATRICE-PERMISSIONS.md`.
- **Audit** : `audit.ts` (journalisation des actions sensibles), `actionsAuditConnues.ts` (catalogue des identifiants d'action : tout nouvel identifiant y est ajouté, sinon `audit.test.mts` échoue), `journalAudit.ts`.
- **Catalogue et modération** : `restaurants.ts`, `catalogue-restaurant*.ts`, `decision-restaurant.ts`, `referencements*.ts`, `partenariats*.ts`, `liste-attente.ts`, `geographie*.ts`, `taxonomie.ts`, `doublons*.ts`, `etablissements*.ts` (lot L6), `menus*.ts` (lots L5, L8), `misesEnAvant.ts`, `classement.ts`, `aide-choix.ts`.
- **Commandes, livraison, paiements** : `commandes*.ts` (support, avec motif obligatoire et trace), `repartition*.ts` (poste de répartition, ADR-020), `quarts-*.ts` (lot L2), `supervision*.ts`, `livraisons*.ts`, `livreurs.ts`, `paie-livreurs-*.ts`, `paiements.ts`, `finances-*.ts` (lot L3), `incidents-*.ts` (lot L10), `campagnes-*.ts` (lot L11), `contacts-*.ts` (lot L7), `support-*.ts`.
- **Contenu et paramètres** : `contenus.ts`, `emplacements.ts`, `pages-blocs.ts`, `images-studio.ts`, `blocs-donnees.ts`, `accueil-blocs.ts`, `parametres.ts`, `fonctionnalites.ts`, `livraison.ts`, `annonce-version.ts`, `misesAJourCatalogue.ts`.
- **Comptes et opérations lourdes** : `comptes.ts`, `annuaire.ts`, `suppression-compte.ts`, `questions-reinitialisation.ts`, `reinitialisation.ts` + `reinitialisationRegles.ts` + `sauvegarde.ts` (remise à l'état neuf : sauvegarde complète avant, jeton à usage unique ; banc SQL `scripts/base/test-reinitialisation.mjs`).
- **Tableau de bord** : `tableauDeBord.ts`, `pilotageCalculs.ts` (pur), `couverture.ts`, `comptesTest.ts` (repère les comptes de test).
- **Versions « équipe » pour l'application** (`*-equipe-regles.ts` / `*-equipe-service.ts`) : attente, audit, comptes, contenus, menus, restaurants, consommées par `app/api/v1/equipe/*`.
- `index.ts` : point d'entrée du périmètre (bloc 8a).
- Piège général : **chaque action appelle `verifierPermission(...)` avant toute écriture** et les écritures sensibles journalisent *avant* (ex. export CSV de la liste d'attente) ; les lectures de coordonnées exigent un motif.
- Tests (règles pures) : `paliers.test.mts`, `audit.test.mts`, `audit-equipe.test.mts`, `csv.test.mts`, `decision.test.mts`, `attente-equipe.test.mts`, `comptes-equipe.test.mts`, `contenus-equipe.test.mts`, `restaurants-equipe.test.mts`, `navigation.test.mts`, `plat-regles.test.mts`, `quarts.test.mts`, `supervision.test.mts`, `finances.test.mts`, `support.test.mts`, `menus-en-masse.test.mts`, `paie-livreurs.test.mts`, `campagnes.test.mts`, `incidents.test.mts`, `menus-confirmation.test.mts`, `etablissements.test.mts`, `contacts.test.mts`, `geographie-outils.test.mts`. Les `*-service.ts` ne sont pas testés en unitaire (à vérifier cas par cas).

### table/ — commande sur place (sessions de table)
- `regles.ts`, `profils.ts` (purs, `docs/COMMANDE-SUR-PLACE.md`), `cle-calcul.ts` (pur : calcul de la clé de table) + `cle.ts` (SO : lit l'environnement ; **le QR d'une table contient une clé, pas seulement l'id public du restaurant** — revue du 19/10/2026 I-1), `service.ts` (SO, clé de service), `actions.ts` (US : convive porteur du jeton, ou membre du restaurant pour SA table).
- Appelants : `app/restaurant` (salle, tables), `app/suivi`, `app/commande`, `app/r`.
- Tests : `table.test.mts`, `profils.test.mts`, `cle-table.test.mts`.

### worker/ — micro-cache
- `microcache.ts` (pur) : `MicroCache`, `decisionCache`, `reponseConservable` ; importé directement par `worker-entree.js` (fichier `.js` qui importe du `.ts`, voir `lancer.mjs`/`microcache.test.mts` pour l'exécution sous Node). Voir 1.2.
- Tests : `microcache.test.mts`.

---

## 3. `src/app/`

### 3.1 Racine

- `layout.tsx` : charge **toutes** les feuilles CSS globales (liste en 4.2), les polices `next/font` (Manrope, Bricolage Grotesque, Barlow Condensed ; auto-hébergées), injecte `<style id="jetons-design">` (jetons du Studio, en dernier pour l'emporter sur `globals.css`), monte `ConsoleProviders`, `FichiersAnimes`, `EnregistrementServiceWorker`. `lang="fr"`, couleur de thème `#b82a20`.
- `page.tsx` : accueil (`force-dynamic` ; version en blocs si la page `accueil` est publiée, sinon page d'origine). `not-found.tsx`, `robots.ts`, `sitemap.ts`, `favicon.ico`, `SelecteurRole.tsx` (à vérifier : rôle exact).
- Les 40 feuilles `*.css` sont à plat dans `src/app/` (voir 4.2).

### 3.2 Pages publiques (site visiteur / client)

| Chemin | Rôle |
|---|---|
| `/` | Accueil. `a-propos`, `comment-ca-marche`, `conditions`, `confidentialite`, `aide`, `quartiers`, `quartiers/[slug]`, `restaurateurs`, `devenir-partenaire`, `installer` (APK), `bienvenue` : pages d'information |
| `/restaurants`, `/restaurants/[id]`, `/restaurants/[id]/alternatives` | Catalogue et fiche publique (+ `restaurants/[id]/qr/route.ts`) |
| `/aide-au-choix` | Recommandation guidée |
| `/panier`, `/commande` | Panier puis commande invitée (Server Actions de `lib/commande/actions.ts`) |
| `/suivi`, `/suivi/[jeton]`, `/suivi/recu`, `/suivi/[jeton]/recu`, `/recu/[jeton]` | Suivi de commande (cookie HttpOnly pour `/suivi`, jeton dans l'URL pour les anciens liens) et reçu |
| `/p/[slug]` | Pages éditoriales et pages à blocs du CMS (`force-dynamic`) |
| `/r/[code]` | Lien court d'un restaurant (route : compte la visite par source puis redirige) |
| `/acces`, `/entrer`, `/inscription`, `/connexion` (+ `nouveau-mot-de-passe`, `oubli`, `questions`, `verification`), `/auth/application`, `/auth/confirmation` (route), `/auth/client` (route, retour Facebook) | Entrée et authentification (`acces` : « Qui êtes-vous ? » ; `connexion` selon la piste `role=client|restaurateur`, `suite=/system…` → administration) |
| `/compte` (+ `adresses`, `avis`, `commandes`, `favoris`, `preferences`, `securite`), `compte/alertes/*` (routes) | Espace client |

### 3.3 Console restaurateur `/restaurant` et console livreur `/livreur`

- `restaurant/nouveau` (création d'établissement) ; tout le reste dans le groupe de routes **`restaurant/(console)/`** (`layout.tsx` = barre latérale sombre + barre de navigation basse sur téléphone, appelle `obtenirContexteRestaurant("/restaurant")` ; `error.tsx`, `loading.tsx`, `recap.css` local). Sous-pages : accueil, `commandes`, `menu`, `menu-du-jour`, `ouverture`, `positionnement`, `profil` (+ `livreurs`, `page-publique`, `zones`), `documents`, `avis`, `affiche`, `salle` (+ `saisie`), `tables`.
- Routes d'alerte : `restaurant/alertes` (GET, commandes à traiter), `alertes/abonnement` (POST/DELETE push web), `alertes/test` (POST).
- `livreur/page.tsx` (console du livreur, `force-dynamic`, redirige vers `/connexion?suite=/livreur` sans session ; protégée aussi par `proxy.ts`) et `livreur/activer` (activation d'une fiche par lien).

### 3.4 Console équipe `/system` (= « system »)

`system/layout.tsx` appelle `obtenirContexteSysteme()` (404 sans rôle), avec `error.tsx` et `loading.tsx`. Sections (une page par entrée) :
`/system` (tableau de bord), `acces` (`comptes`, `doublons`, `numeros`, `paliers`, `roles`), `aide-choix`, `audit`, `avis`, `campagnes`, `catalogue` (`couverture`, `geographie`, `liste-attente`, `menus`, `mises-en-avant`, `partenariats`, `referencements`, `restaurants` + `[id]` + `[id]/menu`, `taxonomie`), `commandes` (+ `[id]`), `contacts`, `contenu` (`bannieres`, `medias`, `pages` + `[id]` + `[id]/blocs`, `textes`), `design`, `etablissements`, `finances`, `livraisons` (`incidents`, `livreurs`, `paie`), `menus-confirmation`, `mises-a-jour`, `paiements`, `parametres` (`aide-choix`, `classement`, `livraison`, `paiement` + `comptes`, `reinitialisation`), `quarts` (propres `error.tsx`/`loading.tsx`), `repartition`, `supervision`. Deux exports CSV : `system/catalogue/geographie/export/route.ts`, `system/catalogue/liste-attente/export/route.ts` (permission `attente.gerer`, audit écrit avant l'export).

### 3.5 Routes `api/` (hors `v1`)

| Route | Méthode | Rôle |
|---|---|---|
| `api/paiement/notification/[fournisseur]` | POST | Notifications du prestataire de paiement (signature vérifiée) |
| `api/paiement/entretien` | POST | Entretien périodique (expirations, reprise des versements) ; appelée par le `scheduled` du Worker avec `x-entretien-secret` |
| `api/application/alertes-equipe` | POST | Alertes e-mail de l'équipe (`?action=lister\|confirmer`), même secret |
| `api/application/annonce-auto` | POST | Annonce automatique de la version publiée aux téléphones |
| `api/application/purge-candidatures` | POST | Purge quotidienne des candidatures refusées |
| `api/suivi/session` | POST | Échange du jeton (fragment d'URL) contre une session HttpOnly |
| `api/panier/complements` | GET | Compléments du panier (lecture publique) |
| `api/zone/position` | POST | Géocodage inverse (Nominatim), rien n'est enregistré |
| `api/zone/alerte` | POST | « Prévenez-moi quand un restaurant ouvre ici » (liste d'attente) |

### 3.6 Routes `api/v1/*` (contrat de l'application mobile)

Toutes : JSON sans cache, erreurs `ErreurMetier` → `repondreErreur`, authentification par jeton porteur via `src/lib/api/v1-*.ts`, limite de débit par compte. **R** = relais vers l'API possible (module entre parenthèses, voir 1.7).

Publiques / sans compte :
- `version` GET (R, `public`) : dernière version de l'APK. `aide` GET (R, `public`) : contact d'assistance. `connexion/fournisseurs` GET (R, `public`) : réseaux sociaux ouverts aux clients.
- `suivi` POST (R, `suivi`, lecture), `suivi/annuler` POST (R), `suivi/proposition` POST (R) : jeton de suivi = clé d'accès. `livraison/estimation` POST (R, `livraison`). `commandes` POST (création, délai 15 s) / GET (R, `commandes`).

Compte connecté :
- `moi` GET (R, `moi`) : espaces ouvrables (client, restaurateur, livreur, équipe). `client/espace` GET, `client/profil|adresses|favoris|compte` POST (R, `client`).
- `appareils` POST, `appareils/retirer` POST, `appareils/essai` POST : enregistrement push FCM (limite `LIMITE_APPAREIL_PAR_COMPTE`).
- `candidature` GET/POST, `candidature/image` POST (multipart), `candidature/menu-photo` POST : application « J'ai un restaurant ».

Restaurateur (`restaurantAuthentifie`) : `restaurant/commandes` GET, `…/commandes/action|paiement|document|proposition` POST, `restaurant/historique` POST, `restaurant/menu` GET, `restaurant/menu/action|photo` POST, `restaurant/statut` POST, `restaurant/reglages` GET/POST, `restaurant/activite` GET.

Livreur (`livreurAuthentifie`) : `livreur/etat` GET, `livreur/en-ligne`, `livreur/offre`, `livreur/course`, `livreur/position` POST, `livreur/gains` GET.

Équipe (`equipeAuthentifiee`, permission par route ; `equipe/moi` liste les sections ayant un écran natif) : `equipe/{moi,tableau,audit,avis,avis/moderation,bannieres,commandes,commandes/[id],commandes/[id]/statut,commandes/[id]/coordonnees,comptes,finances,liste-attente,liste-attente/prevenue,livraisons,livraisons/action,livreurs/action,medias,menus,menus/[id],menus/[id]/import,menus/[id]/photo,menus/confirmer,menus/disponibilite,mises-a-jour,paiements,parametres,partenariats,partenariats/statut,referencements,referencements/{options,statut,creer-etablissement,rattacher},repartition,repartition/action,restaurants,restaurants/[id],restaurants/[id]/profil}`. Les lectures de finances, paiements et paramètres sont en **lecture seule** depuis l'application ; la révélation d'un téléphone (`…/coordonnees`) exige un motif et écrit une trace d'audit.

Aucune route `equipe/*`, `restaurant/*`, `livreur/*`, `appareils/*`, `candidature/*` n'a de relais (état au 31/10/2026 ; à re-vérifier avec `grep relaisSiActif`).

### 3.7 Autres routes à connaître

`installer/qr` (QR de téléchargement), `restaurants/[id]/qr` (QR d'un restaurant publié), `compte/alertes/abonnement|message` (push web du client ; `message` est lu par son Service Worker), `auth/*` (voir 3.2).

---

## 4. Composants et CSS

### 4.1 `src/components/` (118 fichiers, 186 fichiers du site portent `"use client"` au total)

À la racine : cadre et navigation (`CadreSite`, `EnteteSite`, `PiedSite`, `NavigationClient`, `LienRetour`, `BanniereRestaurant`), carte et fiche (`RestaurantCard`, `VignettePlat`, `StampFraicheur`, `MenuFiltre`, `ResumePanierFiche`), boutons (`BoutonAssistance`, `BoutonFavori`, `BoutonRecommander`, `BoutonsPartage`), `ChampMotDePasse`, `Chevron`, `Turnstile`, `MemoireTable`, `AlerteCommandes` (alerte sonore), `RappelDoubleAuthentification`, `RappelMasquable`, `PageCompte`, `ListeDemarrage`, `EnregistrementServiceWorker`, `FichiersAnimes`.

Sous-dossiers : `accueil/` (sections de l'accueil, `lectures.ts`, `ApercuTextesPont`), `admin/` (squelette des consoles : `AdminNav`, `blocs`, `graphiques`, `icones`, `BarreEnregistrement`), `console/` (`ConsoleProviders`, `PaletteRecherche`, `Tiroir`, `FilAriane`), `geographie/`, `illustrations/` (`Illustration`, `EditeurIllustration`, `ornements`), `livraison/` (`CarteLivraison`), `notation/`, `panier/` (`panier.ts` = état du panier côté navigateur), `restaurant/`, `site/` (bandeaux, carrousel, `FriseSuivi`, `TexteRiche`, et `vecteurs/` : illustrations SVG dessinées à la main), `studio/` (`RenduBlocs`, `RenduPage` ; `editeur/` = intégration Puck), `ui/` (`Button`, `Input`, `Card`, `Badge`, `Alert`, `ListeChoix`, exportés par `index.ts` : composants UI partagés du bloc 3).

Règles : un composant sans `"use client"` est un Server Component ; les composants reçoivent des données déjà autorisées (aucun accès base direct dans un composant client) ; les tokens viennent du CSS, pas du JSX.

### 4.2 Feuilles CSS globales (`src/app/*.css`, ≈ 17 900 lignes au total)

Le CSS est **global** (pas de modules CSS). Ordre d'import dans `src/app/layout.tsx` : `utilitaires`, `globals`, `components`, `questions`, `landing`, `catalogue`, `notation`, `aide-choix`, `sur-place`, `installer`, `marche`, `cadre`, `public`, `public-pages`, `public-info`, `public-mouvement`, `fiche-refonte`, `controles`, `paiement`, `affiche`, `documents`, `public-segments`, `admin`, `console-resto`, `console`, `console-b`, `fantaisie`, `console-sx`, `boucles`, `vecteurs`, `decouverte-b`, `envie-b`, `cms-public`, `studio-blocs`, `studio-editeur`, `partenariat`. Importées ailleurs : `commande.css` (`app/commande/layout.tsx`), `panier.css` (`app/panier/layout.tsx`), `suivi.css` (`app/suivi/[jeton]/page.tsx`), `restaurant/(console)/recap.css`, `system/design/design.css`.

| Feuille | Portée |
|---|---|
| `globals.css` (129 l.) | **Tokens verrouillés** (`:root`) : voir 4.3 ; anneau de focus 3 px `--rouge-fonce` |
| `components.css` | Composants UI partagés (boutons, champs, cartes, badges, alertes), contraste AA, focus clavier |
| `utilitaires.css` | Classes utilitaires **générées** le 19/10/2026 depuis d'anciens `style={{…}}` (outil jetable) |
| `cadre.css`, `public*.css`, `fiche-refonte.css`, `decouverte-b.css`, `envie-b.css`, `marche.css`, `catalogue.css`, `landing.css`, `partenariat.css`, `vecteurs.css`, `boucles.css` | Site public, direction B « Marché » (décision du 4 octobre 2026, scoping `.theme-…` à vérifier), animations (`transform`/`opacity` seulement, coupées par `prefers-reduced-motion`) |
| `admin.css` (3 130 l.), `console-resto.css`, `console.css`, `console-b.css`, `console-sx.css` | Consoles : squelette `ad-*`, espace restaurateur, direction B étendue, composants `src/components/console/` |
| `cms-public.css`, `studio-blocs.css`, `studio-editeur.css` | Pages CMS, blocs, éditeur Puck (portée `.studio-editeur`, `[data-puck-entry]`) |
| `aide-choix.css`, `notation.css`, `sur-place.css`, `paiement.css`, `documents.css`, `affiche.css`, `installer.css`, `questions.css`, `controles.css`, `fantaisie.css`, `commande.css`, `panier.css`, `suivi.css` | Fonctionnalités ciblées |

### 4.3 Règles CSS et tokens

- **Tokens** (`globals.css`, verrouillés par `docs/cadrage/DESIGN-SYSTEM.md`, ne pas redéfinir ailleurs) : `--rouge #d9362b`, `--rouge-fonce #b82a20`, `--orange`, `--mangue`, `--creme`, `--surface`, `--encre`, `--secondaire #75695f` (jamais `#80736C`, contraste AA), `--bordure`, `--succes*`, `--danger*`, `--avertissement-*`, `--surface-alt`, `--desactive-*`, `--gradient-marque` (dégradé réservé à l'action principale), espacements `--space-1…8`, rayons `--radius-sm|md|lg|xl|pill`. Seul le Studio (jetons de design en base, palier 4) peut surcharger ces variables, via `<style id="jetons-design">`.
- **Règle de préfixe** (`CLAUDE.md`, cas vécu `.choix-carte`) : avant d'écrire un `className`, `grep` le nom dans les feuilles ; un nouveau nom est **préfixé par le contexte de page** (`inscription-…`, `commande-…`, `aide-choix-…`, `notation-…`, `table-…`/`salle-…`, `installer-…`, `pay-…`, `doc-…`, `ad-…` pour le squelette de console) et son style va **dans la feuille**, pas dans `style={{…}}`.
- Pas de dégradé décoratif hors bouton d'action principale ; thème clair unique (mode sombre non conçu).

---

## 5. `scripts/` et tests

### 5.1 Tests purs : `npm run test:unit` (depuis `apps/web` ou la racine)

`scripts/tests/lancer.mjs` : crée un dossier temporaire, y **copie** (via `scripts/outils/copie-tmp.mjs`) les sources `src/lib/…` listées et les `*.test.mts`, réécrit les imports (suffixe `.ts`, alias `@/`, `zod/mini`, `@speedfood/shared/…`), puis exécute chaque fichier avec Node (types effacés) en série ; code de sortie ≠ 0 si un test échoue. Il termine par `scripts/verifier-requetes.mjs` (garde-fou des volumes). Il n'y a **pas** de bibliothèque de test : chaque `.test.mts` fait ses propres assertions.

- Pour qu'un module soit testé il faut : (1) pur et sans import `server-only`/`next` ; (2) ajouté par `copier("src/lib/…")` **et** son test dans `lancer.mjs` ; (3) le nom du test ajouté à la liste finale `for (const fichier of [...])`. Un test présent dans le dossier mais absent de la liste ne tourne pas.
- Exigences de syntaxe : « types effacés » seulement (pas de paramètres-propriétés de constructeur, pas d'enum), d'où les champs explicites dans `ErreurMetier`.
- Suites (≈ 95 fichiers `*.test.mts`) : voir les « Tests » de chaque dossier en 2. Hors rapprochement par dossier : `paquet-partage.test.mts` (pureté du paquet partagé), `verifierbase.test.mts` (déduit les tables attendues des migrations, `scripts/verifier-base-sql.ts`), `version-app.test.mts` (empreinte APK), `api-v1.test.mts`.
- Piège (mémoire « Vérifier les tests par le code de sortie ») : un plantage n'écrit rien et un « ECHEC » est écrit sans accent ; **exiger code de sortie 0 + `tsc` propre**, ne pas se fier à l'absence de message.

### 5.2 Autres suites

| Commande | Fichier | Rôle |
|---|---|---|
| `npm run test:cloisonnement` | `scripts/tests/cloisonnement.mjs` | Rejoue **toutes** les migrations `supabase/migrations` sur une base jetable PGlite (en mémoire, sans Docker, sans toucher la production) via `supabase/rejeu/node_modules/@electric-sql/pglite`, puis joue des « faux comptes » (restaurateur A, B, client, admin système, anonyme). C'est ici que la RLS est prouvée. À lancer après toute migration touchant RLS ou `SECURITY DEFINER` (avec `get_advisors(type: "security")`). Voir `docs/TESTS-CLOISONNEMENT.md`. |
| `npm run test:sw` | `scripts/tests/sw-hors-ligne.test.mjs` | Service worker `public/sw.js` : écran hors connexion, réessai des 503 Cloudflare, jamais de page applicative en cache (faux environnement Node ; essai navigateur réel non fait) |
| `npm run test:concurrence` | `../../supabase/concurrence/concurrence.mjs` | Courses concurrentes sur la base (voir `docs/TESTS-CONCURRENCE.md`) ; nécessite une base : à vérifier avant de lancer |
| `npm run test:simulation` | `../../supabase/concurrence/simulation-journee.mjs` | Simulation d'une journée ; lit `apps/web/src/…` |
| `npm run test:api` (racine) | `apps/api` | Tests de l'API Hono |
| `npm run typecheck` | `tsc --noEmit` | Types (aussi à la racine, via les espaces de travail) |
| `npm run lint` | `eslint` (config Next core-web-vitals + typescript ; ignore `.next`, `.open-next`, `.wrangler`, `demo`) | Pas de règle personnalisée |

### 5.3 Garde-fous de construction

- `scripts/verifier-base.mjs` (+ partie pure `verifier-base-sql.ts`) : **avant `cf:build` / `cf:deploy`**, refuse si la base Supabase n'a pas les tables que les migrations déclarent (une migration oubliée casserait la production, p. ex. sans `acces_paliers` tous les éditeurs perdent le Studio). Dernière mesure documentée : 84 tables lues. Lecture seule ; demande les variables d'environnement du projet (non affichées ici).
- `scripts/verifier-requetes.mjs` + `scripts/requetes-non-bornees.json` : toute lecture `.from("t").select(...)` doit avoir `.limit(`, `.range(`, `.maybeSingle(`, `.single(` ou être **déclarée** dans le JSON (`fichier`, `table`, `raison`). Lancé à la fin de `test:unit`. Ajouter une lecture sans borne = ajouter son entrée justifiée.

### 5.4 Scripts d'essai, d'exploitation et de génération

Ne lancer ceux qui touchent la vraie base ou un prestataire qu'en connaissance de cause (clés lues dans `.env.local`, jamais affichées ; aucun déploiement ni coût sans feu vert de Malika).

- Essais sur la **vraie base** : `essai-livreurs-restaurant.mjs` (liens d'activation des livreurs), `essai-paiement-reel.mjs` (paiement en ligne avec fournisseur de démonstration et commandes de test), `essai-repartition.mjs` (poste de répartition), `parcours-client-test.mjs` (données de test attachées à un vrai compte client, effaçables avec `nettoyer`).
- Chap Chap Pay : `chapchap-lecture.mjs` (lecture seule), `chapchap-essai-test.mjs` (mode test, 3 000 GNF minimum).
- Données : `export/exporter.mjs` (`npm run export:donnees`, export complet, pas de sauvegarde automatique sur l'offre gratuite ; `docs/RUNBOOK-EXPORT.md`), `export/verifier-restauration.mjs` (`npm run export:verifier`, rejoue sur PGlite), `export/lancer-export.cmd`, `base/test-reinitialisation.mjs` (banc SQL de la réinitialisation, PGlite, nécessite `npm i @electric-sql/pglite` dans un dossier temporaire).
- Génération : `generer-icones.mjs` (icônes de l'application installable depuis `public/logo-speedfood.webp`, `sharp`), `illustrations/extraire-icones.mjs` (→ `lib/illustrations/icones.generated.ts`), `empreinte-apk.mjs` (après avoir copié l'APK signée dans `public/speedfood.apk`), `geocodage-quartiers.mjs` (OpenStreetMap, 1 requête/s), `deplacer-vers-partage.mjs`, `outils/copie-tmp.mjs`.
- Divers : `simulation-economie-revente.mjs` (hypothèses, pas des mesures), `surveillance/verifier-disponibilite.ps1` + `installer-tache.ps1` (surveillance de disponibilité sur le poste de la propriétaire, `docs/SURVEILLANCE.md`).

### 5.5 Construction et déploiement

`npm run dev` (serveur local ; `next.config.ts` initialise les bindings Cloudflare **uniquement en développement**, sinon `next build` ouvrirait une session distante pour le binding `AI` et exigerait `CLOUDFLARE_API_TOKEN`) · `npm run build` (Next seul) · `npm run cf:build` (= `verifier-base` + `opennextjs-cloudflare build`, **sans déployer**) · `npm run cf:preview` · `npm run cf:deploy` (**feu vert explicite de Malika requis**). En-têtes de sécurité (CSP, HSTS, `X-Frame-Options`, `Permissions-Policy`) : `next.config.ts` ; la CSP autorise Turnstile et le projet Supabase : toute nouvelle origine externe doit y être ajoutée. `serverActions.bodySizeLimit` = 6 mb.

---

## 6. Conventions de code (vérifiées dans le code)

- **Langue** : commentaires, messages d'erreur, noms de fonctions et de variables métier **en français sans accents dans les identifiants** (`creerClientAdmin`, `obtenirContexteSysteme`, `limiterAppareil`, `repondreErreur`) ; seule exception relevée : `clientTypé` dans `system-admin/referencements-service.ts` (identifiant accentué, à ne pas imiter). Termes techniques anglais conservés (`server-only`, `Props`, `route`, `hook`…). Les identifiants de base (tables, colonnes) sont en français ou en anglais selon l'historique (`orders`, `order_proposals`, `client_profils`, `restaurant_scans`, `acces_paliers`, `parametres_application`) : lire la migration.
- **Fichiers** : en majorité kebab-case (`creation-coeur.ts`) ; quelques camelCase historiques (`sessionSuivi.ts`, `chefMenu.ts`, `paletteMarque.ts`, `actionsAuditConnues.ts`, `misesAJourCatalogue.ts`). Composants React en PascalCase français (`EnteteSite.tsx`). Suffixes : `-regles` (pur), `-service` (SO), `-actions`/`actions.ts` (US), `-lecture` (lectures), `.generated.ts` (généré).
- **En-têtes** : presque chaque fichier commence par un bloc `/** … */` qui dit le *pourquoi*, cite le document (`docs/…`, ADR, TDR §), la date d'un incident vécu et le lot (`lot L5`, `palier 3`). Les fichiers purs affichent « Pur, sans dépendance : testable seul (npm run test:unit) ». **Conserver ce style** et dater les décisions.
- **Montants** : GNF en **entiers**, jamais en flottant (`Number.isInteger`, arrondi au GNF supérieur pour les frais) ; prix maximum `PRIX_MAX_GNF`.
- **Erreurs** : `ErreurMetier(code, message, champs?)` (paquet partagé) ; les routes `/api/v1` la traduisent via `repondreErreur`.
- **Sécurité** : jamais de secret dans le code, les logs ou les commits ; le message de journal ne contient ni secret ni adresse (cf. `relais_mal_configure`) ; aucune IP ni téléphone en clair dans les compteurs ; `server-only` en tête de tout fichier qui lit l'environnement ou la clé de service.
- **Base** : toute migration appliquée a son fichier dans `../../supabase/migrations/` dans le même commit ; policies réservées aux membres `to authenticated` ; avant d'écrire dans une table, lire ses contraintes.
- **Next 16** : `proxy.ts`, pas `middleware.ts` ; vérifier `node_modules/next/dist/docs/` (racine) avant de s'appuyer sur un souvenir.
- **Dates dans les commentaires** : format « 19 octobre 2026 » ; le dépôt est daté de l'automne 2026.

---

## 7. Pièges transverses (résumé)

1. Un identifiant (restaurant, commande) venu du navigateur n'est **jamais** une autorisation : vérifier côté serveur ou par RLS ; la clé de service ne s'emploie qu'après vérification.
2. Une page `/restaurant` ou `/system` doit refaire son contrôle ; ne pas compter sur `proxy.ts`.
3. Le CSS est global : préfixer, ne pas réutiliser de nom existant.
4. Une valeur qui enfreint une contrainte de table fait échouer toute l'insertion en silence (profil client, cas du 10/10/2026).
5. Toute lecture de liste doit être bornée (1 000 lignes max côté API) : `lecture-complete.ts` ou déclaration dans `requetes-non-bornees.json`.
6. Ajouter un test pur = l'inscrire dans `lancer.mjs` (copie du module + du test + liste finale).
7. Ne pas allumer le relais (`API_RELAIS`) ni déployer (`cf:deploy`, API) sans feu vert de Malika ; ne rien afficher de `.env*`, `.dev.vars`, secrets.
8. Charge : le Worker du plan gratuit échoue dès quelques visiteurs simultanés sans le micro-cache ; ne pas introduire de calcul lourd par requête publique.
9. Après toute migration RLS / `SECURITY DEFINER` : `get_advisors(type: "security")` et `test:cloisonnement`.
10. En cas de contradiction document / code : ne pas trancher en silence, le signaler (`STATUT-PROJET.md`, ADR-011, `DESIGN-SYSTEM.md` §0 décrivent l'application réelle).

### Points à vérifier (non confirmés lors de cette cartographie)

- Rôle exact de `src/app/SelecteurRole.tsx` (fichier à la racine de `app/`).
- Portée exacte des classes `.theme-…` du site public (mentionnée dans `public-pages.css`) et lien avec `layout.tsx`.
- État réel de la passerelle Chap Chap Pay en production (KYC) : `docs/STATUT-PROJET.md`.
- Prérequis de `test:concurrence` et `test:simulation` (connexion à une base).
- Couverture de tests des fichiers `*-service.ts` et `*-actions.ts` (non importés par `lancer.mjs`).
- Nombre exact de suites listées dans la boucle finale de `lancer.mjs` (la liste est tronquée à la lecture) ; ≈ 95 fichiers `*.test.mts` présents.
