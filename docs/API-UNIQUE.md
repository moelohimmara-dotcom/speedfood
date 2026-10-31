# API unique de Speedfood (`apps/api`) : étapes 1a (socle), 1b (routes et relais) et 1c-1 (suivi et commandes), 31 octobre 2026

**État : les étapes 1a et 1b sont en production (voir « Mise en production », relais allumé pour `public,moi,client,livraison`). L'étape 1c-1 (suivi et commandes du client) est écrite et testée en local, NON déployée, relais ÉTEINT pour `suivi` et `commandes`** : le Worker en ligne n'a pas ce code et le site en ligne n'a pas ces gardes ; les utilisateurs ne voient rien. Plans : `docs/plans/2026-10-31-etape-1a-socle-api.md`, `docs/plans/2026-10-31-etape-1b-routes-et-relais.md` et `docs/plans/2026-10-31-etape-1c1-suivi-et-commandes.md`. Cible d'ensemble : `docs/specs/2026-10-30-architecture-cible-design.md` (section 5).

## À quoi ça sert, et pourquoi un Worker séparé

Les futures applications (React Native) et le site parleront à une seule API, au contrat uniforme `{ ok: false, erreur: { code, message } }` en cas d'erreur. Elle est un **Worker séparé** du site (`speedfood-app`) : on la déploie, la corrige ou la retire sans toucher au site, et sa limite de CPU est comptée à part. Elle **réutilise les services du site** (accès à la base, limitation de débit, règles) au lieu de les recopier, mais sans embarquer Next.js.

## Ce qui existe

Hono sur Workers : `GET /sante` et **dix routes `/api/v1/*`** (tableau ci-dessous). Une route inconnue hors des préfixes protégés répond 404 `INTROUVABLE`. **Sous `/api/v1/moi`, `/api/v1/client` et `/api/v1/livraison/estimation`, l'identité passe d'abord** (middleware `"*"` de chaque sous-routeur) : une route ou méthode inconnue y répond 401 sans jeton ; avec un jeton bien formé, l'API fait l'appel `getUser`, consomme le plafond du compte, puis répond 404 (observé par une sonde ; correctif de code reporté au plan 1c). Une erreur non prévue répond 500 sans détail (rien ne fuit).

```
apps/api/
  package.json, tsconfig.json, wrangler.jsonc   Worker « speedfood-api » (valeur publique seulement ; secrets jamais ici)
  build.mjs                 assemblage esbuild + garde « aucun fichier de Next.js dans le paquet »
  src/app.ts                application Hono (erreurs au contrat, premier maillon : en-têtes de la requête, relais de confiance)
  src/worker.ts             câblage de PRODUCTION : les routes reçoivent les services du site (secrets lus à l'appel)
  src/types.ts              dépendances injectées (testables sans réseau)
  src/http.ts               repondre, reponseErreur, lireCorpsJson (identiques au site)
  src/routes/               version, aide, fournisseurs, moi, client, estimation, suivi, commandes
  src/cales/                next-headers.ts (cale de headers()), vide.ts (module « server-only » vide)
  src/controles/chaine.ts   briques de la chaîne de contrôles
  src/identite/jeton.ts     vérification des jetons Supabase : local (ES256) et strict (service d'authentification)
  src/identite/relais.ts    confiance dans l'adresse transmise par le site (secret partagé)
  sondes/                   services.ts (services du site qui doivent tenir sans Next), interdit.ts (sonde fautive qui prouve la garde)
  scripts/                  comparateur.mjs, comparer-routes.mjs, preparer-dev-vars.mjs, résolveur TypeScript des tests
  tests/                    un fichier de test par brique
```

