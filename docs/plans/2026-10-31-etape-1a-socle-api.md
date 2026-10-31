# Étape 1a, socle de l'API unique : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-compétence requise : `subagent-driven-development` (recommandé) ou `executing-plans`. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** poser le Worker `speedfood-api` (Hono, Cloudflare Workers) avec sa chaîne de contrôles, la vérification locale des jetons, une garde qui interdit à Next.js d'entrer dans son code, un comparateur de routes, et prouver le tout avec deux routes publiques réelles (`/api/v1/version`, `/api/v1/aide`), **sans rien déployer ni changer pour les utilisateurs**.

**Architecture :** nouvelle application `apps/api` de l'espace de travail npm. L'API **réutilise** les services du site (`apps/web/src/lib/**`) au lieu de les copier : un seul endroit pour les règles. Elle les assemble avec esbuild, qui remplace `server-only` par un module vide et `next/headers` par une cale qui lit les en-têtes de la requête courante (`AsyncLocalStorage`). Une garde de construction échoue si un seul fichier de Next.js entre dans le paquet. Les routes reçoivent leurs dépendances par injection : on les teste avec de fausses dépendances, sans réseau ni Supabase.

**Pile :** Hono 4.13.14, jose 6.2.14 (vérification ES256), esbuild, wrangler 4, TypeScript 5, `node:test` avec suppression de types de Node (sans compilateur de test supplémentaire).

Design de référence : `docs/specs/2026-10-30-architecture-cible-design.md` §5 (API unique) et §9 étape 1. Cette étape est la **première moitié** de l'étape 1 ; la suite (modules de routes, relais depuis le site) fera l'objet d'un plan 1b.

## Contraintes globales

Copiées du design et de `CLAUDE.md` ; elles s'appliquent à chaque tâche.

- Un seul dépôt TypeScript : `apps/` et `packages/`.
- **Le déploiement en production reste manuel**, avec le feu vert explicite de Malika (D10). Rien dans ce plan ne déploie, hors la Tâche 8, qui n'a lieu que sur sa demande et que **je** (le contrôleur) conduis avec elle, pas un sous-agent.
- Aucune dépense, aucun compte ni projet cloud sans consigne explicite de Malika. Le Worker `speedfood-api` n'est créé chez Cloudflare qu'à la Tâche 8.
- Le pilote ne s'arrête jamais : à l'étape 1a, **les utilisateurs ne voient rien**.
- Le serveur décide : prix, statuts et droits ne se décident jamais côté client ; l'identifiant de restaurant reçu du navigateur n'est jamais une autorisation.
- Aucune donnée sensible (mot de passe, clé, jeton) dans le code, les commits ou les journaux. `.env.local` et `.dev.vars` ne sont jamais commités. Un script qui lit un secret ne l'affiche jamais.
- Montants GNF : entiers, jamais en flottant.
- Un exit code `0` est exigé pour dire qu'une vérification passe (le test écrit « ECHEC » sans accent ; un plantage n'écrit rien).
- Écrire les fichiers contenant des antislashs ou des expressions régulières avec l'outil d'écriture de fichiers, jamais avec `node -e` ou un heredoc.
- Les commandes `npm run …` se lancent depuis le dossier de l'application ; `npm install` se lance **à la racine**.
- Avant d'écrire dans une table, lire ses contraintes (`supabase/migrations/`). Cette étape n'écrit dans aucune table.
- Branche de travail : `etape-1a-socle-api` (le contrôle GitHub tourne sur `etape-*`). Fusion en avance rapide dans `master` seulement après contrôle vert.

## Faits vérifiés avant d'écrire ce plan (31 octobre 2026)

- **Signature des jetons :** le projet Supabase publie une clé **ES256** (`https://ggldjdizqrtpetdiohxy.supabase.co/auth/v1/.well-known/jwks.json`, une clé `P-256`). La vérification locale est donc possible : c'était une question ouverte du design (§10).
- **Aujourd'hui** l'API du site vérifie chaque jeton avec `auth.getUser(jeton)` (appel réseau à Supabase, clé service-role) : `apps/web/src/lib/api/v1.ts`. Ce contrôle confirme aussi que **le compte existe encore**. Une vérification purement locale accepte un jeton valide **jusqu'à son expiration** même si le compte vient d'être supprimé ou banni. Le plan fournit donc **deux modes** (`local` et `strict`) et branche `strict` par défaut tant que Malika n'a pas tranché (voir Tâche 3 et « Décisions à confirmer »).
- **Les routes sont minces** : elles lisent la requête, appellent un service (`lib/**/*-service.ts`) et formatent la réponse. 77 routes sous `apps/web/src/app/api/v1`.
- **Liens avec Next dans `lib` :** 345 fichiers, dont 121 importent `server-only` (un simple marqueur) et 80 importent `next/…`. Dans le code de limitation de débit, **un seul** appel dépend de Next : `headers()` de `next/headers`, dans `adresseClient()`. La cale `AsyncLocalStorage` le remplace sans modifier un seul fichier du site.
- **Les services lisent `process.env.*`** (clé service-role, secrets) : cela fonctionne dans un Worker avec `nodejs_compat` (le site s'en sert déjà).
- **Versions :** `hono` 4.13.14, `jose` 6.2.14, `wrangler` 4.156.0 sont les dernières publiées au 31 octobre 2026 ; esbuild 0.28.1 est déjà installé (dépendance de wrangler).

## Décisions à confirmer par Malika (n'empêchent pas l'exécution des tâches 1 à 7)

1. **Jetons : strict ou local ?** `strict` (comme aujourd'hui) garantit qu'un compte supprimé est refusé tout de suite, au prix d'un aller-retour Supabase par requête ; `local` est plus rapide et ne coûte aucun appel réseau, mais un compte supprimé garde ses droits **jusqu'à une heure** (durée de vie du jeton). Proposition : `local` pour les lectures très fréquentes (position du livreur, relecture des commandes du restaurateur), `strict` partout ailleurs. À trancher avant le plan 1b.
2. **Création du Worker `speedfood-api`** chez Cloudflare (Tâche 8) : gratuit, mais c'est un service de plus ; elle le crée sur son feu vert.

## Écarts assumés et hors périmètre

- **Hors périmètre :** déplacer d'autres routes que `version` et `aide` ; le relais du site vers l'API ; droits, validation et journal d'audit de la chaîne (le plan ne livre que limite de débit, identité, et le câblage) ; le client typé `packages/api-client` ; le second projet Supabase d'essai (D9).
- **Écart de méthode :** les tests de `apps/api` n'utilisent pas le lanceur maison du site (`apps/web/scripts/tests/lancer.mjs`) mais `node --test` avec un petit résolveur d'imports (`scripts/resolveur-ts.mjs`). Raison : les services de l'API sont injectés, donc aucun test n'a besoin de l'alias `@/` ni de copies temporaires.
- **Jeton de test :** la vérification d'un **vrai** jeton Supabase (valeur exacte de l'émetteur `iss`) ne peut pas se faire sans connexion à un compte : elle est testée avec des jetons signés localement, et l'émetteur réel est confirmé au plan 1b avec un compte de test.

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `apps/api/package.json` | Créer | Paquet `@speedfood/api`, scripts `typecheck`, `test`, `build`, `dev`, `comparer` |
| `apps/api/tsconfig.json` | Créer | Types stricts ; chemins `@/*`, `server-only`, `next/headers` pour le vérificateur de types |
| `apps/api/wrangler.jsonc` | Créer | Worker `speedfood-api`, `no_bundle`, variables publiques |
| `apps/api/build.mjs` | Créer | Assemblage esbuild + garde « aucun fichier de Next » + taille |
| `apps/api/scripts/resolveur-ts.mjs`, `enregistrer-resolveur.mjs` | Créer | Résolution des imports sans extension dans les tests |
| `apps/api/scripts/comparateur.mjs`, `comparer-routes.mjs` | Créer | Comparaison de routes entre deux adresses |
| `apps/api/scripts/preparer-dev-vars.mjs` | Créer | Écrit `.dev.vars` à partir de `.env.local` sans rien afficher |
| `apps/api/src/app.ts` | Créer | Fabrique `creerApp(deps)` : cale d'en-têtes, `/sante`, routes, erreurs uniformes |
| `apps/api/src/types.ts` | Créer | Interface `Deps` |
| `apps/api/src/cales/next-headers.ts`, `vide.ts` | Créer | Remplaçants de `next/headers` et `server-only` |
| `apps/api/src/routes/version.ts`, `aide.ts` | Créer | Les deux premières routes |
| `apps/api/src/identite/jeton.ts` | Créer | Vérification locale ES256 du jeton Supabase |
| `apps/api/src/controles/chaine.ts` | Créer | Briques de la chaîne : limite de débit, identité, limite par compte |
| `apps/api/src/worker.ts` | Créer | Câblage de production (services du site) |
| `apps/api/sondes/services.ts` | Créer | Sonde de construction : les services du site tiennent-ils sans Next ? |
| `apps/api/tests/*.test.ts` | Créer | Tests de chaque brique |
| `packages/shared/src/api/v1-regles.ts`, `application/version.ts` | Déplacer | Règles pures utilisées par le site et l'API (raccords laissés) |
| `.github/workflows/controles.yml`, `.gitignore`, `package.json` (racine) | Modifier | Contrôles de l'API, fichiers ignorés |
| `docs/API-UNIQUE.md`, `docs/STATUT-PROJET.md`, `docs/ORGANISATION-DU-DEPOT.md` | Créer / modifier | Documentation |

---

### Tâche 1 : Squelette de `apps/api` et premier test

**Fichiers :**
- Créer : `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/scripts/resolveur-ts.mjs`, `apps/api/scripts/enregistrer-resolveur.mjs`, `apps/api/src/app.ts`, `apps/api/src/types.ts`, `apps/api/src/cales/next-headers.ts`, `apps/api/src/cales/vide.ts`, `apps/api/tests/app.test.ts`
- Modifier : `.gitignore`

**Interfaces :**
- Consomme : `@speedfood/shared/contracts/erreurs` (existant : `ErreurMetier`, `ErreurApi`) et `@speedfood/shared/api/v1-regles` (déplacé à la Tâche 2 ; à la Tâche 1, utiliser provisoirement `statutHttp` copié **n'est pas permis** : voir étape 4, la Tâche 1 crée l'application sans l'import de `statutHttp`, et la Tâche 2 l'ajoute).
- Produit : `creerApp(deps: Deps): Hono`, `type Deps`, `entetesCourants: AsyncLocalStorage<Headers>`, `headers(): Promise<Headers>` (cale), commande `npm run test --workspace @speedfood/api`.

- [ ] **Étape 1 : Créer la branche**

```bash
cd /c/Users/moelo/dev/speedfood
git checkout master && git pull --ff-only
git checkout -b etape-1a-socle-api
```

- [ ] **Étape 2 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/app.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { headers } from "../src/cales/next-headers.ts";
import type { Deps } from "../src/types.ts";

const deps: Deps = {
  version: { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 },
  lireAssistance: async () => ({ whatsapp: null }),
};

test("/sante répond ok sans cache", async () => {
  const reponse = await creerApp(deps).request("/sante");
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true });
  assert.equal(reponse.headers.get("cache-control"), "no-store");
});

