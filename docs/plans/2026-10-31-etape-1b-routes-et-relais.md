# Étape 1b, premières routes de l'API, jetons câblés et relais : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-compétence requise : `subagent-driven-development` (recommandé) ou `executing-plans`. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** faire servir par l'API (`apps/api`) dix routes du site (3 publiques, 7 avec compte), avec les mêmes réponses octet pour octet que le site, brancher la vérification des jetons (mode strict et mode local, panne Supabase distinguée du jeton invalide), et ajouter au site un **relais éteint par défaut** vers l'API, **sans rien déployer ni changer pour les utilisateurs**.

**Architecture :** chaque route de l'API est une fabrique qui reçoit ses dépendances (services du site, vérificateurs de jetons) : on la teste avec de fausses dépendances, puis `worker.ts` y branche les vrais services du site (aucune règle copiée). Le site garde ses routes ; chacune commence par un garde à deux lignes qui, **seulement si le relais est allumé pour son module**, transmet la requête à l'API. Le relais prouve son identité à l'API par un secret partagé pour lui faire croire l'adresse IP du visiteur d'origine.

**Pile :** celle de l'étape 1a (Hono 4.13.14, jose 6.2.14, esbuild, `node:test` avec suppression de types), plus le lanceur de tests du site (`apps/web/scripts/tests/lancer.mjs`) pour les règles pures du relais.

Design de référence : `docs/specs/2026-10-30-architecture-cible-design.md` §5 et §9 étape 1 ; plan précédent : `docs/plans/2026-10-31-etape-1a-socle-api.md` (mergé, `docs/API-UNIQUE.md`). **Décision de Malika (31 octobre 2026) : jetons en mode mixte** (local pour les lectures très fréquentes, strict partout ailleurs, strict par défaut par route). Les dix routes de ce plan sont **toutes en mode strict** : aucune n'est une lecture très fréquente. Le mode local est câblé et testé ici, il servira au plan 1c (position du livreur, relecture des commandes).

## Contraintes globales

Reprises de l'étape 1a (elles s'appliquent à chaque tâche) :

- **Le déploiement en production reste manuel**, avec le feu vert explicite de Malika. Rien dans les tâches 1 à 9 ne déploie ni ne touche Cloudflare ou Supabase en écriture. La Tâche 10 est conduite par le contrôleur avec elle, jamais par un sous-agent.
- Aucune dépense, aucun compte, aucun projet cloud sans consigne explicite de Malika.
- **Parité exacte avec le site** : une route portée renvoie le même statut, le même corps JSON, les mêmes en-têtes de cache et les mêmes messages d'erreur que la route du site. On **ne corrige pas** un comportement du site en le portant (par exemple l'absence de plafond d'adresse sur l'estimation) : toute observation est notée dans `docs/API-UNIQUE.md`, section « Observations sur le site ».
- Le serveur décide : l'identité vient uniquement du jeton vérifié, jamais d'un en-tête ou d'un corps ; l'identifiant de restaurant reçu du navigateur n'est jamais une autorisation.
- Aucune donnée sensible dans le code, les commits, les journaux, les rapports. Un script qui lit un secret ne l'affiche jamais. `.env.local` et `.dev.vars` ne sont jamais commités.
- Un code de sortie `0` est exigé pour dire qu'une vérification passe, sans `| tail` qui le masque. Le test du site écrit « ECHEC » sans accent.
- Fichiers contenant des antislashs ou des expressions régulières : outil d'écriture de fichiers, jamais `node -e` ni heredoc.
- Les commandes `npm run …` se lancent depuis le dossier de l'application ou depuis la racine (`test:api`, `build:api`, `typecheck`, `test:unit`, `test:cloisonnement`) ; `npm install` à la racine ; aucune version existante du verrou ne change.
- Dans Git Bash, un argument qui commence par `/` est converti en chemin Windows : préfixer par `MSYS_NO_PATHCONV=1`.
- Avant d'écrire dans une table, lire ses contraintes. **Ce plan n'écrit dans aucune table** (les routes d'écriture sont testées avec de faux services ; leurs vrais services ne sont pas appelés avant la Tâche 10).
- Branche de travail : `etape-1b-routes-et-relais` (le contrôle GitHub tourne sur `etape-*`). Fusion en avance rapide dans `master` seulement après contrôle vert.

## Faits vérifiés avant d'écrire ce plan (31 octobre 2026)

- Les 77 routes sont minces : chacune lit la requête, appelle un service et formate. Aides communes : `apps/web/src/lib/api/v1.ts` (`repondre` = JSON sans cache ; `repondreErreur` ; `utilisateurDuJeton` par `auth.getUser` ; `lireCorpsJson` : type de contenu contenant `application/json`, taille par `corpsTropGros`, JSON valide) et `v1-client.ts` (`clientAuthentifie` : identité puis `limiterClientApplication`).
- Les dix routes retenues et leurs services (tous existants, aucun à écrire sauf `moi`) :

| Route | Méthode | Cache | Identité | Service du site |
|---|---|---|---|---|
| `/api/v1/connexion/fournisseurs` | GET | `public, max-age=60` | aucune | `connexionClientActive()` (erreur → `facebook:false`) |
| `/api/v1/moi` | GET | aucun | jeton, strict, puis `limiterClientApplication` | à extraire de la route : `lireRolesCompte` |
| `/api/v1/client/espace` | GET | aucun | `clientAuthentifie` | `lireEspaceClient(id)` |
| `/api/v1/client/favoris` | POST | aucun | `clientAuthentifie` | `basculerFavoriClient(id, restaurantId)` |
| `/api/v1/client/profil` | POST | aucun | `clientAuthentifie` | `enregistrerProfilClient(id, corps)` |
| `/api/v1/client/adresses` | POST | aucun | `clientAuthentifie` | `actionAdresseClient(id, corps)` |
| `/api/v1/client/compte` | POST | aucun | `clientAuthentifie` | `supprimerCompteClient(id, confirmation)` |
| `/api/v1/livraison/estimation` | POST | aucun | jeton seul (message différent), **pas de plafond de compte** | `estimerPourClient(restaurantId, destination, sousTotal)` |

  (plus `version` et `aide`, déjà portées à l'étape 1a : elles reçoivent seulement leur garde de relais.) Les routes d'écriture répondent `{ok:true,message[,favori]}` ou une erreur `VALIDATION` portant le message du service.
- `limitation-debit.ts` lit l'adresse du visiteur dans `cf-connecting-ip`, à défaut `x-forwarded-for`. Un appel du Worker du site vers le Worker de l'API arrive avec **l'adresse du Worker du site**, pas celle du visiteur : sans correctif, tous les visiteurs partageraient un plafond. D'où le secret de relais (Tâche 7). Ce que Cloudflare met réellement dans `cf-connecting-ip` pour un appel entre deux Workers n'est **pas vérifié** : le plan ne s'y fie pas.
- Le site a un seul fichier à extraire, `moi` : sa requête est écrite dans la route. Tout le reste existe déjà dans `lib/`.

## Écarts assumés et hors périmètre

- **Hors périmètre :** les routes du livreur, du restaurateur, de l'équipe, des commandes et du suivi (plan 1c et suivants) ; le mode local pour une route ; le plafond par adresse sur l'estimation (comportement du site à ne pas changer) ; le relais en production ; le client typé `packages/api-client`.
- **Comparaison avec la production :** les routes publiques (`fournisseurs`) se comparent sans jeton. Les routes avec compte ne se comparent qu'avec **un vrai jeton** : l'option `--jeton-env` est livrée (Tâche 6), son essai réel est dans la Tâche 10. Les routes d'écriture (`favoris`, `profil`, `adresses`, `compte`) **ne sont jamais comparées à la production** (elles écriraient) : seule leur parité de code est testée.
- **Écart connu :** sur une méthode non gérée, le site répond 405 (Next) et l'API répond 404. Sans conséquence pour le relais (le garde est dans le gestionnaire de la bonne méthode).

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `apps/api/src/http.ts` | Créer | `repondre`, `lireCorpsJson` identiques au site |
| `apps/api/src/app.ts` | Modifier | cast `ContentfulStatusCode`, journal avec nom d'erreur, relais de confiance |
| `apps/api/src/types.ts` | Modifier | `Deps` étendu (vérificateurs, services client, estimation, fournisseurs, rôles, secret de relais) |
| `apps/api/src/identite/jeton.ts` | Modifier | panne JWKS = exception, jeton invalide = `null` ; vérificateur strict |
| `apps/api/src/identite/relais.ts` | Créer | confiance dans l'adresse transmise par le site (secret, comparaison à temps constant) |
| `apps/api/src/controles/chaine.ts` | Modifier | `identifier(verifier, message?)` |
| `apps/api/src/routes/fournisseurs.ts`, `moi.ts`, `client.ts`, `estimation.ts` | Créer | les huit routes |
| `apps/api/src/worker.ts` | Modifier | câblage de production |
| `apps/api/scripts/comparateur.mjs`, `comparer-routes.mjs` | Modifier | jeton, méthode, corps |
| `apps/api/tests/*.test.ts` | Créer / modifier | un fichier de test par brique |
| `apps/web/src/lib/api/moi-service.ts` | Créer | `lireRolesCompte` extrait de la route `moi` |
| `apps/web/src/lib/api/relais-regles.ts`, `relais.ts` | Créer | règles pures du relais (testées) et branchement sur l'environnement |
| `apps/web/src/app/api/v1/**/route.ts` (10 fichiers) | Modifier | garde de relais de deux lignes (et `moi` utilise `lireRolesCompte`) |
| `apps/web/scripts/tests/relais.test.mts`, `lancer.mjs` | Créer / modifier | test du relais |
| `docs/API-UNIQUE.md`, `docs/STATUT-PROJET.md`, mémoire | Modifier | documentation |

---

### Tâche 1 : Réponses et corps JSON de l'API, identiques au site

**Fichiers :**
- Créer : `apps/api/src/http.ts`, `apps/api/tests/http.test.ts`
- Modifier : `apps/api/src/app.ts`, `apps/api/tests/app.test.ts`

**Interfaces :**
- Consomme : `corpsTropGros` de `@speedfood/shared/api/v1-regles`, `ErreurApi`, `statutHttp`.
- Produit :
  - `repondre(c: Context, corps: unknown, statut?: number): Response` : JSON, en-tête `Cache-Control: no-store`
  - `lireCorpsJson(c: Context): Promise<{ ok: true; corps: unknown } | { ok: false; reponse: Response }>` : mêmes trois refus que `lireCorpsJson` du site (type de contenu, taille, JSON illisible), mêmes messages
  - `reponseErreur` (déjà dans `app.ts`) exportée aussi depuis `http.ts` (déplacée), `app.ts` la réexporte

- [ ] **Étape 1 : Créer la branche**

```bash
cd /c/Users/moelo/dev/speedfood
git checkout master && git pull --ff-only
git checkout -b etape-1b-routes-et-relais
```

- [ ] **Étape 2 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/http.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { lireCorpsJson, repondre } from "../src/http.ts";

function appEssai() {
  const app = new Hono();
  app.post("/", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    return repondre(c, { ok: true, recu: lu.corps }, 201);
  });
  return app;
}
const JSON_TYPE = { "content-type": "application/json" };

test("repondre : JSON, statut demandé, jamais de cache", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: JSON_TYPE, body: '{"a":1}' });
  assert.equal(reponse.status, 201);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, recu: { a: 1 } });
});

