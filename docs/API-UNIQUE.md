# API unique de Speedfood (`apps/api`) : étape 1a, socle (31 octobre 2026)

**État : code écrit et testé en local, NON déployé.** Le Worker `speedfood-api` n'existe pas encore chez Cloudflare ; les utilisateurs ne voient rien. Plan : `docs/plans/2026-10-31-etape-1a-socle-api.md`. Cible d'ensemble : `docs/specs/2026-10-30-architecture-cible-design.md` (section 5).

## À quoi ça sert, et pourquoi un Worker séparé

Les futures applications (React Native) et le site parleront à une seule API, au contrat uniforme `{ ok: false, erreur: { code, message } }` en cas d'erreur. Elle est un **Worker séparé** du site (`speedfood-app`) : on la déploie, la corrige ou la retire sans toucher au site, et sa limite de CPU est comptée à part. Elle **réutilise les services du site** (accès à la base, limitation de débit, règles) au lieu de les recopier, mais sans embarquer Next.js.

## Ce qui existe (étape 1a)

Hono sur Workers, deux routes publiques en lecture seule : `GET /api/v1/version`, `GET /api/v1/aide`, plus `GET /sante`. Toute route inconnue répond 404 `INTROUVABLE`. Une erreur non prévue répond 500 sans détail (rien ne fuit).

```
apps/api/
  package.json, tsconfig.json, wrangler.jsonc   Worker « speedfood-api » (valeur publique seulement ; secrets jamais ici)
  build.mjs                 assemblage esbuild + garde « aucun fichier de Next.js dans le paquet »
  src/app.ts                application Hono (erreurs au contrat, premier maillon : en-têtes de la requête)
  src/worker.ts             câblage de PRODUCTION : les routes reçoivent les services du site
  src/types.ts              dépendances injectées (testables sans réseau)
  src/routes/               version.ts, aide.ts
  src/cales/                next-headers.ts (cale de headers()), vide.ts (module « server-only » vide)
  src/controles/chaine.ts   briques de la chaîne de contrôles
  src/identite/jeton.ts     vérification locale des jetons Supabase (ES256)
  sondes/                   services.ts (services du site qui doivent tenir sans Next), interdit.ts (sonde fautive qui prouve la garde)
  scripts/                  comparateur.mjs, comparer-routes.mjs, preparer-dev-vars.mjs, résolveur TypeScript des tests
  tests/                    app, routes, jeton, chaine, construction, comparateur
```

Les règles pures partagées (version de l'application, règles de l'API v1) vivent dans `packages/shared` (`@speedfood/shared`), avec un raccord d'une ligne à leur ancienne place dans le site.

## Commandes

`npm install` se lance **à la racine**. Les commandes `npm run …` de l'API se lancent depuis `apps/api` ; `typecheck`, `test:api` et `build:api` existent aussi à la racine.

| Commande | Où | Rôle |
|---|---|---|
| `npm run test` | `apps/api` (ou `npm run test:api` à la racine) | tests de l'API (32 au 31 octobre 2026), Node avec `--experimental-strip-types` (Node 24 en local, 22 sur GitHub : non vérifié sur GitHub à ce jour) |
| `npm run build` | `apps/api` (ou `npm run build:api` à la racine) | écrit `dist/worker.js` (786 Kio au 31 octobre 2026) et **échoue** si un fichier de Next.js est entré dans le paquet |
| `npm run typecheck` | racine | types de tous les paquets, API comprise |
| `npm run preparer-dev-vars` | `apps/api` | écrit `.dev.vars` (ignoré par Git) depuis `apps/web/.env.local`, sans jamais afficher un secret |
| `npm run dev` | `apps/api` | `wrangler dev` (workerd local ; construire d'abord) |
| `npm run comparer -- <réf> <candidate> <chemins…>` | `apps/api` | compare des routes entre deux serveurs (statut, cache, corps), en GET |

Deux pièges du comparateur :
- Sous **Git Bash**, un argument comme `/api/v1/version` est converti en chemin Windows : préfixer par `MSYS_NO_PATHCONV=1` (`MSYS_NO_PATHCONV=1 npm run comparer -- … /api/v1/version`).
- Un côté hors 2xx est **un écart** (deux erreurs identiques ne passent pas pour « 0 écart »). `--tolerer-non-2xx` désactive ce contrôle quand on compare volontairement des erreurs.

## Mécanisme de réutilisation des services du site

Les services du site importent `server-only` et `next/headers`. L'API les réutilise sans Next.js par quatre moyens :
1. **Alias `server-only`** : `build.mjs` le remplace par un module vide (`src/cales/vide.ts`).
2. **Cale `next/headers`** (`src/cales/next-headers.ts`) : `headers()` rend les en-têtes de la requête en cours, tenus dans un `AsyncLocalStorage` posé par le premier maillon de l'application. Deux requêtes concurrentes ne voient jamais les en-têtes l'une de l'autre (test avec délai croisé).
3. **Garde de construction** : après l'assemblage, `build.mjs` liste les fichiers entrés dans le paquet et échoue si l'un vient de `node_modules/next/`, `@opennextjs/` ou `react-dom/`. La sonde `sondes/interdit.ts` (importe `next/server`) prouve, dans un test, que la garde se déclenche vraiment.
4. **Sonde des services** : `sondes/services.ts` importe `creerClientAdmin`, `limiterClientApplication` et l'espace client du site ; elle a passé la construction du premier coup, sans modifier le site (alias `@/*` résolu par le tsconfig de l'API vers `apps/web/src`).