test("une route inconnue répond INTROUVABLE au format uniforme", async () => {
  const reponse = await creerApp(deps).request("/api/v1/nexiste-pas");
  assert.equal(reponse.status, 404);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "INTROUVABLE", message: "Route inconnue." } });
});

test("une erreur non prévue répond ERREUR_SERVEUR sans fuite de détail", async () => {
  const app = creerApp({ ...deps, lireAssistance: async () => { throw new Error("secret interne"); } });
  const reponse = await app.request("/api/v1/aide");
  assert.equal(reponse.status, 500);
  const corps = JSON.stringify(await reponse.json());
  assert.ok(corps.includes("ERREUR_SERVEUR"));
  assert.ok(!corps.includes("secret interne"));
});

test("la cale next/headers lit les en-têtes de la requête en cours, et refuse hors requête", async () => {
  let vu: string | null = null;
  const app = creerApp({
    ...deps,
    lireAssistance: async () => {
      vu = (await headers()).get("cf-connecting-ip");
      return { whatsapp: null };
    },
  });
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "203.0.113.9" } });
  assert.equal(vu, "203.0.113.9");
  await assert.rejects(() => headers(), /hors requête/);
});
```

Ce test couvre aussi `/api/v1/aide` ; il échouera tant que la Tâche 2 n'a pas ajouté la route (voir étape 5 : le test de l'erreur et celui de la cale sont **remis à la Tâche 2**). Pour la Tâche 1, ne garder dans le fichier que les deux premiers tests ; les deux autres sont ajoutés à la Tâche 2, étape 6.

- [ ] **Étape 3 : Créer le paquet et la configuration** (outil Write)

`apps/api/package.json` (relever la version de `@types/node` dans `apps/web/package.json` et la reprendre telle quelle ; relever la version d'esbuild installée avec `npm ls esbuild` et reprendre celle qui est à la racine) :

```json
{
  "name": "@speedfood/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "API unique de Speedfood (Hono sur Cloudflare Workers). Réutilise les services du site, sans Next.js.",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "node --experimental-strip-types --import ./scripts/enregistrer-resolveur.mjs --test \"tests/**/*.test.ts\"",
    "build": "node build.mjs",
    "dev": "wrangler dev",
    "preparer-dev-vars": "node scripts/preparer-dev-vars.mjs",
    "comparer": "node scripts/comparer-routes.mjs"
  },
  "dependencies": {
    "@speedfood/shared": "*",
    "hono": "4.13.14",
    "jose": "6.2.14"
  },
  "devDependencies": {
    "@types/node": "<même version que apps/web>",
    "esbuild": "<version installée à la racine>",
    "typescript": "^5",
    "wrangler": "^4.142.0"
  }
}
```

`apps/api/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["esnext", "dom"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "types": ["node"],
    "paths": {
      "@/*": ["../web/src/*"],
      "server-only": ["./src/cales/vide.ts"],
      "next/headers": ["./src/cales/next-headers.ts"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "sondes/**/*.ts"]
}
```

`apps/api/scripts/resolveur-ts.mjs` :

```js
// Hook de résolution des tests : un import relatif sans extension, écrit dans un fichier .ts, vise le fichier « .ts » voisin.
// Les règles partagées s'écrivent sans extension (Next et le lanceur du site les attendent ainsi) ; Node, lui, exige l'extension.
export async function resolve(specifieur, contexte, suivant) {
  try {
    return await suivant(specifieur, contexte);
  } catch (erreur) {
    const relatif = specifieur.startsWith("./") || specifieur.startsWith("../");
    if (relatif && erreur?.code === "ERR_MODULE_NOT_FOUND" && !/\.[a-z]+$/i.test(specifieur)) {
      return suivant(`${specifieur}.ts`, contexte);
    }
    throw erreur;
  }
}
```

`apps/api/scripts/enregistrer-resolveur.mjs` :

```js
import { register } from "node:module";

register("./resolveur-ts.mjs", import.meta.url);
```

`apps/api/src/cales/vide.ts` :

```ts
// Remplace « server-only » dans l'API : ce marqueur ne sert qu'à faire échouer le build du site s'il finit dans le navigateur. L'API n'a pas de navigateur.
export {};
```

`apps/api/src/cales/next-headers.ts` :

```ts
import { AsyncLocalStorage } from "node:async_hooks";

// Remplace `headers()` de `next/headers` dans l'API : le code de limitation de débit du site lit l'adresse du visiteur par cette fonction.
// La cale rend les en-têtes de la requête en cours (posés par le premier maillon de l'application), jamais ceux d'une autre requête.
export const entetesCourants = new AsyncLocalStorage<Headers>();

export async function headers(): Promise<Headers> {
  const courants = entetesCourants.getStore();
  if (!courants) throw new Error("headers() appelé hors requête");
  return courants;
}
```

`apps/api/src/types.ts` :

```ts
import type { VersionApplication } from "@speedfood/shared/application/version";

/** Tout ce que les routes ont le droit d'appeler : injecté en production par `worker.ts`, remplacé par de fausses valeurs dans les tests. */
export interface Deps {
  version: VersionApplication;
  lireAssistance(): Promise<{ whatsapp: string | null }>;
}
```

(`@speedfood/shared/application/version` existe après la Tâche 2 : pour la Tâche 1, déplacer d'abord ce fichier avec l'outil, étape 2 de la Tâche 2 — **inverser** : voir la note d'ordre ci-dessous.)

> **Note d'ordre (autonome).** `Deps` dépend de `application/version` et `app.ts` de `v1-regles`. **Avant d'écrire ces fichiers, exécuter ici les deux déplacements** (c'est l'étape 1 de la Tâche 2, répétée pour que la Tâche 1 se suffise ; la Tâche 2 la considère déjà faite si le commit de la Tâche 1 contient les deux fichiers dans `packages/shared/src`) :
>
> ```bash
> cd /c/Users/moelo/dev/speedfood/apps/web
> node scripts/deplacer-vers-partage.mjs application/version --essai; echo "code=$?"
> node scripts/deplacer-vers-partage.mjs api/v1-regles --essai; echo "code=$?"
> node scripts/deplacer-vers-partage.mjs application/version && node scripts/deplacer-vers-partage.mjs api/v1-regles
> cd ../.. && npm run typecheck; echo "typecheck=$?"
> (cd apps/web && npm run test:unit > /dev/null 2>&1; echo "test:unit=$?")
> ```
>
> Attendu : essais `code=0`, `typecheck=0`, `test:unit=0`. Si l'outil refuse un fichier (impureté), ne pas forcer : BLOCKED.

`apps/api/src/app.ts` (sans les routes `version` et `aide`, qui arrivent à la Tâche 2) :

```ts
import { Hono } from "hono";
import type { Context } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import { statutHttp } from "@speedfood/shared/api/v1-regles";
import { entetesCourants } from "./cales/next-headers.ts";
import type { Deps } from "./types.ts";

const SANS_CACHE = { "Cache-Control": "no-store" };

/** Réponse d'erreur au contrat uniforme du site : `{ ok: false, erreur: { code, message } }`. */
export function reponseErreur(c: Context, erreur: ErreurApi): Response {
  return c.json({ ok: false, erreur }, statutHttp(erreur.code) as 400, SANS_CACHE);
}

export function creerApp(_deps: Deps) {
  const app = new Hono();

  // Premier maillon : les en-têtes de la requête sont disponibles, partout et sans paramètre, pour le code du site qui appelle `headers()`.
  app.use("*", (c, suivant) => entetesCourants.run(c.req.raw.headers, suivant));

  app.get("/sante", (c) => c.json({ ok: true }, 200, SANS_CACHE));

  app.notFound((c) => reponseErreur(c, { code: "INTROUVABLE", message: "Route inconnue." }));
  app.onError((erreur, c) => {
    if (erreur instanceof ErreurMetier) return reponseErreur(c, erreur.toApi());
    console.error("api_erreur_non_geree");
    return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." });
  });

  return app;
}
```

Lire `packages/shared/src/contracts/erreurs.ts` avant d'écrire : si `ErreurMetier` n'expose pas `toApi()` ou si `ErreurApi["code"]` diffère de la liste de `statutHttp`, adapter l'appel (le comportement attendu est celui du site : le code de l'erreur détermine le statut HTTP).

- [ ] **Étape 4 : Installer et constater l'échec puis le succès**

```bash
cd /c/Users/moelo/dev/speedfood
echo "scripts/ et fichiers d'API ignorés ajoutés ci-dessous"
printf '\n# API unique\n/apps/api/dist/\n/apps/api/.dev.vars\n/apps/api/.wrangler/\n' >> .gitignore
npm install --no-audit --no-fund
git diff --stat package-lock.json | tail -1
cd apps/api
npm run test; echo "test=$?"
```

Résultat attendu avant l'écriture de `app.ts` : échec (module introuvable) ; après : `test=0`, deux tests verts. `package-lock.json` ne doit montrer que l'ajout de `apps/api`, de `hono`, `jose` et de leurs dépendances propres ; **aucune version existante ne change** (sinon arrêter : BLOCKED).

- [ ] **Étape 5 : Vérifier les types et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
npm run typecheck; echo "typecheck=$?"
git add -A
git commit -m "API unique : squelette apps/api (Hono), cale next/headers, erreurs uniformes, résolveur d'imports pour les tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Résultat attendu : `typecheck=0` (paquets partagés et API).

---

### Tâche 2 : Règles partagées déplacées et deux premières routes (`version`, `aide`)

**Fichiers :**
- Déplacer (avec raccord) : `apps/web/src/lib/api/v1-regles.ts` → `packages/shared/src/api/v1-regles.ts` ; `apps/web/src/lib/application/version.ts` → `packages/shared/src/application/version.ts`
- Créer : `apps/api/src/routes/version.ts`, `apps/api/src/routes/aide.ts`
- Modifier : `apps/api/src/app.ts`, `apps/api/tests/app.test.ts`
- Créer : `apps/api/tests/routes.test.ts`

**Interfaces :**
- Consomme : `creerApp`, `Deps`, `reponseErreur` (Tâche 1) ; l'outil `apps/web/scripts/deplacer-vers-partage.mjs`.
- Produit : `routeVersion(deps: Pick<Deps, "version">): Hono`, `routeAide(deps: Pick<Deps, "lireAssistance">): Hono`, les 13 fichiers du paquet partagé.

- [ ] **Étape 1 : Déplacer les deux règles** (à faire avant l'étape 3 de la Tâche 1, voir la note d'ordre)

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
node scripts/deplacer-vers-partage.mjs application/version --essai; echo "code=$?"
node scripts/deplacer-vers-partage.mjs api/v1-regles --essai; echo "code=$?"
node scripts/deplacer-vers-partage.mjs application/version && node scripts/deplacer-vers-partage.mjs api/v1-regles
cd ../.. && npm run typecheck; echo "typecheck=$?"
(cd apps/web && npm run test:unit > /dev/null 2>&1; echo "test:unit=$?")
```

Résultat attendu : essais à `code=0`, déplacements faits, `typecheck=0`, `test:unit=0`. **Si l'outil refuse** un des deux fichiers (impureté détectée), ne pas forcer : lire le message, signaler, et pour la Tâche 1 remplacer l'import concerné par une injection dans `Deps` (la version) ou un import depuis le site non utilisé par les tests — puis arrêter et demander (BLOCKED).

Vérifier que le test `paquet-partage` voit désormais **13** fichiers (26 lignes « pur » et « raccord ») et que le `README` du paquet, qui cite « 11 fichiers », est mis à jour (liste exacte par `find packages/shared/src -name '*.ts'`).

- [ ] **Étape 2 : Écrire les tests des routes qui échouent** (outil Write) : `apps/api/tests/routes.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import type { Deps } from "../src/types.ts";

const version = { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 15733962 };

function app(surcharge: Partial<Deps> = {}) {
  return creerApp({ version, lireAssistance: async () => ({ whatsapp: "224620000000" }), ...surcharge });
}

test("GET /api/v1/version : même corps et même cache que la route du site", async () => {
  const reponse = await app().request("/api/v1/version");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=300");
  assert.match(reponse.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await reponse.json(), { ok: true, version });
});

test("GET /api/v1/aide : numéro WhatsApp renseigné", async () => {
  const reponse = await app().request("/api/v1/aide");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=300");
  assert.deepEqual(await reponse.json(), { ok: true, whatsapp: "224620000000" });
});

test("GET /api/v1/aide : sans numéro, whatsapp vaut null", async () => {
  const reponse = await app({ lireAssistance: async () => ({ whatsapp: null }) }).request("/api/v1/aide");
  assert.deepEqual(await reponse.json(), { ok: true, whatsapp: null });
});

test("seul GET est accepté sur ces routes publiques", async () => {
  for (const chemin of ["/api/v1/version", "/api/v1/aide"]) {
    const reponse = await app().request(chemin, { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    assert.equal(reponse.status, 404);
  }
});
```

(La route Next du site répond 405 à POST ; l'API répond 404 uniforme. Le comparateur de la Tâche 6 ne teste que GET. Si on veut le 405 identique, c'est une amélioration du plan 1b.)

- [ ] **Étape 3 : Lancer pour constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run test; echo "test=$?"
```

Résultat attendu : `test` différent de 0 (routes absentes).

- [ ] **Étape 4 : Écrire les routes** (outil Write)

`apps/api/src/routes/version.ts` :

```ts
import { Hono } from "hono";
import type { Deps } from "../types.ts";

/** Dernière version de l'application publiée. Route PUBLIQUE (l'application la lit avant la connexion) ; cache court : une publication est visible en quelques minutes. */
export function routeVersion(deps: Pick<Deps, "version">) {
  const route = new Hono();
  route.get("/", (c) => c.json({ ok: true, version: deps.version }, 200, { "Cache-Control": "public, max-age=300" }));
  return route;
}
```

`apps/api/src/routes/aide.ts` :

```ts
import { Hono } from "hono";
import type { Deps } from "../types.ts";

/** Contact d'assistance (rubrique Aide) : numéro WhatsApp de l'administration, ou `null`. Route PUBLIQUE, cache court. */
export function routeAide(deps: Pick<Deps, "lireAssistance">) {
  const route = new Hono();
  route.get("/", async (c) => {
    const { whatsapp } = await deps.lireAssistance();
    return c.json({ ok: true, whatsapp }, 200, { "Cache-Control": "public, max-age=300" });
  });
  return route;
}
```

Dans `apps/api/src/app.ts`, renommer le paramètre `_deps` en `deps`, importer les deux routes et les monter juste après `/sante` :

```ts
import { routeAide } from "./routes/aide.ts";
import { routeVersion } from "./routes/version.ts";
// …
  app.route("/api/v1/version", routeVersion(deps));
  app.route("/api/v1/aide", routeAide(deps));
```

- [ ] **Étape 5 : Vérifier**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
```

Résultat attendu : `test=0` (tests de la Tâche 1 et de cette tâche), `typecheck=0`.

- [ ] **Étape 6 : Ajouter les deux tests différés de la Tâche 1** à la fin de `apps/api/tests/app.test.ts` (erreur non prévue sur `/api/v1/aide` ; cale `next/headers`), exactement ceux de l'étape 2 de la Tâche 1, puis :

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Résultat attendu : `test=0`.

- [ ] **Étape 7 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git add -A
git commit -m "API unique : règles partagées déplacées (v1-regles, version), routes publiques version et aide avec tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tâche 3 : Vérification locale des jetons Supabase (ES256), deux modes

**Fichiers :**
- Créer : `apps/api/src/identite/jeton.ts`, `apps/api/tests/jeton.test.ts`

**Interfaces :**
- Consomme : `jose` (`jwtVerify`, `createRemoteJWKSet`, `createLocalJWKSet`, `SignJWT`, `generateKeyPair`, `exportJWK`).
- Produit :
  - `interface ConfigJeton { cles: JWTVerifyGetKey; issuer: string }`
  - `configJetonSupabase(urlSupabase: string): ConfigJeton`
  - `verifierJetonLocal(jeton: string, config: ConfigJeton, maintenant?: Date): Promise<{ id: string } | null>`
  - `type VerificateurJeton = (jeton: string) => Promise<{ id: string } | null>` (type commun aux deux modes)

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/jeton.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { verifierJetonLocal } from "../src/identite/jeton.ts";

const ISSUER = "https://exemple.supabase.co/auth/v1";

async function fabrique() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  const config = { cles: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER };
  const signer = (surcharge: { iss?: string; aud?: string; sub?: string | null; exp?: string | number; cle?: CryptoKey; alg?: string } = {}) => {
    const jeton = new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: (surcharge.alg ?? "ES256") as "ES256", kid: "k1" })
      .setIssuer(surcharge.iss ?? ISSUER)
      .setAudience(surcharge.aud ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(surcharge.exp ?? "1h");
    if (surcharge.sub !== null) jeton.setSubject(surcharge.sub ?? "11111111-1111-1111-1111-111111111111");
    return jeton.sign(surcharge.cle ?? privateKey);
  };
  return { config, signer };
}