test("type de contenu autre que JSON : VALIDATION 400, message identique au site", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON attendu." } });
});

test("type de contenu absent : refusé", async () => {
  const reponse = await appEssai().request("/", { method: "POST", body: "{}" });
  assert.equal(reponse.status, 400);
});

test("corps trop gros d'après content-length : refusé sans lire le corps", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: { ...JSON_TYPE, "content-length": "99999999" }, body: "{}" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête trop volumineuse." } });
});

test("JSON illisible : VALIDATION 400, message identique au site", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: JSON_TYPE, body: "{pas du json" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
});

test("une valeur JSON qui n'est pas un objet est rendue telle quelle (la route décide)", async () => {
  const reponse = await appEssai().request("/", { method: "POST", headers: JSON_TYPE, body: "[1,2]" });
  assert.deepEqual(await reponse.json(), { ok: true, recu: [1, 2] });
});
```

- [ ] **Étape 3 : Constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Attendu : `test` différent de 0 (module `http.ts` introuvable).

- [ ] **Étape 4 : Écrire `http.ts`** (outil Write)

```ts
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";
import { corpsTropGros, statutHttp } from "@speedfood/shared/api/v1-regles";

const SANS_CACHE = { "Cache-Control": "no-store" };

/** Réponse JSON sans cache (jamais de commande ni de compte dans un cache partagé) : même contrat que `repondre` du site. */
export function repondre(c: Context, corps: unknown, statut = 200): Response {
  return c.json(corps as object, statut as ContentfulStatusCode, SANS_CACHE);
}

/** Réponse d'erreur au contrat uniforme `{ ok: false, erreur: { code, message } }`, statut dérivé du code. */
export function reponseErreur(c: Context, erreur: ErreurApi): Response {
  return repondre(c, { ok: false, erreur }, statutHttp(erreur.code));
}

/** Corps JSON d'une requête, ou une réponse d'erreur toute prête : mêmes refus et mêmes messages que `lireCorpsJson` du site. */
export async function lireCorpsJson(c: Context): Promise<{ ok: true; corps: unknown } | { ok: false; reponse: Response }> {
  if (!(c.req.header("content-type") ?? "").includes("application/json")) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : JSON attendu." }) };
  }
  if (corpsTropGros(c.req.header("content-length") ?? null)) {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête trop volumineuse." }) };
  }
  try {
    return { ok: true, corps: await c.req.json() };
  } catch {
    return { ok: false, reponse: reponseErreur(c, { code: "VALIDATION", message: "Requête invalide : JSON illisible." }) };
  }
}
```

Dans `apps/api/src/app.ts` : supprimer la définition locale de `reponseErreur` et la constante `SANS_CACHE` si elles ne servent plus, importer `import { reponseErreur } from "./http.ts";` et ajouter `export { reponseErreur };` (les tests de la 1a l'importent d'ici). Dans `onError`, remplacer le journal par `console.error("api_erreur_non_geree", erreur instanceof Error ? erreur.name : "inconnue");` (nom seulement : ni message, ni pile, ni chemin).

- [ ] **Étape 5 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : réponses et lecture du corps JSON identiques au site, journal d'erreur avec le nom seul

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `test=0` (les 37 tests précédents plus 6), `typecheck=0`.

---

### Tâche 2 : Jetons câblables : panne distinguée du jeton invalide, mode strict, message d'erreur de l'identité

**Fichiers :**
- Modifier : `apps/api/src/identite/jeton.ts`, `apps/api/src/controles/chaine.ts`, `apps/api/tests/jeton.test.ts`, `apps/api/tests/chaine.test.ts`

**Interfaces :**
- Consomme : `VerificateurJeton`, `ConfigJeton`, `verifierJetonLocal` (étape 1a).
- Produit :
  - `verifierJetonLocal(jeton, config, maintenant?)` : **jeton invalide (signature, émetteur, audience, expiration, forme, algorithme) → `null` ; toute autre erreur (lecture des clés impossible, délai dépassé, erreur inattendue) → l'exception remonte** (la chaîne répond alors 500 et jamais 401)
  - `type ClientAuthStrict = { auth: { getUser(jeton: string): Promise<{ data: { user: { id: string } | null }; error: { status?: number; name?: string } | null }> } }`
  - `creerVerificateurLocal(config: ConfigJeton): VerificateurJeton`
  - `creerVerificateurStrict(obtenirClient: () => ClientAuthStrict): VerificateurJeton` : `getUser` ; compte absent, jeton refusé (statut 4xx) → `null` ; erreur réseau ou statut ≥ 500 ou absent → l'exception remonte
  - `identifier(verifier, message = "Connectez-vous avec votre compte.")` : le message de `NON_AUTHENTIFIE` devient un paramètre (l'estimation du site en dit un autre)

- [ ] **Étape 1 : Écrire les tests qui échouent.** Dans `apps/api/tests/jeton.test.ts`, ajouter à la fin (la fabrique `fabrique()` et la constante `ISSUER` existent déjà ; relire le fichier avant d'écrire) :

```ts
import { errors } from "jose";
import { creerVerificateurLocal, creerVerificateurStrict } from "../src/identite/jeton.ts";

test("panne de lecture des clés (délai dépassé) : l'exception remonte, ce n'est PAS un jeton invalide", async () => {
  const { signer } = await fabrique();
  const jeton = await signer();
  const cles = async () => { throw new errors.JWKSTimeout(); };
  await assert.rejects(() => verifierJetonLocal(jeton, { cles, issuer: ISSUER }), errors.JWKSTimeout);
});

test("panne réseau (TypeError) pendant la lecture des clés : l'exception remonte", async () => {
  const { signer } = await fabrique();
  const jeton = await signer();
  const cles = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(() => verifierJetonLocal(jeton, { cles, issuer: ISSUER }), TypeError);
});

test("clé inconnue (kid absent du jeu) : jeton invalide, null", async () => {
  const { config, signer } = await fabrique();
  const jeton = await new (await import("jose")).SignJWT({}).setProtectedHeader({ alg: "ES256", kid: "inconnue" }).setIssuer(ISSUER).setAudience("authenticated").setSubject("x").setExpirationTime("1h").sign((await (await import("jose")).generateKeyPair("ES256")).privateKey);
  assert.equal(await verifierJetonLocal(jeton, config), null);
  void signer;
});

test("vérificateur local : même résultat que la fonction", async () => {
  const { config, signer } = await fabrique();
  assert.deepEqual(await creerVerificateurLocal(config)(await signer()), { id: "11111111-1111-1111-1111-111111111111" });
});

type Reponse = { data: { user: { id: string } | null }; error: { status?: number; name?: string } | null };
const strict = (reponse: Reponse | Error) => creerVerificateurStrict(() => ({ auth: { getUser: async () => { if (reponse instanceof Error) throw reponse; return reponse; } } }));

test("strict : compte existant, identifiant rendu", async () => {
  assert.deepEqual(await strict({ data: { user: { id: "u1" } }, error: null })("jeton"), { id: "u1" });
});

test("strict : jeton refusé par le service (statut 401 ou 403) ou compte absent : null", async () => {
  assert.equal(await strict({ data: { user: null }, error: { status: 401 } })("jeton"), null);
  assert.equal(await strict({ data: { user: null }, error: { status: 403 } })("jeton"), null);
  assert.equal(await strict({ data: { user: null }, error: null })("jeton"), null);
});

test("strict : panne du service (statut 500, erreur sans statut, exception réseau) : l'exception remonte, jamais null", async () => {
  await assert.rejects(() => strict({ data: { user: null }, error: { status: 500 } })("jeton"));
  await assert.rejects(() => strict({ data: { user: null }, error: { name: "AuthRetryableFetchError" } })("jeton"));
  await assert.rejects(() => strict(new TypeError("fetch failed"))("jeton"));
});
```

Le test « clé inconnue » ci-dessus est volontairement maladroit : **le réécrire proprement** en important `SignJWT` et `generateKeyPair` en tête de fichier avec les autres imports `jose` (supprimer les `await import`), sans changer ce qu'il prouve : un jeton dont le `kid` n'est pas dans le jeu de clés est refusé par `null`.

Dans `apps/api/tests/chaine.test.ts`, ajouter :

```ts
test("le message de NON_AUTHENTIFIE se règle par route", async () => {
  const app = creerApp(deps);
  const protege = new Hono<{ Variables: Variables }>();
  protege.use("*", identifier(async () => null, "Connectez-vous pour calculer la livraison."));
  protege.get("/", (c) => c.json({ ok: true }));
  app.route("/api/v1/essai", protege);
  const reponse = await app.request("/api/v1/essai", { headers: { authorization: `Bearer ${JETON}` } });
  assert.equal(reponse.status, 401);
  assert.equal(((await reponse.json()) as { erreur: { message: string } }).erreur.message, "Connectez-vous pour calculer la livraison.");
});
```

- [ ] **Étape 2 : Constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
```

Attendu : `test` différent de 0.

- [ ] **Étape 3 : Écrire le code.** Remplacer dans `apps/api/src/identite/jeton.ts` le corps de `verifierJetonLocal` et ajouter les deux fabriques (le reste du fichier est inchangé ; le commentaire de la fonction est à mettre à jour : « jeton invalide → null ; panne → exception ») :

```ts
import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

/** Un jeton INVALIDE (forme, signature, émetteur, audience, expiration, algorithme, clé inconnue) se reconnaît à ces classes d'erreur de jose. Tout le reste est une panne. */
function estJetonInvalide(erreur: unknown): boolean {
  return (
    erreur instanceof errors.JWTInvalid ||
    erreur instanceof errors.JWSInvalid ||
    erreur instanceof errors.JWTExpired ||
    erreur instanceof errors.JWTClaimValidationFailed ||
    erreur instanceof errors.JWSSignatureVerificationFailed ||
    erreur instanceof errors.JOSEAlgNotAllowed ||
    erreur instanceof errors.JOSENotSupported ||
    erreur instanceof errors.JWKSNoMatchingKey ||
    erreur instanceof errors.JWKSMultipleMatchingKeys
  );
}

export async function verifierJetonLocal(jeton: string, config: ConfigJeton, maintenant: Date = new Date()): Promise<{ id: string } | null> {
  try {
    const { payload } = await jwtVerify(jeton, config.cles, {
      issuer: config.issuer,
      audience: "authenticated",
      algorithms: ["ES256"],
      currentDate: maintenant,
    });
    return typeof payload.sub === "string" && payload.sub !== "" ? { id: payload.sub } : null;
  } catch (erreur) {
    if (estJetonInvalide(erreur)) return null;
    throw erreur;
  }
}

/** Vérificateur local prêt à brancher sur une route (mode « local » de la décision du 31 octobre 2026). */
export function creerVerificateurLocal(config: ConfigJeton): VerificateurJeton {
  return (jeton) => verifierJetonLocal(jeton, config);
}

export type ClientAuthStrict = {
  auth: {
    getUser(jeton: string): Promise<{ data: { user: { id: string } | null }; error: { status?: number; name?: string } | null }>;
  };
};

/**
 * Vérificateur STRICT : le service d'authentification confirme aussi que le compte existe encore (un compte supprimé ou banni est refusé tout de suite).
 * Comportement du site : jeton refusé ou compte absent → null ; panne du service → exception (500), jamais un faux « non connecté » qui déconnecterait tout le monde.
 */
export function creerVerificateurStrict(obtenirClient: () => ClientAuthStrict): VerificateurJeton {
  return async (jeton) => {
    const { data, error } = await obtenirClient().auth.getUser(jeton);
    if (error) {
      if (typeof error.status === "number" && error.status >= 400 && error.status < 500) return null;
      throw new Error(`verification du jeton impossible (${error.name ?? "sans nom"})`);
    }
    return data.user ? { id: data.user.id } : null;
  };
}
```