### Services pas encore utilisables par l'API
Aucun à ce jour : la sonde a tout passé. Cela prouve que ces services **s'assemblent** sans Next.js, pas qu'ils **fonctionnent** sur Cloudflare (voir plus bas).

## Chaîne de contrôles (design section 5)

Livrée, sous forme de briques testées (`src/controles/chaine.ts`), dans cet ordre, chacune court-circuitant les suivantes :
1. limite de débit par adresse (avant l'identité) ;
2. identité par **jeton porteur uniquement** (les cookies du site ne sont jamais lus) ;
3. limite de débit par compte (le compte vient du jeton vérifié, jamais d'un identifiant envoyé).

**Reste (plan 1b)** : droits (rôle, restaurant), validation des entrées, règle métier, audit.

**Important : le vérificateur de jetons n'est PAS câblé au Worker.** Les deux routes livrées sont publiques ; aucune route authentifiée n'existe encore, donc `identifier` et `verifierJetonLocal` ne sont exercés que par les tests (jetons fabriqués avec des clés de test), jamais par le Worker.

## Vérification des jetons : deux modes, compromis, décision en attente

- **Local (livré, `verifierJetonLocal`)** : signature ES256, émetteur `<url Supabase>/auth/v1`, audience `authenticated`, expiration, `sub` non vide. Clés publiques lues une fois chez Supabase et gardées en mémoire de l'isolat (renouvellement au plus toutes les 10 minutes). Rapide, aucun appel au service d'authentification. Testés : jeton expiré, mauvaise clé, mauvais émetteur, mauvaise audience, `alg: none`.
- **Strict (non écrit)** : interroger le service d'authentification à chaque appel. Plus lent et plus coûteux en requêtes, mais un compte supprimé ou banni est refusé tout de suite.

**Compromis** : en mode local, un compte supprimé ou banni reste accepté jusqu'à l'expiration de son jeton (environ une heure). **Décision en attente de Malika** : tout en local, tout en strict, ou local par défaut et strict pour les actions sensibles. À trancher avant le plan 1b.

## Essai local face à la production (31 octobre 2026)

`wrangler dev --local` (workerd local, port 8788) comparé à la production du site, deux GET publics en lecture seule :
`MSYS_NO_PATHCONV=1 npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide`
Résultat : **2 routes identiques, 0 écart** (code de sortie 0). Contrôle manuel : les deux côtés répondent 200, `application/json`, `Cache-Control: public, max-age=300`. La route `aide` a lu le numéro WhatsApp dans la base de production avec la vraie clé service-role de `.env.local` (lecture seule). Depuis, le comparateur a été durci (écart si hors 2xx) ; l'essai réel n'a pas été relancé après ce durcissement, les deux routes répondant 200 au moment de l'essai.

## Ce qui n'est PAS vérifié

- **L'émetteur réel d'un vrai jeton** : la valeur `iss` d'un vrai jeton Supabase du projet n'a jamais été lue ; l'émetteur attendu est construit à partir de l'adresse du projet, et seuls des jetons de test l'ont exercé. À contrôler avec un vrai jeton avant la première route authentifiée.
- **Le comportement sur Cloudflare réel** : l'essai tourne dans workerd local. Réseau, limite de CPU (erreur 1102 : voir l'historique du site), liaisons et secrets de production ne sont pas éprouvés. Le Worker n'existe pas chez Cloudflare.
- **Le quota partagé avec le site** : l'API et le site useront le même Redis (offre gratuite) et la même base ; le partage du quota et la charge combinée n'ont pas été mesurés.
- **`process.env` sous workerd en production** : les services du site lisent leur configuration par `process.env`. Local, `.dev.vars` le remplit ; en production, que les variables et secrets du Worker apparaissent bien dans `process.env` (drapeau `nodejs_compat`, date de compatibilité) est supposé, non vérifié.
- **`COMMANDE_JETON_SECRET`** : absent de `apps/web/.env.local`, donc jamais vérifié ni préparé dans `.dev.vars`. Aucune route livrée n'en a besoin ; les routes de commande du plan 1b en auront besoin.
- Seules deux routes publiques en GET ont été comparées ; aucune écriture, aucun test de charge.

## À faire au plan 1b

1. **Distinguer la panne JWKS/réseau du jeton invalide dans `verifierJetonLocal`, avant de le câbler.** Aujourd'hui toute erreur (jeton invalide, mais aussi clés Supabase injoignables) rend `null`, donc un 401. Une panne de Supabase donnerait des 401 en masse que l'application pourrait prendre pour une session expirée. La panne doit sortir en 500/503 (la chaîne répond déjà 500 sans fuite quand le vérificateur lève, test de non-régression dans `chaine.test.ts`), le jeton invalide rester `null`.
2. **Politique CORS.** L'API n'en a aucune (valeur sûre : l'application native n'en a pas besoin). À trancher si le navigateur du site appelle l'API.
3. **Construire (`npm run build`) juste avant tout `wrangler dev` ou déploiement** : `no_bundle` sert `dist` tel quel, un `dist` périmé serait publié sans erreur. `npm run dev` le fait seul (script `predev`) ; un déploiement manuel doit le faire explicitement.

## Ce qui reste

- **Plan 1b** : routes par modules, relais du site vers l'API, câblage du vérificateur de jetons, droits, validation, audit.
- **Décision de Malika** : mode des jetons (ci-dessus).
- **Tâche 8** : création du Worker `speedfood-api` chez Cloudflare, secrets, déploiement et vérification en réel. Uniquement avec le feu vert explicite de Malika, conduite avec elle.
- Contrôle GitHub vert sur la branche puis fusion en avance rapide dans `master` (rien n'est déployé par la fusion).
