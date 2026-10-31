# Passation de la refonte d'architecture (état au 31 octobre 2026, soir)

> À lire EN PREMIER par l'agent qui reprend. Complète `docs/PASSATION.md` (état du produit au 22 octobre) et
> `docs/REPRISE-SESSION.md`. Ici : ce qui a été fait depuis le 29 octobre (monorepo, API unique, relais),
> où l'on s'est arrêté exactement, et ce qu'il reste à faire, dans l'ordre.
> Cartes du code : `docs/CARTE-DU-CODE-WEB.md` (site) et `docs/CARTE-DU-CODE-API-MOBILE-BASE.md` (API, paquet partagé, mobile, base).

## 0. Qui est Malika, comment travailler avec elle

- Elle s'appelle Malika, **répondre toujours en français**, phrases courtes, sans jargon. Elle trouve les opérations
  techniques compliquées : une action par message, avec la commande exacte à coller et le résultat attendu.
- Sa fenêtre de terminal habituelle est l'**invite classique `cmd`** (pas PowerShell) : pas de `;`, utiliser `&&`,
  `cd /d C:\...`. Sous PowerShell (outil de l'agent) : `npx.cmd`, `cmd /c "npm run …"`. Sous Git Bash : `MSYS_NO_PATHCONV=1`.
- **Elle déploie elle-même** (`wrangler deploy`, `cf:deploy`, `wrangler secret put`) : le classifieur de l'agent bloque
  les déploiements et la suppression de branches distantes. L'agent prépare, vérifie avant/après, jamais ne saisit un secret.
- Aucun mot de passe, clé, jeton dans le chat, les commits, les journaux, les rapports. Elle tape elle-même ses mots de passe
  (voir `apps/api/scripts/test-jeton-reel.mjs` : saisie masquée, jeton gardé en mémoire).
- Pied de commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Pas de `gh` installé : lire le contrôle GitHub avec `curl https://api.github.com/repos/moelohimmara-dotcom/speedfood/actions/runs?branch=<branche>`
  (dépôt lisible). Branches `etape-*` déclenchent « Contrôles » (`.github/workflows/controles.yml`).

## 1. Architecture actuelle (en production)

```
Visiteur / appli Android (Kotlin) / iPhone
        │
        ▼
Site  speedfood-app   (Next.js 16.3.8 + OpenNext, Cloudflare Workers)   https://speedfood-app.moelohimmara.workers.dev
        │   relais OPTIONNEL (variable API_RELAIS) — garde de 2 lignes en première instruction des routes /api/v1/*
        ▼
API   speedfood-api   (Hono 4.13.14, Cloudflare Workers)               https://speedfood-api.moelohimmara.workers.dev
        │
        ▼
Supabase (Postgres + RLS, projet ggldjdizqrtpetdiohxy)     Upstash Redis (limitation de débit, repli sur la base)
```

Monorepo npm : `apps/web`, `apps/api`, `packages/shared`, `mobile/`, `supabase/`, `docs/`. `npm install` à la RACINE.

### Ce qui vit dans l'API (dix routes en production + cinq prêtes)
- En production, relayées : `GET version`, `GET aide`, `GET connexion/fournisseurs` (module `public`), `GET moi` (`moi`),
  `GET client/espace` + `POST client/{favoris,profil,adresses,compte}` (`client`), `POST livraison/estimation` (`livraison`).
- Dans `master`, **déployées dans l'API mais NON relayées** (modules `suivi` et `commandes` absents d'`API_RELAIS`) :
  `POST suivi`, `POST suivi/annuler`, `POST suivi/proposition`, `GET commandes`, `POST commandes`.
- Tout le reste (livreur, restaurateur, équipe, appareils, candidature…) est encore servi uniquement par le site.

### Jetons (décision de Malika, mode « mixte »)
- Strict (`auth.getUser` chez Supabase) : toutes les routes portées à ce jour. Local (ES256) : réservé au plan 1c-2 (position du livreur, très fréquente).
- Les routes /suivi n'ont AUCUNE identité : le jeton de suivi (clé d'accès, 40 caractères) dans le corps suffit.