(`createRemoteJWKSet` reste utilisé par `configJetonSupabase`, déjà dans le fichier ; ne pas le retirer.) Vérifier que toutes les classes citées existent dans `jose` 6.2.14 (`node -e "console.log(Object.keys(require('jose').errors))"` : si un nom manque, le signaler et adapter la liste, sans élargir à `JOSEError` en général).

Dans `apps/api/src/controles/chaine.ts` : `export function identifier(verifier: VerificateurJeton, message = "Connectez-vous avec votre compte."): MiddlewareHandler<{ Variables: Variables }>` et utiliser `message` dans `ErreurMetier("NON_AUTHENTIFIE", message)`.

- [ ] **Étape 4 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : jetons câblables (panne distinguée du jeton invalide, vérificateurs local et strict), message d'identité réglable

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `test=0`, `typecheck=0`. Rendre dans le rapport la liste exacte des classes d'erreur de jose retenues.

---

### Tâche 3 : Dépendances de l'API et routes publiques `connexion/fournisseurs`

**Fichiers :**
- Modifier : `apps/api/src/types.ts`, `apps/api/src/app.ts`
- Créer : `apps/api/src/routes/fournisseurs.ts`, `apps/api/tests/fournisseurs.test.ts`
- Modifier : `apps/api/tests/app.test.ts`, `apps/api/tests/routes.test.ts`, `apps/api/tests/chaine.test.ts` (leurs `Deps` d'essai : adapter le littéral à la nouvelle forme, voir étape 2)

**Interfaces :**
- Produit : `Deps` étendu, tel que dans le code ci-dessous ; `routeFournisseurs(deps: Pick<Deps, "connexionClientActive">): Hono`.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/fournisseurs.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";

test("fournisseurs : Facebook ouvert, cache 60 secondes, comme le site", async () => {
  const reponse = await creerApp(depsEssai({ connexionClientActive: async () => true })).request("/api/v1/connexion/fournisseurs");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual(await reponse.json(), { ok: true, facebook: true });
});

test("fournisseurs : Facebook fermé", async () => {
  const reponse = await creerApp(depsEssai({ connexionClientActive: async () => false })).request("/api/v1/connexion/fournisseurs");
  assert.deepEqual(await reponse.json(), { ok: true, facebook: false });
});

test("fournisseurs : une erreur de lecture rend « fermé », jamais une erreur (un bouton qui échouerait est pire)", async () => {
  const reponse = await creerApp(depsEssai({ connexionClientActive: async () => { throw new Error("base indisponible"); } })).request("/api/v1/connexion/fournisseurs");
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual(await reponse.json(), { ok: true, facebook: false });
});
```

- [ ] **Étape 2 : Créer l'aide de tests** (outil Write) : `apps/api/tests/deps-essai.ts`. Elle fabrique des `Deps` complets avec de fausses valeurs, et sert à **tous** les tests d'API (migrer les trois fichiers de tests existants pour qu'ils l'utilisent à la place de leur littéral local).

```ts
import type { Deps } from "../src/types.ts";

const ECHEC = async () => { throw new Error("dépendance non prévue dans ce test"); };
const refus = async () => null;

/** Dépendances d'essai : tout échoue bruyamment par défaut ; chaque test ne fournit que ce qu'il utilise. */
export function depsEssai(surcharge: Partial<Deps> = {}): Deps {
  return {
    version: { code: 51, nom: "2.47.0", notes: "essai", obligatoire: false, apkSha256: "a".repeat(64), apkTaille: 1 },
    lireAssistance: async () => ({ whatsapp: null }),
    connexionClientActive: ECHEC,
    verificateurs: { strict: refus, local: refus },
    limiterClientApplication: async () => {},
    lireRoles: ECHEC,
    client: { lireEspace: ECHEC, basculerFavori: ECHEC, enregistrerProfil: ECHEC, actionAdresse: ECHEC, supprimerCompte: ECHEC },
    estimerPourClient: ECHEC,
    secretRelais: () => undefined,
    ...surcharge,
  };
}
```

- [ ] **Étape 3 : Étendre `Deps`** (outil Write sur `apps/api/src/types.ts`)

```ts
import type { VersionApplication } from "@speedfood/shared/application/version";
import type { VerificateurJeton } from "./identite/jeton.ts";

export type ResultatEspace = { ok: true; message: string; favori?: boolean } | { ok: false; message: string };

export interface RolesCompte {
  restaurateur: { restaurant: string } | null;
  livreur: boolean;
  equipe: string | null;
}

/**
 * Tout ce que les routes ont le droit d'appeler : branché en production par `worker.ts` sur les services du site (jamais une copie de leurs règles),
 * remplacé par de fausses valeurs dans les tests (`tests/deps-essai.ts`).
 */
export interface Deps {
  version: VersionApplication;
  lireAssistance(): Promise<{ whatsapp: string | null }>;
  connexionClientActive(): Promise<boolean>;
  /** Un vérificateur par mode de la décision du 31 octobre 2026 ; chaque route déclare le sien, `strict` par défaut. */
  verificateurs: { strict: VerificateurJeton; local: VerificateurJeton };
  limiterClientApplication(utilisateurId: string): Promise<void>;
  lireRoles(utilisateurId: string): Promise<RolesCompte>;
  client: {
    lireEspace(utilisateurId: string): Promise<object>;
    basculerFavori(utilisateurId: string, restaurantId: unknown): Promise<ResultatEspace>;
    enregistrerProfil(utilisateurId: string, corps: Record<string, unknown>): Promise<ResultatEspace>;
    actionAdresse(utilisateurId: string, corps: Record<string, unknown>): Promise<ResultatEspace>;
    supprimerCompte(utilisateurId: string, confirmation: unknown): Promise<ResultatEspace>;
  };
  estimerPourClient(restaurantId: unknown, destination: unknown, sousTotalGnf: unknown): Promise<object>;
  /** Secret partagé avec le site pour le relais (Tâche 7) ; lu au moment de l'appel, `undefined` tant qu'il n'est pas posé. */
  secretRelais(): string | undefined;
}
```

- [ ] **Étape 4 : Constater l'échec**, puis écrire la route (outil Write) : `apps/api/src/routes/fournisseurs.ts`

```ts
import { Hono } from "hono";
import type { Deps } from "../types.ts";

/**
 * Connexions par réseau social ouvertes aux clients. Route PUBLIQUE (l'application la lit avant la connexion). Une erreur de lecture rend « fermé » :
 * jamais un bouton qui échouerait. Même contrat que la route du site.
 */
export function routeFournisseurs(deps: Pick<Deps, "connexionClientActive">) {
  const route = new Hono();
  route.get("/", async (c) => {
    let facebook = false;
    try {
      facebook = await deps.connexionClientActive();
    } catch {
      facebook = false;
    }
    return c.json({ ok: true, facebook }, 200, { "Cache-Control": "public, max-age=60" });
  });
  return route;
}
```

Dans `apps/api/src/app.ts` : `import { routeFournisseurs } from "./routes/fournisseurs.ts";` et `app.route("/api/v1/connexion/fournisseurs", routeFournisseurs(deps));` après `aide`.

- [ ] **Étape 5 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : dépendances étendues, aide de tests, route connexion/fournisseurs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `test=0`, `typecheck=0`. Le typecheck de `worker.ts` échouera tant que le câblage n'est pas fait : **ajouter dans `worker.ts`, dans cette tâche, des valeurs provisoires qui lèvent « non câblé »** pour les dépendances nouvelles (`connexionClientActive`, `verificateurs`, `limiterClientApplication`, `lireRoles`, `client`, `estimerPourClient`, `secretRelais: () => undefined`) afin que le typecheck passe ; la Tâche 7 les remplace par le vrai câblage. Aucune de ces routes n'étant encore montée, le Worker n'expose rien de plus.

---

### Tâche 4 : Route `moi` (rôles du compte), service extrait du site

**Fichiers :**
- Créer : `apps/web/src/lib/api/moi-service.ts`, `apps/api/src/routes/moi.ts`, `apps/api/tests/moi.test.ts`
- Modifier : `apps/web/src/app/api/v1/moi/route.ts`, `apps/api/src/app.ts`

**Interfaces :**
- Consomme : `identifier`, `limiterParCompte` (chaîne), `repondre` (Tâche 1), `Deps.verificateurs.strict`, `Deps.limiterClientApplication`, `Deps.lireRoles`.
- Produit : `lireRolesCompte(utilisateurId: string): Promise<RolesCompte>` (site) ; `routeMoi(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "lireRoles">): Hono<{ Variables: Variables }>`.

- [ ] **Étape 1 : Extraire le service du site** (outil Write) : `apps/web/src/lib/api/moi-service.ts`. **Copier à l'identique** les trois requêtes et le calcul de `nomRestaurant` et `roleEquipe` de `apps/web/src/app/api/v1/moi/route.ts` (relire le fichier avant), sans changer une condition :

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { estRoleSysteme } from "@/lib/system-admin/permissions";

export interface RolesCompte {
  restaurateur: { restaurant: string } | null;
  livreur: boolean;
  equipe: string | null;
}

/** Quels espaces ce compte peut-il ouvrir ? Extrait de la route `/api/v1/moi` pour que le site et l'API partagent la même lecture. */
export async function lireRolesCompte(utilisateurId: string): Promise<RolesCompte> {
  // Client sans types générés : la table `livreurs` n'en fait pas partie (même usage que src/lib/livraison/livreur.ts).
  const admin = creerClientAdmin() as unknown as SupabaseClient;
  const [restaurant, livreur, equipe] = await Promise.all([
    admin.from("restaurant_memberships").select("restaurant_id, restaurants(nom)").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
    admin.from("livreurs").select("id").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
    admin.from("system_admin_memberships").select("role").eq("utilisateur_id", utilisateurId).limit(1).maybeSingle(),
  ]);
  const jointure = restaurant.data?.restaurants as { nom?: string } | { nom?: string }[] | null | undefined;
  const nomRestaurant = Array.isArray(jointure) ? jointure[0]?.nom : jointure?.nom;
  const roleEquipe = typeof equipe.data?.role === "string" && estRoleSysteme(equipe.data.role) ? equipe.data.role : null;
  return {
    restaurateur: restaurant.data ? { restaurant: nomRestaurant ?? "Mon restaurant" } : null,
    livreur: Boolean(livreur.data),
    equipe: roleEquipe,
  };
}
```

Dans `apps/web/src/app/api/v1/moi/route.ts` : remplacer tout le bloc qui va du commentaire « Client sans types générés » jusqu'à la fin de l'appel `repondre({...})` par :

```ts
  return repondre({ ok: true, roles: await lireRolesCompte(utilisateur.id) });
```

et ajuster les imports (supprimer ceux devenus inutiles : `SupabaseClient`, `creerClientAdmin`, `estRoleSysteme` ; ajouter `import { lireRolesCompte } from "@/lib/api/moi-service";`). Le corps JSON reste `{ ok: true, roles: { restaurateur, livreur, equipe } }` : **clés dans le même ordre**. `npm run typecheck` et `npx eslint` du site à exit 0 ; `npm run test:unit` et `npm run test:cloisonnement` à exit 0.

- [ ] **Étape 2 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/moi.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const ROLES = { restaurateur: { restaurant: "Chez Fatou" }, livreur: false, equipe: null };

function app(surcharge = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => { appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    limiterClientApplication: async (id) => { appels.push(`limite:${id}`); },
    lireRoles: async (id) => { appels.push(`roles:${id}`); return ROLES; },
    ...surcharge,
  }));
}