test("un jeton valide donne l'identifiant du compte", async () => {
  const { config, signer } = await fabrique();
  assert.deepEqual(await verifierJetonLocal(await signer(), config), { id: "11111111-1111-1111-1111-111111111111" });
});

test("un jeton expiré est refusé", async () => {
  const { config, signer } = await fabrique();
  const jeton = await signer({ exp: Math.floor(Date.now() / 1000) - 60 });
  assert.equal(await verifierJetonLocal(jeton, config), null);
});

test("un jeton signé par une autre clé est refusé", async () => {
  const { config, signer } = await fabrique();
  const autre = await generateKeyPair("ES256");
  assert.equal(await verifierJetonLocal(await signer({ cle: autre.privateKey }), config), null);
});

test("un mauvais émetteur ou une mauvaise audience sont refusés", async () => {
  const { config, signer } = await fabrique();
  assert.equal(await verifierJetonLocal(await signer({ iss: "https://autre.supabase.co/auth/v1" }), config), null);
  assert.equal(await verifierJetonLocal(await signer({ aud: "anon" }), config), null);
});

test("un jeton sans compte (sub absent) est refusé", async () => {
  const { config, signer } = await fabrique();
  assert.equal(await verifierJetonLocal(await signer({ sub: null }), config), null);
});

