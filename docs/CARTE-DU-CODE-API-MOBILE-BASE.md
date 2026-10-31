# Carte du code : API, paquet partagé, application mobile, base de données, contrôle automatique, démo (31 octobre 2026)

But : permettre à un agent qui reprend le projet sans historique de savoir **où est quoi** hors du site `apps/web/`. Document de navigation, pas de spécification. Pour l'état et les décisions : `docs/PASSATION.md`, `docs/REPRISE-SESSION.md`, `docs/STATUT-PROJET.md`, `docs/API-UNIQUE.md`. Pour la cible : `docs/specs/2026-10-30-architecture-cible-design.md`. Pour la répartition des dossiers : `docs/ORGANISATION-DU-DEPOT.md`.

Convention : « à vérifier » = lu dans le code ou un document, mais non exécuté ni confirmé pendant la rédaction. Tous les chemins sont relatifs à la racine du dépôt. Aucun fichier `.env*`, `.dev.vars` ou secret n'a été lu pour écrire cette carte.

Sommaire : A. `apps/api/` ; B. `packages/shared/` ; C. `mobile/` ; D. `supabase/` ; E. `.github/workflows/controles.yml` ; F. `demo/` ; G. pièges et points « à vérifier ».

---

## Vue d'ensemble : qui parle à qui

```
Application mobile (Kotlin)  ──HTTPS──►  Site Next.js (Worker « speedfood-app », apps/web)
                                           │  /api/v1/*  (routes du site)
                                           │  relais (éteint ou partiel) : relaisSiActif(...) dans chaque gestionnaire
                                           ▼
                                        API Hono (Worker « speedfood-api », apps/api)
                                           │  réutilise les services du site via l'alias « @/* » (apps/web/src)
                                           ▼
                                        Supabase (Postgres + RLS, supabase/migrations)
Paquet partagé : packages/shared (règles pures) ← importé par apps/web, apps/api (et plus tard l'application)
```

- L'application mobile Kotlin appelle aujourd'hui **le site** (`config.siteUrl`, `…/api/v1/<chemin>`), pas l'API directement. L'API ne reçoit du trafic que par le **relais** du site (variable `API_RELAIS`).
- L'API est en production pour `public,moi,client,livraison` (31 octobre 2026) ; les modules `suivi` et `commandes` (étape 1c-1) sont écrits et testés en local, **non déployés, relais éteint** (`docs/API-UNIQUE.md`). Ne jamais allumer le relais ni déployer sans feu vert de Malika ; ne jamais mettre `API_RELAIS=tout`.
- Un dossier `apps/mobile/` est cité dans le README du paquet partagé comme futur consommateur (React Native) : **il n'existe pas** dans le dépôt. L'application actuelle est `mobile/` (Kotlin Multiplatform), non déplacée.

---

## A. `apps/api/` : l'API unique (Hono sur Cloudflare Workers)

Paquet npm `@speedfood/api` (`apps/api/package.json`), dépendances : `hono 4.13.14`, `jose 6.2.14`, `@speedfood/shared`; dev : `esbuild 0.25.4`, `wrangler ^4.142.0`, `typescript ^5`, `@types/node ^20`. `"type": "module"`. TypeScript exécuté tel quel par Node (`--experimental-strip-types`) : **les imports relatifs de l'API portent l'extension `.ts`** (voir le hook de résolution plus bas).

### A.1 Arborescence et rôle de chaque fichier de `apps/api/src/`