test("moi : identité stricte, plafond du compte, puis les rôles ; pas de cache", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, roles: ROLES });
  assert.deepEqual(appels, ["identite", "limite:compte-1", "roles:compte-1"]);
});

test("moi : sans jeton, ou jeton refusé : 401 et rien d'autre n'est appelé", async () => {
  for (const entetes of [{}, { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" }]) {
    const appels: string[] = [];
    const reponse = await app({}, appels).request("/api/v1/moi", { headers: entetes });
    assert.equal(reponse.status, 401);
    assert.equal(((await reponse.json()) as { erreur: { code: string; message: string } }).erreur.message, "Connectez-vous avec votre compte.");
    assert.ok(!appels.some((a) => a.startsWith("limite") || a.startsWith("roles")));
  }
});

test("moi : plafond dépassé, 429, les rôles ne sont pas lus", async () => {
  const appels: string[] = [];
  const reponse = await app({ limiterClientApplication: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); } }, appels).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 429);
  assert.ok(!appels.some((a) => a.startsWith("roles")));
});

test("moi : panne de la lecture des rôles, 500 sans détail", async () => {
  const reponse = await app({ lireRoles: async () => { throw new Error("secret interne"); } }).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
});

test("moi : panne du service d'authentification, 500 (jamais 401 : l'application ne doit pas déconnecter)", async () => {
  const reponse = await app({ verificateurs: { strict: async () => { throw new Error("auth indisponible"); }, local: async () => null } }).request("/api/v1/moi", { headers: AUTH });
  assert.equal(reponse.status, 500);
});

test("moi : un compte sans rôle reçoit trois valeurs vides, jamais une erreur", async () => {
  const vide = { restaurateur: null, livreur: false, equipe: null };
  const reponse = await app({ lireRoles: async () => vide }).request("/api/v1/moi", { headers: AUTH });
  assert.deepEqual(await reponse.json(), { ok: true, roles: vide });
});
```

- [ ] **Étape 3 : Constater l'échec, puis écrire la route** (outil Write) : `apps/api/src/routes/moi.ts`

```ts
import { Hono } from "hono";
import { identifier, limiterParCompte } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { repondre } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Quels espaces ce compte peut-il ouvrir ? Information d'affichage seulement : chaque route d'un espace revérifie le droit elle-même.
 * Mode de jeton : STRICT (le compte doit exister). Identité, puis plafond du compte, comme `clientAuthentifie` du site.
 */
export function routeMoi(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "lireRoles">) {
  const route = new Hono<{ Variables: Variables }>();
  route.use("*", identifier(deps.verificateurs.strict));
  route.use("*", limiterParCompte(deps.limiterClientApplication));
  route.get("/", async (c) => repondre(c, { ok: true, roles: await deps.lireRoles(c.get("utilisateurId")) }));
  return route;
}
```

Dans `apps/api/src/app.ts` : `app.route("/api/v1/moi", routeMoi(deps));` (+ import). Si le typecheck proteste sur le typage de `app.route` avec un sous-routeur à `Variables`, utiliser le même montage que `tests/chaine.test.ts` (qui compile déjà) et le signaler dans le rapport.

- [ ] **Étape 4 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
npm run test:unit > /dev/null; echo "test:unit=$?"
(cd apps/web && npx eslint src/lib/api src/app/api/v1/moi; echo "eslint=$?")
git add -A && git commit -m "API unique : route moi (rôles du compte), lecture extraite du site dans moi-service

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : tous à `0`. Le rapport dit que le service extrait n'est **pas** testé unitairement (requêtes de base) : sa parité n'est confirmée que par l'essai avec un vrai jeton (Tâche 10).

---

### Tâche 5 : Routes `client/*` (espace, favoris, profil, adresses, compte) et `livraison/estimation`

**Fichiers :**
- Créer : `apps/api/src/routes/client.ts`, `apps/api/src/routes/estimation.ts`, `apps/api/tests/client.test.ts`, `apps/api/tests/estimation.test.ts`
- Modifier : `apps/api/src/app.ts`

**Interfaces :**
- Consomme : `identifier`, `limiterParCompte`, `lireCorpsJson`, `repondre`, `reponseErreur`, `Deps.client`, `Deps.estimerPourClient`.
- Produit : `routeClient(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "client">)` monté sur `/api/v1/client` (sous-chemins `/espace` GET, `/favoris`, `/profil`, `/adresses`, `/compte` POST) ; `routeEstimation(deps: Pick<Deps, "verificateurs" | "estimerPourClient">)` monté sur `/api/v1/livraison/estimation` (POST).

- [ ] **Étape 1 : Écrire les tests qui échouent** (outil Write) : `apps/api/tests/client.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}`, "content-type": "application/json" };
type Journal = { appels: unknown[][] };

function app(journal: Journal, surcharge: Partial<Deps["client"]> = {}, limite: Deps["limiterClientApplication"] = async () => {}) {
  const note = (nom: string, valeur: unknown) => journal.appels.push([nom, valeur]);
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => (j === JETON ? { id: "compte-1" } : null), local: async () => null },
    limiterClientApplication: limite,
    client: {
      lireEspace: async (id) => { note("espace", id); return { profil: null, adresses: [], favoris: [], avis: [] }; },
      basculerFavori: async (id, r) => { note("favori", [id, r]); return { ok: true, message: "Favori mis à jour.", favori: true }; },
      enregistrerProfil: async (id, c) => { note("profil", [id, c]); return { ok: true, message: "Profil enregistré." }; },
      actionAdresse: async (id, c) => { note("adresse", [id, c]); return { ok: true, message: "Adresse ajoutée." }; },
      supprimerCompte: async (id, conf) => { note("compte", [id, conf]); return { ok: true, message: "Compte supprimé." }; },
      ...surcharge,
    },
  }));
}
const post = (chemin: string, corps: unknown, entetes: Record<string, string> = AUTH) =>
  ({ chemin, init: { method: "POST", headers: entetes, body: JSON.stringify(corps) } });

test("espace : GET, identité du jeton, réponse {ok:true, ...espace}, jamais de cache", async () => {
  const journal: Journal = { appels: [] };
  const reponse = await app(journal).request("/api/v1/client/espace", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, profil: null, adresses: [], favoris: [], avis: [] });
  assert.deepEqual(journal.appels, [["espace", "compte-1"]]);
});

const ECRITURES: { chemin: string; corps: Record<string, unknown>; appel: string; attendu: unknown; reponse: Record<string, unknown> }[] = [
  { chemin: "/api/v1/client/favoris", corps: { restaurantId: "r1" }, appel: "favori", attendu: ["compte-1", "r1"], reponse: { ok: true, message: "Favori mis à jour.", favori: true } },
  { chemin: "/api/v1/client/profil", corps: { pseudo: "Fatou" }, appel: "profil", attendu: ["compte-1", { pseudo: "Fatou" }], reponse: { ok: true, message: "Profil enregistré." } },
  { chemin: "/api/v1/client/adresses", corps: { action: "ajouter" }, appel: "adresse", attendu: ["compte-1", { action: "ajouter" }], reponse: { ok: true, message: "Adresse ajoutée." } },
  { chemin: "/api/v1/client/compte", corps: { confirmation: "SUPPRIMER" }, appel: "compte", attendu: ["compte-1", "SUPPRIMER"], reponse: { ok: true, message: "Compte supprimé." } },
];

for (const e of ECRITURES) {
  test(`${e.chemin} : l'identité vient du jeton, jamais du corps ; réponse du site`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, { ...e.corps, utilisateurId: "pirate", utilisateur_id: "pirate" });
    const reponse = await app(journal).request(chemin, init);
    assert.equal(reponse.status, 200);
    assert.deepEqual(await reponse.json(), e.reponse);
    assert.equal(journal.appels.length, 1);
    assert.equal((journal.appels[0][1] as unknown[])[0], "compte-1");
  });

  test(`${e.chemin} : sans jeton 401, rien n'est écrit`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, e.corps, { "content-type": "application/json" });
    const reponse = await app(journal).request(chemin, init);
    assert.equal(reponse.status, 401);
    assert.deepEqual(journal.appels, []);
  });

  test(`${e.chemin} : corps non JSON, 400 VALIDATION, rien n'est écrit`, async () => {
    const journal: Journal = { appels: [] };
    const reponse = await app(journal).request(e.chemin, { method: "POST", headers: AUTH, body: "pas du json" });
    assert.equal(reponse.status, 400);
    assert.deepEqual(journal.appels, []);
  });

  test(`${e.chemin} : plafond dépassé, 429, rien n'est écrit`, async () => {
    const journal: Journal = { appels: [] };
    const { chemin, init } = post(e.chemin, e.corps);
    const reponse = await app(journal, {}, async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }).request(chemin, init);
    assert.equal(reponse.status, 429);
    assert.deepEqual(journal.appels, []);
  });
}

test("refus du service : réponse VALIDATION 400 avec le message du service (comme le site)", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/compte", { confirmation: "non" });
  const reponse = await app(journal, { supprimerCompte: async () => ({ ok: false, message: "Écrivez SUPPRIMER pour confirmer la suppression." }) }).request(chemin, init);
  assert.equal(reponse.status, 400);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Écrivez SUPPRIMER pour confirmer la suppression." } });
});

test("un corps qui n'est pas un objet est rendu comme objet vide au service (comme le site)", async () => {
  const journal: Journal = { appels: [] };
  const { chemin, init } = post("/api/v1/client/profil", [1, 2]);
  await app(journal).request(chemin, init);
  assert.equal(journal.appels.length, 1);
});

test("le favori n'est pas ajouté d'un GET ; les écritures refusent GET", async () => {
  const journal: Journal = { appels: [] };
  const reponse = await app(journal).request("/api/v1/client/favoris", { headers: AUTH });
  assert.equal(reponse.status, 404);
  assert.deepEqual(journal.appels, []);
});
```

Remarque pour l'implémenteur : le test « un corps qui n'est pas un objet » reproduit le site : `typeof corps === "object" && corps !== null ? corps : {}` laisse passer un tableau, qui est donc transmis tel quel ; le test n'affirme que l'appel unique, il ne doit pas affirmer un comportement que le site n'a pas.

`apps/api/tests/estimation.test.ts` :

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}`, "content-type": "application/json" };
const ESTIMATION = { statut: "ok", fraisGnf: 8000 };

function app(appels: unknown[][] = []) {
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => (j === JETON ? { id: "compte-1" } : null), local: async () => null },
    estimerPourClient: async (r, d, s) => { appels.push([r, d, s]); return ESTIMATION; },
  }));
}

test("estimation : jeton valide, les trois champs du corps sont transmis, réponse {ok:true, estimation}", async () => {
  const appels: unknown[][] = [];
  const corps = { restaurantId: "r1", destination: { quartierId: "q1" }, sousTotal: 25000 };
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: JSON.stringify(corps) });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, estimation: ESTIMATION });
  assert.deepEqual(appels, [["r1", { quartierId: "q1" }, 25000]]);
});

test("estimation : sans jeton, message propre à cette route (comme le site), le service n'est pas appelé", async () => {
  const appels: unknown[][] = [];
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(reponse.status, 401);
  assert.equal(((await reponse.json()) as { erreur: { message: string } }).erreur.message, "Connectez-vous pour calculer la livraison.");
  assert.deepEqual(appels, []);
});

test("estimation : corps non JSON, 400, le service n'est pas appelé", async () => {
  const appels: unknown[][] = [];
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: "x" });
  assert.equal(reponse.status, 400);
  assert.deepEqual(appels, []);
});

test("estimation : champs absents, transmis tels quels (le service refuse), jamais d'erreur de la route", async () => {
  const appels: unknown[][] = [];
  const reponse = await app(appels).request("/api/v1/livraison/estimation", { method: "POST", headers: AUTH, body: "{}" });
  assert.equal(reponse.status, 200);
  assert.deepEqual(appels, [[undefined, undefined, undefined]]);
});
```

- [ ] **Étape 2 : Constater l'échec, puis écrire les routes** (outil Write)

`apps/api/src/routes/client.ts` :

```ts
import { Hono } from "hono";
import { identifier, limiterParCompte } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre, reponseErreur } from "../http.ts";
import type { Deps, ResultatEspace } from "../types.ts";

/** Corps d'une écriture : un objet, ou un objet vide (comme le site : `typeof === "object" && !== null ? corps : {}`). */
function enObjet(corps: unknown): Record<string, unknown> {
  return (typeof corps === "object" && corps !== null ? corps : {}) as Record<string, unknown>;
}