Les règles pures partagées (version de l'application, règles de l'API v1) vivent dans `packages/shared` (`@speedfood/shared`), avec un raccord d'une ligne à leur ancienne place dans le site. Côté site : `apps/web/src/lib/api/moi-service.ts` (`lireRolesCompte`, extrait de la route `moi` pour que le site et l'API partagent la même lecture), `relais-regles.ts` (règles pures, testées) et `relais.ts` (branchement sur l'environnement).

## Les dix routes servies par l'API

Parité avec les routes du site sur les réponses nominales et les erreurs du contrat (même statut, même corps JSON, mêmes en-têtes de cache, mêmes messages d'erreur) ; les écarts connus sont listés dans « Observations sur le site ». Toutes les routes avec compte sont en **mode de jeton strict** (voir plus bas).

| Route | Méthode | Jeton | Cache | Service du site |
|---|---|---|---|---|
| `/api/v1/version` | GET | aucun | `public, max-age=300` | `VERSION_APPLICATION` |
| `/api/v1/aide` | GET | aucun | `public, max-age=300` | `lireReglagesAssistance()` |
| `/api/v1/connexion/fournisseurs` | GET | aucun | `public, max-age=60` | `connexionClientActive()` (erreur : `facebook:false`) |
| `/api/v1/moi` | GET | strict, puis limite par compte | `no-store` | `lireRolesCompte` |
| `/api/v1/client/espace` | GET | strict, puis limite par compte | `no-store` | `lireEspaceClient` |
| `/api/v1/client/favoris` | POST | strict, puis limite par compte | `no-store` | `basculerFavoriClient` |
| `/api/v1/client/profil` | POST | strict, puis limite par compte | `no-store` | `enregistrerProfilClient` |
| `/api/v1/client/adresses` | POST | strict, puis limite par compte | `no-store` | `actionAdresseClient` |
| `/api/v1/client/compte` | POST | strict, puis limite par compte | `no-store` | `supprimerCompteClient` |
| `/api/v1/livraison/estimation` | POST | strict, jeton seul (message d'erreur différent), **pas de plafond de compte** | `no-store` | `estimerPourClient` |

Les routes d'écriture répondent `{ ok: true, message[, favori] }` ou une erreur `VALIDATION` portant le message du service.

### Les cinq gestionnaires de l'étape 1c-1 (suivi et commandes du client, NON déployés)

Mêmes réponses que le site (statut, corps JSON, `no-store`, messages). Commandes (GET, POST) : mode de jeton **strict** (une commande est une écriture d'argent) ; suivi (3 routes) : **aucune identité**, le jeton de suivi du corps suffit. Fichiers : `apps/api/src/routes/suivi.ts` et `commandes.ts`.

| Route | Méthode | Identité | Cache | Service du site |
|---|---|---|---|---|
| `/api/v1/suivi` | POST | **aucune** : le jeton de suivi (40 caractères, dans le corps) est la clé d'accès ; plafond `limiterLectureSuivi` | `no-store` | `chargerSuiviParJeton` |
| `/api/v1/suivi/annuler` | POST | aucune (jeton de suivi) ; plafond `limiterAnnulationClient` | `no-store` | `annulerParClient` (idempotent) |
| `/api/v1/suivi/proposition` | POST | aucune (jeton de suivi) ; plafond `limiterReponseProposition` | `no-store` | `repondreProposition` (idempotent) |
| `/api/v1/commandes` | GET | strict (jeton porteur), **pas de plafond de compte** | `no-store` | `listerMesCommandes(id, { avecJeton: true })` (la liste contient les jetons de suivi) |
| `/api/v1/commandes` | POST | strict, **pas de plafond de compte** ; l'identité passe **avant** la lecture du corps (sur les routes de suivi, qui n'ont pas d'identité, le corps est lu en premier) | `no-store` | `validerCreationCommande` puis `executerCreationCoeur(…, { antiRobot: false, apres })` ; `201` (commande nouvelle) ou `200` (`idempotent: true`) |

**Coupure `creation-coeur` / `creation-service`.** Le service de création appelait `after` de `next/server`, seul fichier qui tirait 54 fichiers de Next.js dans le paquet. `apps/web/src/lib/commande/creation-coeur.ts` (sans Next) exporte `executerCreationCoeur(valeurs, utilisateurId, { antiRobot, apres })` avec `type Planifier = (tache: () => Promise<void>) => void` ; `creation-service.ts` garde son nom, sa signature et ses appelants et ne fait plus que lui passer `after`. Côté API, `apres = (t) => c.executionCtx.waitUntil(t())`. L'alerte « page fermée » du restaurant n'est planifiée que pour une commande **nouvelle** (jamais pour un rejeu idempotent, jamais après un refus). La validation (`validerCreationCommande`) et `estJetonValide` restent dans le site et sont injectées par `Deps`.

**`apres()` est appelé dans le `try` du cœur.** Si le contexte d'exécution manquait (`c.executionCtx` lève hors Workers, ou `app.fetch` appelé sans `ctx`), la commande serait **créée** mais la réponse serait un **500** : c'est la parité avec le site, où `after` hors contexte de requête fait de même. Garde-fou : `worker.ts` transmet `ctx` à `app.fetch` (test statique).

**`antiRobot: false`.** L'application native ne produit pas de jeton Turnstile ; la protection est le jeton porteur strict et les plafonds de `limiterCreationCommande` (adresse, téléphone, restaurant). La route ne lit jamais `jetonVerification` du corps. Un test statique de `worker.ts` fige `antiRobot: false`.

**Méthode inconnue sur `/api/v1/commandes` : 404, pas 405 (décision D6).** L'identité est posée **par méthode** (`route.get`, `route.post`), pas sur `"*"` : une méthode inconnue répond 404 `INTROUVABLE` **sans appel réseau** (le défaut observé en 1b, 401 sans jeton ou `getUser` avec jeton, n'est pas reproduit ici). Le site répond 405. Sans effet sur le relais.

## Commandes

`npm install` se lance **à la racine**. Les commandes `npm run …` de l'API se lancent depuis `apps/api` ; `typecheck`, `test:api` et `build:api` existent aussi à la racine.

| Commande | Où | Rôle |
|---|---|---|
| `npm run test` | `apps/api` (ou `npm run test:api` à la racine) | tests de l'API (224 au 31 octobre 2026 après l'étape 1c-1, relevés en relançant la commande), Node avec `--experimental-strip-types` (Node 24 en local, 22 sur GitHub : non vérifié sur GitHub à ce jour) |
| `npm run build` | `apps/api` (ou `npm run build:api` à la racine) | écrit `dist/worker.js` (1 165 Kio, soit 1 193 032 octets, au 31 octobre 2026 après l'étape 1c-1 ; 857 Kio à l'étape 1b ; 237 802 octets compressés en gzip, soit 232,2 Kio) et **échoue** si un fichier de Next.js est entré dans le paquet |
| `npm run typecheck` | racine | types de tous les paquets, API comprise |
| `npm run preparer-dev-vars` | `apps/api` | écrit `.dev.vars` (ignoré par Git) depuis `apps/web/.env.local`, sans jamais afficher un secret |
| `npm run dev` | `apps/api` | `wrangler dev` (workerd local ; construire d'abord) |
| `npm run comparer -- <réf> <candidate> <chemins…>` | `apps/api` | compare des routes entre deux serveurs (statut, cache, corps ; **l'ordre des clés JSON est ignoré**, donc « 0 écart » ne prouve pas l'égalité octet pour octet), avec jeton (`--jeton-env`), méthode, corps (`--corps`) ou corps secret lu dans l'environnement (`--corps-env NOM`) |

Deux pièges du comparateur :
- Sous **Git Bash**, un argument comme `/api/v1/version` est converti en chemin Windows : préfixer par `MSYS_NO_PATHCONV=1` (`MSYS_NO_PATHCONV=1 npm run comparer -- … /api/v1/version`).
- Un côté hors 2xx est **un écart** (deux erreurs identiques ne passent pas pour « 0 écart »). `--tolerer-non-2xx` désactive ce contrôle quand on compare volontairement des erreurs.
- Les routes d'écriture (`favoris`, `profil`, `adresses`, `compte`, et, à l'étape 1c-1, `suivi/annuler`, `suivi/proposition` et `POST commandes`) ne se comparent **jamais** à la production (elles écriraient) : seule leur parité de code est testée, avec de faux services.
- **`--corps-env NOM` (étape 1c-1)** : le corps JSON est lu dans la variable d'environnement `NOM` (même validation du nom que `--jeton-env`). **Pour un jeton de suivi (`POST /suivi`) on utilise toujours `--corps-env`, jamais `--corps`** : `--corps` met la valeur dans la ligne de commande (historique du shell, liste des processus). Variable absente ou vide, ou JSON illisible : code 2 avec un message fixe (ni la valeur ni le message de `JSON.parse`). `--corps` et `--corps-env` sont exclusifs ; `--corps-env` exige `--methode` ; les gardes d'adresse (https ou boucle locale, hôte de la base) s'appliquent au corps secret comme au jeton. `POST /suivi` est une lecture mais reste un POST : il exige `--autoriser-ecriture`.
- **Écarts affichés tels quels** : quand `cache-control` ou `content-type` diffèrent entre les deux serveurs, l'écart montre les valeurs envoyées par les serveurs, telles quelles (ce sont des en-têtes, pas des secrets). Le corps n'est jamais affiché dans un écart.

## Mécanisme de réutilisation des services du site

Les services du site importent `server-only` et `next/headers`. L'API les réutilise sans Next.js par quatre moyens :
1. **Alias `server-only`** : `build.mjs` le remplace par un module vide (`src/cales/vide.ts`).
2. **Cale `next/headers`** (`src/cales/next-headers.ts`) : `headers()` rend les en-têtes de la requête en cours, tenus dans un `AsyncLocalStorage` posé par le premier maillon de l'application. Deux requêtes concurrentes ne voient jamais les en-têtes l'une de l'autre (test avec délai croisé).
3. **Garde de construction** : après l'assemblage, `build.mjs` liste les fichiers entrés dans le paquet et échoue si l'un vient de `node_modules/next/`, `@opennextjs/` ou `react-dom/`. La sonde `sondes/interdit.ts` (importe `next/server`) prouve, dans un test, que la garde se déclenche vraiment.
4. **Sonde des services** : `sondes/services.ts` importe `creerClientAdmin`, `limiterClientApplication`, `lireRolesCompte`, `estimerPourClient`, `connexionClientActive` et l'espace client du site ; elle a passé la construction du premier coup, sans modifier le site (alias `@/*` résolu par le tsconfig de l'API vers `apps/web/src`).

Cela prouve que ces services **s'assemblent** sans Next.js, pas qu'ils **fonctionnent** sur Cloudflare (voir « Ce qui n'est PAS vérifié »).

## Chaîne de contrôles (design section 5)

Briques testées (`src/controles/chaine.ts`), dans cet ordre, chacune court-circuitant les suivantes :
1. limite de débit par adresse (avant l'identité) ;
2. identité par **jeton porteur uniquement** (les cookies du site ne sont jamais lus) ;
3. limite de débit par compte (le compte vient du jeton vérifié, jamais d'un identifiant envoyé).

Le vérificateur strict est maintenant câblé au Worker (`worker.ts`) ; le vérificateur local l'est aussi mais **aucune route de ce plan ne l'utilise** (pour le plan 1c). **Reste (plans suivants)** : droits (rôle, restaurant) pour les routes livreur, restaurateur et équipe, validation des entrées, audit.

## Vérification des jetons : décision mixte

- **Local (`verifierJetonLocal`)** : signature ES256, émetteur `<url Supabase>/auth/v1`, audience `authenticated`, expiration, `sub` non vide. Clés publiques lues une fois chez Supabase et gardées en mémoire de l'isolat (renouvellement au plus toutes les 10 minutes). Rapide, aucun appel au service d'authentification. Une panne des clés Supabase **lève** (500) et n'est plus confondue avec un jeton invalide (`null`, 401). Compromis : un compte supprimé ou banni reste accepté jusqu'à l'expiration de son jeton (environ une heure).
- **Strict (`creerVerificateurStrict`)** : `auth.getUser` à chaque appel. Plus lent et plus coûteux en requêtes, mais un compte supprimé ou banni est refusé tout de suite. Une erreur 4xx du service d'authentification rend `null` (jeton refusé), **sauf 408 (délai) et 429 (limitation de débit) qui ne disent rien du jeton : ils sont traités comme une panne et lèvent** (500). On ne reprend pas le défaut du site sur ce point.

**Décision de Malika (31 octobre 2026) : mode mixte.** Local pour les lectures très fréquentes (position du livreur, relecture de commandes en cours) ; strict pour tout le reste, y compris commandes et paiements. Chaque route déclare son mode, strict par défaut. **Les dix routes de ce plan sont toutes en mode strict.**

## Le relais du site vers l'API (ÉTEINT par défaut)

Le site peut transmettre à l'API les requêtes de quinze gestionnaires (dix à l'étape 1b, cinq à l'étape 1c-1 ; garde de deux lignes, première instruction de chaque gestionnaire : `const relais = await relaisSiActif(request, "<module>"); if (relais) return relais;`, avec en 3e argument facultatif `options` `{ lecture?, delaiMs? }` pour les routes de l'étape 1c-1 : `relaisSiActif(request, "suivi", { lecture: true, delaiMs: … })`, règles dans « Les trois réglages par route »). Sans réglage, **rien ne change** : aucun appel réseau, aucune lecture du corps.

### Variables

| Variable | Où | Rôle |
|---|---|---|
| `API_RELAIS` | site | absent, vide ou `non` : éteint ; `tout` : tous les modules (**à BANNIR en production**, voir plus bas) ; sinon liste de modules séparés par des virgules (casse et espaces indifférents) |
| `API_URL` | site | adresse de base de l'API (valeur publique) |
| `RELAIS_SECRET` | site | secret partagé envoyé dans `x-relais-secret` |
| `RELAIS_SECRET` | API | le même secret, lu à l'appel (`process.env.RELAIS_SECRET`) |

Modules : `public` (`version`, `aide`, `connexion/fournisseurs`), `moi`, `client` (`espace`, `favoris`, `profil`, `adresses`, `compte`), `livraison` (`estimation`), et, à l'étape 1c-1, `suivi` (`POST suivi`, `suivi/annuler`, `suivi/proposition`) et `commandes` (`GET` et `POST`). Deux modules et non un seul : le module est le seul levier du relais, il faut pouvoir allumer la lecture avant l'écriture.

**Pose du secret** : `RELAIS_SECRET` se pose avec `wrangler secret put` sur les **DEUX** Workers (site et API), avec la **même** valeur, **aléatoire d'au moins 32 caractères, ASCII visible seulement (sans espace, retour à la ligne ni accent) ; hors de cette forme, le site et l'API refusent de s'en servir**, générée et saisie par Malika. Jamais dans le chat, jamais dans un fichier du dépôt.

### Règles (Tâche 8)

1. Éteint par défaut : zéro appel réseau, zéro lecture de corps.
2. Allumé mais mal configuré (`API_URL` absente, illisible, avec identifiants, chemin, requête ou fragment, en `http://` hors boucle locale ; `RELAIS_SECRET` absent, de moins de 32 caractères ou hors ASCII visible) : le site traite lui-même, journal `relais_mal_configure` (nom seul, une fois par isolat).
3. Transmis : méthode, chemin et chaîne de requête, `authorization`, `content-type`, corps tel quel, `x-relais-secret` et `x-relais-ip` (`cf-connecting-ip` de la requête reçue, à défaut le premier `x-forwarded-for`, seulement si la valeur a l'allure d'une adresse IP). **Rien d'autre** : les cookies ne traversent jamais.
4. Réponse : statut, corps, `content-type` et `cache-control` de l'API, rendus tels quels (sans corps pour 204, 205, 304).
5. Échec réseau ou délai dépassé (2 500 ms) : repli (le site traite lui-même) **seulement pour une lecture (GET, HEAD)** ; pour une écriture, 500 `ERREUR_SERVEUR` : une écriture dont on ne sait pas si elle est partie ne se rejoue jamais. Une réponse 5xx de l'API n'est **jamais** un déclencheur de repli.
6. Le secret et le jeton ne sont jamais journalisés ni rendus.

### Ce que fait l'API du secret (`src/identite/relais.ts`)

Premier maillon de l'application : l'API ne croit l'adresse de `x-relais-ip` **que si** `x-relais-secret` est exact (comparaison à temps constant sur les empreintes SHA-256). Dans ce cas elle la pose comme `cf-connecting-ip` pour le code du site (limitation de débit par adresse). Sinon (appel direct, secret faux, secret non posé) elle l'ignore ; elle l'ignore aussi si le secret attendu n'a pas la forme requise (32 caractères ASCII visibles au moins : ni espace, ni retour à la ligne, ni accent), même si l'appelant envoie la même valeur, et si l'adresse transmise est mal formée (plus de 45 caractères, ou caractère hors `[0-9a-fA-F:.]`). Dans ce dernier cas `cf-connecting-ip` reste celui que Cloudflare donne. Dans tous les cas, les deux en-têtes de relais sont retirés de ce que voit le code des routes. Pourquoi : sans cela, tous les visiteurs relayés partageraient l'adresse du Worker du site, donc un seul plafond.

### Les trois réglages par route (étape 1c-1)

`relaisSiActif(request, module, options?)` accepte `options: { lecture?, delaiMs? }`, et le corps est conservé pour un repli éventuel :

- **`lecture: true`** : la route est une lecture faite par POST (`POST /suivi`, que l'application relit toutes les quelques secondes) ; le repli sur le site est alors permis comme pour un GET. **Valable pour la méthode POST seulement** (sur PUT, PATCH, DELETE l'option est sans effet) : une écriture n'est jamais rejouée. Ne jamais la poser sur une écriture.
- **`delaiMs`** : délai propre à la route, au lieu de 2 500 ms. Valeurs actuelles : `suivi/annuler` et `suivi/proposition` 8 000 ms, `POST /commandes` 15 000 ms (provisoires, à réévaluer à la mesure). Un `delaiMs` absent, nul, négatif, `NaN` ou infini retombe sur le **repli de 2 500 ms** ; au-delà de **60 000 ms** (plafond), la valeur est ramenée à 60 000 ms (le minuteur de `setTimeout` déborde au-delà de 2^31 ms et partirait aussitôt).
- **Corps conservé** : quand un repli est possible et que la méthode porte un corps, le relais lit le corps sur une **copie** (`request.clone()`), pour que le site retrouve un corps intact (sinon « JSON illisible »). Sans repli possible, aucune copie.
- **Un 4xx de l'API n'est jamais un repli**, pas plus qu'un 5xx : le statut et le corps de l'API sont rendus tels quels, même avec `lecture: true`.
- **`GET /commandes` peut retomber sur le site** (repli d'un GET sur panne ou délai) : la liste, qui contient des **jetons de suivi**, est alors lue par le site. Comportement voulu (c'est une lecture), à garder en tête à l'allumage.

Les gardes des cinq gestionnaires du site sont figées par un test statique (`apps/web/scripts/tests/gardes-relais.test.mts`) : première instruction du gestionnaire, bon module, bonnes options.

### Réglage de `API_RELAIS` : bannir `tout`

**La valeur `tout` est à BANNIR en production** : elle allumerait d'un coup `suivi` et `commandes`, donc la création de commande. Le réglage actuel est `public,moi,client,livraison`. Allumage progressif prévu, un feu vert de Malika par étape et une mesure entre deux :

1. `API_RELAIS=public,moi,client,livraison,suivi` (lecture et annulations du suivi) ;
2. puis `API_RELAIS=public,moi,client,livraison,suivi,commandes` (liste, puis création, après vérification de `COMMANDE_JETON_SECRET` ci-dessous).

Retour arrière : retirer le module de la liste (ou `non`), sans redéployer.

### Allumer, mesurer, éteindre

Allumage **module par module**, un feu vert de Malika par module, dans cet ordre : `API_RELAIS=public`, vérifier et mesurer (temps de réponse, erreurs 1102 dans le tableau Cloudflare, quota de sous-requêtes), puis `moi`, `livraison`, `client` (par exemple `API_RELAIS=public,moi`). **Retour arrière immédiat : `API_RELAIS=non`**, sans redéployer le code (changer la variable suffit). Retour complet : `npx wrangler delete --name speedfood-api` depuis `apps/api` supprime le Worker sans toucher au site.

## Observations sur le site (comportements portés tels quels, non corrigés)

- **Estimation de livraison sans plafond de compte** : `/api/v1/livraison/estimation` n'applique que le jeton (identité), pas `limiterClientApplication`. L'API reproduit ce comportement.
- **Méthode non gérée ou route inconnue** : le site répond 405 ou 404 (Next) ; l'API répond 404 `INTROUVABLE`, sauf sous `moi`, `client` et `livraison/estimation` où elle répond 401 sans jeton, ou 404 après `getUser` et plafond du compte avec un jeton. Sans conséquence pour le relais (le garde est dans le gestionnaire de la bonne méthode).
- **Panne du service d'authentification** (réseau, 5xx, 408, 429) : 401 sur le site (l'erreur devient `null`), 500 `ERREUR_SERVEUR` sur l'API (voulu : voir « Vérification des jetons »).
- **Exception levée par un service** (`lireRolesCompte`, `lireEspaceClient`, `estimerPourClient`…) : 500 par défaut de Next sans corps JSON sur le site ; 500 JSON au contrat sur l'API.
- **Barre finale dans l'adresse** (`/api/v1/moi/`) : redirection 308 de Next sur le site (non vérifié) ; 401 sans jeton, sinon 404 après `getUser` et plafond, sur l'API.
- **Plafond de taille du corps** : il ne se fonde que sur l'en-tête `content-length` **annoncé**. Une requête sans cet en-tête n'est pas plafonnée. Même comportement sur le site et sur l'API.
- **Erreur levée par le plafond autre que `TROP_DE_REQUETES`** : l'API restitue le code propre de l'erreur ; le site répond 500. Écart de comportement connu, non corrigé.
- **Étape 1c-1, panne du service d'authentification sur `POST /commandes`** (risque 8 du plan) : site 401 (l'application se croit déconnectée), API 500. C'est un mieux voulu (pas de fausse déconnexion au moment d'envoyer la commande).
- **Étape 1c-1, `listerMesCommandes` avale les erreurs de base** (`data ?? []`, risque 9) : une panne de lecture renvoie `{ ok: true, commandes: [] }` sur le site, donc sur l'API (parité). L'application affiche « aucune commande » pendant la panne. Non corrigé.
- **Étape 1c-1, méthode inconnue** (risque 10, D6) : 405 sur le site, 404 sur l'API pour `/api/v1/commandes`.
- **Étape 1c-1, pas de plafond de compte sur `commandes`** (D7) : le site n'en a pas ; le plafond de création est celui de `limiterCreationCommande` (adresse, téléphone, restaurant). Parité d'abord, non ajouté.
- **Étape 1c-1, création non transactionnelle** : commande, lignes puis options sont insérées l'une après l'autre (suppression de compensation en cas d'échec rattrapé) ; une coupure entre deux insertions laisserait une commande sans lignes, et le rejeu rendrait `idempotent: true`. Portée telle quelle.

## `COMMANDE_JETON_SECRET` : usage et vérification de parité (étape 1c-1)

**Lu à trois endroits**, tous avec le même repli `process.env.COMMANDE_JETON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY` : `lib/commande/jetons.ts` (jeton de suivi = HMAC-SHA256 de la clé d'idempotence), `lib/securite/limitation-debit.ts` (empreinte des clés de compteur) et `lib/table/cle.ts` (clé des QR de table).

**Le piège silencieux est le repli** : si le site a `COMMANDE_JETON_SECRET` et que l'API non, l'API se rabat **sans erreur** sur la clé de service, donc sur un autre secret effectif. Deux Workers à secrets différents calculent deux jetons de suivi différents pour la même clé d'idempotence : un nouvel essai qui change de Worker (relais éteint entre-temps, repli) créerait **une seconde commande**. Les compteurs de limitation se séparent aussi (plafonds doublés pendant l'allumage ou un repli).

**On aligne l'API sur le site, jamais l'inverse** : changer la valeur du site casserait les QR de table déjà imprimés et tous les compteurs.

**Vérification (Tâche 12, avec Malika, aucun agent ne lit de secret)** : (1) noms seulement, `npx wrangler secret list` depuis `apps/web` et `apps/api` : `COMMANDE_JETON_SECRET` présent sur les **deux** ou absent des **deux**, `SUPABASE_SERVICE_ROLE_KEY` sur les deux ; sinon, rien ne s'allume ; (2) présent des deux côtés : Malika recopie elle-même la valeur du site sur l'API (`wrangler secret put`) ; (3) preuve par le comportement, si Malika l'accepte (décision du 31 octobre : commande `est_test` sur un restaurant d'essai, seulement avec les feux verts de la Tâche 12) : la **même clé d'idempotence** envoyée au site (relais éteint pour `commandes`) puis à l'API doit donner `200`, `idempotent: true` et **le même jeton de suivi** ; (4) sans cet essai, `commandes` ne s'allume pas ; `suivi` (qui ne dérive aucun jeton) peut s'allumer, au risque tolérable des compteurs séparés.