| Fichier | Rôle |
|---|---|
| `src/app.ts` | `creerApp(deps)` : construit l'application Hono. (1) premier maillon `app.use("*")` : calcule les en-têtes « de confiance » (`enteteRelaisDeConfiance`) et exécute la suite dans `entetesCourants.run(...)` (AsyncLocalStorage de la cale `next/headers`) ; (2) `GET /sante` → `{ ok: true }`, `Cache-Control: no-store` ; (3) monte huit sous-routeurs ; (4) `notFound` → 404 `INTROUVABLE` « Route inconnue. » ; (5) `onError` → `ErreurMetier` rendue au contrat, tout le reste → 500 `ERREUR_SERVEUR` « Réessayez dans un instant. » (journal `api_erreur_non_geree` avec le seul nom d'erreur, jamais le message). Réexporte `reponseErreur`. |
| `src/worker.ts` | **Câblage de production** : importe les services du site (alias `@/lib/...`) et les branche dans `Deps`. Exporte `{ fetch: (requete, env, ctx) => app.fetch(requete, env, ctx) }` (le `ctx` est transmis explicitement, sinon `c.executionCtx.waitUntil` lèverait). Détail en A.4. |
| `src/types.ts` | Interface `Deps` (tout ce que les routes ont le droit d'appeler : `version`, `lireAssistance`, `connexionClientActive`, `verificateurs {strict, local}`, `limiterClientApplication`, `lireRoles`, `client {...5 méthodes}`, `estimerPourClient`, `secretRelais`, `suivi {...7}`, `commandes {valider, creer, lister}`). Types `ResultatEspace`, `RolesCompte`, `Planifier` (réexporté depuis `apps/web/src/lib/commande/creation-coeur`). Dans les tests, `Deps` est remplacé par de fausses valeurs. |
| `src/http.ts` | `repondre(c, corps, statut)` (JSON + `Cache-Control: no-store`), `reponseErreur(c, erreur)` (contrat `{ ok:false, erreur:{code,message} }`, statut dérivé par `statutHttp`), `lireCorpsJson(c)` (exige `application/json`, refuse `content-length` trop gros, JSON illisible → 400 `VALIDATION` ; mêmes messages que `lireCorpsJson` du site). |
| `src/controles/chaine.ts` | Les trois briques de la chaîne de contrôles (voir A.3) : `limiterParRequete`, `identifier`, `limiterParCompte`, plus le type `Variables = { utilisateurId: string }`. |
| `src/identite/jeton.ts` | Vérification des jetons Supabase : `verifierJetonLocal` / `creerVerificateurLocal` (ES256 + JWKS), `creerVerificateurStrict` (`auth.getUser`), `configJetonSupabase`. Détail en A.3. |
| `src/identite/relais.ts` | Confiance dans l'adresse transmise par le site : `enteteRelaisDeConfiance`, `SECRET_RELAIS_VALIDE` (`/^[\x21-\x7E]{32,}$/`), `adresseRelaisPlausible`. Comparaison à temps constant sur des empreintes SHA-256 (Web Crypto). |
| `src/cales/next-headers.ts` | Cale de `next/headers` : `entetesCourants` (AsyncLocalStorage) et `headers()` qui rend les en-têtes de la requête en cours (lève hors requête). Utilisée par la limitation de débit du site pour lire l'adresse du visiteur. |
| `src/cales/vide.ts` | Module vide qui remplace `server-only` (le marqueur n'a de sens que pour le navigateur). |
| `src/routes/version.ts` | `GET /api/v1/version` : `VERSION_APPLICATION`, `Cache-Control: public, max-age=300`. Sans jeton. |
| `src/routes/aide.ts` | `GET /api/v1/aide` : `lireAssistance()` → `{ whatsapp }`, cache public 300 s. Sans jeton. |
| `src/routes/fournisseurs.ts` | `GET /api/v1/connexion/fournisseurs` : `connexionClientActive()` ; en cas d'erreur de lecture rend `facebook:false` (jamais une erreur). Cache public 60 s. |
| `src/routes/moi.ts` | `GET /api/v1/moi` : `identifier(strict)` puis `limiterParCompte(limiterClientApplication)` sur `"*"`, puis `lireRoles` → `{ ok, roles }`. |
| `src/routes/client.ts` | Espace client : `GET /espace`, et quatre écritures POST de même forme (`/favoris`, `/profil`, `/adresses`, `/compte`). Identité stricte + plafond de compte sur `"*"`. Le compte vient du jeton, jamais du corps ; erreur du service → 400 `VALIDATION` portant son message. |
| `src/routes/estimation.ts` | `POST /api/v1/livraison/estimation` : identité stricte avec message « Connectez-vous pour calculer la livraison. », **pas de plafond de compte** (parité avec le site), service `estimerPourClient`. |
| `src/routes/suivi.ts` | Suivi sans identité : `POST /` (lecture), `POST /annuler`, `POST /proposition`. Le jeton de suivi (40 caractères) est dans le **corps** ; ordre : corps JSON → forme du jeton (`jetonValide`) → plafond propre à la route → service. 429 relayé, autre panne du plafond → 500. Réponse `no-store`. |
| `src/routes/commandes.ts` | `GET /` (liste du compte, avec jetons de suivi) et `POST /` (création). Identité **stricte posée par méthode** (`route.get(path, identifier(...), ...)`), jamais sur `"*"` : une méthode inconnue répond 404 sans appel réseau (décision D6). POST : identité → corps JSON → refus de `mode: "sur_place"` → `valider` → `creer(..., apres)` avec `apres = (t) => c.executionCtx.waitUntil(t())` → `201` (nouvelle) ou `200` (`idempotent`). |

Montage dans `app.ts` : `/api/v1/version`, `/aide`, `/connexion/fournisseurs`, `/moi`, `/client`, `/livraison/estimation`, `/suivi`, `/commandes` (+ `/sante`), soit dix routes `/api/v1/*` à l'étape 1b et quinze gestionnaires avec les cinq de l'étape 1c-1 (3 de suivi + GET et POST commandes). Les tableaux route par route (méthode, jeton, cache, service du site) sont dans `docs/API-UNIQUE.md` : ne pas les dupliquer ici.

### A.2 Fichiers hors `src/`

| Fichier | Rôle |
|---|---|
| `apps/api/build.mjs` | Assemblage esbuild + garde « aucun Next ». Voir A.5. |
| `apps/api/wrangler.jsonc` | Worker `speedfood-api` ; voir A.8. |
| `apps/api/tsconfig.json` | Résout l'alias `@/*` vers `apps/web/src` (à vérifier : contenu exact non relu) ; utilisé aussi par esbuild (`tsconfig:` de `build.mjs`). |
| `apps/api/sondes/services.ts` | « Sonde » : réexporte les services du site utilisés par l'API (`creerClientAdmin`, `limiterClientApplication`, `lireRolesCompte`, `estimerPourClient`, `connexionClientActive`, espace client, et pour 1c : `executerCreationCoeur`, `validerCreationCommande`, `listerMesCommandes`, `estJetonValide`, `chargerSuiviParJeton`, `annulerParClient`, `repondreProposition`, trois limiteurs). Sert uniquement à prouver à la construction qu'ils tiennent sans Next.js. |
| `apps/api/sondes/interdit.ts` | Sonde **volontairement fautive** (`export { NextResponse } from "next/server"`, `@ts-nocheck`) : prouve dans un test que la garde se déclenche. Jamais importée par le Worker. |
| `apps/api/dist/worker.js` | Sortie de `npm run build` (ignorée par Git, à vérifier dans `.gitignore`). `no_bundle` : wrangler sert `dist` tel quel, donc **toujours reconstruire avant `wrangler dev` ou déploiement**. |
| `apps/api/.dev.vars`, `apps/api/.wrangler/` | Locaux, ignorés par Git. `.dev.vars` contient la clé de service de production : **ne jamais le lire ni l'afficher** ; Malika le supprime après les essais. |

### A.3 Chaîne de middlewares et modes de jeton

Ordre voulu (design §5), chaque brique court-circuite les suivantes (`src/controles/chaine.ts`) :

1. `limiterParRequete(limiter)` : plafond **par adresse**, avant toute identité (le code du site lève `TROP_DE_REQUETES` → 429 via `onError`). Brique testée et exportée ; **à vérifier** : aucune route de `src/routes/` ne l'utilise explicitement aujourd'hui (le plafond par adresse est appliqué par les services du site eux-mêmes, par exemple `limiterLectureSuivi`, `limiterCreationCommande`).
2. `identifier(verificateur, message?)` : lit le jeton porteur (`lireBearer`, de `packages/shared/src/api/v1-regles.ts`) **uniquement** dans `Authorization: Bearer` (les cookies du site ne sont jamais lus) ; jeton absent ou refusé → `ErreurMetier("NON_AUTHENTIFIE", message)` (401) ; sinon `c.set("utilisateurId", ...)`.
3. `limiterParCompte(limiter)` : plafond **par compte** après identité (`limiterClientApplication`), le compte venant du jeton vérifié.

Utilisation réelle : `moi` et `client` = `identifier(strict)` + `limiterParCompte` sur `"*"` ; `estimation` = `identifier(strict, message propre)` sans plafond ; `commandes` = `identifier(strict)` par méthode sans plafond de compte ; `suivi`, `version`, `aide`, `fournisseurs` = aucune identité. Restent pour les plans suivants : droits par rôle/restaurant (livreur, restaurateur, équipe), validation, audit.

**Deux modes de jeton** (décision de Malika du 31 octobre 2026 : mixte, strict par défaut), fournis par `Deps.verificateurs` :

- **strict** (`creerVerificateurStrict(() => creerClientAdmin())`) : `auth.getUser(jeton)` à chaque appel. Compte supprimé/banni refusé tout de suite. Erreur 4xx → `null` (401) **sauf 408 et 429** qui lèvent (panne → 500, pas de fausse déconnexion). Panne réseau/5xx → lève. **Toutes les routes de l'API actuelle sont strictes.**
- **local** (`creerVerificateurLocal(configJetonSupabase(url))` / `verifierJetonLocal`) : signature **ES256 uniquement**, émetteur `<url Supabase>/auth/v1`, audience `authenticated`, expiration, `sub` non vide ; clés publiques lues via `createRemoteJWKSet` (cache 10 min, cooldown 30 s). Les classes d'erreur de `jose` qui désignent un jeton invalide → `null` ; toute autre (clés injoignables) → exception → 500. Compromis : un compte supprimé reste accepté jusqu'à l'expiration (~1 h). Prévu pour la position du livreur et la relecture fréquente (plan 1c-2) ; câblé dans `worker.ts` mais **aucune route ne l'utilise**. Réserve 8 : le `?? ""` sur `NEXT_PUBLIC_SUPABASE_URL` du mode local est à traiter au plan 1c.

### A.4 Câblage des services du site dans `src/worker.ts`

- Principe : les routes ne contiennent aucune règle métier ; `worker.ts` passe à `creerApp` les **fonctions du site** (`apps/web/src/lib/...`) : `lireReglagesAssistance` (parametres/assistance), `connexionClientActive` (client/reglage), `lireRolesCompte` (api/moi-service), `creerClientAdmin` (db/admin), limiteurs `limiterClientApplication`, `limiterLectureSuivi`, `limiterAnnulationClient`, `limiterReponseProposition` (securite/limitation-debit), `estJetonValide` (commande/jetons), `chargerSuiviParJeton` (commande/requetes), `annulerParClient` (commande/annulation-client), `repondreProposition` (commande/propositions), `validerCreationCommande` (commande/validation), `executerCreationCoeur` (commande/creation-coeur), `listerMesCommandes` (client/mes-commandes), cinq fonctions de client/espace-service, `estimerPourClient` (livraison/estimation-service).
- **Secrets lus à l'appel, jamais au chargement du module** : `secretRelais: () => process.env.RELAIS_SECRET`, `local: (jeton) => { local ??= creer...(configJetonSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")); ... }`. Le test statique `apps/api/tests/worker-source.test.ts` échoue si `process.env` est lu hors d'une fonction fléchée (et refuse une fonction fléchée appelée aussitôt).
- Création de commande : `creer: (valeurs, utilisateurId, apres) => executerCreationCoeur(valeurs, utilisateurId, { antiRobot: false, apres })`. `antiRobot: false` (l'application native ne produit pas de jeton Turnstile ; la protection = jeton porteur strict + plafonds de `limiterCreationCommande`) est **figé par un test statique**. `lister: (id) => listerMesCommandes(id, { avecJeton: true })`.
- Coupure côté site : `apps/web/src/lib/commande/creation-coeur.ts` (sans Next) exporte `executerCreationCoeur` ; `creation-service.ts` garde son nom et lui passe `after` de `next/server`. C'est ce qui a permis d'enlever 54 fichiers de Next du paquet.
- Variables lues par les services au runtime (noms seulement) : `NEXT_PUBLIC_SUPABASE_URL` (aussi en `vars` publiques), `SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET` (repli silencieux sur la clé de service : piège décrit dans `docs/API-UNIQUE.md`), `RELAIS_SECRET`, et la configuration Redis/Upstash de la limitation de débit (noms exacts : à vérifier dans `apps/web/src/lib/securite/limitation-debit.ts`).
- Particularité `process.env` : suppose `nodejs_compat` (voir `wrangler.jsonc`) ; que les secrets apparaissent bien dans `process.env` sous workerd en production est **supposé, non prouvé** (`docs/API-UNIQUE.md`, « Ce qui n'est PAS vérifié »).

### A.5 `build.mjs` et la garde « aucun Next »

- `construire({ entree, sortie })` appelle esbuild : `bundle`, `format: "esm"`, `platform: "neutral"`, `target: "es2022"`, `mainFields: ["module","main"]`, `conditions: ["workerd","worker","browser","import"]`, `external: ["node:*","cloudflare:*"]`, `alias: { "server-only" → src/cales/vide.ts, "next/headers" → src/cales/next-headers.ts }`, `tsconfig` de l'API, `metafile: true`.
- Garde : liste les entrées du metafile et compare à `INTERDITS` = `node_modules/next/`, `@opennextjs/`, `react-dom/`, `@next/`, `styled-jsx/`. Si une correspond, `npm run build` affiche « ECHEC : des fichiers de Next.js sont entrés dans le paquet de l'API » et sort avec le code 1. `react` seul n'est pas interdit (il entre par `fonctionnalites/lire.ts`).
- Lancé directement (`node build.mjs`) : écrit `dist/worker.js` et affiche sa taille. Importé par les tests (`construire` retourne `{ metafile, octets, interdits }`). Taille de référence au 31 octobre 2026 après 1c-1 : 1 193 032 octets (1 165 Kio), ~232 Kio en gzip.

### A.6 `apps/api/scripts/`

| Fichier | Rôle |
|---|---|
| `scripts/comparer-routes.mjs` | Commande `npm run comparer -- [options] <urlRéférence> <urlCandidate> <chemin…>`. Analyse les options : `--tolerer-non-2xx`, `--jeton-env NOM`, `--methode`, `--autoriser-ecriture`, `--corps JSON` ou `--corps-env NOM` (exclusifs). Gardes : adresses `https` ou boucle locale (`localhost`, `127.0.0.1`, `[::1]`), jeton/corps secret lus dans l'environnement et jamais affichés, toute écriture refusée sans `--autoriser-ecriture`. Codes de sortie : 0 aucun écart, 1 écarts, 2 usage/erreur (utilise `process.exitCode`, pas `process.exit`, à cause d'un plantage sous Windows). Sous Git Bash, préfixer `MSYS_NO_PATHCONV=1`. |
| `scripts/comparateur.mjs` | Fonction pure `comparerRoutes(base1, base2, chemins, envoyer = fetch, options)` : compare statut, type de contenu, `cache-control` et corps JSON (**clés triées**, donc l'ordre des clés est ignoré). Une réponse hors 2xx est un écart sauf `tolererNon2xx`. Ne met jamais un corps ni un en-tête d'identité dans un message d'écart. |
| `scripts/test-jeton-reel.mjs` | Parité avec un **vrai jeton** contre la production (`SITE`/`API` en dur, `*.moelohimmara.workers.dev`) : le mot de passe est saisi par la personne (masqué, jamais écrit), le jeton reste en mémoire et part au comparateur par variable d'environnement. Lit `apps/web/.env.local` pour les valeurs publiques (à vérifier : le chemin `..\..\web\.env.local` dans le script vise `apps/web`). À lancer **avec Malika**, pas par un agent seul. |
| `scripts/preparer-dev-vars.mjs` | Écrit `apps/api/.dev.vars` (ignoré par Git) depuis `apps/web/.env.local`, en ne reprenant que `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET` ; n'affiche que les **noms** repris/manquants. |
| `scripts/enregistrer-resolveur.mjs` + `scripts/resolveur-ts.mjs` | Hook Node (`register`) chargé par `--import` dans `npm test` : un import relatif **sans extension** venu d'un fichier `.ts` (les règles partagées s'écrivent ainsi pour Next) retombe sur `<spécifieur>.ts`. |

### A.7 `apps/api/tests/` (224 tests au 31 octobre 2026 selon `docs/API-UNIQUE.md`)

Lancement : `npm run test` dans `apps/api` (ou `npm run test:api` à la racine) = `node --experimental-strip-types --import ./scripts/enregistrer-resolveur.mjs --test "tests/**/*.test.ts"`. Node 24 en local ; 22 sur GitHub. Chaque test fournit de fausses dépendances via `tests/deps-essai.ts` (`depsEssai(surcharge)` : tout échoue bruyamment par défaut ; `ctxEssai()` : faux `ExecutionContext` qui compte les `waitUntil`).

| Fichier | Couvre |
|---|---|
| `tests/deps-essai.ts` | Aide (pas un test) : fausses `Deps` et faux contexte d'exécution. |
| `tests/app.test.ts` | `/sante` sans cache ; route inconnue → `INTROUVABLE` au contrat ; erreur non prévue → `ERREUR_SERVEUR` sans fuite ; cale `next/headers` (hors requête lève ; deux requêtes concurrentes isolées) ; le contexte d'exécution atteint la route. |
| `tests/chaine.test.ts` | Ordre et court-circuit des trois briques ; 429 par adresse avant identité ; 401 sans jeton ou jeton mal formé sans interroger le vérificateur ; cookies jamais pris pour un jeton ; panne du compteur ou du vérificateur → 500. |
| `tests/jeton.test.ts` | Vérificateur local (valide, expiré, mauvaise clé, mauvais émetteur/audience, `sub` absent, `alg none`, liste blanche d'algorithmes, panne JWKS → exception) et strict (4xx → `null`, 408/429/5xx → exception). |
| `tests/relais.test.ts` | Confiance dans `x-relais-ip` : bon/mauvais secret, secret non posé, secret < 32 caractères ou hors ASCII visible, adresse mal formée, en-têtes de relais jamais visibles par les routes, secret absent de toute réponse, cale voit l'adresse d'origine. |
| `tests/http.test.ts` | `repondre`, `lireCorpsJson` (type de contenu, taille, JSON illisible, valeur non objet). |
| `tests/routes.test.ts` | `version` (corps et cache identiques au site), `aide` (avec et sans WhatsApp), montage des cinq gestionnaires 1c, seul GET accepté sur les routes publiques. |
| `tests/fournisseurs.test.ts` | Facebook ouvert/fermé, cache 60 s, erreur de lecture → fermé. |
| `tests/moi.test.ts` | Identité stricte, plafond, rôles, pannes (500 jamais 401), compte sans rôle. |
| `tests/client.test.ts` | Espace (GET) et quatre écritures : identité du jeton jamais du corps, 401, plafond avant lecture du corps, corps non JSON. |
| `tests/estimation.test.ts` | Estimation : trois champs transmis, message d'identité propre, corps non JSON, pas de plafond de compte. |
| `tests/suivi.test.ts` | Trois routes de suivi : forme du jeton, plafonds (429), pannes, 404 « Commande introuvable. », **aucun jeton dans les journaux**. |
| `tests/commandes.test.ts` | GET/POST commandes : identité stricte seule, aucun plafond de compte, 201 vs 200 idempotent, `sur_place` refusé, pannes (500), méthode inconnue → 404 sans appel réseau, jetons absents des journaux. |
| `tests/creation-coeur.test.ts` | `executerCreationCoeur` (site) : alerte du restaurant planifiée une seule fois pour une commande nouvelle, jamais pour un rejeu ni après un refus, panne de l'alerte avalée. |
| `tests/comparateur.test.ts` | Comparateur et script `comparer-routes.mjs` : écarts nommés, tolérance, options envoyées aux deux côtés, gardes (https, hôtes, écriture), `--corps-env` (variable absente/vide, JSON illisible, exclusion avec `--corps`), aucun secret affiché. |
| `tests/construction.test.ts` | Construit réellement le Worker de production : aucun fichier de Next, plafonds de taille (brut < 1 400 000 octets, gzip < 3 Mio), sondes de services et de 1c construites, et **la garde mord** (la sonde `interdit.ts` est détectée). |
| `tests/worker-source.test.ts` | **Tests statiques du source de `worker.ts`** (aucun test n'exécute `worker.ts`) : lecture de `process.env` seulement dans une fonction fléchée ; chaque clé de `Deps` câblée sur le bon service du site ; `secretRelais` fourni par une fonction ; `antiRobot: false` figé ; plus aucune dépendance « non câblé » ; `ctx` transmis à `app.fetch`. |

Tests côté site liés à l'API : `apps/web/scripts/tests/relais.test.mts` (décision pure `decisionRelais`), `apps/web/scripts/tests/gardes-relais.test.mts` (les quinze gestionnaires appellent `relaisSiActif` en première instruction, avec le bon module et les bonnes options), `apps/web/scripts/tests/paquet-partage.test.mts` (pureté de `packages/shared`).

### A.8 `wrangler.jsonc`

- `name: "speedfood-api"`, `main: "dist/worker.js"`, `no_bundle: true`.
- `compatibility_date: "2026-09-27"`, `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`.
- `vars`: seulement `NEXT_PUBLIC_SUPABASE_URL` (publique). **Aucun secret dans ce fichier** : clés de service, `COMMANDE_JETON_SECRET`, `RELAIS_SECRET`, Redis se posent avec `wrangler secret put` (par Malika). `observability.enabled: true`.
- Déploiement = geste manuel avec feu vert de Malika (`npm run build` d'abord). Retour complet : `npx wrangler delete --name speedfood-api` depuis `apps/api`.

### A.9 Commandes de l'API

| Commande | Où | Effet |
|---|---|---|
| `npm install` | racine | espaces de travail npm (verrou unique `package-lock.json`) |
| `npm run test:api` / `npm run test` | racine / `apps/api` | tests ci-dessus |
| `npm run build:api` / `npm run build` | racine / `apps/api` | `dist/worker.js` + garde |
| `npm run typecheck` | racine ou `apps/api` | `tsc --noEmit` de tous les paquets |
| `npm run dev` | `apps/api` | `predev` reconstruit, puis `wrangler dev` (workerd local ; attention : sans Redis dans `.dev.vars`, la limitation de débit écrit dans la base de **production**, voir `docs/API-UNIQUE.md`) |
| `npm run preparer-dev-vars` | `apps/api` | écrit `.dev.vars` |
| `npm run comparer -- ...` | `apps/api` | comparaison de routes |

---

## B. `packages/shared/` : règles pures (`@speedfood/shared`)

Paquet `packages/shared/package.json` : `exports: { "./*": "./src/*.ts" }`, donc chaque fichier est un point d'entrée : `import { transitionAutorisee } from "@speedfood/shared/contracts/statuts"`. Règle d'or (`packages/shared/README.md`) : un fichier ne dépend que d'autres fichiers du paquet (imports relatifs) ; interdits : alias `@/`, `server-only`, `next`, `@supabase`, `react`, `node:` et modules Node, `import()`, `require`, `process.env`, `"use client"`/`"use server"`, auto-référence `@speedfood/shared`. Le test `apps/web/scripts/tests/paquet-partage.test.mts` (dans `npm run test:unit`) la fait respecter, et exige un **raccord d'une ligne** à l'ancienne place dans `apps/web/src/lib/`. Pour déplacer une règle de plus : `node scripts/deplacer-vers-partage.mjs <chemin> [--essai]` depuis `apps/web`. `tsconfig.json` du paquet : `types: []`, `lib: ["esnext"]`.

**Écart de comptage** : la consigne de la mission parle de 11 fichiers ; le dépôt en contient **13** (comme le dit `packages/shared/README.md`, « 13 fichiers »). Contenu réel de `packages/shared/src/` :

| Fichier | Contient (exports principaux) |
|---|---|
| `api/v1-regles.ts` | `lireBearer(entete)`, `statutHttp(code)` (code d'erreur → statut HTTP), `TAILLE_CORPS_MAX_OCTETS` (64 Kio), `corpsTropGros(contentLength)`. Utilisé par `http.ts` et `chaine.ts` de l'API. |
| `application/version.ts` | `VersionApplication` (code, nom, notes, obligatoire, apkSha256, apkTaille) et `VERSION_APPLICATION` (valeur servie par `/api/v1/version`). |
| `commande/estimation.ts` | `DELAI_PREPARATION_MIN/MAX` (5 et 240), `lireDelaiPreparation`, `calculerPretEstimeeLe`, `heureDepuisIso`. |
| `commande/mode.ts` | `ModeCommande` (`retrait`, `livraison`, `sur_place`), `lireNumeroTable`, `libelleMode`, `versModeCommande`. |
| `commande/telephone.ts` | `normaliserTelephone(brut)`. |
| `contracts/statuts.ts` | `STATUTS_COMMANDE`, `StatutCommande`, `transitionAutorisee(depuis, vers)`, `STATUTS_ACTIFS`, `STATUTS_TERMINAUX`. |
| `contracts/erreurs.ts` | `ErreurApi` (`code`, `message`) et la classe `ErreurMetier` (`toApi()`), utilisée par `app.ts`, `chaine.ts`, `suivi.ts`. |
| `contracts/commande.ts` | Types de la commande (`Commande`, `LigneCommande`, `OptionCommande`, `ClientCommande`, `EvenementStatutCommande`, propositions révisées, `CreationCommandePayload`, `ResultatCreationCommande`, `LigneCommandeClient`, `EtatDeriveCommande`…), 268 lignes. |
| `contracts/menu.ts` | `MenuItem`. |
| `contracts/restaurant.ts` | `CategorieRestaurant`, `RestaurantPublic`, `RestaurantAdmin`, `RoleMembership`, `RestaurantMembership`. |
| `contracts/index.ts` | Réexporte `statuts`, `restaurant`, `menu`, `commande`, `erreurs`. |
| `disponibilite/etat.ts` | Disponibilité horodatée des plats (`etatDisponibilite`, `libelleDisponibilite`, `ancienneteLisible`, `scoreFraicheur`) et état du restaurant (`etatRestaurant`, `estCommandable`). |
| `paiement/regles.ts` | `ModePaiement` (`especes`, `orange_money`, `mtn_momo`, `speedfood`), `StatutPaiement`, `LIBELLES_MODE`, `lireCodeMarchand`, `lireReferencePaiement`, `optionsPaiement`, `paiementOuvert`, `peutDeclarer`, `libelleStatutPaiement`, `chiffresWhatsApp`. |

Le mobile Kotlin **n'importe pas** ce paquet : il a ses propres copies (par exemple `mobile/.../disponibilite/Etat.kt`, `data/Telephone.kt`, `data/Format.kt`). Toute règle changée ici est à répercuter à la main côté Kotlin (à vérifier : il n'existe pas de test de parité TS/Kotlin dans ce que j'ai lu).

---

## C. `mobile/` : application Android et iPhone (Kotlin Multiplatform, Compose Multiplatform)

Projet Gradle séparé (`mobile/settings.gradle.kts`, `rootProject.name = "Speedfood"`), modules : `:shared`, `:androidApp`, `:desktopApp`. Hors espace de travail npm. Un fichier `mobile/iosApp/` (projet Xcode) n'est pas un module Gradle : il consomme le framework statique `Shared` produit par `:shared`.

### C.1 Modules

| Module | Contenu |
|---|---|
| `mobile/shared/` | Tout le code partagé. Cibles (`shared/build.gradle.kts`) : `iosArm64`, `iosSimulatorArm64` (framework statique `Shared`), `jvm()` (aperçu bureau et tests sans émulateur), `androidLibrary` (namespace `com.speedfood.app.shared`). Ktor (okhttp / darwin / mock), Koin, Navigation Compose, Coil, Material3, kotlinx.serialization. |
| `mobile/androidApp/` | L'application Android : `applicationId = "com.speedfood.app"`, **`versionCode = 51`, `versionName = "2.47.0"`** (`androidApp/build.gradle.kts`), `google-services.json` (Firebase), signature « release » si configurée. Code natif dans `androidApp/src/main/kotlin/com/speedfood/app/`. |
| `mobile/iosApp/` | Projet Xcode (`iosApp.xcodeproj`), `iOSApp.swift`, `ContentView.swift` (héberge `MainViewController` de `shared/src/iosMain`), `Configuration/Config.xcconfig` (`BUNDLE_ID=com.speedfood.app`, `MARKETING_VERSION=2.46.2`, `CURRENT_PROJECT_VERSION=50`, `SUPABASE_URL`/`SUPABASE_ANON_KEY` vides, `SITE_URL`). Les versions iOS **n'ont pas suivi** Android (2.46.2/50 contre 2.47.0/51) : à vérifier si c'est voulu (le commentaire du fichier dit « même numéro que l'APK au moment de la publication »). |
| `mobile/desktopApp/` | Fenêtre bureau (`desktopApp/src/main/kotlin/com/speedfood/app/main.kt`), pour aperçu. |

### C.2 Structure du code partagé (`mobile/shared/src/commonMain/kotlin/com/speedfood/app/`)

- `App.kt` : composable racine, navigation (onglets Accueil / Panier / Commandes / Compte avec `NavigationBar`, routes typées `hasRoute`), logique d'ouverture (`debutApplication`, `ecranApresOuverture`, choix du profil, visite guidée). `Coques.kt` : coques d'écran communes. `EspacePro.kt` : espaces restaurateur / livreur / équipe.
- `config/SpeedfoodConfig.kt` : `supabaseUrl`, `supabaseAnonKey`, `siteUrl`, `estComplete` (https exigé ; exception `http://10.0.2.2` pour le faux serveur). Valeurs **publiques**, jamais la clé de service. Fournies par chaque plateforme : Android lit `mobile/speedfood.properties` (copié depuis `speedfood.properties.example`, ignoré par Git : clés `supabase.url`, `supabase.anonKey`, `site.url`, `google.webClientId`) ; iOS lit `Secrets.xcconfig`/`Config.xcconfig`.
- `data/` : couche réseau et services (≈ 60 fichiers). Convention : une `interface XxxApi` + une implémentation `KtorXxxApi(client: HttpClient, config: SpeedfoodConfig)` (injection par Koin), avec URL construites par `"${config.siteUrl.trimEnd('/')}/api/v1/$chemin"`. Exemples : `Commandes.kt` (`CommandeApi`, `KtorCommandeApi`, `CommandesLocales`, `nouvelleCleIdempotence()` = UUID aléatoire), `Auth.kt` (`AuthApi`, `ErreurAuth`), `SessionService.kt`, `Client.kt` (`ClientApi`), `Livraison.kt`, `Livreur.kt`/`LivreurEspace.kt`/`SuiviLivreur.kt`, `Restaurateur*.kt`, famille `*Equipe.kt` (une API par console d'équipe : audit, avis, bannières, comptes, finances, listes d'attente, menus/photos, mises à jour, paiements, paramètres, partenariats, référencements, restaurants), `MiseAJour.kt`/`InstallationMiseAJour.kt`/`LiensProfonds.kt`, `Google.kt`/`Facebook.kt`, `AppareilPush.kt`, `SurveillanceCommandes.kt`, `CacheHorsLigne.kt` (`RestaurantApiAvecCache`), `StockageLocal.kt` (interface + `StockageMemoire`), `Panier.kt`, `Format.kt`, `Telephone.kt`, `Zone.kt`, `Securite.kt`.
- `ui/` : un écran + un `ViewModel` par fonctionnalité (`XxxScreen.kt` / `XxxViewModel.kt`) : accueil et restaurants, fiche restaurant, panier, commande, suivi, mes commandes, compte et espace client, connexion, candidature, livreur, restaurateur, équipe (≈ 15 consoles), support, verrou, visite guidée ; plus `Composants.kt`, `IconesApp.kt`, `Pictos.kt`, `Illustrations.kt`, `Mouvement.kt`, `LogoAnime.kt`.
- `design/` : `Couleurs.kt`, `Teintes.kt`, `Theme.kt` (tokens de `docs/cadrage/DESIGN-SYSTEM.md`). `disponibilite/Etat.kt` : copie Kotlin de la règle de disponibilité (cf. B).
- `di/Koin.kt` : voir C.3.
- Ressources : `shared/src/commonMain/composeResources/{drawable,font}`.
- Plateformes : `shared/src/iosMain/.../MainViewController.kt` ; `androidApp/src/main/kotlin/...` (points d'entrée natifs, voir C.5).
- Tests : `shared/src/commonTest/kotlin/com/speedfood/app/*Test.kt` (≈ 55 fichiers : `CommandeTest`, `SuiviTest`, `EspaceClientTest`, `AccesSessionTest`, `HorsLigneTest`, `SecuriteTest`, `LivreurTest`, etc., avec Ktor `MockEngine`) et `shared/src/jvmTest/.../CapturesTest.kt` (captures d'écran Compose sur bureau). Commande de test : `./gradlew :shared:jvmTest` (à vérifier, non exécutée ; la tâche exacte dépend du plugin Android KMP).

### C.3 Injection de dépendances (Koin) : `di/Koin.kt`

- `modulesApplication(config, stockage, position, alerte, jetonPush, plateforme, versionApp, google, codeVersionApp, notificateurMiseAJour, selecteurPhoto, installateurApk, demandeNotifications, verrouAppareil, facebook)` retourne la liste de modules. Chaque plateforme fournit ses implémentations natives ; les valeurs par défaut sont des classes `…Indisponible` (patron « null object »).
- Un seul `HttpClient` Ktor partagé (`single`) : `ContentNegotiation` + JSON `ignoreUnknownKeys`, **`requestTimeoutMillis = 20_000`**, `connectTimeoutMillis = 10_000`. Intercepteur `HttpSend` : un 401/403 sur un appel portant `Authorization: Bearer …` n'est pas une coupure réseau, il est signalé à `ReactionAcces` (session expirée ou droit retiré).
- Services en `single` : `SessionService`, `ProfilService`, `PanierService`, `CommandesLocales`, `EspaceService`, `DeconnexionService`, `EnregistrementPush`, `SuiviMiseAJour`, `InfosApplication`, toutes les `KtorXxxApi` liées à leur interface. `RestaurantApi` = `RestaurantApiAvecCache(KtorRestaurantApi(...))` (cache hors ligne).
- ViewModels : `factoryOf(::XxxViewModel)` (nouvelle instance par écran) ; certains avec paramètre (`factory { parametres -> RestaurantViewModel(get(), parametres.get()) }`). Fichier non relu en entier au-delà de la ligne ~260 : la fin déclare le reste des ViewModels et `initKoin`/`enregistrerAppareilPush`/`lancerEnregistrementPush` (à vérifier).

### C.4 `CommandeViewModel` et l'idempotence (`ui/CommandeViewModel.kt`)

- Dépendances : `PanierService`, `SessionService`, `CommandeApi`, `RestaurantApi`, `LivraisonApi`, `CommandesLocales`, `ClientApi`. État exposé : `EtatCommande` (mode, quartier, estimation de livraison, `enCours`, `erreur`, `info`, `envoyee` = jeton de suivi en cas de succès), `quartiers`, `adresses`.
- **Clé d'idempotence** : champ `cle = nouvelleCleIdempotence()` (UUID). `signature()` = lignes du panier (`cle x quantité`) + mode (`livraison:quartier:frais` ou `retrait`). Dans `envoyer(...)`, si la signature courante diffère de `signaturePanier`, une **nouvelle** clé est générée ; sinon la **même clé est réutilisée** pour un nouvel essai. Effet voulu : un 500 ou un délai suivi d'un nouvel essai donne côté serveur un rejeu idempotent (HTTP 200 `idempotent: true`) au lieu d'une seconde commande. Après succès (`ResultatCommande.Creee`) la commande est enregistrée localement (`CommandesLocales.ajouter`), le panier vidé, une nouvelle clé générée et `signaturePanier` remis à vide.
- Ordre de `envoyer` : panier non vide → `verifierSaisieCommande(...)` (nom, téléphone normalisé, consentement au règlement, adresse et estimation pour la livraison) → clé → `session.jetonValide()` (sans jeton : « Connectez-vous pour envoyer votre commande. », la commande n'est pas envoyée) → `CreationCommande` (clé, restaurant, client, mode `livraison`/`retrait`, lignes {plat, quantité, options}, `sousTotalAffiche`, `fraisAffiches`, `destination`) → `api.creer`. **Aucun prix n'est envoyé comme prix** : les montants affichés ne servent qu'à détecter un changement.
- Refus `CONFLIT_ETAT` (prix ou frais changés) : le panier est actualisé avec le menu du jour (`panier.actualiser`), la livraison recalculée (`estimer()`), message à confirmer. Autres refus : message affiché.
- Pourquoi cela compte pour l'API : le délai du client (20 s) dépasse ceux du relais du site (8 000 ms pour `suivi/annuler` et `suivi/proposition`, 15 000 ms pour `POST /commandes`), donc un nouvel essai avec la même clé est plausible ; cela suppose `COMMANDE_JETON_SECRET` **identique** sur les deux Workers (`docs/API-UNIQUE.md`, Tâche 12).
- Test : `shared/src/commonTest/.../CommandeTest.kt` (à vérifier : étendue exacte de la couverture de l'idempotence).

### C.5 Notifications et services Android (`androidApp/src/main/kotlin/com/speedfood/app/`)

- `FirebaseSpeedfood.kt` : `FirebaseMessagingService` (réception des notifications poussées), création du canal de notification, fournisseur du jeton (`FournisseurJetonPush`). Côté partagé : `data/AppareilPush.kt` (`AppareilApi`, `KtorAppareilApi`, `EnregistrementPush` : enregistre le jeton de l'appareil sur le serveur ; `messageEssai`). Projet Firebase Speedfood : voir la mémoire du projet et `google-services.json`. La clé de service Firebase côté serveur est à générer par Malika (état au 22 octobre : à vérifier dans `docs/PASSATION.md`).
- `AlerteAndroid.kt` : `AlerteCommande` (sonnerie, écran allumé pour une commande entrante restaurateur).
- `SurveillanceRestaurateurService.kt` : service de premier plan qui surveille les commandes du restaurateur (`data/SurveillanceCommandes.kt` côté partagé) avec verrou de réveil.
- `SuiviLivreurService.kt` : service de premier plan pour la position du livreur (`PositionAndroid.kt`, `data/SuiviLivreur.kt`, `LivreurPosteFixe.kt`).
- Autres : `GoogleAndroid.kt`, `FacebookAndroid.kt` (connexion), `PhotoAndroid.kt` (sélecteur), `InstallateurApkAndroid.kt` + `NotificateurMiseAJourAndroid.kt` (mise à jour de l'APK hors Play Store), `SecuriteAndroid.kt` (verrou d'appareil), `SpeedfoodApp.kt` (`Application` : stockage dans des préférences privées, `initKoin`, enregistrement push), `MainActivity.kt`.
- Docs : `docs/ALERTES-COMMANDES.md`, `docs/NOTIFICATIONS-ICONES-OUTILS.md` (sous `docs/cadrage/` d'après `CLAUDE.md`), `docs/APPLICATION-ANDROID.md`, `docs/NATIF-PLAN.md`.

### C.6 Compiler

Depuis `mobile/` (pas depuis la racine) :

```bash
cd mobile
cp speedfood.properties.example speedfood.properties   # puis remplir supabase.url, supabase.anonKey (PUBLICS), site.url, google.webClientId
./gradlew :androidApp:assembleDebug      # APK de débogage (tâche usuelle, à vérifier)
./gradlew :androidApp:assembleRelease    # citée par docs/APPLICATION-ANDROID.md ; signature release selon androidApp/build.gradle.kts
./gradlew :shared:jvmTest                # tests (à vérifier)
./gradlew :desktopApp:run                # aperçu bureau (à vérifier : nom de tâche)
```

`mobile/local.properties` (chemin du SDK Android) et `mobile/speedfood.properties` sont locaux. JDK 17. Émulateur Android 14 installé le 22 octobre (voir la mémoire du projet « Émulateur Android Speedfood »). L'APK publié vit dans `apps/web/public/` (empreinte : `apps/web/scripts/empreinte-apk.mjs`) et sa version est décrite par `packages/shared/src/application/version.ts` : **à mettre à jour ensemble** à chaque publication.

### C.7 `mobile/faux-serveur/` : serveur factice pour l'émulateur

Lancement depuis la **racine** : `node mobile/faux-serveur/faux-serveur-application.mjs` (port 8787, variable `PORT` ; l'émulateur y accède par `http://10.0.2.2:8787`). L'application de test est construite avec `site.url = supabase.url = http://10.0.2.2:8787` (`docs/AUDIT-PARCOURS-2026-10-22.md`). Comptes factices (mot de passe quelconque) : `client@test.sf`, `resto@test.sf`, `livreur@test.sf`, `equipe@test.sf`, `multi@test.sf`. Les lectures publiques `/rest/v1/*` (restaurants, plats, quartiers) sont relayées **en lecture seule** vers la vraie base (`SUPABASE_URL`, défaut = projet de production) ; tout le reste est simulé en mémoire. Endpoints de test : `GET /__revoquer` puis `GET /__restaurer` (session révoquée).

| Fichier | Lignes | Rôle |
|---|---|---|
| `faux-serveur-application.mjs` | 511 | Serveur principal : comptes, jetons `tok-<email>`, auth, commandes, favoris ; délègue aux modules ci-dessous |
| `faux-serveur-client-decouverte.mjs` | 65 | Découverte côté client |
| `faux-serveur-livreur-livreur.mjs` | 106 | Livreur |
| `faux-serveur-restaurant-restaurateur.mjs` | 125 | Restaurateur |
| `faux-serveur-equipe-catalogue.mjs` / `-etablissement.mjs` / `-exploitation.mjs` / `-finances.mjs` / `-quarts.mjs` / `-support.mjs` | 12 / 320 / 9 / 38 / 143 / 21 | Consoles de l'équipe |

Il ne simule **pas** (à vérifier) les routes ajoutées pour l'étape 1c-1 de l'API : ce sont les routes du site qui existent, pas des nouvelles. Voir `docs/AUDIT-PARCOURS-2026-10-22.md` et la mémoire « Faux serveur d'audit émulateur ».

### C.8 Pipeline iPhone : `.github/workflows/ios.yml`

- Nom : « iPhone (compilation de contrôle) ». Déclencheurs : `workflow_dispatch` ; `push` sur `master` si `mobile/**` ou le workflow changent. `concurrency` : annule la précédente du même `ref`. Permissions : `contents: read`.
- Un seul job `simulateur`, `runs-on: macos-15`, 90 min : checkout → Temurin JDK 17 → `gradle/actions/setup-gradle@v4` → **réglages publics** (variables du dépôt `SUPABASE_URL`, `SUPABASE_ANON_KEY`, à défaut lues dans `apps/web/wrangler.jsonc`) écrits dans `mobile/iosApp/Configuration/Secrets.xcconfig` → choix du plus récent Xcode 26 (`/Applications/Xcode_26*`) → `xcodebuild -project iosApp.xcodeproj -target iosApp -configuration Debug -sdk iphonesimulator ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build` depuis `mobile/iosApp`. En cas d'échec, la fin du journal est republiée en annotation `::error` (les journaux ne se lisent qu'une fois connecté à GitHub).
- Ce que cela prouve : le code iPhone **compile et se lie** pour le simulateur, sans compte Apple, sans signature, sans publication. TestFlight/App Store exigent un compte Apple Developer (`docs/NATIF-PLAN.md`). Le dépôt étant public, les minutes macOS sont gratuites. Voir la mémoire « iPhone par GitHub Actions ».
- Le reste du workflow après `xcodebuild` n'a été lu que jusqu'à la ligne 80 (à vérifier s'il y a des étapes de publication d'artefact).

---

## D. `supabase/` : la base (Postgres + RLS)

Contenu : `supabase/migrations/` (**119 fichiers** `.sql` au 31 octobre 2026), `supabase/seed.sql` (128 lignes), `supabase/rejeu/` (outil de rejeu), `supabase/concurrence/` (tests de concurrence). Le projet Supabase de production est celui de `NEXT_PUBLIC_SUPABASE_URL` (visible dans `apps/api/wrangler.jsonc`).

### D.1 Convention des migrations

- Nom : `AAAAMMJJHHMMSS_description_en_snake_case.sql`, ordre lexicographique = ordre d'application. Première : `20260927150000_tables.sql` ; suivantes de base : `…150100_fonctions_utilitaires`, `…150200_triggers`, `…150300_rls`, `…150400_durcissement_securite`, `…150500_optimisations_perf` ; plus récentes : `20261027204958_doublons_adresse_canonique`, `20261027211258_numeros_titulaires`, `20261029084602_delai_preparation`.
- **Règle non négociable (CLAUDE.md)** : toute migration appliquée en base (outil `apply_migration`) a son fichier dans `supabase/migrations/`, **dans le même commit** ; le dépôt doit pouvoir reconstruire la base ; chaque migration en base a son fichier, même nombre des deux côtés. Vérification : `list_migrations` (MCP Supabase) contre `ls supabase/migrations | wc -l`.
- Les policies réservées aux membres portent `to authenticated`, jamais sans restriction de rôle (sinon évaluées pour `anon` et cassent la lecture publique voisine ; `fn_est_membre_restaurant` n'est pas exécutable par `anon`).
- Avant d'écrire dans une table, lire ses contraintes dans les migrations : une valeur qui les enfreint fait échouer toute l'insertion, silencieusement (cas vécu : `client_profils`, `pseudo` 3–24 caractères, `avatar` dans une liste fermée).
- Après toute migration touchant RLS ou une fonction `SECURITY DEFINER` : `get_advisors(type: "security")` et corriger ce qui est signalé.
- Montants GNF : entiers.

### D.2 Retrouver une table, une policy, une fonction

```bash
grep -il "create table.*<nom>" supabase/migrations/*        # où la table est créée (44 fichiers contiennent « create table »)
grep -l  "<nom_table>" supabase/migrations/*                 # toutes les migrations qui la touchent, dans l'ordre
grep -n  "create policy" supabase/migrations/*               # policies RLS
grep -il "security definer" supabase/migrations/*            # fonctions SECURITY DEFINER (32 fichiers)
```

Fichiers fondateurs : tables → `20260927150000_tables.sql` ; fonctions utilitaires → `…150100` ; déclencheurs → `…150200` ; RLS initiale → `…150300_rls.sql` ; durcissement → `…150400_durcissement_securite.sql`, `20260927164254_revoquer_execution_anon.sql`, `20260927160100_revoquer_execution_anon_onboarding.sql`, `20260927200000_durcissement_colonnes_protegees.sql`. Les tables ont ensuite évolué par blocs (`bloc8b_restaurants_comptes`, `bloc8c_contenus_taxonomie`, etc.). Le modèle de données commenté est dans `docs/MODELE-DONNEES.md` (et `docs/AUDIT-SUPABASE.md`) ; la vérité reste les migrations. Le garde-fou `apps/web/scripts/verifier-base.mjs` (appelé par `npm run cf:build` et `cf:deploy`) lit une ligne par table attendue (84 tables lues au 29 octobre) avec la clé de service et **refuse la construction si une table manque** ; contournement assumé : `SPEEDFOOD_SANS_VERIF_BASE=1`. Les tests `apps/web/scripts/tests/verifierbase.test.mts` et `verifier-base-sql.ts` y sont associés.

Familles de tables et de fonctions (déduites des noms de fichiers et des documents, à vérifier avant de s'y fier) : restaurants, menus et plats, commandes (avec lignes, options, événements de statut, propositions révisées), paiements et remboursements manuels, livreurs et incidents de livraison, comptes d'équipe et accès par paliers (`acces_paliers`), profils clients, adresses, favoris, candidatures d'application, avis, compteurs de limitation (`fn_limiter_debit`), appareils push.

### D.3 Autres dossiers

- `supabase/seed.sql` : données de développement local **explicitement fictives** (catégories de menu, quartiers, deux restaurants de dev, l'un publié et l'autre non). « Ne jamais exécuter contre un environnement pilote/production ». À ne pas confondre avec le prototype (`demo/`).
- `supabase/rejeu/` (`rejeu.mjs`, `signature.sql`, `README.md`) : rejoue chaque migration, dans l'ordre, sur une base jetable PGlite (PostgreSQL 18 en WebAssembly) sans Docker ni compte, arrêt à la première erreur, puis affiche une **signature du schéma `public`** (tables, colonnes, contraintes, index, policies, triggers, fonctions). On compare cette signature à celle de la production en exécutant `signature.sql` sur la base de prod (sept lignes de hachages). Limites : PG 18 contre 17 en prod (`NOT NULL` exclus), bouchons pour `auth.users`/`auth.uid()`/rôles/`storage.buckets`, GRANT/REVOKE et données **non comparés**. Lancement : `cd supabase/rejeu && npm ci && npm run rejeu`. Le contrôle automatique l'installe (`npm ci`) mais **ne le lance pas** (voir E).
- `supabase/concurrence/` (`concurrence.mjs`, `simulation-journee.mjs`) : tests d'écriture concurrente sur un vrai PostgreSQL 17 (`embedded-postgres`, ~100 Mo téléchargés), toutes les migrations rejouées, plusieurs connexions simultanées ; `simulation-journee.mjs` simule une journée de service et vérifie des invariants (aucune commande perdue, numéros d'appel uniques, isolement entre restaurants, moyennes d'avis exactes). Lancés depuis `apps/web` : `npm run test:concurrence`, `npm run test:simulation` (prérequis `cd supabase/concurrence && npm ci`). `simulation-journee.mjs` lit `apps/web/src/…`. Voir `docs/TESTS-CONCURRENCE.md`. Rien ne touche la production.

---

## E. `.github/workflows/controles.yml` : le contrôle automatique

Nom « Contrôles ». Ne déploie **jamais** rien. Déclencheurs : `push` sur `master` et sur les branches `etape-*`, et `pull_request`. `permissions: contents: read`. `concurrency` par référence (annulation en cours sauf sur `master`). Un job `site` (`ubuntu-latest`, 30 min), Node 22, cache npm sur `package-lock.json` et `supabase/rejeu/package-lock.json` :

1. `actions/checkout@v4`, `actions/setup-node@v4` (Node 22).
2. `npm ci` (racine, espaces de travail).
3. `npm ci` dans `supabase/rejeu` (installe l'outil ; **le rejeu lui-même n'est pas lancé** dans ce fichier).
4. `npm run typecheck` (tous les paquets, `--workspaces --if-present`).
5. `npx eslint` dans `apps/web`.
6. `npm run test:unit` (tests purs du site, dont pureté de `packages/shared` et gardes du relais).
7. `npm run test:cloisonnement` (tests de cloisonnement entre restaurants).
8. `npm run test:api` (tests de l'API).
9. `npm run build:api` (construction de l'API et garde « aucun Next »).

Ne couvre **pas** : `next build` / `cf:build`, `verifier-base.mjs` (exige la clé de service), compilation Android, tests Kotlin, tests de concurrence, rejeu des migrations. Le workflow `ios.yml` est séparé (C.8). Un test d'API tourne sous Node 22 sur GitHub alors qu'il a été validé sous Node 24 en local : « non vérifié sur GitHub à ce jour » selon `docs/API-UNIQUE.md` (à vérifier au premier passage vert).

---

## F. `demo/` : prototype de démonstration (hors application réelle)

`demo/README.md` : matériel de validation produit, **statique, sans backend**. `demo/landing/` (`index.html`, `app.js`, `styles.css`) = page de présentation publique (formulaire de démo stocké en local) ; `demo/prototype/` (`index.html`, `app.js`, `data.js`, `styles.css`, `README.md`) = démo cliquable portail client + console restaurant avec données fictives. Déployés comme projet Cloudflare Pages `speedfood` (`wrangler pages deploy dist --project-name speedfood`, `dist/` construit à partir de ces sources). **Ne pas y ajouter de fonctionnalités** : le développement se fait dans le vrai système. Le README de `demo/` cite encore `src/` (lire `apps/web/src/`). Les documents du cadrage qui parlent de `index.html`/`localStorage` décrivent ce prototype, pas l'application. Le prototype d'origine vit aussi, d'après `CLAUDE.md`, dans un dépôt OneDrive séparé : répartition exacte dans `docs/PROTOCOLE-COLLABORATION.md` (non relu ici).

---

## G. Pièges et points « à vérifier » (récapitulatif)

Pièges à connaître :
- `no_bundle` : **reconstruire** (`npm run build` dans `apps/api`) avant `wrangler dev` ou tout déploiement, sinon un `dist` périmé est publié sans erreur.
- `wrangler dev` sans Redis dans `.dev.vars` écrit des compteurs de limitation dans la base de **production** (aucune écriture métier).
- `COMMANDE_JETON_SECRET` : repli silencieux sur la clé de service ; il doit être présent sur les deux Workers ou sur aucun ; on aligne l'API sur le site, jamais l'inverse.
- Comparateur : « 0 écart » ne prouve pas l'égalité octet pour octet (clés triées) ; ne jamais comparer une écriture à la production.
- `API_RELAIS=tout` est à bannir ; retour arrière = `API_RELAIS=non`. `suivi` puis `commandes` ne s'allument qu'avec feux verts de Malika (Tâche 12 du plan 1c-1).
- Imports : dans `apps/api`, extension `.ts` explicite ; dans `packages/shared`, imports relatifs sans extension (hook de résolution pour les tests).
- Les documents anciens citent `src/…`, `public/…`, `scripts/…` : lire `apps/web/…`. Windows/Git Bash : `MSYS_NO_PATHCONV=1`.
- Aucun agent ne lit ni n'affiche `apps/web/.env.local`, `apps/api/.dev.vars`, `mobile/speedfood.properties` (clé publique mais à ne pas diffuser inutilement), `mobile/androidApp/google-services.json`.

Points « à vérifier » (non exécutés ou non lus pendant la rédaction) :
1. Nombre de fichiers de `packages/shared` : 13 réels contre « 11 » dans la consigne ; l'ancienne documentation dit 13.
2. `apps/api/tsconfig.json` et `.gitignore` (alias `@/*`, `dist/` ignoré) non relus.
3. Aucune route n'applique `limiterParRequete` explicitement : confirmer que le plafond par adresse n'est assuré que par les services du site.
4. Noms exacts des variables Redis/limitation de débit lues par `apps/web/src/lib/securite/limitation-debit.ts`.
5. Commandes Gradle exactes (`assembleDebug`, `:shared:jvmTest`, `:desktopApp:run`) : seule `assembleRelease` est citée par un document ; aucune n'a été lancée.
6. Fin de `mobile/shared/.../di/Koin.kt` (après la ligne ~260), fin de `ios.yml` (après la ligne 80) et couverture exacte de `CommandeTest.kt`.
7. Écart de versions iOS (2.46.2 / 50) contre Android (2.47.0 / 51).
8. Absence de test de parité entre les règles de `packages/shared` et leurs copies Kotlin.
9. Liste exhaustive des tables et policies : à relire dans les migrations (la section D.2 ne donne que des familles).
10. Que `npm run test` de l'API passe sous Node 22 sur GitHub (jamais constaté) ; nombre de 224 tests tiré de `docs/API-UNIQUE.md`, non recompté.
11. Contenu de `docs/PROTOCOLE-COLLABORATION.md`, `docs/PASSATION.md`, `docs/REPRISE-SESSION.md` (lus seulement par leur titre dans `CLAUDE.md`).
12. L'état de déploiement réel (Workers, relais, migrations appliquées) : seul Malika et les outils Cloudflare/Supabase le confirment ; ce document reflète `docs/API-UNIQUE.md` du 31 octobre 2026.