/**
 * Espace client de l'application : profil, adresses, favoris, suppression du compte. Mode de jeton : STRICT (écritures sur le compte).
 * L'identité vient UNIQUEMENT du jeton vérifié ; plafond par compte comme `clientAuthentifie` du site.
 */
export function routeClient(deps: Pick<Deps, "verificateurs" | "limiterClientApplication" | "client">) {
  const route = new Hono<{ Variables: Variables }>();
  route.use("*", identifier(deps.verificateurs.strict));
  route.use("*", limiterParCompte(deps.limiterClientApplication));

  route.get("/espace", async (c) => repondre(c, { ok: true, ...(await deps.client.lireEspace(c.get("utilisateurId"))) }));

  /** Les quatre écritures ont la même forme : corps JSON, service, `{ok:true,message}` ou VALIDATION portant le message du service. */
  const ecriture = (chemin: string, appeler: (utilisateurId: string, corps: Record<string, unknown>) => Promise<ResultatEspace>, avecFavori = false) =>
    route.post(chemin, async (c) => {
      const lu = await lireCorpsJson(c);
      if (!lu.ok) return lu.reponse;
      const r = await appeler(c.get("utilisateurId"), enObjet(lu.corps));
      if (!r.ok) return reponseErreur(c, { code: "VALIDATION", message: r.message });
      return repondre(c, avecFavori ? { ok: true, message: r.message, favori: r.favori === true } : { ok: true, message: r.message });
    });

  ecriture("/favoris", (id, c) => deps.client.basculerFavori(id, c.restaurantId), true);
  ecriture("/profil", (id, c) => deps.client.enregistrerProfil(id, c));
  ecriture("/adresses", (id, c) => deps.client.actionAdresse(id, c));
  ecriture("/compte", (id, c) => deps.client.supprimerCompte(id, c.confirmation));
  return route;
}
```

`apps/api/src/routes/estimation.ts` :

```ts
import { Hono } from "hono";
import { identifier } from "../controles/chaine.ts";
import type { Variables } from "../controles/chaine.ts";
import { lireCorpsJson, repondre } from "../http.ts";
import type { Deps } from "../types.ts";

/**
 * Estimation des frais de livraison (même calcul que le site). Compte identifié par le jeton (mode STRICT) ; comme la route du site : message d'identité propre et
 * PAS de plafond de compte (le site n'en applique pas ici : on ne change pas ce comportement en le portant).
 */
export function routeEstimation(deps: Pick<Deps, "verificateurs" | "estimerPourClient">) {
  const route = new Hono<{ Variables: Variables }>();
  route.use("*", identifier(deps.verificateurs.strict, "Connectez-vous pour calculer la livraison."));
  route.post("/", async (c) => {
    const lu = await lireCorpsJson(c);
    if (!lu.ok) return lu.reponse;
    const corps = (typeof lu.corps === "object" && lu.corps !== null ? lu.corps : {}) as { restaurantId?: unknown; destination?: unknown; sousTotal?: unknown };
    return repondre(c, { ok: true, estimation: await deps.estimerPourClient(corps.restaurantId, corps.destination, corps.sousTotal) });
  });
  return route;
}
```

Dans `apps/api/src/app.ts` : monter `app.route("/api/v1/client", routeClient(deps));` et `app.route("/api/v1/livraison/estimation", routeEstimation(deps));` (+ imports).

**Point d'attention (ordre des contrôles) :** dans la route du site, l'identité est vérifiée **avant** de lire le corps ; l'API respecte le même ordre (les middlewares passent avant le gestionnaire). Le test « sans jeton, rien n'est écrit » le prouve.

- [ ] **Étape 3 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : routes client (espace, favoris, profil, adresses, compte) et estimation de livraison, parité de réponses testée

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `test=0`, `typecheck=0`.

---

### Tâche 6 : Comparateur avec jeton, méthode et corps

**Fichiers :**
- Modifier : `apps/api/scripts/comparateur.mjs`, `apps/api/scripts/comparer-routes.mjs`, `apps/api/tests/comparateur.test.ts`

**Interfaces :**
- Consomme : `comparerRoutes(base1, base2, chemins, envoyer = fetch, options = { tolererNon2xx: false })` (étape 1a).
- Produit : `options` étendues : `{ tolererNon2xx?: boolean, entetes?: Record<string, string>, methode?: string, corps?: string }` ; CLI : `--jeton-env NOM` (variable d'environnement qui contient un jeton porteur ; le jeton est envoyé aux deux adresses, **jamais affiché**), `--methode POST`, `--corps '{"a":1}'` (envoyé tel quel avec `content-type: application/json`).

- [ ] **Étape 1 : Écrire les tests qui échouent.** Dans `apps/api/tests/comparateur.test.ts`, relire le fichier puis ajouter (le serveur factice existant `serveur(routes)` répond selon l'adresse seule : en créer une variante `serveurEcho` qui renvoie dans un en-tête de réponse `x-methode-recue`, `x-auth-recu` (« oui »/« non », jamais la valeur) et `x-corps-recu` (le corps lu), pour prouver ce que le comparateur envoie) :

```ts
test("les options entetes, methode et corps sont envoyés aux DEUX adresses", async () => {
  const vus: { methode: string; auth: string; corps: string }[] = [];
  const faux = async (_url: string, init?: RequestInit) => {
    vus.push({ methode: init?.method ?? "GET", auth: new Headers(init?.headers).get("authorization") ?? "", corps: String(init?.body ?? "") });
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  };
  const ecarts = await comparerRoutes("http://a", "http://b", ["/x"], faux, { entetes: { authorization: "Bearer SECRET" }, methode: "POST", corps: '{"k":1}' });
  assert.deepEqual(ecarts, []);
  assert.equal(vus.length, 2);
  for (const v of vus) assert.deepEqual(v, { methode: "POST", auth: "Bearer SECRET", corps: '{"k":1}' });
});