## Essai local de l'étape 1c-1 sous workerd (31 octobre 2026)

`wrangler dev` local (workerd), trois requêtes : `POST /suivi` avec un jeton bien formé mais inventé (404 `Commande introuvable.`, joué deux fois pour mesurer à froid et à chaud), `POST /suivi` avec un corps `{}` (400) et `GET /commandes` sans jeton (401). **Ce n'est pas « aucune écriture »** : les deux appels `POST /suivi` ont chacun écrit un **compteur de limitation** dans la base de **production** (Redis absent de `.dev.vars`, repli sur `fn_limiter_debit`). Il n'y a eu **aucune écriture métier** (rien dans `orders` ni dans une autre table métier, aucune commande créée). Le jeton inventé n'apparaît dans aucun journal.

**Observé** : le chargement du Worker et les requêtes sans exception ; `createHmac` s'exécute sous workerd (l'empreinte des compteurs de limitation l'utilise, les deux appels ont abouti).

**NON vérifié** : `randomInt` (référence `SF-XXXXX` de la commande, atteint seulement à une vraie création) ; `request.clone()` du relais sous OpenNext/workerd (le relais vit dans le site, éteint) ; `ctx.waitUntil` réel et la fin de la tâche d'alerte du restaurant (testé avec un faux contexte seulement) ; le CPU réel en production (limite de 10 ms du plan gratuit ; `wrangler dev` ne le mesure pas ; créer une commande est la plus lourde des routes, risque de 1102 jamais mesuré) ; que le Worker n'est pas coupé quand le site abandonne l'appel sur délai.