### Relais (site → API) — règles à ne jamais casser
Fichiers : `apps/web/src/lib/api/relais.ts` (colle Next), `relais-regles.ts` (décisions pures testées), tests `apps/web/scripts/tests/relais.test.mts`
et `gardes-relais.test.mts`. Variables du site : `API_RELAIS` (absent/vide/`non` = éteint ; `tout` = tous ; sinon liste de modules séparés par des virgules),
`API_URL` (https, ou http vers localhost seulement, sans chemin ni identifiants), `RELAIS_SECRET` (≥ 32 caractères imprimables, IDENTIQUE sur les deux Workers).
- Transmis : authorization, content-type, corps, `x-relais-secret`, `x-relais-ip`. Rien d'autre (jamais de cookie).
- Repli sur le site seulement sur panne réseau / délai (jamais sur une réponse 4xx ou 5xx de l'API) ; seulement GET/HEAD, plus `POST` si l'appel passe `lecture: true`
  (réservé à `POST /suivi`, une lecture). **Une écriture n'est JAMAIS rejouée** : sur panne/délai le site répond 500 « Réessayez dans un instant. » — l'API a peut-être abouti.
- Délais : 2 500 ms par défaut ; `annuler` et `proposition` 8 000 ms ; `POST /commandes` 15 000 ms ; plafond 60 000 ms. Le mobile attend 20 000 ms.
- **`API_RELAIS=tout` est INTERDIT en production** : il allumerait `suivi` et `commandes`. Réglage actuel : `public,moi,client,livraison`.
- Retour arrière immédiat (sans redéployer) : `"non" | npx.cmd wrangler secret put API_RELAIS` depuis `apps/web`.

## 2. Où l'on s'est arrêté (Tâche 12 du plan 1c-1)

Plan : `docs/plans/2026-10-31-etape-1c1-suivi-et-commandes.md` (Tâche 12 = mise en service, feux verts de Malika UN PAR UN). Registre de travail : `.sdd/etape-1c1/progress.md` (non versionné).

Fait le 31 octobre 2026 :
- Code 1c-1 fusionné dans `master` (`d375bee`), contrôles GitHub verts (branche et master). Branche distante `etape-1c1` encore présente (suppression refusée par le classifieur ; inoffensive, à supprimer par Malika ou à garder).
- **API redéployée** avec le code de master : version `8a77448b-28d9-4fad-be63-a9dd5fdeb39f`. Vérifiée sans jeton : `/version` 200, `/aide` 200, `/moi` 401, `/commandes` GET 401, `POST /suivi` et `/suivi/annuler` corps `{}` → 400 « Lien de suivi invalide. », `POST /commandes` 401.
- **Site redéployé** avec le code de master : version `fd173a5c-8656-42fc-b611-3e2247d1c928` (14:44 UTC). Vérifié : accueil 200, `/api/v1/version` 200, `moi` et `commandes` 401. `API_RELAIS` inchangé (suivi et commandes éteints).
- Version précédente du site (point de retour de code) : `6d5bb384-9161-4b43-9e87-32e190b79897`.
- Parité du secret `COMMANDE_JETON_SECRET` : **les NOMS** sont présents sur les deux Workers (`npx wrangler secret list --name …`) ; **l'égalité des VALEURS n'est pas prouvée** (seule la Tâche 12, étape 9 la prouve).

### Reste à faire, dans l'ordre (chacun sur feu vert explicite de Malika)
1. **Étape 6** : `POST /suivi` face à la production avec un VRAI jeton de suivi d'une commande d'essai de Malika. Elle met le jeton dans une variable de SON terminal, puis :
   `cd /d C:\Users\moelo\dev\speedfood && node apps\api\scripts\comparer-routes.mjs --methode POST --autoriser-ecriture --corps-env NOM_VARIABLE https://speedfood-app.moelohimmara.workers.dev https://speedfood-api.moelohimmara.workers.dev /api/v1/suivi`
   avec le corps de la variable au format `{"jeton":"…"}` (JSON). Attendu : « 1 route(s) identiques : 0 écart ». Si elle n'a pas de commande d'essai : sauter, risque faible (lecture).
2. **Étape 7** : `GET /commandes` avec son jeton porteur (`--jeton-env`). Le script `test-jeton-reel.mjs` peut être étendu à ce chemin.
3. **Feu vert 3** : allumer `suivi` : `"public,moi,client,livraison,suivi" | npx.cmd wrangler secret put API_RELAIS` (depuis `apps\web`). Mesurer : temps de réponse, erreurs 1102 (Cloudflare → Workers → speedfood-api ET speedfood-app), quota de sous-requêtes. Retour : retirer `suivi`.
4. **Feu vert 5** (création de commande, la plus sensible), toutes conditions réunies : (a) égalité des valeurs de `COMMANDE_JETON_SECRET` prouvée par l'essai d'idempotence croisée (même clé d'idempotence envoyée au site puis à l'API, commande d'essai `est_test` — **Malika a accepté ce principe le 31 octobre**) : seconde réponse 200, `idempotent: true`, MÊME jeton de suivi ; (b) mesure du temps de calcul de la création sur l'API (plan gratuit : 10 ms de CPU ; si ça approche, ne pas allumer, décision de coût de Malika : Workers payant 5 $/mois) ; (c) l'alerte « page fermée » arrive chez le restaurateur d'essai (vérifiée par Malika) ; (d) `API_RELAIS=public,moi,client,livraison,suivi,commandes`. Si Malika veut la lecture de `GET /commandes` seule d'abord, il faut créer un module `commandes-lecture` (non fait).
5. Supprimer `apps/api/.dev.vars` (contient la clé de service de production ; ignoré par git ; jamais le lire ni l'afficher).
6. Mettre à jour `docs/STATUT-PROJET.md`, `docs/API-UNIQUE.md` et la mémoire (`redis-upstash-et-refonte-architecture.md`) après chaque feu vert (qui est allumé, mesures, ce qui est vérifié).

## 3. Ce qui N'est PAS vérifié (ne pas l'affirmer)

- L'égalité des VALEURS de `COMMANDE_JETON_SECRET` entre les deux Workers. Piège : s'il manque côté API, l'API se rabat en silence sur la clé de service, donc le jeton de suivi change pour une même clé d'idempotence → doublon possible. **Aligner l'API sur le site, jamais l'inverse** (le secret fixe aussi les QR de table imprimés).
- Aucune route d'ÉCRITURE n'a jamais été comparée à la production (client/favoris|profil|adresses|compte, annuler, proposition, POST commandes) : seulement des tests avec de faux services.
- Sous Cloudflare réel : `randomInt` (référence `SF-XXXXX`), `Request.clone()` du relais sous OpenNext, `ctx.waitUntil` réel (alerte du restaurateur), CPU et erreurs 1102 du Worker de l'API sous charge, coût du relais en plan gratuit, valeur de `cf-connecting-ip` entre Workers (le secret de relais contourne la question).
- Une écriture dont la réponse dépasse le délai du relais : le site répond 500 alors que l'API a peut-être abouti ; la création n'est pas transactionnelle (commande puis lignes puis options) : une commande sans lignes est théoriquement possible si l'API est coupée en cours de route.
- `GET /commandes` peut retomber sur le site (repli GET) : la liste, qui contient des jetons de suivi, est alors lue par le site.
- Le plafond de lecture du suivi peut être compté deux fois en cas de repli (API puis site).
- **À examiner en priorité par le prochain agent** : `limiterParRequete` (plafond par requête/IP, `apps/api/src/controles/chaine.ts:15`) est DÉFINI mais n'est branché sur aucune route de l'API (grep du 31 octobre : une seule occurrence, sa définition). Les routes appliquent `identifier` puis `limiterParCompte` (par compte) et, pour le suivi, le plafond par jeton. Le plafond par IP est donc peut-être appliqué seulement côté site (qui garde sa limitation) : vérifier que ce n'est pas une perte de protection quand le relais est allumé, et décider s'il faut le brancher (la doc `docs/API-UNIQUE.md` décrit la chaîne comme complète : à confronter au code).
- L'essai local du 31 octobre (`wrangler dev`, base de production) a écrit 2 compteurs de limitation (aucune écriture métier).

## 4. Méthode de travail utilisée (à reprendre)

- Développement piloté par sous-agents (skill `subagent-driven-development`) : un implémenteur par tâche (rapport dans `.sdd/<plan>/rapport-tache-N.md`),
  une revue (spécification ET qualité, mutations pour prouver que les tests cassent), boucle de correctifs (5 tours max), revue finale de branche, UNE vague de correctifs.
  Jamais de correctif par le contrôleur lui-même. Modèles : Sonnet pour le mécanique, Opus pour la sécurité/création de commande.
- Registre de reprise : `.sdd/<plan>/progress.md` (une ligne « Task N: complete (commit, …) »). Après une coupure, se fier à lui et à `git log`.
- Vérifications avant de dire « fait » (exit 0 exigé) : `npm run typecheck`, `npm run test:unit` (aucune ligne « ECHEC »), `npm run test:cloisonnement`, `npm run test:api`,
  `npm run build:api` (le Worker doit rester < 1 400 000 octets bruts / 3 Mio gzip, aucun fichier de Next), `npx eslint` depuis `apps/web`, `npm run cf:build` depuis `apps/web`.
- Un test statique (`apps/api/tests/worker-source.test.ts`) fige le câblage de `worker.ts` : secrets lus **à l'appel** (jamais au chargement), `antiRobot: false` seulement dans l'API,
  `ctx` transmis à `app.fetch`, correspondance clé→service. Ne pas le contourner.
- Garde de construction : `apps/api/build.mjs` interdit tout import de Next dans le paquet de l'API (`server-only` et `next/headers` remplacés par des cales). `creation-coeur.ts` (sans Next)
  est le cœur de la création de commande ; `creation-service.ts` est l'enveloppe du site (`after` de Next) ; l'API passe `ctx.waitUntil` via le paramètre `Planifier`.

## 5. Plans suivants (pas commencés)

- **1c-2 Livreur** (`livreur/*` 6 routes, appareils 3) : c'est ici que le jeton « local » (ES256) sert, pour la position du livreur (très fréquente). Corriger aussi le `?? ""` de `worker.ts` en mode local.
- **1c-3 Restaurateur** (`restaurant/*`, 12 routes ; téléversements de photos et documents).
- **1c-4 Équipe** (`equipe/*`, ~35 routes ; usage interne).
- Corriger la réponse des routes inconnues sous `/moi`, `/client`, `/livraison/estimation` : aujourd'hui 401 sans jeton, et avec jeton l'API fait `getUser` + consomme le plafond avant de répondre 404.
- Refonte de l'application : Expo / React Native + SQLite locale (`expo-sqlite` + Drizzle), synchro « maison », remplace le Kotlin à terme ; le site Next.js sera allégé. Spec de design pas encore écrite
  (`docs/specs/…-design.md` à produire après validation par Malika de : API/paquets, ordre de migration, sécurité/déploiement).
- Autres sujets ouverts d'avant : paiement Chap Chap Pay (KYC 0 %, remboursement absent de l'API), notifications Firebase (clé de service à générer par Malika), connexion Facebook (application Meta en mode développement), bouton d'annulation côté site.

## 6. Pièges déjà payés (liste courte ; le détail est dans `docs/REPRISE-SESSION.md`)

- CSS global : une classe réutilisée casse la mise en page ailleurs ; préfixer par le contexte de la page.
- Avant d'écrire dans une table, lire ses contraintes (`supabase/migrations/`) : une valeur hors contrainte fait échouer toute l'insertion en silence.
- Toute migration appliquée a son fichier dans `supabase/migrations/` dans le même commit ; policies membres `to authenticated` ; `get_advisors(security)` après toute migration RLS.
- Next.js 16 : `proxy.ts`, pas `middleware.ts` ; lire `node_modules/next/dist/docs/` à la racine du dépôt avant de s'appuyer sur sa mémoire.
- PowerShell bloque `npx`/`npm` (politique d'exécution) : `npx.cmd`, `cmd /c`. Git Bash convertit les chemins : `MSYS_NO_PATHCONV=1`.
- Un test qui n'échoue jamais ne prouve rien : exiger la mutation (casser le code, constater l'échec, restaurer).
- Plan gratuit Workers : 10 ms de CPU ; erreurs 1102 dès ~5 visiteurs simultanés avant Redis (voir mémoire `workers-cpu-limit-1102`).