test("un écart ne contient JAMAIS la valeur du jeton, même si le serveur la renvoie dans le corps", async () => {
  const reponses = [new Response('{"echo":"Bearer SECRET"}', { status: 200, headers: { "content-type": "application/json" } }), new Response('{"echo":"autre"}', { status: 200, headers: { "content-type": "application/json" } })];
  let i = 0;
  const ecarts: string[] = await comparerRoutes("http://a", "http://b", ["/x"], async () => reponses[i++], { entetes: { authorization: "Bearer SECRET" } });
  assert.ok(ecarts.length > 0);
  assert.ok(!JSON.stringify(ecarts).includes("SECRET"));
});
```

- [ ] **Étape 2 : Constater l'échec, puis adapter `comparateur.mjs`** : dans `lire(base, chemin, envoyer, options)` appeler `envoyer(url, { redirect: "manual", method: options.methode ?? "GET", headers: { ...(options.corps !== undefined ? { "content-type": "application/json" } : {}), ...(options.entetes ?? {}) }, body: options.corps })` ; transmettre `options` à `lire`. Les messages d'écart ne contiennent que des statuts, des types, des en-têtes de cache et « corps différent » (jamais un corps ni un en-tête d'identité). Dans `comparer-routes.mjs` : lire `--jeton-env NOM` (valeur de `process.env[NOM]` ; si la variable est absente ou vide : message « variable absente » **sans valeur**, code 2), `--methode`, `--corps` ; construire `entetes = { authorization: "Bearer " + valeur }` ; ne jamais journaliser les options. Usage mis à jour dans le message d'aide.

- [ ] **Étape 3 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : comparateur avec jeton porteur, méthode et corps (le jeton n'est jamais affiché)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `test=0`, `typecheck=0`. Vérifier aussi par un essai local (faux serveur) que `MSYS_NO_PATHCONV=1 npm run comparer -- … --jeton-env ABSENTE` sort en 2 avec « variable absente » et sans aucun jeton.

---

### Tâche 7 : Câblage de production et relais de confiance côté API

**Fichiers :**
- Créer : `apps/api/src/identite/relais.ts`, `apps/api/tests/relais.test.ts`
- Modifier : `apps/api/src/app.ts`, `apps/api/src/worker.ts`, `apps/api/tests/construction.test.ts`, `apps/api/sondes/services.ts`

**Interfaces :**
- Consomme : `Deps.secretRelais`, `entetesCourants`.
- Produit :
  - `enteteRelaisDeConfiance(entetes: Headers, secretAttendu: string | undefined): Promise<Headers>` : si `x-relais-secret` égale le secret attendu (comparaison à temps constant sur des empreintes), rend une **copie** des en-têtes où `cf-connecting-ip` vaut `x-relais-ip` ; sinon (secret absent, faux, ou secret attendu non posé) rend une copie **sans** `x-relais-secret` ni `x-relais-ip`
  - dans `app.ts`, le premier maillon pose ces en-têtes épurés dans `entetesCourants`

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/relais.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { headers } from "../src/cales/next-headers.ts";
import { enteteRelaisDeConfiance } from "../src/identite/relais.ts";
import { depsEssai } from "./deps-essai.ts";

const entetes = (o: Record<string, string>) => new Headers(o);

test("secret correct : l'adresse transmise remplace cf-connecting-ip, les en-têtes de relais disparaissent", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "s3cret", "x-relais-ip": "203.0.113.9" }), "s3cret");
  assert.equal(sortie.get("cf-connecting-ip"), "203.0.113.9");
  assert.equal(sortie.get("x-relais-secret"), null);
  assert.equal(sortie.get("x-relais-ip"), null);
});

test("mauvais secret : l'adresse transmise est ignorée (un appel direct ne peut pas se faire passer pour un autre visiteur)", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "faux", "x-relais-ip": "203.0.113.9" }), "s3cret");
  assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
  assert.equal(sortie.get("x-relais-ip"), null);
  assert.equal(sortie.get("x-relais-secret"), null);
});

test("secret attendu non posé : jamais de confiance, même si l'appelant envoie un secret vide ou quelconque", async () => {
  for (const envoye of ["", "x", "undefined"]) {
    const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": envoye, "x-relais-ip": "203.0.113.9" }), undefined);
    assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
  }
  const vide = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "", "x-relais-ip": "203.0.113.9" }), "");
  assert.equal(vide.get("cf-connecting-ip"), "198.51.100.1");
});

test("secret correct mais adresse transmise absente : cf-connecting-ip inchangé", async () => {
  const sortie = await enteteRelaisDeConfiance(entetes({ "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "s3cret" }), "s3cret");
  assert.equal(sortie.get("cf-connecting-ip"), "198.51.100.1");
});

test("dans l'application : la cale next/headers voit l'adresse du visiteur d'origine quand le relais est authentifié", async () => {
  let vue: string | null = null;
  const app = creerApp(depsEssai({
    secretRelais: () => "s3cret",
    lireAssistance: async () => { vue = (await headers()).get("cf-connecting-ip"); return { whatsapp: null }; },
  }));
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "s3cret", "x-relais-ip": "203.0.113.9" } });
  assert.equal(vue, "203.0.113.9");
  await app.request("/api/v1/aide", { headers: { "cf-connecting-ip": "198.51.100.1", "x-relais-secret": "faux", "x-relais-ip": "203.0.113.9" } });
  assert.equal(vue, "198.51.100.1");
});

test("le secret de relais n'apparaît dans aucune réponse", async () => {
  const reponse = await creerApp(depsEssai({ secretRelais: () => "s3cret" })).request("/sante", { headers: { "x-relais-secret": "s3cret" } });
  assert.ok(!(await reponse.text()).includes("s3cret"));
  assert.equal(reponse.headers.get("x-relais-secret"), null);
});
```

- [ ] **Étape 2 : Constater l'échec, puis écrire** (outil Write) : `apps/api/src/identite/relais.ts`

```ts
const encodeur = new TextEncoder();

async function empreinte(valeur: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encodeur.encode(valeur)));
}

/** Comparaison à temps constant : on compare les EMPREINTES (longueur fixe), octet par octet, sans sortie anticipée. */
async function memeSecret(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([empreinte(a), empreinte(b)]);
  let ecart = 0;
  for (let i = 0; i < ha.length; i++) ecart |= ha[i] ^ hb[i];
  return ecart === 0;
}

/**
 * Le site relaie des requêtes vers l'API : l'adresse vue par l'API serait celle du Worker du site, pas celle du visiteur. Le site transmet donc l'adresse d'origine dans
 * `x-relais-ip`, accompagnée du secret partagé `x-relais-secret`. L'API ne croit cette adresse QUE si le secret est exact ; sinon (appel direct, secret faux, secret non posé)
 * elle l'ignore. Dans tous les cas, les deux en-têtes de relais sont retirés de ce que voit le code du site (jamais journalisés, jamais rendus).
 */
export async function enteteRelaisDeConfiance(entetes: Headers, secretAttendu: string | undefined): Promise<Headers> {
  const copie = new Headers(entetes);
  const secretRecu = entetes.get("x-relais-secret");
  const adresse = entetes.get("x-relais-ip");
  copie.delete("x-relais-secret");
  copie.delete("x-relais-ip");
  if (secretAttendu && secretRecu && adresse && (await memeSecret(secretRecu, secretAttendu))) {
    copie.set("cf-connecting-ip", adresse);
  }
  return copie;
}
```

Dans `apps/api/src/app.ts`, remplacer le premier maillon par :

```ts
  app.use("*", async (c, suivant) => {
    const entetes = await enteteRelaisDeConfiance(c.req.raw.headers, deps.secretRelais());
    return entetesCourants.run(entetes, suivant);
  });
```

(+ import de `enteteRelaisDeConfiance`). Le test d'isolation concurrente de la 1a doit rester vert.

- [ ] **Étape 3 : Câbler la production** (outil Write sur `apps/api/src/worker.ts`). Lire d'abord les fichiers du site pour ne rien deviner : noms d'export exacts de `@/lib/client/espace-service`, `@/lib/livraison/estimation-service`, `@/lib/client/reglage`, `@/lib/api/moi-service`, `@/lib/securite/limitation-debit` (`limiterClientApplication`), `@/lib/db/admin` (`creerClientAdmin`).

```ts
import { VERSION_APPLICATION } from "@speedfood/shared/application/version";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { connexionClientActive } from "@/lib/client/reglage";
import { lireRolesCompte } from "@/lib/api/moi-service";
import { creerClientAdmin } from "@/lib/db/admin";
import { limiterClientApplication } from "@/lib/securite/limitation-debit";
import { actionAdresseClient, basculerFavoriClient, enregistrerProfilClient, lireEspaceClient, supprimerCompteClient } from "@/lib/client/espace-service";
import { estimerPourClient } from "@/lib/livraison/estimation-service";
import { creerApp } from "./app.ts";
import { configJetonSupabase, creerVerificateurLocal, creerVerificateurStrict } from "./identite/jeton.ts";

// Câblage de PRODUCTION : les routes reçoivent les services du site, jamais une copie de leurs règles. Les secrets sont lus à l'APPEL (jamais au chargement du module).
let local: ReturnType<typeof creerVerificateurLocal> | undefined;

const app = creerApp({
  version: VERSION_APPLICATION,
  lireAssistance: async () => {
    const { whatsapp } = await lireReglagesAssistance();
    return { whatsapp };
  },
  connexionClientActive,
  verificateurs: {
    strict: creerVerificateurStrict(() => creerClientAdmin()),
    // Mode local : les clés publiques sont lues une fois par isolat. Non utilisé par les routes de ce plan (toutes strictes) ; câblé pour le plan 1c.
    local: (jeton) => {
      local ??= creerVerificateurLocal(configJetonSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""));
      return local(jeton);
    },
  },
  limiterClientApplication,
  lireRoles: lireRolesCompte,
  client: {
    lireEspace: lireEspaceClient,
    basculerFavori: basculerFavoriClient,
    enregistrerProfil: enregistrerProfilClient,
    actionAdresse: actionAdresseClient,
    supprimerCompte: supprimerCompteClient,
  },
  estimerPourClient,
  secretRelais: () => process.env.RELAIS_SECRET,
});

export default { fetch: app.fetch };
```

Si `creerClientAdmin()` n'est pas assignable à `ClientAuthStrict` (types Supabase), **ne pas élargir le type** : écrire l'adaptateur `() => ({ auth: { getUser: (jeton) => creerClientAdmin().auth.getUser(jeton) } })` et le dire dans le rapport. Si un service du site tire Next.js (la garde de construction échoue), appliquer la procédure de l'étape 5 de la Tâche 5 du plan 1a (ne pas contourner : corriger le site seulement si trivial et sans changement de comportement, avec `test:unit` et `test:cloisonnement` à 0 ; sinon consigner le service dans `docs/API-UNIQUE.md` et arrêter : DONE_WITH_CONCERNS).

Mettre à jour `apps/api/sondes/services.ts` pour exporter aussi `lireRolesCompte`, `estimerPourClient`, `connexionClientActive` ; dans `tests/construction.test.ts`, ajouter à la première assertion que `octets > 10_000` est toujours vrai et que l'ensemble des entrées du paquet ne contient **pas** `react`/`next` (déjà vérifié par `interdits`).

- [ ] **Étape 4 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
npm run build; echo "build=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
cd apps/api && npx wrangler deploy --dry-run --outdir "<dossier du scratchpad>" 2>&1 | tail -6
cd ../.. && git add -A && git commit -m "API unique : câblage de production des huit routes, relais de confiance par secret partagé

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `test=0`, `build=0`, `typecheck=0`, `--dry-run` sous le plafond gratuit (noter les tailles). **`wrangler deploy` sans `--dry-run` est interdit.**

---

### Tâche 8 : Relais éteint par défaut côté site

**Fichiers :**
- Créer : `apps/web/src/lib/api/relais-regles.ts`, `apps/web/src/lib/api/relais.ts`, `apps/web/scripts/tests/relais.test.mts`
- Modifier : `apps/web/scripts/tests/lancer.mjs`, les dix routes du site (`aide`, `version`, `connexion/fournisseurs`, `moi`, `client/espace`, `client/favoris`, `client/profil`, `client/adresses`, `client/compte`, `livraison/estimation`)

**Interfaces :**
- Produit (`relais-regles.ts`, **pur** : ni `process.env`, ni `server-only`, ni Next) :
  - `moduleRelaye(reglage: string | undefined, module: string): boolean` : `undefined`, vide, `non` → faux ; `tout` → vrai ; sinon liste séparée par des virgules (espaces tolérés, casse indifférente)
  - `type OptionsRelais = { baseApi: string; secret: string; ipVisiteur: string | null; envoyer?: typeof fetch; delaiMs?: number }`
  - `relayer(request: Request, chemin: string, options: OptionsRelais, repliPossible: boolean): Promise<Response | null>`