**Taille du Worker** : 1 193 032 octets (1 165 Kio), 237 802 octets compressés (gzip niveau 6, soit 232,2 Kio ; offre gratuite : 3 Mio compressés), contre 857 Kio à l'étape 1b ; un test plafonne le Worker (brut sous 1 400 000 octets, gzip sous 3 Mio) en plus de la sonde des services. `react` entre dans le paquet par `fonctionnalites/lire.ts` (le garde ne cite que `react-dom`), donc `cache` de React n'y mémoïse pas : possiblement une lecture de plus de `fonctionnalites` par création.

**À faire par Malika : supprimer `apps/api/.dev.vars` quand les essais sont finis.** Ce fichier (ignoré par Git, jamais lu ni affiché par un agent) contient la **clé de service de production**.

## Essai local face à la production (étape 1a, 31 octobre 2026)

`wrangler dev --local` (workerd local, port 8788) comparé à la production du site, deux GET publics en lecture seule : **2 routes identiques, 0 écart** (`version`, `aide`). Les huit autres routes ne l'ont pas été (aucun essai réel avant la Tâche 10).

## Mise en production (31 octobre 2026)

Worker `speedfood-api` créé par Malika (version 5385f34c), site redéployé (f3975d7d). Relais allumé pour `public,moi,client,livraison` (livraison vérifié seulement sans jeton). Parité face à la production : `version`, `aide`, `connexion/fournisseurs` (0 écart) ; `moi` et `client/espace` avec un vrai jeton, via `apps/api/scripts/test-jeton-reel.mjs` (le mot de passe est saisi par la personne, masqué, le jeton reste en mémoire) : identiques. Retour arrière : `API_RELAIS=non`.