test("une valeur qui n'est pas un jeton est refusée sans lever d'exception", async () => {
  const { config } = await fabrique();
  assert.equal(await verifierJetonLocal("pas-un-jeton", config), null);
  assert.equal(await verifierJetonLocal("", config), null);
});

test("un jeton non signé (alg none) est refusé", async () => {
  const { config } = await fabrique();
  const enTete = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const corps = Buffer.from(JSON.stringify({ iss: ISSUER, aud: "authenticated", sub: "x", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  assert.equal(await verifierJetonLocal(`${enTete}.${corps}.`, config), null);
});
```

- [ ] **Étape 2 : Constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Résultat attendu : `test` différent de 0 (module `identite/jeton.ts` introuvable).

- [ ] **Étape 3 : Écrire le module** (outil Write) : `apps/api/src/identite/jeton.ts`

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

/** Un vérificateur de jeton rend l'identifiant du compte, ou `null` si le jeton est absent, invalide ou expiré. Jamais d'exception. */
export type VerificateurJeton = (jeton: string) => Promise<{ id: string } | null>;

export interface ConfigJeton {
  /** Clés publiques de signature (celles que Supabase publie). */
  cles: JWTVerifyGetKey;
  /** Émetteur attendu : `<url du projet>/auth/v1`. */
  issuer: string;
}

/** Configuration de production : les clés sont lues une fois chez Supabase, gardées en mémoire de l'isolat, renouvelées au plus toutes les 10 minutes. */
export function configJetonSupabase(urlSupabase: string): ConfigJeton {
  const base = urlSupabase.replace(/\/+$/, "");
  return {
    cles: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 30_000, cacheMaxAge: 600_000 }),
    issuer: `${base}/auth/v1`,
  };
}

/**
 * Vérification LOCALE : signature (ES256 uniquement), émetteur, audience « authenticated », expiration. Aucun appel au service d'authentification.
 * Limite connue : un compte supprimé ou banni reste accepté jusqu'à l'expiration du jeton (une heure) ; le mode « strict » (appel au service) existe pour les actions sensibles.
 */
export async function verifierJetonLocal(jeton: string, config: ConfigJeton, maintenant: Date = new Date()): Promise<{ id: string } | null> {
  try {
    const { payload } = await jwtVerify(jeton, config.cles, {
      issuer: config.issuer,
      audience: "authenticated",
      algorithms: ["ES256"],
      currentDate: maintenant,
    });
    return typeof payload.sub === "string" && payload.sub !== "" ? { id: payload.sub } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Étape 4 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A
git commit -m "API unique : vérification locale des jetons Supabase (ES256), jeton expiré, mauvaise clé, émetteur, audience, alg none testés

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Résultat attendu : `test=0` (7 tests de jeton en plus des précédents), `typecheck=0`.

---

### Tâche 4 : Briques de la chaîne de contrôles

**Fichiers :**
- Créer : `apps/api/src/controles/chaine.ts`, `apps/api/tests/chaine.test.ts`

**Interfaces :**
- Consomme : `ErreurMetier` (`@speedfood/shared/contracts/erreurs`), `lireBearer` (`@speedfood/shared/api/v1-regles`), `VerificateurJeton` (Tâche 3), `reponseErreur`/`creerApp` (Tâche 1).
- Produit :
  - `type Variables = { utilisateurId: string }`
  - `limiterParRequete(limiter: () => Promise<void>): MiddlewareHandler` : limite avant identité (par adresse)
  - `identifier(verifier: VerificateurJeton): MiddlewareHandler<{ Variables: Variables }>` : pose `utilisateurId` ou répond `NON_AUTHENTIFIE`
  - `limiterParCompte(limiter: (utilisateurId: string) => Promise<void>): MiddlewareHandler<{ Variables: Variables }>`
  - Ordre garanti et testé : limite de débit **puis** identité **puis** limite par compte ; une requête refusée à une étape n'appelle pas les suivantes.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/chaine.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { creerApp } from "../src/app.ts";
import { identifier, limiterParCompte, limiterParRequete } from "../src/controles/chaine.ts";
import type { Variables } from "../src/controles/chaine.ts";
import type { Deps } from "../src/types.ts";

const deps: Deps = { version: { code: 1, nom: "1", notes: "", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 }, lireAssistance: async () => ({ whatsapp: null }) };
const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";

/** Application d'essai : la chaîne complète devant une route qui renvoie l'identifiant du compte. */
function montage(appels: string[], options: { limiteRequete?: () => Promise<void>; verifier?: (jeton: string) => Promise<{ id: string } | null>; limiteCompte?: (id: string) => Promise<void> } = {}) {
  const app = creerApp(deps);
  const protege = new Hono<{ Variables: Variables }>();
  protege.use("*", limiterParRequete(options.limiteRequete ?? (async () => void appels.push("limite-requete"))));
  protege.use("*", identifier(options.verifier ?? (async (jeton) => { appels.push("identite"); return jeton === JETON ? { id: "compte-1" } : null; })));
  protege.use("*", limiterParCompte(options.limiteCompte ?? (async (id) => void appels.push(`limite-compte:${id}`))));
  protege.get("/", (c) => c.json({ ok: true, id: c.get("utilisateurId") }));
  app.route("/api/v1/essai", protege);
  return app;
}

test("requête valide : les trois étapes passent dans l'ordre et la route voit le compte", async () => {
  const appels: string[] = [];
  const reponse = await montage(appels).request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), { ok: true, id: "compte-1" });
  assert.deepEqual(appels, ["limite-requete", "identite", "limite-compte:compte-1"]);
});

test("limite par adresse dépassée : 429, et l'identité n'est pas même interrogée", async () => {
  const appels: string[] = [];
  const app = montage(appels, { limiteRequete: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 429);
  assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "TROP_DE_REQUETES");
  assert.deepEqual(appels, []);
});

test("sans jeton ou avec un mauvais jeton : 401 NON_AUTHENTIFIE, la limite par compte n'est pas appelée", async () => {
  for (const entetes of [{}, { authorization: "Bearer pas-un-jeton" }, { authorization: `Bearer aaaaaaaa.bbbbbbbb.ddddddddd` }]) {
    const appels: string[] = [];
    const reponse = await montage(appels).request("/api/v1/essai", { headers: entetes });
    assert.equal(reponse.status, 401);
    assert.equal(((await reponse.json()) as { erreur: { code: string } }).erreur.code, "NON_AUTHENTIFIE");
    assert.ok(!appels.some((a) => a.startsWith("limite-compte")));
  }
});

test("les cookies ne remplacent jamais le jeton porteur", async () => {
  const appels: string[] = [];
  const reponse = await montage(appels).request("/api/v1/essai", { headers: { cookie: `sb-access-token=${JETON}` } });
  assert.equal(reponse.status, 401);
});

test("limite par compte dépassée : 429 après identification", async () => {
  const appels: string[] = [];
  const app = montage(appels, { limiteCompte: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } });
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 429);
});

test("une panne du compteur (erreur non métier) répond ERREUR_SERVEUR, pas un passage libre", async () => {
  const appels: string[] = [];
  const app = montage(appels, { limiteRequete: async () => { throw new Error("redis en panne"); } });
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("redis en panne"));
});
```

Note sur le dernier test : le code de limitation du site **laisse passer** quand son compteur tombe en panne (il journalise puis rend la main : voir `appliquerLimites`), donc une erreur qui **remonte jusqu'ici** est un cas imprévu ; la brique ne doit jamais l'avaler en silence.

- [ ] **Étape 2 : Constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Résultat attendu : `test` différent de 0 (module `controles/chaine.ts` introuvable).

- [ ] **Étape 3 : Écrire les briques** (outil Write) : `apps/api/src/controles/chaine.ts`

```ts
import type { MiddlewareHandler } from "hono";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { lireBearer } from "@speedfood/shared/api/v1-regles";
import type { VerificateurJeton } from "../identite/jeton.ts";

/** Ce que la chaîne pose pour les maillons suivants. */
export type Variables = { utilisateurId: string };

/**
 * Chaîne de contrôles de chaque requête (design §5), dans l'ordre : limite de débit, identité, limite par compte, puis (plan 1b) droits, validation, règle métier, audit.
 * Chaque brique court-circuite : une requête refusée à une étape n'atteint jamais les suivantes (aucun appel réseau gaspillé sur une requête qui n'a pas le droit de passer).
 */

/** Limite AVANT l'identité (par adresse) : le code du site lève `TROP_DE_REQUETES` ; `onError` en fait un 429. */
export function limiterParRequete(limiter: () => Promise<void>): MiddlewareHandler {
  return async (_c, suivant) => {
    await limiter();
    await suivant();
  };
}

/** Identité : jeton porteur UNIQUEMENT (les cookies du site ne sont jamais lus, pas de requête intersite à protéger). */
export function identifier(verifier: VerificateurJeton): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, suivant) => {
    const jeton = lireBearer(c.req.header("authorization"));
    const utilisateur = jeton ? await verifier(jeton) : null;
    if (!utilisateur) throw new ErreurMetier("NON_AUTHENTIFIE", "Connectez-vous avec votre compte.");
    c.set("utilisateurId", utilisateur.id);
    await suivant();
  };
}

/** Limite APRÈS l'identité (par compte : le compte vient du jeton vérifié, jamais d'un identifiant envoyé par l'application). */
export function limiterParCompte(limiter: (utilisateurId: string) => Promise<void>): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, suivant) => {
    await limiter(c.get("utilisateurId"));
    await suivant();
  };
}
```

Si `ErreurMetier` n'accepte pas le code `NON_AUTHENTIFIE` ou a une signature différente, lire `packages/shared/src/contracts/erreurs.ts` et adapter (le code d'erreur et le message du site sont : `NON_AUTHENTIFIE` / « Connectez-vous avec votre compte. »).

- [ ] **Étape 4 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A
git commit -m "API unique : briques de la chaîne de contrôles (limite par adresse, identité par jeton porteur, limite par compte), ordre et court-circuit testés

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Résultat attendu : `test=0`, `typecheck=0`.

---

### Tâche 5 : Assemblage esbuild, garde « aucun Next », câblage de production et sonde des services

**Fichiers :**
- Créer : `apps/api/build.mjs`, `apps/api/wrangler.jsonc`, `apps/api/src/worker.ts`, `apps/api/sondes/services.ts`, `apps/api/tests/construction.test.ts`

**Interfaces :**
- Consomme : `creerApp` (Tâche 1), les services du site (`@/lib/parametres/assistance`, `@/lib/securite/limitation-debit`, `@/lib/db/admin`, `@/lib/client/espace-service`) et `VERSION_APPLICATION`.
- Produit : `construire({ entree, sortie }): Promise<{ metafile, octets, interdits: string[] }>` (exporté par `build.mjs`), commande `npm run build` qui écrit `apps/api/dist/worker.js` et **échoue** si un fichier de Next.js est dans le paquet.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/construction.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error : module JavaScript sans déclaration de types
import { construire } from "../build.mjs";

const racineApi = fileURLToPath(new URL("..", import.meta.url));

async function construireDans(entree: string) {
  const dossier = mkdtempSync(join(tmpdir(), "speedfood-api-"));
  try {
    return await construire({ entree: join(racineApi, entree), sortie: join(dossier, "worker.js") });
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

test("le Worker de production se construit sans aucun fichier de Next.js", async () => {
  const resultat = await construireDans("src/worker.ts");
  assert.deepEqual(resultat.interdits, []);
  assert.ok(resultat.octets > 10_000, "le paquet doit contenir Hono et les services");
});

test("les services du site utilisés par l'API se construisent sans Next.js (sonde)", async () => {
  const resultat = await construireDans("sondes/services.ts");
  assert.deepEqual(resultat.interdits, []);
});

test("la garde mord : un import de next/server dans un paquet est détecté", async () => {
  const resultat = await construireDans("sondes/interdit.ts");
  assert.ok(resultat.interdits.length > 0, "next/server aurait dû être détecté");
});
```

La sonde `sondes/interdit.ts` (étape 3) importe volontairement `next/server` : elle prouve que la garde détecte vraiment Next ; elle est exclue du typecheck de production par `// @ts-nocheck` et n'est jamais importée par le Worker.

- [ ] **Étape 2 : Constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Résultat attendu : `test` différent de 0 (`build.mjs` introuvable).

- [ ] **Étape 3 : Écrire l'assemblage, le câblage et les sondes** (outil Write)

`apps/api/build.mjs` :

```js
// Assemble le Worker de l'API avec esbuild, puis vérifie qu'AUCUN fichier de Next.js n'est entré dans le paquet.
// `server-only` devient un module vide et `next/headers` une cale (voir src/cales). Les alias `@/` des services du site sont résolus par le tsconfig du site.
import { build } from "esbuild";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = dirname(fileURLToPath(import.meta.url));

/** Chemins d'entrées qui trahissent Next.js (ou son adaptateur Cloudflare) dans le paquet. */
const INTERDITS = [/node_modules[\\/]next[\\/]/, /node_modules[\\/]@opennextjs[\\/]/, /node_modules[\\/]react-dom[\\/]/];

export async function construire({ entree = join(racine, "src", "worker.ts"), sortie = join(racine, "dist", "worker.js") } = {}) {
  const resultat = await build({
    entryPoints: [entree],
    outfile: sortie,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    conditions: ["workerd", "worker", "browser", "import"],
    external: ["node:*", "cloudflare:*"],
    alias: {
      "server-only": join(racine, "src", "cales", "vide.ts"),
      "next/headers": join(racine, "src", "cales", "next-headers.ts"),
    },
    tsconfig: join(racine, "tsconfig.json"),
    metafile: true,
    logLevel: "warning",
    legalComments: "none",
  });
  const interdits = Object.keys(resultat.metafile.inputs).filter((chemin) => INTERDITS.some((motif) => motif.test(chemin)));
  return { metafile: resultat.metafile, octets: statSync(sortie).size, interdits };
}

// Lancé directement (`npm run build`) : écrit dist/worker.js et échoue si Next.js est entré dans le paquet.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { octets, interdits } = await construire();
  console.log(`dist/worker.js : ${(octets / 1024).toFixed(0)} Kio`);
  if (interdits.length > 0) {
    console.error("ECHEC : des fichiers de Next.js sont entrés dans le paquet de l'API :");
    for (const chemin of interdits.slice(0, 10)) console.error(`  ${chemin}`);
    process.exit(1);
  }
}
```

`apps/api/wrangler.jsonc` (le paquet est déjà assemblé et vérifié : `no_bundle` garantit que **ce** paquet est celui qui se déploie) :

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  // API unique de Speedfood. Worker SÉPARÉ du site (speedfood-app) : on le déploie sans toucher au site.
  // Il n'existe pas encore chez Cloudflare : il n'est créé qu'avec le feu vert de Malika (plan 1a, tâche 8).
  "name": "speedfood-api",
  "main": "dist/worker.js",
  // Le paquet est assemblé par build.mjs (esbuild) puis contrôlé : wrangler ne le ré-assemble pas.
  "no_bundle": true,
  "compatibility_date": "2026-09-27",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  // Valeur publique uniquement. Les secrets (clé service-role, clé de dérivation des jetons, Redis) se posent avec `wrangler secret put`, jamais ici.
  "vars": {
    "NEXT_PUBLIC_SUPABASE_URL": "https://ggldjdizqrtpetdiohxy.supabase.co"
  },
  "observability": { "enabled": true }
}
```

`apps/api/src/worker.ts` :

```ts
import { VERSION_APPLICATION } from "@speedfood/shared/application/version";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { creerApp } from "./app.ts";

// Câblage de PRODUCTION : les routes reçoivent les services du site, jamais une copie de leurs règles.
const app = creerApp({
  version: VERSION_APPLICATION,
  lireAssistance: async () => {
    const { whatsapp } = await lireReglagesAssistance();
    return { whatsapp };
  },
});

export default { fetch: app.fetch };
```

`apps/api/sondes/services.ts` (sonde de construction : si un de ces services tire Next.js, la garde le dit ; ne pas le retirer pour « faire passer » le test, voir étape 5) :

```ts
// Sonde : ces services du site seront utilisés par les routes du plan 1b. Ce fichier ne sert qu'à vérifier, à la construction, qu'ils tiennent sans Next.js.
export { creerClientAdmin } from "@/lib/db/admin";
export { limiterClientApplication } from "@/lib/securite/limitation-debit";
export * as espaceClient from "@/lib/client/espace-service";
```

`apps/api/sondes/interdit.ts` :

```ts
// @ts-nocheck : sonde volontairement fautive, jamais importée par le Worker.
// Preuve que la garde de build.mjs détecte réellement Next.js.
export { NextResponse } from "next/server";
```

- [ ] **Étape 4 : Lancer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run test; echo "test=$?"
npm run build; echo "build=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
```

Résultat attendu : `test=0`, `build=0` avec la taille du paquet, `typecheck=0`.

- [ ] **Étape 5 : Si la sonde `services.ts` échoue** (un service tire Next.js : c'est la raison d'être de cette sonde)

**Ne pas contourner.** Lire la liste des fichiers interdits affichée, identifier la chaîne d'imports qui y mène (`metafile.inputs[…].imports`), puis :
- si c'est une dépendance **évitable** par une très petite modification (un `import type` mal écrit, un import inutile), la corriger dans le site **sans changer son comportement** et relancer tous les tests du site (`npm run test:unit`, `npm run test:cloisonnement`) ;
- sinon, retirer **seulement** ce service de la sonde, et consigner dans `docs/API-UNIQUE.md` (section « Services pas encore utilisables par l'API ») le nom du service, le fichier fautif et la raison. Statut : DONE_WITH_CONCERNS. Le plan 1b en tiendra compte.

- [ ] **Étape 6 : Mesurer la taille avec un essai de déploiement à blanc**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npx wrangler deploy --dry-run --outdir "<un dossier du scratchpad>" 2>&1 | tail -8
```

**`--dry-run` est obligatoire : ne jamais lancer `wrangler deploy` sans lui.** Noter la taille totale et la taille compressée (le plafond du forfait gratuit est de 3 Mio compressés).

- [ ] **Étape 7 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git add -A
git commit -m "API unique : assemblage esbuild avec garde « aucun Next.js », câblage du Worker, sonde des services du site

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tâche 6 : Comparateur de routes et essai local face au site en production

**Fichiers :**
- Créer : `apps/api/scripts/comparateur.mjs`, `apps/api/scripts/comparer-routes.mjs`, `apps/api/scripts/preparer-dev-vars.mjs`, `apps/api/tests/comparateur.test.ts`

**Interfaces :**
- Consomme : le Worker construit (Tâche 5).
- Produit : `comparerRoutes(base1, base2, chemins, envoyer?): Promise<string[]>` (liste d'écarts, vide si identiques) ; commandes `npm run comparer -- <urlReference> <urlCandidate> <chemin>…` (code de sortie 1 s'il y a des écarts) et `npm run preparer-dev-vars`.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/comparateur.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
// @ts-expect-error : module JavaScript sans déclaration de types
import { comparerRoutes } from "../scripts/comparateur.mjs";

type Reponse = { statut: number; type: string; cache?: string; corps: string };

async function serveur(routes: Record<string, Reponse>) {
  const http = createServer((requete, reponse) => {
    const r = routes[requete.url ?? ""];
    if (!r) { reponse.writeHead(404, { "content-type": "application/json" }).end("{}"); return; }
    reponse.writeHead(r.statut, { "content-type": r.type, ...(r.cache ? { "cache-control": r.cache } : {}) }).end(r.corps);
  });
  await new Promise<void>((ok) => http.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, fermer: () => new Promise<void>((ok) => http.close(() => ok())) };
}

const A: Reponse = { statut: 200, type: "application/json", cache: "public, max-age=300", corps: JSON.stringify({ ok: true, a: 1, b: [1, 2] }) };

test("deux réponses identiques (même si les clés sont dans un autre ordre) : aucun écart", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": { ...A, type: "application/json; charset=utf-8", corps: JSON.stringify({ b: [1, 2], a: 1, ok: true }) } });
  try {
    assert.deepEqual(await comparerRoutes(s1.base, s2.base, ["/x"]), []);
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("statut, cache et corps différents : trois écarts nommés", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({ "/x": { statut: 500, type: "application/json", cache: "no-store", corps: JSON.stringify({ ok: false }) } });
  try {
    const ecarts: string[] = await comparerRoutes(s1.base, s2.base, ["/x"]);
    assert.equal(ecarts.length, 3);
    assert.ok(ecarts.some((e) => e.includes("statut")) && ecarts.some((e) => e.includes("cache")) && ecarts.some((e) => e.includes("corps")));
  } finally { await s1.fermer(); await s2.fermer(); }
});

test("une route absente d'un côté est un écart de statut", async () => {
  const s1 = await serveur({ "/x": A });
  const s2 = await serveur({});
  try {
    assert.ok((await comparerRoutes(s1.base, s2.base, ["/x"])).some((e) => e.includes("statut")));
  } finally { await s1.fermer(); await s2.fermer(); }
});
```

- [ ] **Étape 2 : Constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Résultat attendu : `test` différent de 0.

- [ ] **Étape 3 : Écrire les trois scripts** (outil Write)

`apps/api/scripts/comparateur.mjs` :

```js
// Compare ce que répondent deux adresses (par exemple l'ancienne route du site et la nouvelle de l'API) : statut, type de contenu, cache et corps JSON.
// Le corps est comparé indépendamment de l'ordre des clés.

async function lire(base, chemin, envoyer) {
  const reponse = await envoyer(base.replace(/\/+$/, "") + chemin, { redirect: "manual" });
  const texte = await reponse.text();
  let corps;
  try {
    corps = JSON.parse(texte);
  } catch {
    corps = texte;
  }
  return {
    statut: reponse.status,
    typeContenu: (reponse.headers.get("content-type") ?? "").split(";")[0].trim(),
    cache: reponse.headers.get("cache-control") ?? "",
    corps,
  };
}

function trier(valeur) {
  if (Array.isArray(valeur)) return valeur.map(trier);
  if (valeur && typeof valeur === "object") return Object.fromEntries(Object.keys(valeur).sort().map((cle) => [cle, trier(valeur[cle])]));
  return valeur;
}

/** Liste des écarts entre les deux adresses, pour chaque chemin. Vide si tout est identique. */
export async function comparerRoutes(base1, base2, chemins, envoyer = fetch) {
  const ecarts = [];
  for (const chemin of chemins) {
    const [a, b] = await Promise.all([lire(base1, chemin, envoyer), lire(base2, chemin, envoyer)]);
    const champs = [["statut", "statut"], ["typeContenu", "type de contenu"], ["cache", "cache"]];
    for (const [champ, nom] of champs) {
      if (a[champ] !== b[champ]) ecarts.push(`${chemin} : ${nom} ${JSON.stringify(a[champ])} ≠ ${JSON.stringify(b[champ])}`);
    }
    if (JSON.stringify(trier(a.corps)) !== JSON.stringify(trier(b.corps))) ecarts.push(`${chemin} : corps différent`);
  }
  return ecarts;
}
```

`apps/api/scripts/comparer-routes.mjs` :

```js
// Usage : npm run comparer -- <urlReference> <urlCandidate> <chemin> [<chemin>…]
// Exemple : npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide
import { comparerRoutes } from "./comparateur.mjs";

const [reference, candidate, ...chemins] = process.argv.slice(2);
if (!reference || !candidate || chemins.length === 0) {
  console.error("Usage : npm run comparer -- <urlReference> <urlCandidate> <chemin> [<chemin>…]");
  process.exit(2);
}
const ecarts = await comparerRoutes(reference, candidate, chemins);
if (ecarts.length === 0) {
  console.log(`${chemins.length} route(s) identiques : 0 écart`);
} else {
  console.error(`ECHEC : ${ecarts.length} écart(s)`);
  for (const ecart of ecarts) console.error(`  ${ecart}`);
  process.exit(1);
}
```

`apps/api/scripts/preparer-dev-vars.mjs` (ne lit que deux noms, n'affiche jamais une valeur) :

```js
// Écrit apps/api/.dev.vars (ignoré par Git) à partir de apps/web/.env.local, pour `wrangler dev`. Seuls les noms listés sont repris ; AUCUNE valeur n'est affichée.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(racine, "..", "web", ".env.local");
const cible = join(racine, ".dev.vars");
const NOMS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "COMMANDE_JETON_SECRET"];

if (!existsSync(source)) {
  console.error("ECHEC : apps/web/.env.local introuvable.");
  process.exit(1);
}
const valeurs = new Map();
for (const ligne of readFileSync(source, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
  if (m && NOMS.includes(m[1])) valeurs.set(m[1], m[2].replace(/^(['"])(.*)\1$/, "$2"));
}
writeFileSync(cible, [...valeurs].map(([nom, valeur]) => `${nom}=${valeur}`).join("\n") + "\n");
console.log(`.dev.vars écrit avec : ${[...valeurs.keys()].join(", ") || "(rien)"}`);
const manquants = NOMS.filter((nom) => !valeurs.has(nom));
if (manquants.length) console.log(`absents de .env.local : ${manquants.join(", ")}`);
```

- [ ] **Étape 4 : Vérifier les tests**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
```

Résultat attendu : `test=0` (3 tests de comparateur en plus), `typecheck=0`.

- [ ] **Étape 5 : Essai local face au site en production** (lecture seule : aucune écriture, aucun déploiement)

```bash
cd /c/Users/moelo/dev/speedfood/apps/api
npm run preparer-dev-vars
npm run build
npx wrangler dev --port 8788 --local > "<scratchpad>/api-dev.log" 2>&1 &
```

Attendre que `http://localhost:8788/sante` réponde (boucle `curl` avec délai court, 60 s au plus), puis :

```bash
npm run comparer -- https://speedfood-app.moelohimmara.workers.dev http://localhost:8788 /api/v1/version /api/v1/aide; echo "comparer=$?"
```

Résultat attendu : « 2 route(s) identiques : 0 écart », `comparer=0`. **Arrêter ensuite `wrangler dev` proprement** et vérifier qu'il ne reste aucun processus `workerd` ou `node` orphelin. Si un écart apparaît (par exemple le site en production ajoute un en-tête de cache différent), **le rapporter tel quel** avec les deux valeurs : ne pas modifier le comparateur pour le masquer ; décider ensuite si c'est la route de l'API ou la comparaison qui doit s'aligner.

Ce que cet essai ne prouve **pas** : le comportement sur Cloudflare (réseau, limites de calcul), ni la vérification d'un vrai jeton Supabase. Les consigner dans le rapport.

- [ ] **Étape 6 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git status --short | head
git add -A
git commit -m "API unique : comparateur de routes, préparation de .dev.vars sans afficher de secret, essai local face à la production

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Résultat attendu : `git status` ne montre ni `.dev.vars`, ni `dist/`, ni `.wrangler/`.

---

### Tâche 7 : Contrôle automatique, documentation, mémoire et fusion

**Fichiers :**
- Modifier : `.github/workflows/controles.yml`, `package.json` (racine), `docs/ORGANISATION-DU-DEPOT.md`, `docs/STATUT-PROJET.md`, `packages/shared/README.md` (déjà touché à la Tâche 2), `CLAUDE.md` (organisation)
- Créer : `docs/API-UNIQUE.md`
- Mémoire : `C:\Users\moelo\.claude\projects\C--Users-moelo-dev-speedfood\memory\redis-upstash-et-refonte-architecture.md`

**Interfaces :**
- Consomme : tout ce qui précède.
- Produit : un contrôle GitHub qui teste et construit l'API, et la documentation qui permet à une session future de reprendre sans historique.

- [ ] **Étape 1 : Ajouter l'API au contrôle automatique**

Dans le `package.json` de la racine, ajouter les scripts :

```json
    "test:api": "npm run test --workspace @speedfood/api",
    "build:api": "npm run build --workspace @speedfood/api"
```

Dans `.github/workflows/controles.yml`, ajouter à la fin des étapes :

```yaml
      - name: Tests de l'API
        run: npm run test:api

      - name: Construction de l'API (aucun fichier de Next.js dans le paquet)
        run: npm run build:api
```

Le `typecheck` de la racine couvre déjà `apps/api` (`--workspaces --if-present`). Si le test de l'API échoue **uniquement sur GitHub** (Node 22 au lieu de 24 en local), corriger la cause : version de Node ou option `--experimental-strip-types`, jamais en retirant l'étape.

- [ ] **Étape 2 : Écrire `docs/API-UNIQUE.md`** (outil Write ; chiffres vérifiés, jamais recopiés d'un plan)

Contenu minimal : à quoi sert l'API et pourquoi un Worker séparé (renvoi au design §5) ; l'arborescence de `apps/api` ; **comment la lancer et la tester** (`npm run test`, `build`, `dev`, `preparer-dev-vars`, `comparer`) avec le dossier d'où lancer chaque commande ; **le mécanisme de réutilisation** (alias `server-only`, cale `next/headers` par `AsyncLocalStorage`, garde de construction, sonde) ; la **chaîne de contrôles** livrée (limite → identité → limite par compte) et celle qui reste (droits, validation, audit) ; les **deux modes de vérification des jetons** avec le compromis de la suppression de compte et la décision en attente de Malika ; la section « Services pas encore utilisables par l'API » (vide si la sonde a tout passé) ; le résultat de l'essai local (écarts éventuels) ; **ce qui n'est pas vérifié** (émetteur réel d'un vrai jeton, comportement sur Cloudflare, quota partagé avec le site).

Mettre à jour `docs/ORGANISATION-DU-DEPOT.md` (ajout de `apps/api`), `CLAUDE.md` (une ligne dans l'organisation du dépôt) et `docs/STATUT-PROJET.md` (section « Étape 1a, socle de l'API : fait, NON déployé » avec le plan, le résultat de la Tâche 5 étape 6 et ce qui reste : plan 1b, Tâche 8).

- [ ] **Étape 3 : Mettre à jour la mémoire de projet**

Dans `redis-upstash-et-refonte-architecture.md` (relire avant d'éditer, garder le frontmatter), ajouter après le paragraphe de l'étape 0 : « **Étape 1a (socle de l'API) faite le … (non déployée)** : `apps/api` (Hono), garde « aucun Next » par esbuild, cale `next/headers` par `AsyncLocalStorage`, vérification ES256 locale, comparateur de routes ; deux routes (`version`, `aide`) ; Worker `speedfood-api` pas encore créé chez Cloudflare. Plan : `docs/plans/2026-10-31-etape-1a-socle-api.md`. Reste : plan 1b (routes par modules, relais du site), décision jetons strict/local. » (mettre la vraie date).

- [ ] **Étape 4 : Vérification complète puis fusion**

```bash
cd /c/Users/moelo/dev/speedfood
npm run typecheck; echo "typecheck=$?"
npm run test:unit > /dev/null 2>&1; echo "test:unit=$?"
npm run test:cloisonnement > /dev/null 2>&1; echo "cloisonnement=$?"
npm run test:api > /dev/null 2>&1; echo "test:api=$?"
npm run build:api; echo "build:api=$?"
(cd apps/web && npx eslint 2>&1 | tail -3; npm run cf:build > /dev/null 2>&1; echo "cf:build=$?")
git status -sb | head -3
git push -u origin etape-1a-socle-api
```

Résultat attendu : tous les codes à `0`, arbre propre, push accepté. Lire ensuite le contrôle GitHub de la branche (Claude in Chrome, `https://github.com/moelohimmara-dotcom/speedfood/actions/workflows/controles.yml`) : il doit être **vert** avant la fusion.

```bash
git checkout master
git merge --ff-only etape-1a-socle-api
git push
git branch -d etape-1a-socle-api
```

Relire le contrôle GitHub de `master`. **Rien n'est déployé** : le site en production n'a pas changé (le code du site n'a été modifié que par le déplacement de deux fichiers en raccords, comme à l'étape 0). Si Malika veut tout de même que le site soit redéployé avec ces raccords, elle l'écrit explicitement (« oui, déploie »), et on vérifie ensuite les pages, la version 2.47.0 et les secrets comme à l'étape 0.

---

### Tâche 8 : Création du Worker `speedfood-api` chez Cloudflare (UNIQUEMENT sur le feu vert de Malika, conduite par le contrôleur, pas par un sous-agent)

Cette tâche engage un **service de plus** chez Cloudflare (gratuit, mais un service) et pose des **secrets** que seule Malika peut saisir. Elle n'a lieu que si elle l'écrit explicitement dans la conversation (« oui, crée le Worker de l'API »). Je la guide **pas à pas**, car elle trouve les opérations compliquées : une seule action par message, avec le résultat attendu.

- [ ] **Étape 1 : Préparer.** Vérifier que `master` est à jour, que `npm run build:api` sort `0`, et noter la version actuelle du site (`wrangler deployments list` depuis `apps/web`) comme point de retour. Le site n'est **pas** touché.
- [ ] **Étape 2 : Créer le Worker et poser les secrets (Malika, terminal, rien ne s'affiche quand elle colle).** Depuis `C:\Users\moelo\dev\speedfood\apps\api`, après `npm run build` : première publication avec `npx wrangler deploy` (crée le Worker), puis `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (les mêmes valeurs que celles du site ; elle les copie depuis ses propres sources, je ne les vois jamais). Les commandes exactes, l'ordre, et le critère de réussite à chaque pas sont donnés au moment voulu.
- [ ] **Étape 3 : Vérifier.** `curl https://speedfood-api.<sous-domaine>.workers.dev/sante` répond `{"ok":true}` ; puis `npm run comparer -- https://speedfood-app.moelohimmara.workers.dev https://speedfood-api.<sous-domaine>.workers.dev /api/v1/version /api/v1/aide` doit sortir `0 écart`. Relever les temps de réponse et vérifier dans le tableau Cloudflare qu'aucune erreur 1102 n'apparaît.
- [ ] **Étape 4 : Ne rien router vers l'API.** Le site ne relaie encore rien : c'est le plan 1b. Le Worker de l'API reste un service **à côté**, sans trafic, jusqu'à ce que Malika autorise le relais.
- [ ] **Étape 5 : Retour arrière** (si besoin) : `npx wrangler delete --name speedfood-api` (depuis `apps/api`) supprime le Worker sans toucher au site.

---

## Auto-contrôle du plan

**Couverture du design (§5 et §9 étape 1, première moitié)** : « Worker `speedfood-api` avec la chaîne de contrôles » → Tâches 1, 3, 4 (limite de débit, identité, limite par compte ; droits/validation/audit nommés comme restant au plan 1b) ; « identité : jeton vérifié localement » → Tâche 3 (question ouverte §10 résolue : ES256 confirmé) ; « routes déplacées par modules, les plus légères d'abord » → deux routes publiques à la Tâche 2, le reste au plan 1b ; « comparaison de chaque route avec l'ancienne » → Tâche 6 ; « relais depuis le site » → **plan 1b** (écart assumé) ; un Worker séparé non déployé tant que Malika n'a pas dit oui (D6, D10) → Tâche 8 ; réutilisation des règles sans duplication → alias et cale (Tâche 5) et garde de pureté.

**Cohérence des noms :** `creerApp`, `Deps`, `reponseErreur`, `entetesCourants`/`headers`, `routeVersion`/`routeAide`, `ConfigJeton`/`configJetonSupabase`/`verifierJetonLocal`/`VerificateurJeton`, `Variables`/`limiterParRequete`/`identifier`/`limiterParCompte`, `construire`, `comparerRoutes` sont définis à la tâche qui les produit et réutilisés avec la même orthographe. Paquet `@speedfood/api` ; branche `etape-1a-socle-api`.

**Points qui demandent de la vigilance à l'exécution :** (1) la note d'ordre entre les Tâches 1 et 2 (les deux déplacements avant `Deps` et `app.ts`) ; (2) la forme réelle d'`ErreurMetier` et de `ErreurApi` à lire avant d'écrire `app.ts` et `chaine.ts` ; (3) la sonde `services.ts` peut révéler que certains services tirent Next.js : c'est une information voulue, jamais un obstacle à masquer ; (4) `@types/node`, esbuild et wrangler doivent reprendre les versions déjà installées pour ne changer aucune version existante dans le verrou ; (5) le test de `jeton` utilise des types `jose` (`JWTVerifyGetKey`) à vérifier à la compilation.

**Non vérifié (honnêtement) :** la valeur exacte de l'émetteur `iss` d'un vrai jeton du projet (testée seulement avec des jetons signés localement) ; le comportement du Worker sur Cloudflare (calcul, quota partagé avec le site) avant la Tâche 8 ; le coût du futur relais site → API dans l'offre gratuite (plan 1b).