- Produit (`relais.ts`, branché sur l'environnement, `import "server-only"`) : `relaisSiActif(request: Request, module: string): Promise<Response | null>` : rend `null` (le site traite lui-même) quand le relais est éteint, mal configuré, ou en repli ; rend la réponse de l'API sinon.

**Règles du relais (à respecter à la lettre) :**
1. Éteint par défaut : `API_RELAIS` absent, vide ou `non` → `null` immédiatement, **zéro** appel réseau, zéro lecture de corps.
2. Allumé mais mal configuré (`API_URL` ou `RELAIS_SECRET` absent) → `null` (le site traite lui-même) et un journal `relais_mal_configure` (nom seul).
3. Transmis : méthode, chemin et chaîne de requête, `authorization`, `content-type`, corps tel quel ; `x-relais-secret` (le secret) et `x-relais-ip` (valeur de `cf-connecting-ip` de la requête reçue, à défaut le premier `x-forwarded-for`). **Rien d'autre** (pas de cookies).
4. Réponse : statut, corps, `content-type` et `cache-control` de l'API, rendus tels quels.
5. Échec réseau ou délai dépassé (2 500 ms) : **repli** (`null`, le site traite lui-même) **seulement pour les routes de lecture** (`repliPossible = true` : GET) ; pour une écriture (`false`), réponse `{ok:false, erreur:{code:"ERREUR_SERVEUR", message:"Réessayez dans un instant."}}` en 500 : une écriture dont on ne sait pas si elle est partie ne se rejoue jamais. Une réponse 5xx de l'API **n'est jamais** un déclencheur de repli (la requête a pu être traitée).
6. Le secret et le jeton ne sont jamais journalisés ni rendus.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/web/scripts/tests/relais.test.mts`, dans le style du dossier (`verifier(nom, obtenu, attendu)`, `ECHEC` sans accent, `process.exit(1)` si un échec ; voir `api-v1.test.mts`)

```ts
import { moduleRelaye, relayer } from "../../src/lib/api/relais-regles";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

verifier("éteint par défaut", [moduleRelaye(undefined, "client"), moduleRelaye("", "client"), moduleRelaye("non", "client"), moduleRelaye("NON", "client")], [false, false, false, false]);
verifier("tout", [moduleRelaye("tout", "client"), moduleRelaye("TOUT", "moi")], [true, true]);
verifier("liste de modules", [moduleRelaye("client, moi", "client"), moduleRelaye("client, moi", "moi"), moduleRelaye("client, moi", "aide"), moduleRelaye("Client", "client")], [true, true, false, true]);
verifier("un nom partiel ne correspond pas", moduleRelaye("clients", "client"), false);

type Appel = { url: string; init: RequestInit };
const OPTIONS = { baseApi: "https://api.exemple.test/", secret: "s3cret", ipVisiteur: "203.0.113.9", delaiMs: 200 };

async function essai(requete: Request, repli: boolean, envoyer: typeof fetch) {
  return relayer(requete, "/api/v1/client/favoris", { ...OPTIONS, envoyer }, repli);
}

{
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => {
    appels.push({ url, init });
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }) as unknown as typeof fetch;
  const requete = new Request("https://site.test/api/v1/client/favoris?x=1", { method: "POST", headers: { authorization: "Bearer a.b.c", "content-type": "application/json", cookie: "sb=SECRETCOOKIE" }, body: '{"restaurantId":"r1"}' });
  const reponse = await essai(requete, false, envoyer);
  verifier("réponse de l'API rendue telle quelle", [reponse?.status, await reponse?.text(), reponse?.headers.get("cache-control")], [200, '{"ok":true}', "no-store"]);
  const h = new Headers(appels[0]?.init.headers);
  verifier("URL : base de l'API + chemin + chaîne de requête, sans double barre", appels[0]?.url, "https://api.exemple.test/api/v1/client/favoris?x=1");
  verifier("méthode et corps transmis", [appels[0]?.init.method, String(appels[0]?.init.body ?? "")], ["POST", '{"restaurantId":"r1"}']);
  verifier("en-têtes transmis : jeton, type, secret, adresse du visiteur ; PAS de cookie", [h.get("authorization"), h.get("content-type"), h.get("x-relais-secret"), h.get("x-relais-ip"), h.get("cookie")], ["Bearer a.b.c", "application/json", "s3cret", "203.0.113.9", null]);
}

{
  const envoyer = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET", headers: { authorization: "Bearer a.b.c" } });
  verifier("lecture : panne réseau → repli (null, le site traite lui-même)", await essai(lecture, true, envoyer), null);
  const ecriture = new Request("https://site.test/api/v1/client/favoris", { method: "POST", headers: { authorization: "Bearer a.b.c", "content-type": "application/json" }, body: "{}" });
  const r = await essai(ecriture, false, envoyer);
  verifier("écriture : panne réseau → ERREUR_SERVEUR 500, jamais rejouée par le site", [r?.status, await r?.json()], [500, { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } }]);
}

{
  const lent = (async (_u: string, init: RequestInit) => new Promise<Response>((_ok, ko2) => init.signal?.addEventListener("abort", () => ko2(new DOMException("abort", "AbortError"))))) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET" });
  verifier("délai dépassé sur une lecture → repli", await essai(lecture, true, lent), null);
}