## Ce qui n'est PAS vérifié

- **L'adresse que Cloudflare met dans `cf-connecting-ip`** pour un appel entre deux Workers : le plan ne s'y fie pas (le secret de relais contourne la question).
- **La parité de `lireRolesCompte` et de l'espace client avec la production, sans vrai jeton** : le service extrait n'est pas testé unitairement (requêtes de base) ; l'essai avec un vrai jeton du 31 octobre 2026 a confirmé `moi` et `client/espace` (lectures) ; les écritures restent jamais comparées.
- **Le coût du relais dans l'offre gratuite** : une sous-requête de plus par appel et deux invocations ; si le relais soulage réellement le Worker du site n'est pas mesuré.
- **L'émetteur `iss` réel d'un vrai jeton Supabase du projet** : jamais lu ; seuls des jetons de test l'ont exercé.
- **`process.env` sous workerd en production** : les services du site lisent leur configuration par `process.env` ; que les variables et secrets du Worker apparaissent bien dans `process.env` (drapeau `nodejs_compat`, date de compatibilité) est supposé.
- **Temps de démarrage et CPU du Worker avec `supabase-js`** : le paquet fait 857 Kio ; aucune mesure sur Cloudflare (erreur 1102 : voir l'historique du site).
- **Le comportement de l'API quand `x-relais-ip` est omis** (adresse du visiteur invalide côté site) : l'API retombe sur ce que Cloudflare lui donne, non observé.
- **`getUser` pour un compte supprimé** : le statut réellement renvoyé n'a pas été observé.
- **Le comportement sur Cloudflare réel en général** : l'essai tourne dans workerd local. Le Worker n'existe pas chez Cloudflare. Le quota partagé avec le site (Redis et base) et la charge combinée ne sont pas mesurés.
- **`COMMANDE_JETON_SECRET`** : absent de `apps/web/.env.local`, donc jamais préparé dans `.dev.vars` ; les routes de commande du plan 1c en auront besoin.
- Aucun essai de charge, aucune écriture réelle.
- **Étape 1c-1** (voir aussi « Essai local de l'étape 1c-1 ») : le comportement de la création de commande relayée sur Cloudflare réel (durée, CPU, 1102) ; `randomInt` ; `clone()` ; `waitUntil` réel ; l'égalité des secrets de production (seule la présence des noms se voit, plus l'essai d'idempotence croisée si Malika l'accepte) ; le délai de l'application mobile : relevé dans le code, `requestTimeoutMillis = 20_000` (`mobile/shared/src/commonMain/kotlin/com/speedfood/app/di/Koin.kt`, l.189), donc plus que les délais du relais (8 000 et 15 000 ms) ; et `CommandeViewModel.kt` (l.176-178) garde la même clé d'idempotence tant que le panier, le mode ou la destination ne changent pas. Conséquence attendue (non essayée) : un 500 renvoyé par le site après 15 s, puis un nouvel essai, donne un rejeu idempotent 200 (pas de doublon), **à condition que `COMMANDE_JETON_SECRET` soit identique sur les deux Workers** (à vérifier en Tâche 12) ; à surveiller en Tâche 12 : si le relais de `POST /suivi` retombe sur le site après panne ou délai, le plafond `limiterLectureSuivi` peut être compté deux fois (API puis site), et si les secrets diffèrent les compteurs des deux Workers se séparent (effet faible : plafond par jeton) ; les écritures (`annuler`, `proposition`, `POST commandes`) jamais comparées à la production ; la parité exacte de `listerMesCommandes`, `chargerSuiviParJeton`, `annulerParClient`, `repondreProposition` sous Workers sans vrai jeton (mêmes fonctions que le site, mais exécution observée seulement à la Tâche 12) ; l'ordre des clés JSON ; le coût du relais dans l'offre gratuite ; la mémoïsation de `fonctionnaliteActive`.

## Réserves traitées le 31 octobre 2026

Lot « réserves avant allumage » (commit `bbb482e`, puis correctifs de relecture). Une réserve n'est marquée faite que si un test échoue quand on casse le code : chaque correctif a été vérifié par mutation (condition retirée, seuil décalé, garde supprimée, regex élargie : toutes les mutations tentées font échouer au moins un test ; une seule survit, équivalente, sur `valeur.length > 0` qui double la regex).

1. **Décision pure testée** (`decisionRelais` dans `relais-regles.ts`) : éteint / mal configuré / relayer ; `relais.ts` n'est plus qu'une colle de quelques lignes (lecture de `process.env`, journal, appel). Tests dans `apps/web/scripts/tests/relais.test.mts`. Non vérifié : l'exécution de la colle dans Next (aucun test ne lance Next).
2. **`API_URL`** : `https://` exigé ; `http://` toléré seulement vers `localhost`, `127.0.0.1`, `[::1]` ; identifiants dans l'adresse (`user:pass@`), chaîne de requête, fragment, chemin autre que `/` et adresse illisible refusés (le chemin de la requête est collé à cette base : un préfixe serait gardé sans que personne l'ait voulu). Sinon : mal configuré (le site traite lui-même, aucune requête, le secret ne part jamais en clair).
3. **HEAD** traité comme GET : relayé sans corps, repli permis.
4 et 12. **Réponses sans corps** (204, 205, 304) : la réponse est reconstruite sans corps, plus de plantage. Testé pour 204, 205, 304, une écriture suivie d'un 204, et un 200 au corps vide. 101 et 103 ne sont pas gérés : `fetch` ne les rend pas à l'appelant et `new Response` ne les construit pas.
5. **Journal `relais_mal_configure`** écrit une seule fois par isolat (`creerSignalUnique`, drapeau de module), sans secret ni adresse.
7. **`x-relais-ip` côté API** : acceptée seulement si 45 caractères au plus et `[0-9a-fA-F:.]` uniquement ; sinon `cf-connecting-ip` inchangé (les deux en-têtes de relais sont toujours retirés).
9. **Secrets lus à l'appel** : test **statique** sur le source de `worker.ts` (`apps/api/tests/worker-source.test.ts`) qui échoue si `process.env` est lu hors d'une fonction fléchée. Il ne prouve PAS que `worker.ts` s'exécute ni que `process.env` est rempli sous workerd (reste dans « Ce qui n'est PAS vérifié »).
10. **Secret de relais de forme valide** : `/^[!-~]{32,}$/` (de `!` à `~`, 32 caractères au moins). Côté API, un secret attendu hors de cette forme n'accorde jamais la confiance (même si l'appelant envoie la même valeur) ; côté site, un `RELAIS_SECRET` hors de cette forme = mal configuré. Pourquoi la forme et pas seulement la longueur : un retour à la ligne ou un accent fait planter la pose de l'en-tête (500 sur toutes les requêtes relayées), des espaces de bord sont retirés par les en-têtes alors que l'API compare la valeur entière (confiance refusée en silence).
11. **Comparateur** : toute écriture (méthode autre que GET/HEAD, casse indifférente), avec OU sans jeton, est refusée (code 2, message sans valeur, aucune requête) sauf avec `--autoriser-ecriture` ; les autres gardes (https ou boucle locale, hôte) restent appliquées.

## Réserves restantes

- **6 (documenté ici, non corrigé)** : le délai de 2 500 ms couvre aussi la lecture du corps de la réponse. Une écriture déjà traitée par l'API peut donc renvoyer 500 au client (la requête n'est jamais rejouée, mais le client ne sait pas qu'elle a abouti). Le comportement attendu côté application (vérifier l'état avant de réessayer une écriture) reste **à documenter dans le guide de l'application** ; ce guide n'existe pas encore.
- **8** : `worker.ts`, le `?? ""` sur l'URL Supabase du mode local, à traiter au plan 1c (le mode local n'est utilisé par aucune route de ce plan).
- **9 (partielle)** : la lecture à l'appel est gardée par un test statique ; aucun test n'exécute `worker.ts`.

## À faire au plan 1b / 1c

Fait au plan 1b : panne JWKS distinguée du jeton invalide (et 408/429 du service d'authentification traités en panne) ; vérificateur strict ; câblage du vérificateur au Worker ; construction avant `wrangler dev` (script `predev`) ; décision de jetons appliquée.

Reste :
1. **Politique CORS.** L'API n'en a aucune (valeur sûre : l'application native n'en a pas besoin). À trancher si le navigateur du site appelle l'API.
2. **Construire (`npm run build`) juste avant tout `wrangler dev` ou déploiement** : `no_bundle` sert `dist` tel quel, un `dist` périmé serait publié sans erreur. `npm run dev` le fait seul ; un déploiement manuel doit le faire explicitement.
3. Les réserves restantes ci-dessus (6, 8, 9 partielle) ; les autres sont traitées (31 octobre 2026).

## Ce qui reste

- **Étapes 1a et 1b** : faites et en production (voir « Mise en production »). Restent à accepter ou traiter les réserves 6 (écriture déjà traitée mais 500 rendu : à documenter dans le guide de l'application), 8 (`?? ""` du mode local) et 9 en partie (aucun test n'exécute `worker.ts`).
- **Tâche 12 de l'étape 1c-1** (mise en service, uniquement sur le feu vert de Malika, conduite avec elle) : déployer l'API puis le site avec `API_RELAIS` inchangé (`suivi` et `commandes` éteints), vérifier `COMMANDE_JETON_SECRET` (section ci-dessus), comparer `POST /suivi` avec un vrai jeton de suivi d'une commande d'essai (`--corps-env`), allumer `suivi`, mesurer, puis `GET /commandes`, puis `POST /commandes` (essai d'idempotence croisée si acceptée). Jamais `API_RELAIS=tout`.
- **Plan 1c-2 et suivants** : routes du livreur, du restaurateur, de l'équipe ; mode local pour la position du livreur ; droits par rôle, validation, audit.
- **Politique CORS** : l'API n'en a aucune (valeur sûre pour l'application native) ; à trancher si le navigateur du site appelle l'API.
- **Construire (`npm run build`) juste avant tout `wrangler dev` ou déploiement** : `no_bundle` sert `dist` tel quel, un `dist` périmé serait publié sans erreur. `npm run dev` le fait seul.
- Contrôle GitHub vert sur la branche puis fusion en avance rapide dans `master` (rien n'est déployé par la fusion) : sur accord de Malika, après la relecture finale.