{
  const cinqCents = (async () => new Response('{"ok":false,"erreur":{"code":"ERREUR_SERVEUR","message":"x"}}', { status: 500, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const lecture = new Request("https://site.test/api/v1/client/espace", { method: "GET" });
  const r = await essai(lecture, true, cinqCents);
  verifier("une réponse 5xx de l'API n'est PAS un déclencheur de repli (la requête a pu être traitée)", r?.status, 500);
}

{
  const appels: Appel[] = [];
  const envoyer = (async (url: string, init: RequestInit) => { appels.push({ url, init }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  const requete = new Request("https://site.test/api/v1/aide", { method: "GET", headers: { "x-relais-secret": "pirate", "x-relais-ip": "1.1.1.1" } });
  await relayer(requete, "/api/v1/aide", { ...OPTIONS, envoyer }, true);
  const h = new Headers(appels[0]?.init.headers);
  verifier("un visiteur ne peut pas injecter ses propres en-têtes de relais", [h.get("x-relais-secret"), h.get("x-relais-ip")], ["s3cret", "203.0.113.9"]);
}

if (ko > 0) {
  console.log(`\n${ko} échec(s).`);
  process.exit(1);
}
console.log("\nRègles du relais vérifiées.");
```

- [ ] **Étape 2 : Brancher le test dans le lanceur** : dans `apps/web/scripts/tests/lancer.mjs`, ajouter avec les autres `copier(...)` (relire l'ordre et le mécanisme d'exécution des fichiers de tests : une ligne pour la source, une pour le test, et l'exécution du test comme pour `api-v1.test.mts`) :

```js
copier("src/lib/api/relais-regles.ts");
copier("scripts/tests/relais.test.mts");
```

puis constater l'échec : `cd apps/web && npm run test:unit; echo "test:unit=$?"` doit sortir différent de 0 (module absent).

- [ ] **Étape 3 : Écrire les règles pures** (outil Write) : `apps/web/src/lib/api/relais-regles.ts`

```ts
/** Règles pures du relais du site vers l'API (voir docs/API-UNIQUE.md) : aucune lecture d'environnement ici, tout est injecté, tout est testé. */

/** `API_RELAIS` : absent, vide ou « non » = éteint ; « tout » = tous les modules ; sinon une liste de modules séparés par des virgules. */
export function moduleRelaye(reglage: string | undefined, module: string): boolean {
  const valeur = (reglage ?? "").trim().toLowerCase();
  if (valeur === "" || valeur === "non") return false;
  if (valeur === "tout") return true;
  return valeur.split(",").map((m) => m.trim()).includes(module.toLowerCase());
}

export type OptionsRelais = { baseApi: string; secret: string; ipVisiteur: string | null; envoyer?: typeof fetch; delaiMs?: number };

const ERREUR_SERVEUR = { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } };

/**
 * Transmet la requête à l'API. Rend la réponse de l'API, ou `null` pour dire « traite-la toi-même » (panne réseau ou délai dépassé, et SEULEMENT pour une lecture :
 * une écriture dont on ne sait pas si elle est partie ne se rejoue jamais, elle répond ERREUR_SERVEUR). Une réponse 5xx de l'API n'est jamais un repli.
 * Seuls le jeton, le type de contenu et le corps traversent, plus le secret et l'adresse du visiteur ; les cookies ne traversent jamais.
 */
export async function relayer(request: Request, chemin: string, options: OptionsRelais, repliPossible: boolean): Promise<Response | null> {
  const envoyer = options.envoyer ?? fetch;
  const adresse = new URL(request.url);
  const url = `${options.baseApi.replace(/\/+$/, "")}${chemin}${adresse.search}`;
  const entetes = new Headers();
  const jeton = request.headers.get("authorization");
  const type = request.headers.get("content-type");
  if (jeton) entetes.set("authorization", jeton);
  if (type) entetes.set("content-type", type);
  entetes.set("x-relais-secret", options.secret);
  if (options.ipVisiteur) entetes.set("x-relais-ip", options.ipVisiteur);

  const arret = new AbortController();
  const minuteur = setTimeout(() => arret.abort(), options.delaiMs ?? 2500);
  try {
    const avecCorps = request.method !== "GET" && request.method !== "HEAD";
    const reponse = await envoyer(url, { method: request.method, headers: entetes, body: avecCorps ? await request.text() : undefined, redirect: "manual", signal: arret.signal });
    const sortie = new Headers();
    for (const nom of ["content-type", "cache-control"]) {
      const valeur = reponse.headers.get(nom);
      if (valeur) sortie.set(nom, valeur);
    }
    return new Response(await reponse.text(), { status: reponse.status, headers: sortie });
  } catch {
    if (repliPossible) return null;
    return new Response(JSON.stringify(ERREUR_SERVEUR), { status: 500, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } finally {
    clearTimeout(minuteur);
  }
}
```

`apps/web/src/lib/api/relais.ts` :

```ts
import "server-only";
import { moduleRelaye, relayer } from "./relais-regles";

/**
 * Garde de relais des routes `/api/v1/*` : rend la réponse de l'API quand le relais est allumé pour ce module (`API_RELAIS`), sinon `null` et la route du site traite elle-même.
 * ÉTEINT par défaut : sans `API_RELAIS`, aucun appel, aucune lecture du corps, comportement strictement inchangé.
 */
export async function relaisSiActif(request: Request, module: string): Promise<Response | null> {
  if (!moduleRelaye(process.env.API_RELAIS, module)) return null;
  const baseApi = process.env.API_URL;
  const secret = process.env.RELAIS_SECRET;
  if (!baseApi || !secret) {
    console.error("relais_mal_configure");
    return null;
  }
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return relayer(request, new URL(request.url).pathname, { baseApi, secret, ipVisiteur: ip }, request.method === "GET");
}
```

- [ ] **Étape 4 : Ajouter le garde aux dix routes.** En tête du gestionnaire de chaque route (première instruction), avec le module indiqué et l'import `import { relaisSiActif } from "@/lib/api/relais";` :

```ts
  const relais = await relaisSiActif(request, "client");
  if (relais) return relais;
```

| Route du site | Module |
|---|---|
| `version`, `aide`, `connexion/fournisseurs` | `public` |
| `moi` | `moi` |
| `client/espace`, `client/favoris`, `client/profil`, `client/adresses`, `client/compte` | `client` |
| `livraison/estimation` | `livraison` |

Les gestionnaires publics `GET()` n'ont pas de paramètre : leur donner `GET(request: Request)`. **Vérifier route par route** que le garde est bien la toute première instruction (avant toute lecture du corps ou d'identité) et que le reste du gestionnaire n'a pas bougé.

- [ ] **Étape 5 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
npm run test:unit; echo "test:unit=$?"
npm run test:cloisonnement > /dev/null; echo "cloisonnement=$?"
npm run typecheck; echo "typecheck=$?"
(cd apps/web && npx eslint src/lib/api src/app/api/v1; echo "eslint=$?")
(cd apps/web && npm run cf:build > /dev/null 2>&1; echo "cf:build=$?")
git add -A && git commit -m "Site : relais éteint par défaut vers l'API (règles pures testées, secret partagé, repli seulement en lecture), garde de deux lignes sur dix routes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : tous à `0`. Rendre dans le rapport, route par route, la preuve que, sans `API_RELAIS`, le site se comporte comme avant (le garde rend `null` avant toute autre action : c'est la première ligne du gestionnaire).

---

### Tâche 9 : Documentation, contrôle automatique, mémoire et fusion

**Fichiers :**
- Modifier : `docs/API-UNIQUE.md`, `docs/STATUT-PROJET.md`, `docs/ORGANISATION-DU-DEPOT.md` (si une ligne change), `.github/workflows/controles.yml` (rien à ajouter : `test:api`, `build:api`, `test:unit` couvrent déjà tout ; le vérifier)
- Mémoire : `C:\Users\moelo\.claude\projects\C--Users-moelo-dev-speedfood\memory\redis-upstash-et-refonte-architecture.md`

- [ ] **Étape 1 : `docs/API-UNIQUE.md`** (chiffres vérifiés en relançant les commandes, jamais recopiés d'un plan) : table des dix routes servies par l'API (méthode, mode de jeton, cache, service du site) ; le **relais** (variables `API_RELAIS`, `API_URL`, `RELAIS_SECRET` côté site, `RELAIS_SECRET` côté API ; règles 1 à 6 de la Tâche 8 ; ce que fait l'API du secret) ; comment allumer le relais **module par module** et l'éteindre (`API_RELAIS=non` suffit, sans redéployer le code) ; la décision de jetons (mixte) et ce que chaque route utilise (toutes strictes ici) ; la section « Observations sur le site » (estimation de livraison sans plafond de compte ; méthode non gérée : 405 sur le site contre 404 sur l'API) ; **ce qui n'est pas vérifié** (l'adresse que Cloudflare met dans `cf-connecting-ip` pour un appel entre Workers ; la parité de `lireRolesCompte` avec la route d'origine sans vrai jeton ; le coût du relais dans l'offre gratuite ; l'émetteur réel d'un vrai jeton ; `process.env` sous workerd en production ; l'essai local avec jeton).
- [ ] **Étape 2 : `docs/STATUT-PROJET.md`** : section « Étape 1b : fait, NON déployé, relais éteint » (plan, ce qui est vérifié contre supposé, ce qui reste : Tâche 10, plan 1c).
- [ ] **Étape 3 : mémoire** : relire le fichier, garder le frontmatter, ajouter un paragraphe « Étape 1b faite le … (non déployée) » avec le plan, les dix routes, le relais éteint, ce qui reste (Tâche 10, plan 1c : livreur, restaurateur, équipe, commandes, suivi ; mode local à utiliser pour la position du livreur).
- [ ] **Étape 4 : vérification complète puis fusion**

```bash
cd /c/Users/moelo/dev/speedfood
npm run typecheck; echo "typecheck=$?"
npm run test:unit > /dev/null; echo "test:unit=$?"
npm run test:cloisonnement > /dev/null; echo "cloisonnement=$?"
npm run test:api; echo "test:api=$?"
npm run build:api; echo "build:api=$?"
(cd apps/web && npx eslint 2>&1 | tail -3; npm run cf:build > /dev/null 2>&1; echo "cf:build=$?")
git status -sb | head -3
```

Attendu : tous les codes à `0`, arbre propre. Puis, **après la vague de correctifs de la relecture finale** et avec l'accord de Malika : `git push -u origin etape-1b-routes-et-relais`, lire le contrôle GitHub de la branche (doit être **vert** avant toute fusion), puis `git checkout master && git merge --ff-only etape-1b-routes-et-relais && git push`, relire le contrôle de `master`, supprimer la branche. **Rien n'est déployé.**

---

### Tâche 10 : Essai de bout en bout et mise en service du relais (UNIQUEMENT sur le feu vert de Malika, conduite par le contrôleur avec elle)

Cette tâche engage un **service de plus** chez Cloudflare (gratuit, mais un service), pose des **secrets** que seule Malika peut saisir, et touche la production. Elle n'a lieu que sur sa demande explicite (« oui, crée le Worker de l'API » puis, séparément, « oui, déploie » et « oui, allume le relais »). Chaque pas est une action dans un message, avec le résultat attendu, car elle trouve les opérations compliquées. **Trois feux verts distincts, jamais un seul pour tout.**

- [ ] **Étape 1 : Préparer.** `master` à jour ; `npm run build:api` à `0` ; noter la version actuelle du site (`npx wrangler deployments list` depuis `apps/web`) comme point de retour ; le site n'est pas touché.
- [ ] **Étape 2 : Créer le Worker de l'API et poser ses secrets** (feu vert 1). Depuis `apps/api`, après `npm run build` : `npx wrangler deploy` (crée `speedfood-api`), puis `npx wrangler secret put` pour `SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (mêmes valeurs que celles du site) et `RELAIS_SECRET` (**nouvelle valeur aléatoire** qu'elle génère elle-même ; je ne la vois jamais). Aucune valeur dans le chat.
- [ ] **Étape 3 : Vérifier le Worker seul.** `GET <adresse>/sante` répond `{"ok":true}` ; `npm run comparer` entre le site de production et l'API sur `/api/v1/version`, `/api/v1/aide`, `/api/v1/connexion/fournisseurs` : `0 écart`.
- [ ] **Étape 4 : Essai avec un vrai jeton** (lectures seulement). Malika se connecte à l'application ou au site avec **son propre compte**, récupère un jeton d'accès, le place dans une variable d'environnement de **son** terminal (jamais dans le chat) ; puis `npm run comparer -- … --jeton-env NOM /api/v1/moi /api/v1/client/espace` doit sortir `0 écart`. C'est ce qui confirme l'émetteur réel, le mode strict et la parité de `lireRolesCompte`. Si Malika ne veut pas le faire, l'étape est sautée et la documentation garde « non vérifié ».
- [ ] **Étape 5 : Poser le relais côté site** (feu vert 2, un déploiement du site) : variables `API_URL` (publique) et secret `RELAIS_SECRET` (**la même valeur**) ; `API_RELAIS` **absent** : le relais reste éteint. Déploiement avec la procédure habituelle (version, vérification des pages, version 2.47.0, secrets présents), rien ne doit changer pour les utilisateurs.
- [ ] **Étape 6 : Allumer le relais, module par module** (feu vert 3 par module, en commençant par `public`) : `API_RELAIS=public`, vérifier, mesurer (temps de réponse, erreurs 1102 dans le tableau Cloudflare, quota de sous-requêtes), puis `moi`, `livraison`, `client`. **Retour arrière immédiat** : `API_RELAIS=non`.
- [ ] **Étape 7 : Retour arrière complet** (si besoin) : `API_RELAIS=non`, puis `npx wrangler delete --name speedfood-api` depuis `apps/api` supprime le Worker sans toucher au site.

---

## Auto-contrôle du plan

**Couverture du design (§5 et §9 étape 1, seconde moitié) :** routes déplacées par modules, les plus légères d'abord → Tâches 3 à 5 (publique, `moi`, `client`, `livraison`) ; commandes et suivi → **plan 1c** (écart assumé) ; comparaison de chaque route avec l'ancienne → Tâche 6 (jeton, méthode, corps) et Tâche 10 (essai réel) ; relais depuis le site → Tâche 8, éteint par défaut ; coût du relais à vérifier avant de s'y fier → Tâche 10, étape 6 (mesure) ; jetons mixtes (décision du 31 octobre) → Tâche 2 (modes strict et local câblés, panne distinguée du jeton invalide) et routes toutes strictes ; déploiement manuel avec feu vert de Malika → Tâche 10 en trois feux verts distincts ; second projet Supabase (D9) → hors périmètre, sur instruction de Malika seulement.

**Cohérence des noms :** `repondre`, `reponseErreur`, `lireCorpsJson` (http.ts) ; `verifierJetonLocal`, `creerVerificateurLocal`, `creerVerificateurStrict`, `ClientAuthStrict`, `VerificateurJeton` (jeton.ts) ; `identifier(verifier, message?)`, `limiterParCompte`, `Variables` (chaine.ts) ; `Deps` et ses clés `version`, `lireAssistance`, `connexionClientActive`, `verificateurs`, `limiterClientApplication`, `lireRoles`, `client`, `estimerPourClient`, `secretRelais` ; `RolesCompte`, `ResultatEspace` (types.ts, miroirs de ceux du site) ; `routeFournisseurs`, `routeMoi`, `routeClient`, `routeEstimation` ; `enteteRelaisDeConfiance` ; côté site `lireRolesCompte`, `moduleRelaye`, `relayer`, `OptionsRelais`, `relaisSiActif`, variables `API_RELAIS`, `API_URL`, `RELAIS_SECRET`, en-têtes `x-relais-secret` et `x-relais-ip`. Branche `etape-1b-routes-et-relais`.

**Points qui demandent de la vigilance à l'exécution :** (1) les noms exacts d'exports des services du site à lire avant d'écrire `worker.ts` ; (2) les classes d'erreur de jose (`errors.*`) à vérifier dans 6.2.14 avant d'écrire la liste « jeton invalide » ; (3) l'assignabilité de `creerClientAdmin()` à `ClientAuthStrict` ; (4) le typage de `app.route` avec des sous-routeurs à `Variables` ; (5) la sonde de construction : un service du site peut tirer Next.js (ne jamais masquer : procédure de la 1a) ; (6) `moi` : la copie des trois requêtes doit être **littérale** ; (7) l'ordre des clés du JSON de `moi` et de l'espace client ; (8) le garde de relais doit être la **première** instruction de chaque gestionnaire.

**Non vérifié (honnêtement) :** ce que Cloudflare met dans `cf-connecting-ip` entre deux Workers (le secret de relais contourne la question) ; la parité de `lireRolesCompte` et de l'espace client avec un vrai jeton avant la Tâche 10 ; le comportement réel de `getUser` pour un compte supprimé (statut renvoyé) ; le coût du relais (une sous-requête de plus par appel, deux invocations facturées) dans l'offre gratuite ; si le relais soulage réellement le Worker du site (la mesure de la Tâche 10 en décidera ; sinon une route sur domaine personnalisé sera à étudier).
