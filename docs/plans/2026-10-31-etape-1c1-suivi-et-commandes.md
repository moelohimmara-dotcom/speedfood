# Étape 1c-1, suivi et commandes du client : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-compétence requise : `subagent-driven-development` (recommandé) ou `executing-plans`. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** faire servir par l'API (`apps/api`) les quatre routes du site qui portent la commande du client : `POST /api/v1/suivi`, `POST /api/v1/suivi/annuler`, `POST /api/v1/suivi/proposition` et `GET` + `POST /api/v1/commandes` (cinq gestionnaires), avec les mêmes réponses que le site, et leur ajouter le **même relais que l'étape 1b** (éteint par défaut, un module à la fois), **sans rien déployer ni changer pour les utilisateurs** avant les feux verts de la Tâche 12.

**Architecture :** comme en 1b, chaque route de l'API est une fabrique qui reçoit ses dépendances (`Deps`) : on la teste avec de faux services, puis `worker.ts` y branche les vrais services du site (aucune règle copiée). Une seule chose change côté site avant de pouvoir porter la création : le service de création de commande appelle `after` de `next/server` ; il est coupé en deux (un **cœur sans Next** qui reçoit une fonction « après la réponse », et l'enveloppe existante qui lui passe `after`). Le site garde ses routes ; chacune reçoit le garde de relais de deux lignes. Le relais gagne trois réglages par route (lecture par POST avec repli, délai propre, corps conservé pour le repli).

**Pile :** celle de 1b (Hono 4.13.14, jose 6.2.14, esbuild, `node:test` avec suppression de types), le lanceur de tests du site (`apps/web/scripts/tests/lancer.mjs`) pour les règles pures du relais.

Design de référence : `docs/specs/2026-10-30-architecture-cible-design.md` §5 et §9 étape 1 ; plan précédent : `docs/plans/2026-10-31-etape-1b-routes-et-relais.md` (fait et en service, voir `docs/API-UNIQUE.md`). Ce plan est la première moitié de « 1c » de `docs/API-UNIQUE.md` (« routes du livreur, du restaurateur, de l'équipe, des commandes et du suivi ») : les routes du **client** (suivi, commandes). Le livreur, le restaurateur et l'équipe, le mode de jeton local et les droits par rôle restent pour 1c-2 et suivants. **Les cinq gestionnaires de ce plan sont tous en mode de jeton strict** (la commande est une écriture d'argent ; aucune n'est une « lecture très fréquente » au sens de la décision du 31 octobre 2026, même si la relecture du suivi toutes les quelques secondes pourrait un jour y prétendre : à décider sur mesure, pas ici).

## Contraintes globales

Reprises de 1b (elles s'appliquent à chaque tâche) :

- **Le déploiement en production reste manuel**, avec le feu vert explicite de Malika. Rien dans les tâches 1 à 11 ne déploie ni ne touche Cloudflare ou Supabase en écriture. La Tâche 12 est conduite par le contrôleur avec elle, jamais par un sous-agent. **Aucun agent ne pose, ne lit, ne change ni ne fait tourner un secret.**
- Aucune dépense, aucun compte, aucun projet cloud sans consigne explicite de Malika.
- **Parité exacte avec le site** : même statut, même corps JSON, mêmes en-têtes de cache, mêmes messages d'erreur. On **ne corrige pas** un comportement du site en le portant ; toute observation est notée dans `docs/API-UNIQUE.md`, section « Observations sur le site ». Les écarts voulus (panne du service d'authentification : 500 au lieu de 401) y sont déjà.
- Le serveur décide : l'identité d'une commande vient uniquement du jeton vérifié ; l'identifiant de restaurant, les prix et les frais reçus de l'application ne sont jamais une autorisation (ils sont recalculés par `creerCommande`, que l'on appelle tel quel).
- Aucune donnée sensible dans le code, les commits, les journaux, les rapports. **Le jeton de suivi est une clé d'accès** : jamais dans une adresse, un journal, un rapport, un argument de commande (voir Tâche 9).
- Un code de sortie `0` est exigé pour dire qu'une vérification passe, sans `| tail` qui le masque. Le test du site écrit « ECHEC » sans accent.
- Fichiers contenant des antislashs ou des expressions régulières : outil d'écriture de fichiers, jamais `node -e` ni heredoc.
- `npm run …` depuis le dossier de l'application ou la racine ; `npm install` à la racine ; aucune version existante du verrou ne change.
- Dans Git Bash, un argument qui commence par `/` est converti en chemin Windows : préfixer par `MSYS_NO_PATHCONV=1`.
- **Ce plan n'écrit dans aucune table et ne crée aucune commande, même de test** : les routes d'écriture sont testées avec de faux services. Le seul essai qui écrirait (idempotence croisée, Tâche 12) est une décision de Malika, jamais un défaut.
- Branche de travail : `etape-1c1-suivi-et-commandes` (le contrôle GitHub tourne sur `etape-*`). Fusion en avance rapide dans `master` seulement après contrôle vert.

## Faits vérifiés avant d'écrire ce plan (31 octobre 2026)

**Les cinq gestionnaires** (fichiers `apps/web/src/app/api/v1/suivi/route.ts`, `suivi/annuler/route.ts`, `suivi/proposition/route.ts`, `commandes/route.ts`) :

| Gestionnaire | Identité | Contrôles, dans l'ordre | Service du site | Réponse |
|---|---|---|---|---|
| `POST /suivi` | **aucune** : le jeton de suivi, dans le corps, est la clé d'accès | corps JSON ; `estJetonValide` (40 caractères `[A-Za-z0-9_-]`) → `VALIDATION` « Lien de suivi invalide. » ; `limiterLectureSuivi(jeton)` (120 par 5 min et par jeton) : `TROP_DE_REQUETES` rendue, toute autre erreur → `ERREUR_SERVEUR` « Réessayez dans un instant. » | `chargerSuiviParJeton(jeton)` | `{ok:true, suivi}` ou `INTROUVABLE` « Commande introuvable. » |
| `POST /suivi/annuler` | aucune (jeton de suivi) | corps JSON ; jeton valide ; `limiterAnnulationClient()` (20 par heure et par adresse) ; puis `annulerParClient(jeton)` ; toute `ErreurMetier` rendue telle quelle, autre erreur → `ERREUR_SERVEUR` « Une erreur est survenue. Réessayez dans un instant. » | `annulerParClient` (idempotent : une commande déjà annulée répond `ok`) | `{ok:true, reference}` |
| `POST /suivi/proposition` | aucune (jeton de suivi) | corps JSON ; jeton valide ; `reponse` ∈ {`acceptee`,`refusee`} (« Réponse invalide. ») ; `propositionId` chaîne de 1 à 64 caractères (« Proposition invalide. ») ; `limiterReponseProposition()` (30 par 10 min et par adresse) ; puis `repondreProposition` | `repondreProposition(jeton, id, reponse)` (idempotent) | `{ok:true}` |
| `GET /commandes` | jeton porteur, **`utilisateurDuJeton`** (`getUser`), message « Connectez-vous pour voir vos commandes. », **sans plafond de compte** | — | `listerMesCommandes(id, {avecJeton:true})` | `{ok:true, commandes}` (contient les jetons de suivi) |
| `POST /commandes` | jeton porteur, même vérification, message « Connectez-vous pour envoyer votre commande. », sans plafond de compte | corps JSON ; `mode === "sur_place"` refusé (`VALIDATION`, « La commande à table se fait en scannant le QR de la table, depuis le site. ») ; `validerCreationCommande` ; puis le service | `executerCreationCommande(valeurs, id, {antiRobot:false})` | `201` `{ok:true, reference, jeton, idempotent:false}` ; **`200`** si `idempotent:true` ; erreur du contrat sinon |

**L'ordre compte** : sur `POST /commandes` l'identité passe **avant** la lecture du corps ; sur les trois routes de suivi il n'y a pas d'identité, donc le corps est lu en premier. Une route qui inverserait l'ordre changerait quel code d'erreur voit une application mal configurée.

**Dépendances transitives** (mesure faite en construisant, avec le même `build.mjs` que l'API, une sonde qui importe tous les services de ces routes ; la sonde de mesure vit hors du dépôt, elle est refaite proprement en Tâche 1) :

| Module du site | Importe | Verdict pour l'API |
|---|---|---|
| `lib/commande/creation-service.ts` | **`after` de `next/server`**, `server-only`, `limitation-debit`, `turnstile`, `table/cle`, `push/envoi`, `creation` | **Seul fichier à couper** : c'est lui qui tire 54 fichiers de Next.js dans le paquet (les importateurs du métafichier ne citent que lui pour Next, plus `fonctionnalites/lire.ts` pour `react`, voir plus bas) |
| `lib/commande/creation.ts` (+ `calculs`, `transitions`, `jetons`, `commun`, `mode`, `estimation`) | Supabase (`creerClientAdmin`), `node:crypto` (`createHmac`, `randomInt`), `fonctionnalites/lire`, `table/*`, `livraison/*` | Se construit sans Next. `node:crypto` suppose `nodejs_compat` (déjà posé dans `wrangler.jsonc`). **`randomInt` sous workerd n'a jamais été exercé** : à observer (Tâche 10) |
| `lib/commande/validation.ts` | types seuls, `./commun`, `./mode`, `./telephone` : pur | Se construit ; **non importable par les tests de l'API** (l'alias `@/` n'existe pas sous Node) : injecté par `Deps`, comme les autres services |
| `lib/commande/jetons.ts` | `node:crypto` | `estJetonValide` est pur mais vit dans un fichier `server-only` : injecté par `Deps` |
| `lib/commande/requetes.ts` (suivi), `propositions.ts`, `annulation-client.ts`, `transitions.ts` | Supabase, `paiement/en-ligne/suivi`, `livraison/apres-commande` (qui charge à la demande `livraison/service`, `client/notifications`, `paiement/en-ligne/fabrique`) | Se construisent sans Next. **Tout est attendu (`await`)** dans ces chemins : aucune promesse flottante qu'un Worker tuerait après la réponse (relevé dans `apres-commande`, `envoi`, `notifications`, `service`) |
| `lib/client/mes-commandes.ts` | Supabase seul | Se construit sans Next |
| `lib/securite/limitation-debit.ts` | `next/headers` (déjà calé par `src/cales/next-headers.ts` depuis 1a), `redis-client`, Supabase | Déjà utilisé par l'API depuis 1b (`limiterClientApplication`). Les quatre limiteurs de ce plan (`limiterLectureSuivi`, `limiterAnnulationClient`, `limiterReponseProposition`, `limiterCreationCommande`) lisent l'adresse du visiteur par `headers()` : la confiance dans `x-relais-ip` (1b) s'y applique telle quelle |
| `lib/securite/turnstile.ts` | `next/headers` (calé) | Jamais appelé (`antiRobot:false`) mais présent dans le paquet : sans conséquence |
| `lib/push/envoi.ts` (+ `appareils`, `vapid`, `fcm`, `fcm-envoi`) | Supabase, `crypto.subtle` (standard Web) | Se construit sans Next. Appelé **après la réponse** : voir `after` |
| `lib/fonctionnalites/lire.ts` | **`cache` de `react`** | Entre dans le paquet (le garde de `build.mjs` ne cite que `react-dom`, pas `react`). Dans une construction hors RSC, `cache(f)` appelle simplement `f` : **pas de mémoïsation par requête**, donc possiblement une lecture de plus de `fonctionnalites` par création (appelée par `creation.ts` et `service-paiement.ts`). Sans conséquence de justesse, un peu de CPU : à mesurer (Tâche 10) |
| `lib/api/v1.ts` | `NextResponse` | **Non importé** : l'API a son propre `http.ts` (1b) |

**Le paquet** : la sonde de mesure fait 1 276 Kio avec les 54 fichiers de Next (contre 857 Kio pour le Worker de production de 1b) ; la taille sans Next est à relever en Tâche 1.

**Plan gratuit de Cloudflare** (mémoire du projet, `workers-cpu-limit-1102`) : limite de 10 ms de calcul par requête, dépassée par les pages du site, pas par les routes `/api/v1/*` légères (4 à 6 ms mesurés). **Créer une commande est la plus lourde de toutes les routes** (une dizaine d'allers-retours Supabase, un HMAC, un recalcul des lignes) : le risque de 1102 sur l'API est réel et **jamais mesuré**.

## Décisions prises dans ce plan

- **D1. `after` devient une fonction passée au cœur.** `creation-coeur.ts` (sans Next) exporte `executerCreationCoeur(valeurs, utilisateurId, options: { antiRobot: boolean; apres: Planifier })` avec `type Planifier = (tache: () => Promise<void>) => void`. `creation-service.ts` garde son nom, sa signature et son appelant (l'action serveur du site, la route) et ne fait plus que `executerCreationCoeur(valeurs, id, { ...options, apres: (t) => after(t) })`. Côté API, `apres = (t) => c.executionCtx.waitUntil(t())`. **Alternative écartée** : passer l'API par l'enveloppe en simulant `next/server` avec une cale : elle cacherait une différence réelle (`after` de Next et `waitUntil` de Workers n'ont pas la même durée de vie) et élargirait la cale de 1a.
- **D2. Validation et jeton injectés, pas déplacés.** `validerCreationCommande` et `estJetonValide` restent dans le site et entrent dans `Deps` (comme `lireRoles` en 1b). **Alternative écartée** : les déplacer dans `packages/shared` : il faudrait aussi y déplacer `estUuid` (de `commun.ts`, qui mélange types Supabase et fonctions pures) et `normaliserTelephone` ; trop de fichiers du site à toucher pour un gain nul (les tests de la validation vivent déjà côté site, `validation-commande.test.mts`).
- **D3. Deux modules de relais : `suivi` (trois routes) et `commandes` (le GET et le POST).** Le seul levier du relais est le module : sans cette coupure on ne pourrait pas « lire d'abord, écrire ensuite » en production. Écart avec la consigne initiale (« module `commandes` ») : à valider par Malika.
- **D4. Le relais gagne trois réglages par route** (Tâche 7) : (a) `POST /suivi` est une **lecture** : repli permis sur panne ou délai (sinon l'application qui relit le statut toutes les quelques secondes verrait des erreurs au lieu d'une réponse du site) ; (b) un **délai propre** par route (`annuler` et `proposition` attendent des remboursements et des notifications, `POST /commandes` plus d'une dizaine d'allers-retours : 2 500 ms n'y suffit probablement pas) ; (c) le corps est lu sur une **copie** de la requête quand un repli est possible, sinon le site retrouverait un corps déjà consommé (« JSON illisible »).
- **D5. Une écriture n'est jamais rejouée par le relais** (règle 5 de 1b, inchangée). Ce qui rend cela supportable ici, c'est l'idempotence des trois écritures du suivi (voir Risques) et la clé d'idempotence de la création.
- **D6. Sur `commandes`, le contrôle d'identité est posé par méthode, pas sur `"*"`.** Le défaut observé en 1b (une route ou méthode inconnue répond 401 sans jeton, ou consomme un `getUser` avec jeton) n'est pas reproduit ici ; les méthodes inconnues répondent 404 sans appel réseau. Sans effet sur le relais (le garde est dans le gestionnaire de la bonne méthode).
- **D7. Le plafond de compte (`limiterClientApplication`) n'est PAS ajouté** à `commandes` : le site n'en a pas (le plafond de la création est celui de `limiterCreationCommande`, par adresse, téléphone et restaurant). Parité d'abord, observation notée.

## Risques et ce que le plan en fait

1. **Idempotence de la création de commande.** `genererJetonSuivi(cleIdempotence)` = `HMAC-SHA256(secret, "speedfood-jeton-suivi-v1:" + clé)` ; la contrainte UNIQUE sur `orders.jeton_suivi` fait office de garde. Deux Workers qui n'ont **pas le même secret effectif** calculent deux jetons différents pour la même clé : un nouvel essai qui change de Worker (relais éteint entre-temps, repli, appel direct de l'application plus tard) crée **une seconde commande**. Voir la section suivante.
2. **Écriture jamais rejouée, délai de 2 500 ms.** Pour une écriture qui dépasse le délai, le site répond 500 « Réessayez dans un instant. » alors que l'API a peut-être abouti (et continue : un Worker n'est pas annulé quand l'appelant coupe, **non vérifié ici**). Conséquences : (a) `annuler` et `proposition` sont idempotentes, un second essai est inoffensif ; (b) `POST /commandes` **ne l'est que si le secret est identique** (risque 1) et si l'application réutilise sa clé d'idempotence (vérifié dans `mobile/` : `CommandeViewModel` ne régénère la clé que quand le panier, le mode ou la destination changent) ; (c) la création n'est **pas transactionnelle** (insertion de la commande, puis des lignes, puis des options, avec une suppression de compensation en cas d'échec rattrapé) : si le traitement était coupé entre deux insertions, une commande sans lignes existerait et le rejeu rendrait `idempotent:true`. D4(b) réduit la probabilité (délai long) mais ne la supprime pas ; la mesure de la Tâche 12 doit relever la durée réelle de la création relayée.
3. **Notifications au restaurant (push).** `after` (site) devient `waitUntil` (API). Elle doit toujours se faire **après** la réponse, ne jamais la retarder, ne jamais la faire échouer, et **seulement si la commande est nouvelle** (`!idempotent`). Si la tâche n'était pas enregistrée, le restaurateur n'aurait **aucune alerte « page fermée »** : échec silencieux. Un test dédié (Tâche 6) casse si l'appel à `waitUntil` disparaît.
4. **Anti-robot.** `antiRobot:false` (l'application native ne produit pas de jeton Turnstile) ; la protection est le jeton porteur strict + les plafonds par adresse, téléphone et restaurant. La route de l'API ne lit jamais `jetonVerification` du corps pour l'anti-robot. Test.
5. **Limite de 10 ms de calcul** (plan gratuit) : voir « Faits ». L'allumage de `commandes` n'est décidé qu'après mesure en production sur `suivi`, puis sur `GET /commandes`.
6. **Compteurs de limitation.** Les clés de compteur dépendent du même secret que le jeton de suivi (`empreinte()` de `limitation-debit.ts`). Secret différent : les compteurs du site et de l'API se séparent et les plafonds doublent pendant l'allumage progressif ou un repli (déjà noté en 1b).
7. **Le jeton de suivi est un secret d'accès.** `GET /commandes` en rend plusieurs ; `POST /suivi` le reçoit dans le corps. Le relais ne le journalise pas (règle 6 de 1b) ; les tests de cette étape vérifient que ni le jeton de suivi ni le jeton porteur n'apparaissent dans les journaux de l'API (espion sur `console`).
8. **Panne du service d'authentification.** Site : 401 (l'erreur devient `null`), donc l'application se croit déconnectée. API : 500 (voulu depuis 1b). Sur `POST /commandes` c'est un **mieux** (pas de fausse déconnexion au moment de payer), déjà documenté ; on le répète dans les observations.
9. **`listerMesCommandes` avale les erreurs de base** (`data ?? []`) : une panne de lecture renvoie `{ok:true, commandes:[]}` sur le site, donc sur l'API (parité). L'application affiche alors « aucune commande » pendant la panne. À noter, non corrigé.
10. **Méthodes inconnues.** Site : 405 ; API : 404 (écart connu de 1b).

## COMMANDE_JETON_SECRET : usage et vérification de parité

**Où il est lu** (trois endroits, tous avec le même repli) : `secret = process.env.COMMANDE_JETON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY` dans

1. `lib/commande/jetons.ts` : jeton de suivi (HMAC de la clé d'idempotence) ;
2. `lib/securite/limitation-debit.ts` : empreinte des clés de compteur (adresse, téléphone, restaurant, jeton) ;
3. `lib/table/cle.ts` : clé des QR de table (commande « sur place », que l'API refuse mais dont le cœur de création teste la clé).

**Le piège le plus silencieux est le repli** : si le site a `COMMANDE_JETON_SECRET` posé et l'API non, l'API se rabat **sans erreur** sur la clé de service, donc sur un autre secret effectif. Aucune alarme, aucun test local ne le voit (les `.dev.vars` de test n'ont jamais eu `COMMANDE_JETON_SECRET` : `apps/api/scripts/preparer-dev-vars.mjs` le prévoit mais `apps/web/.env.local` ne l'a pas).

**Ce qu'il ne faut jamais faire** : changer la valeur sur le site « pour aligner ». Elle fixe les clés des QR de table déjà imprimés et tous les compteurs ; un changement casserait les QR. **On aligne l'API sur le site, jamais l'inverse.**

**Vérification, dans l'ordre (Tâche 12, avec Malika)** :

1. Noms seulement (aucune valeur) : `npx wrangler secret list` depuis `apps/web` et depuis `apps/api`. `COMMANDE_JETON_SECRET` doit être présent sur les **deux** ou absent des **deux** ; `SUPABASE_SERVICE_ROLE_KEY` présent sur les deux (même projet Supabase). Un seul des deux : stop, rien ne s'allume.
2. Présent des deux côtés : Malika recopie elle-même la valeur du site sur l'API (`wrangler secret put`), sans la montrer. L'agent ne la voit pas et ne peut pas la comparer.
3. **Preuve par le comportement, seulement si Malika l'accepte** (écriture d'une commande d'essai, `est_test`, sur un restaurant d'essai : la mémoire du projet interdit d'écrire en production pour tester sans décision) : envoyer **la même clé d'idempotence** une fois au site (relais éteint pour `commandes`) et une fois à l'API (adresse `workers.dev`), avec le même jeton porteur : la seconde réponse doit être `200` avec `idempotent:true` et **le même jeton de suivi**. Sinon : les secrets diffèrent, on corrige l'API et on ne s'allume pas.
4. Si Malika refuse l'essai d'écriture : `commandes` ne s'allume pas. `suivi` (qui ne dérive aucun jeton) peut s'allumer ; il reste le risque 6 (compteurs séparés), toléré en lecture.

## Écarts assumés et hors périmètre

- **Hors périmètre :** les autres routes du client (`client/*` déjà fait en 1b ; aucune autre route de commande n'existe côté application) ; le livreur, le restaurateur, l'équipe ; le mode local d'un vérificateur ; l'anti-robot Turnstile côté API ; le déplacement de `validation`/`jetons` dans `packages/shared` ; le client typé `packages/api-client` ; la transaction unique pour la création de commande (changement de comportement du site, demande propre) ; la correction du comportement « 401 sur route inconnue » de 1b (traité ici par D6 seulement pour `commandes`).
- **Comparaison avec la production :** `POST /suivi` se compare avec **un vrai jeton de suivi d'une commande d'essai de Malika** (lecture seule, mais c'est un POST : le comparateur le refuse sans `--autoriser-ecriture`, voir Tâche 9). `GET /commandes` se compare avec un vrai jeton porteur (`--jeton-env`), comme `moi` en 1b. **`annuler`, `proposition` et `POST /commandes` ne sont jamais comparés à la production** (elles écriraient) : seule leur parité de code est testée.
- **Écart connu :** sur une méthode non gérée, le site répond 405 (Next) et l'API répond 404.

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `apps/web/src/lib/commande/creation-coeur.ts` | Créer | cœur de la création, sans `next/server` ; `Planifier` en paramètre |
| `apps/web/src/lib/commande/creation-service.ts` | Modifier | enveloppe : mêmes signature et nom, passe `after` au cœur |
| `apps/api/sondes/services.ts` | Modifier | ajoute les services de ce plan (la garde de construction les couvre) |
| `apps/api/tests/construction.test.ts` | Modifier | taille du paquet sans Next, cœur de création inclus |
| `apps/api/src/types.ts` | Modifier | `Deps` : `suivi`, `commandes`, `Planifier` |
| `apps/api/tests/deps-essai.ts` | Modifier | faux services de suivi et de commandes, contexte d'exécution d'essai |
| `apps/api/src/routes/suivi.ts` | Créer | les trois routes de suivi |
| `apps/api/src/routes/commandes.ts` | Créer | `GET` et `POST` |
| `apps/api/src/app.ts` | Modifier | montage des deux routeurs |
| `apps/api/src/worker.ts` | Modifier | câblage de production, `ctx` transmis |
| `apps/api/tests/suivi.test.ts`, `commandes.test.ts` | Créer | un fichier de test par routeur |
| `apps/api/scripts/comparateur.mjs`, `comparer-routes.mjs`, `tests/comparateur.test.ts` | Modifier | `--corps-env` (corps secret lu dans l'environnement) |
| `apps/web/src/lib/api/relais-regles.ts`, `relais.ts` | Modifier | lecture par POST, délai par route, corps conservé |
| `apps/web/scripts/tests/relais.test.mts` | Modifier | tests du relais |
| `apps/web/src/app/api/v1/suivi/**/route.ts`, `commandes/route.ts` (4 fichiers) | Modifier | garde de relais de deux lignes |
| `docs/API-UNIQUE.md`, `docs/STATUT-PROJET.md`, mémoire | Modifier | documentation |

---

### Tâche 1 : Cœur de création sans Next, sonde et garde de construction

**Fichiers :**
- Créer : `apps/web/src/lib/commande/creation-coeur.ts`
- Modifier : `apps/web/src/lib/commande/creation-service.ts`, `apps/api/sondes/services.ts`, `apps/api/tests/construction.test.ts`

**Interfaces :**
- Produit : `type Planifier = (tache: () => Promise<void>) => void` ; `executerCreationCoeur(valeurs: CreationCommandePayload, utilisateurId: string | null, options: { antiRobot: boolean; apres: Planifier }): Promise<ResultatCreationCommande>` (corps **identique** à l'actuel `executerCreationCommande`, sauf l'appel `after(…)` remplacé par `options.apres(…)`).
- `executerCreationCommande(valeurs, utilisateurId, options: { antiRobot: boolean })` : **signature inchangée**, appelle le cœur avec `apres: (tache) => after(tache)`. Aucun appelant du site ne change.

- [ ] **Étape 1 : Créer la branche**

```bash
cd /c/Users/moelo/dev/speedfood
git checkout master && git pull --ff-only
git checkout -b etape-1c1-suivi-et-commandes
```

- [ ] **Étape 2 : Écrire le test de construction qui échoue.** Dans `apps/api/tests/construction.test.ts`, relire le fichier puis ajouter (la sonde est étendue à l'étape 3) :

```ts
test("les services de suivi et de commande se construisent sans Next.js (sonde 1c)", async () => {
  const resultat = await construireDans("sondes/services.ts");
  assert.deepEqual(resultat.interdits, [], "le cœur de création ne doit importer ni next/server ni next/headers directs");
  assert.ok(resultat.octets < 1_100_000, `paquet de la sonde trop gros : ${resultat.octets} octets`);
});
```

Avant d'écrire le seuil `1_100_000`, **relever la taille réelle** après l'étape 4 et fixer le seuil à environ 10 % au-dessus (la valeur ci-dessus est un point de départ : la sonde contenait 1 276 Kio avec les 54 fichiers de Next ; sans eux elle doit être nettement plus petite). Ne pas laisser un seuil qui ne mord pas.

- [ ] **Étape 3 : Étendre la sonde** (outil Write sur `apps/api/sondes/services.ts`, en ajoutant à la fin) :

```ts
export { executerCreationCoeur } from "@/lib/commande/creation-coeur";
export { validerCreationCommande } from "@/lib/commande/validation";
export { listerMesCommandes } from "@/lib/client/mes-commandes";
export { estJetonValide } from "@/lib/commande/jetons";
export { chargerSuiviParJeton } from "@/lib/commande/requetes";
export { annulerParClient } from "@/lib/commande/annulation-client";
export { repondreProposition } from "@/lib/commande/propositions";
export { limiterLectureSuivi, limiterAnnulationClient, limiterReponseProposition } from "@/lib/securite/limitation-debit";
```

- [ ] **Étape 4 : Constater l'échec, puis couper le service.** `npm run test` (depuis `apps/api`) doit échouer sur la sonde (importer `creation-coeur` : fichier introuvable). Puis :
  1. créer `creation-coeur.ts` en **copiant** `creation-service.ts` (outil Write, relire le fichier avant) : retirer l'import `after`, ajouter `export type Planifier = (tache: () => Promise<void>) => void;`, ajouter `apres: Planifier` aux options, remplacer `after(async () => {…})` par `options.apres(async () => {…})` ; **ne toucher à aucune autre ligne** (ordre des contrôles, plafond avant création, `!cree.idempotent`, gestion des erreurs, commentaire) ;
  2. réduire `creation-service.ts` à l'enveloppe :

```ts
import "server-only";
import { after } from "next/server";
import type { CreationCommandePayload, ResultatCreationCommande } from "@/lib/contracts/commande";
import { executerCreationCoeur } from "./creation-coeur";

/** Enveloppe du site : exécute le cœur et planifie l'alerte du restaurant avec `after` de Next. L'API (Worker) appelle le cœur avec `waitUntil`. */
export async function executerCreationCommande(
  valeurs: CreationCommandePayload,
  utilisateurId: string | null,
  options: { antiRobot: boolean }
): Promise<ResultatCreationCommande> {
  return executerCreationCoeur(valeurs, utilisateurId, { ...options, apres: (tache) => after(tache) });
}
```

  (garder le gros commentaire d'origine dans le cœur ; l'enveloppe n'a que le sien.)

- [ ] **Étape 5 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
npm run test:unit > /dev/null; echo "test:unit=$?"
npm run test:cloisonnement > /dev/null; echo "cloisonnement=$?"
(cd apps/web && npx eslint src/lib/commande; echo "eslint=$?")
(cd apps/web && npm run cf:build > /dev/null 2>&1; echo "cf:build=$?")
npm run build:api; echo "build:api=$?"
git add -A && git commit -m "Création de commande : cœur sans Next (planification en paramètre), enveloppe du site inchangée, sonde de l'API étendue

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : tous à `0`. Le rapport donne (1) la taille du paquet de la sonde avant/après, (2) la preuve que `creation-service.ts` garde nom, signature et comportement (le diff du cœur ne change que l'appel de planification), (3) la liste des fichiers du paquet venant de `react` (attendu : ceux de `fonctionnalites/lire.ts`, rien d'autre) et si la taille du paquet change quand on les exclut.

---

### Tâche 2 : Dépendances de l'API (`Deps`), contexte d'exécution et aide de tests

**Fichiers :**
- Modifier : `apps/api/src/types.ts`, `apps/api/src/worker.ts`, `apps/api/tests/deps-essai.ts`

**Interfaces :**
- Produit (dans `types.ts`, ajouts à `Deps`) :

```ts
import type { CreationCommandePayload, ResultatCreationCommande } from "@speedfood/shared/contracts/commande";
import type { ErreurApi } from "@speedfood/shared/contracts/erreurs";

/** « Après la réponse » : sur Workers, `ctx.waitUntil`. La tâche ne retarde jamais la réponse et ne la fait jamais échouer. */
export type Planifier = (tache: () => Promise<void>) => void;

export interface Deps {
  // … (existant)
  suivi: {
    jetonValide(jeton: unknown): jeton is string;
    limiterLecture(jeton: string): Promise<void>;
    lire(jeton: string): Promise<object | null>;
    limiterAnnulation(): Promise<void>;
    annuler(jeton: string): Promise<{ reference: string }>;
    limiterReponseProposition(): Promise<void>;
    repondreProposition(jeton: string, propositionId: string, reponse: "acceptee" | "refusee"): Promise<void>;
  };
  commandes: {
    valider(corps: unknown): { ok: true; valeurs: CreationCommandePayload } | { ok: false; erreur: ErreurApi };
    creer(valeurs: CreationCommandePayload, utilisateurId: string, apres: Planifier): Promise<ResultatCreationCommande>;
    /** Câblage de production : `listerMesCommandes(id, { avecJeton: true })`. */
    lister(utilisateurId: string): Promise<object[]>;
  };
}
```

- `deps-essai.ts` : `ctxEssai(): { ctx: ExecutionContext; attendre(): Promise<void>; enregistrees(): number }` (un faux `ExecutionContext` qui compte les `waitUntil` et dont `attendre()` attend leur fin) ; `suivi` et `commandes` par défaut : `jetonValide` réel (`typeof j === "string" && /^[A-Za-z0-9_-]{40}$/.test(j)`), limiteurs qui ne font rien, tout le reste qui échoue bruyamment (`ECHEC`), `valider` qui lève.
- `worker.ts` : `export default { fetch: (requete: Request, env: unknown, ctx: ExecutionContext) => app.fetch(requete, env, ctx) }` (au lieu de `{ fetch: app.fetch }`, qui perdrait le troisième argument selon la version de Hono : **vérifier** que `c.executionCtx` est bien rempli, test ci-dessous) ; valeurs provisoires « non câblé » pour `suivi` et `commandes` (le typecheck passe, aucune route n'est montée).

- [ ] **Étape 1 : Écrire le test qui échoue** dans `apps/api/tests/app.test.ts` (relire le fichier pour reprendre son aide) :

```ts
import { Hono } from "hono";
import { ctxEssai } from "./deps-essai.ts";

test("le contexte d'exécution de Workers est disponible pour les routes (waitUntil)", async () => {
  const { ctx, attendre, enregistrees } = ctxEssai();
  const app = new Hono();
  app.get("/", (c) => { c.executionCtx.waitUntil(Promise.resolve()); return c.text("ok"); });
  const reponse = await app.request("/", {}, {}, ctx);
  assert.equal(reponse.status, 200);
  await attendre();
  assert.equal(enregistrees(), 1);
});
```

- [ ] **Étape 2 : Constater l'échec** (`ctxEssai` n'existe pas), puis écrire `ctxEssai` et étendre `Deps` et `depsEssai` (outil Write). Toute autre `depsEssai` existante se complète sans changer d'autres tests.
- [ ] **Étape 3 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : dépendances de suivi et de commandes, contexte d'exécution d'essai

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `0` et `0`. Le rapport dit si `app.fetch` passe bien `ctx` en troisième argument avec Hono 4.13.14 (sinon `c.executionCtx` lèverait en production).

---

### Tâche 3 : `POST /api/v1/suivi` (lecture seule)

**Fichiers :**
- Créer : `apps/api/src/routes/suivi.ts` (cette tâche : la route `/` ; les Tâches 4 y ajoutent `/annuler` et `/proposition`), `apps/api/tests/suivi.test.ts`
- Modifier : `apps/api/src/app.ts`

**Interfaces :**
- Consomme : `lireCorpsJson`, `repondre`, `reponseErreur` (1b), `Deps.suivi`.
- Produit : `routeSuivi(deps: Pick<Deps, "suivi">): Hono`, monté sur `/api/v1/suivi`. **Aucune identité** : la clé est le jeton de suivi du corps.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/suivi.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import { ErreurMetier } from "@speedfood/shared/contracts/erreurs";
import type { Deps } from "../src/types.ts";
import { depsEssai } from "./deps-essai.ts";

const JETON = "A".repeat(40);
const JSON_TYPE = { "content-type": "application/json" };
const post = (corps: unknown, entetes: Record<string, string> = JSON_TYPE) => ({ method: "POST", headers: entetes, body: JSON.stringify(corps) });

function app(surcharge: Partial<Deps["suivi"]> = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    suivi: {
      ...depsEssai().suivi,
      limiterLecture: async (j) => { appels.push(`limite:${j === JETON}`); },
      lire: async (j) => { appels.push(`lire:${j === JETON}`); return { reference: "SF-4KVB9", statut: "en_attente" }; },
      ...surcharge,
    },
  }));
}

test("suivi : jeton valide, plafond puis lecture, réponse {ok:true, suivi}, jamais de cache, aucune identité demandée", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, suivi: { reference: "SF-4KVB9", statut: "en_attente" } });
  assert.deepEqual(appels, ["limite:true", "lire:true"]);
});

test("suivi : jeton absent, de mauvaise forme ou non textuel : VALIDATION 400 « Lien de suivi invalide. », rien d'autre n'est appelé", async () => {
  for (const corps of [{}, { jeton: "court" }, { jeton: 123 }, { jeton: "é".repeat(40) }, null, [JETON]]) {
    const appels: string[] = [];
    const reponse = await app({}, appels).request("/api/v1/suivi", post(corps));
    assert.equal(reponse.status, 400);
    assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "VALIDATION", message: "Lien de suivi invalide." } });
    assert.deepEqual(appels, []);
  }
});

test("suivi : type de contenu non JSON ou JSON illisible : refus avant tout, messages du site", async () => {
  const a = await app().request("/api/v1/suivi", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.deepEqual(await a.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON attendu." } });
  const b = await app().request("/api/v1/suivi", { method: "POST", headers: JSON_TYPE, body: "{pas du json" });
  assert.deepEqual(await b.json(), { ok: false, erreur: { code: "VALIDATION", message: "Requête invalide : JSON illisible." } });
});

test("suivi : plafond atteint, 429 TROP_DE_REQUETES, la commande n'est pas lue", async () => {
  const appels: string[] = [];
  const reponse = await app({ limiterLecture: async () => { throw new ErreurMetier("TROP_DE_REQUETES", "Trop de demandes."); }, lire: async () => { appels.push("lire"); return {}; } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 429);
  assert.deepEqual(appels, []);
});

test("suivi : le limiteur tombe en panne (erreur non métier) : ERREUR_SERVEUR 500 « Réessayez dans un instant. », comme le site", async () => {
  const reponse = await app({ limiterLecture: async () => { throw new Error("redis"); } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 500);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." } });
});

test("suivi : commande inconnue, 404 INTROUVABLE « Commande introuvable. »", async () => {
  const reponse = await app({ lire: async () => null }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 404);
  assert.deepEqual(await reponse.json(), { ok: false, erreur: { code: "INTROUVABLE", message: "Commande introuvable." } });
});

test("suivi : panne de la lecture (exception), 500 au contrat sans détail", async () => {
  const reponse = await app({ lire: async () => { throw new Error("secret interne"); } }).request("/api/v1/suivi", post({ jeton: JETON }));
  assert.equal(reponse.status, 500);
  assert.ok(!JSON.stringify(await reponse.json()).includes("secret interne"));
});

test("suivi : ni le jeton de suivi ni rien du corps n'est écrit dans les journaux", async () => {
  const lignes: string[] = [];
  const origine = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  try {
    await app({ lire: async () => { throw new Error(`échec pour ${JETON}`); } }).request("/api/v1/suivi", post({ jeton: JETON }));
  } finally { Object.assign(console, origine); }
  assert.ok(!lignes.join("\n").includes(JETON), "le jeton de suivi a fuité dans un journal");
});
```

- [ ] **Étape 2 : Constater l'échec, puis écrire la route** (outil Write) : `apps/api/src/routes/suivi.ts`. Reprendre **ligne à ligne** la logique de `apps/web/src/app/api/v1/suivi/route.ts` (relire le fichier) : lecture du corps (`lireCorpsJson`), extraction du jeton **de la même façon** (`typeof corps === "object" && corps !== null && "jeton" in corps`), `deps.suivi.jetonValide`, `try { await limiterLecture(jeton) } catch (e) { if (e instanceof ErreurMetier && e.code === "TROP_DE_REQUETES") return reponseErreur(c, e.toApi()); return reponseErreur(c, { code: "ERREUR_SERVEUR", message: "Réessayez dans un instant." }); }`, `lire(jeton)`, `INTROUVABLE` ou `repondre(c, { ok: true, suivi })`. Monter dans `app.ts` : `app.route("/api/v1/suivi", routeSuivi(deps));`.

  *(Le dernier test peut échouer pour une raison étrangère à la route : le gestionnaire d'erreurs d'`app.ts` écrit `error.name` seulement, jamais le message ; c'est précisément ce que le test garde. S'il échoue, corriger la route, pas le test.)*

- [ ] **Étape 3 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : route POST /suivi (lecture par jeton de suivi)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `0` et `0`. Rendre dans le rapport la comparaison ligne à ligne avec la route du site (ordre des contrôles, messages, codes).

---

### Tâche 4 : `POST /suivi/annuler` et `POST /suivi/proposition`

**Fichiers :**
- Modifier : `apps/api/src/routes/suivi.ts`, `apps/api/tests/suivi.test.ts`

**Interfaces :**
- Consomme : `Deps.suivi.{jetonValide, limiterAnnulation, annuler, limiterReponseProposition, repondreProposition}`.
- Produit : les sous-routes `/annuler` et `/proposition` du routeur de la Tâche 3.

**Règles à reproduire** (relire les deux fichiers du site) :
- `/annuler` : corps JSON, jeton valide, puis dans un `try` : `await limiterAnnulation()` **puis** `await annuler(jeton)` → `{ok:true, reference}` ; `catch` : `ErreurMetier` rendue par `toApi()`, sinon `ERREUR_SERVEUR` « Une erreur est survenue. Réessayez dans un instant. » (**ce message-ci, pas celui du suivi** ; la route attrape elle-même pour qu'il ne soit pas remplacé par celui du gestionnaire d'erreurs).
- `/proposition` : corps réduit à `{}` s'il n'est pas un objet, jeton valide, puis **dans cet ordre** `reponse` ∈ {`acceptee`,`refusee`} (« Réponse invalide. »), `propositionId` chaîne de 1 à 64 caractères (« Proposition invalide. »), puis `try { await limiterReponseProposition(); await repondreProposition(jeton, id, reponse); {ok:true} }` avec le même `catch` que `/annuler`.

- [ ] **Étape 1 : Écrire les tests qui échouent** (ajouts à `suivi.test.ts`, même aide `app()` avec les nouveaux faux services) couvrant, **pour chacune des deux routes** : succès nominal et ordre des appels (`limite` avant le service) ; jeton invalide → 400 sans appel ; corps non JSON ; `ErreurMetier("CONFLIT_ETAT", …)` rendue avec son statut (409) et son message ; `ErreurMetier("TROP_DE_REQUETES", …)` du limiteur : 429 et le service **n'est pas appelé** ; exception quelconque → 500 « Une erreur est survenue. Réessayez dans un instant. » ; ni jeton de suivi ni message d'exception dans les journaux. Plus, pour `/proposition` seulement : `reponse` absente ou autre que les deux valeurs, `propositionId` absent / vide / de 65 caractères / non texte → 400 avec le bon message **et l'ordre** (une réponse invalide avec un identifiant invalide renvoie « Réponse invalide. »). Et un test **idempotence** : deux appels identiques de `/annuler` appellent chacun le service (l'idempotence est dans le service du site, pas dans la route : la route ne mémorise rien).
- [ ] **Étape 2 : Constater l'échec, écrire le code, vérifier, enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : routes POST /suivi/annuler et /suivi/proposition

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `0` et `0`.

---

### Tâche 5 : `GET /api/v1/commandes`

**Fichiers :**
- Créer : `apps/api/src/routes/commandes.ts`, `apps/api/tests/commandes.test.ts`
- Modifier : `apps/api/src/app.ts`

**Interfaces :**
- Consomme : `identifier(verifier, message)` (1b), `repondre`, `Deps.verificateurs.strict`, `Deps.commandes.lister`.
- Produit : `routeCommandes(deps: Pick<Deps, "verificateurs" | "commandes">): Hono<{ Variables: Variables }>`, monté sur `/api/v1/commandes`. **L'identité est posée par méthode** (D6), pas sur `"*"` : `route.get("/", identifier(deps.verificateurs.strict, "Connectez-vous pour voir vos commandes."), handler)`.

- [ ] **Étape 1 : Écrire le test qui échoue** (outil Write) : `apps/api/tests/commandes.test.ts` (la partie `POST` y est ajoutée en Tâche 6)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerApp } from "../src/app.ts";
import type { Deps } from "../src/types.ts";
import { ctxEssai, depsEssai } from "./deps-essai.ts";

const JETON = "aaaaaaaa.bbbbbbbb.cccccccc";
const AUTH = { authorization: `Bearer ${JETON}` };
const COMMANDES = [{ id: "c1", reference: "SF-4KVB9", jeton: "B".repeat(40) }];

function app(surcharge: Partial<Deps> = {}, appels: string[] = []) {
  return creerApp(depsEssai({
    verificateurs: { strict: async (j) => { appels.push("identite"); return j === JETON ? { id: "compte-1" } : null; }, local: async () => null },
    commandes: { ...depsEssai().commandes, lister: async (id) => { appels.push(`lister:${id}`); return COMMANDES; } },
    ...surcharge,
  }));
}

test("commandes GET : identité stricte puis liste du compte du jeton, jetons de suivi inclus, jamais de cache", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await reponse.json(), { ok: true, commandes: COMMANDES });
  assert.deepEqual(appels, ["identite", "lister:compte-1"]);
});

test("commandes GET : sans jeton ou jeton refusé, 401 « Connectez-vous pour voir vos commandes. », rien n'est lu", async () => {
  for (const entetes of [{}, { authorization: "Bearer aaaaaaaa.bbbbbbbb.ddddddddd" }]) {
    const appels: string[] = [];
    const reponse = await app({}, appels).request("/api/v1/commandes", { headers: entetes });
    assert.equal(reponse.status, 401);
    assert.equal(((await reponse.json()) as { erreur: { message: string } }).erreur.message, "Connectez-vous pour voir vos commandes.");
    assert.ok(!appels.some((a) => a.startsWith("lister")));
  }
});

test("commandes GET : aucun plafond de compte (comme le site) : limiterClientApplication n'est jamais appelé", async () => {
  let appele = false;
  await app({ limiterClientApplication: async () => { appele = true; } }).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(appele, false);
});

test("commandes GET : panne du service d'authentification, 500 (jamais 401)", async () => {
  const reponse = await app({ verificateurs: { strict: async () => { throw new Error("auth indisponible"); }, local: async () => null } }).request("/api/v1/commandes", { headers: AUTH });
  assert.equal(reponse.status, 500);
});

test("commandes GET : panne de la lecture, 500 sans détail ; aucun jeton de suivi dans les journaux", async () => {
  const lignes: string[] = [];
  const origine = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => { lignes.push(a.map(String).join(" ")); };
  let reponse: Response;
  try {
    reponse = await app({ commandes: { ...depsEssai().commandes, lister: async () => { throw new Error(`échec ${COMMANDES[0].jeton}`); } } }).request("/api/v1/commandes", { headers: AUTH });
  } finally { Object.assign(console, origine); }
  assert.equal(reponse.status, 500);
  assert.ok(!lignes.join("\n").includes(COMMANDES[0].jeton));
});

test("commandes : une méthode inconnue répond 404 sans appeler le service d'authentification (D6)", async () => {
  const appels: string[] = [];
  const reponse = await app({}, appels).request("/api/v1/commandes", { method: "DELETE", headers: AUTH });
  assert.equal(reponse.status, 404);
  assert.deepEqual(appels, []);
});
```

(`ctxEssai` est importé pour la Tâche 6 ; le retirer de l'import s'il n'est pas encore utilisé, le lint de l'API le refuse sinon.)

- [ ] **Étape 2 : Constater l'échec, écrire la route, monter** (`app.route("/api/v1/commandes", routeCommandes(deps));`), **vérifier, enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : route GET /commandes (liste du compte avec jetons de suivi)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `0` et `0`.

---

### Tâche 6 : `POST /api/v1/commandes` (création, la plus sensible)

**Fichiers :**
- Modifier : `apps/api/src/routes/commandes.ts`, `apps/api/tests/commandes.test.ts`

**Interfaces :**
- Consomme : `identifier`, `lireCorpsJson`, `repondre`, `reponseErreur`, `Deps.commandes.{valider, creer}`, `c.executionCtx`.
- Produit : `route.post("/", identifier(deps.verificateurs.strict, "Connectez-vous pour envoyer votre commande."), handler)`. Le gestionnaire reproduit **dans l'ordre** : `lireCorpsJson` ; refus du mode `sur_place` (même test, même message) ; `deps.commandes.valider(corps)` ; `deps.commandes.creer(valeurs, utilisateurId, apres)` avec `apres = (tache) => c.executionCtx.waitUntil(tache())` ; erreur → `reponseErreur(c, resultat.erreur)` ; succès → `repondre(c, resultat, resultat.idempotent ? 200 : 201)`.

- [ ] **Étape 1 : Écrire les tests qui échouent** (ajouts à `commandes.test.ts`). Cas obligatoires, un test chacun :
  1. **Création nominale** : 201, corps `{ok:true, reference, jeton, idempotent:false}` rendu tel quel, `cache-control: no-store` ; `creer` reçoit **l'identifiant du compte du jeton** (`compte-1`), les valeurs **validées** (pas le corps brut), et `antiRobot` n'est pas un paramètre de la route (le câblage le fixe à `false`, test en Tâche 10) ; ordre des appels `identite`, `valider`, `creer`.
  2. **Rejeu idempotent** : `creer` rend `idempotent:true` → **200** et le même corps.
  3. **Identité avant le corps** : sans jeton et avec un corps illisible → 401 « Connectez-vous pour envoyer votre commande. » (pas 400) ; `valider` et `creer` non appelés.
  4. **Corps** : type de contenu non JSON, JSON illisible, `content-length` trop grand : refus avec les messages du site, `creer` non appelé.
  5. **`sur_place`** : 400 `VALIDATION` « La commande à table se fait en scannant le QR de la table, depuis le site. », `valider` **et** `creer` non appelés ; un corps qui n'est pas un objet (`null`, tableau) ne lève pas et passe à `valider`.
  6. **Validation refusée** : `valider` rend `{ok:false, erreur}` → l'erreur rendue avec son statut, `creer` non appelé.
  7. **Erreur du service** : `creer` rend `{ok:false, erreur:{code:"TROP_DE_REQUETES",…}}` → 429 ; `{code:"ERREUR_SERVEUR"}` → 500, corps au contrat.
  8. **Le compte vient du jeton, jamais du corps** : le corps contient `utilisateurId` et `clientUserId` d'un autre compte ; `creer` reçoit toujours `compte-1`.
  9. **Notification après la réponse** : un faux `creer` qui appelle `apres(async () => { journal.push("alerte") })` ; avec `ctxEssai()` passé en quatrième argument de `app.request`, la réponse est rendue **avant** que la tâche ne soit terminée (la tâche attend une promesse qu'on libère après avoir lu la réponse), `enregistrees()` vaut 1, et après `attendre()` le journal contient « alerte ». **Ce test casse si l'appel à `waitUntil` est retiré** (mutation à tenter et à rapporter).
  10. **Une tâche planifiée qui échoue ne change pas la réponse** (la tâche lève : la réponse est déjà 201 ; `attendre()` ne propage pas l'erreur dans la réponse).
  11. **Panne du service d'authentification** : 500, `valider` et `creer` non appelés.
  12. **Aucun jeton dans les journaux** : ni le jeton porteur, ni le jeton de suivi rendu, ni le corps (téléphone du client) ne sont écrits par la route.
  13. **Aucun plafond de compte** (D7) : `limiterClientApplication` jamais appelé.
- [ ] **Étape 2 : Constater l'échec, écrire le code, vérifier, enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : route POST /commandes (création, planification de l'alerte restaurant par waitUntil)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `0` et `0`. Le rapport liste les mutations tentées (retirer `waitUntil`, inverser identité et corps, 200/201, appeler `creer` avec le corps brut) et que chacune fait échouer au moins un test.

---

### Tâche 7 : Relais : lecture par POST avec repli, délai par route, corps conservé

**Fichiers :**
- Modifier : `apps/web/src/lib/api/relais-regles.ts`, `apps/web/src/lib/api/relais.ts`, `apps/web/scripts/tests/relais.test.mts`

**Interfaces :**
- `relaisSiActif(request: Request, module: string, options?: { lecture?: boolean; delaiMs?: number }): Promise<Response | null>` : `lecture: true` rend le repli permis même pour une méthode d'écriture ; `delaiMs` remplace 2 500 ms.
- `decisionRelais(env, module, request, options?)` : `repliPossible = options?.lecture === true || GET || HEAD`.
- `relayer(request, chemin, options, repliPossible)` : quand `repliPossible` est vrai et que la requête a un corps, le corps est lu sur `request.clone()` pour que la requête d'origine reste lisible par la route du site en cas de repli ; quand `repliPossible` est faux, comportement inchangé (aucun clone).

- [ ] **Étape 1 : Écrire les tests qui échouent** dans `relais.test.mts` (relire le fichier, garder son style `verifier(nom, obtenu, attendu)`) :
  1. `POST` avec `lecture:true` et panne réseau → `null` **et** le corps de la requête d'origine est encore lisible (`await requete.json()` réussit après le repli) ;
  2. `POST` avec `lecture:true` et délai dépassé → `null`, corps encore lisible ;
  3. `POST` **sans** `lecture` et panne réseau → toujours 500 `ERREUR_SERVEUR` (règle 5 de 1b intacte) ;
  4. `delaiMs: 50` coupe un faux `fetch` lent ; `delaiMs` absent garde 2 500 ms ;
  5. `decisionRelais` avec `{ lecture: true }` sur `POST` → `repliPossible: true` ; sans option → `false` ;
  6. une réponse 5xx de l'API n'est **pas** un repli, même avec `lecture:true` (règle 5 de 1b) ;
  7. le corps et le jeton ne sont pas journalisés (espion sur `console`).
- [ ] **Étape 2 : Constater l'échec, écrire le code, vérifier, enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
npm run test:unit; echo "test:unit=$?"
npm run typecheck; echo "typecheck=$?"
(cd apps/web && npx eslint src/lib/api; echo "eslint=$?")
git add -A && git commit -m "Site : relais, lecture par POST avec repli, délai par route, corps conservé pour le repli

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : tous à `0`. Rapport : preuve que les dix routes de 1b se comportent comme avant (les appels existants n'ont pas d'option, le chemin de code est identique pour `lecture` absent).

---

### Tâche 8 : Gardes de relais sur les quatre routes du site

**Fichiers :**
- Modifier : `apps/web/src/app/api/v1/suivi/route.ts`, `suivi/annuler/route.ts`, `suivi/proposition/route.ts`, `commandes/route.ts`

Chaque garde est la **toute première instruction** du gestionnaire (avant la lecture de l'identité ou du corps), avec `import { relaisSiActif } from "@/lib/api/relais";` :

| Gestionnaire | Module | Garde |
|---|---|---|
| `POST /suivi` | `suivi` | `relaisSiActif(request, "suivi", { lecture: true })` (lecture : repli permis) |
| `POST /suivi/annuler` | `suivi` | `relaisSiActif(request, "suivi", { delaiMs: 8000 })` |
| `POST /suivi/proposition` | `suivi` | `relaisSiActif(request, "suivi", { delaiMs: 8000 })` |
| `GET /commandes` | `commandes` | `relaisSiActif(request, "commandes")` |
| `POST /commandes` | `commandes` | `relaisSiActif(request, "commandes", { delaiMs: 15000 })` |

(Délais **provisoires** : ils sont fixés ici pour qu'ils existent, et réévalués d'après la mesure de la Tâche 12. Le délai de l'application mobile elle-même n'a pas été relevé : voir « Ce qui ne sera pas vérifié ».)

- [ ] **Étape 1 : Ajouter les gardes** (deux lignes chacune : `const relais = await relaisSiActif(…); if (relais) return relais;`). Vérifier route par route que le garde est bien la première instruction et que le reste du gestionnaire n'a pas bougé.
- [ ] **Étape 2 : Vérifier et enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
npm run test:unit; echo "test:unit=$?"
npm run test:cloisonnement > /dev/null; echo "cloisonnement=$?"
npm run typecheck; echo "typecheck=$?"
(cd apps/web && npx eslint src/app/api/v1; echo "eslint=$?")
(cd apps/web && npm run cf:build > /dev/null 2>&1; echo "cf:build=$?")
git add -A && git commit -m "Site : garde de relais (éteint par défaut) sur le suivi et les commandes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : tous à `0`. Rapport : pour chacune des cinq gestionnaires, la preuve que sans `API_RELAIS` (ou avec `API_RELAIS` ne nommant pas le module) le site se comporte comme avant. **Vérifier en particulier** qu'avec `API_RELAIS=public,moi,client,livraison` (le réglage actuellement en service, `docs/API-UNIQUE.md`), les modules `suivi` et `commandes` **restent éteints** : `moduleRelaye` compare des noms entiers (test existant « un nom partiel ne correspond pas »), mais `API_RELAIS=tout` allumerait ces nouveaux modules : voir Tâche 12, étape 1 (la valeur `tout` est à bannir en production avant le déploiement de ce plan).

---

### Tâche 9 : Comparateur : corps secret lu dans l'environnement

**Fichiers :**
- Modifier : `apps/api/scripts/comparateur.mjs`, `apps/api/scripts/comparer-routes.mjs`, `apps/api/tests/comparateur.test.ts`

**Pourquoi :** comparer `POST /suivi` avec un vrai jeton de suivi exige `--corps '{"jeton":"…"}'` ; or un argument de ligne de commande finit dans l'historique du terminal et la liste des processus, et le jeton de suivi est une clé d'accès. L'option `--corps-env NOM` lit le corps dans la variable d'environnement `NOM` (JSON), comme `--jeton-env` lit le jeton porteur. Elle n'affiche **jamais** la valeur (ni le message d'erreur d'une valeur invalide).

- [ ] **Étape 1 : Écrire le test qui échoue** dans `comparateur.test.ts` (relire le fichier et reprendre son aide) : (a) `--corps-env X` avec `X` définie et un JSON valide : le corps est envoyé aux **deux** serveurs (faux serveurs d'essai) et n'apparaît dans **aucune** ligne de sortie ; (b) `X` absente : code de sortie 2, message sans valeur, aucune requête ; (c) `X` contient du JSON illisible : code 2, la valeur n'est pas affichée ; (d) `--corps` et `--corps-env` ensemble : refusé (code 2) ; (e) la garde d'écriture de 1b reste appliquée : un POST exige toujours `--autoriser-ecriture` (la comparaison de `/suivi` est une lecture par POST, **mais le drapeau est conservé volontairement** : le comparateur ne sait pas distinguer, et Malika décide à chaque fois ; ne pas ajouter de drapeau « lecture seule » qui deviendrait une habitude).
- [ ] **Étape 2 : Constater l'échec, écrire le code, vérifier, enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
git add -A && git commit -m "API unique : comparateur, corps secret lu dans l'environnement (--corps-env)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Attendu : `0` et `0`.

---

### Tâche 10 : Câblage de production, essai local sous workerd, taille et CPU

**Fichiers :**
- Modifier : `apps/api/src/worker.ts`, `apps/api/src/app.ts` (si le montage n'est pas fait), `apps/api/tests/worker-source.test.ts`, `apps/api/tests/routes.test.ts`

**Interfaces :** `worker.ts` remplace les valeurs provisoires de la Tâche 2 par le vrai câblage (noms exacts à relire dans les fichiers du site avant d'écrire) :

```ts
suivi: {
  jetonValide: estJetonValide,
  limiterLecture: limiterLectureSuivi,
  lire: chargerSuiviParJeton,
  limiterAnnulation: limiterAnnulationClient,
  annuler: annulerParClient,
  limiterReponseProposition: limiterReponseProposition,
  repondreProposition,
},
commandes: {
  valider: validerCreationCommande,
  creer: (valeurs, utilisateurId, apres) => executerCreationCoeur(valeurs, utilisateurId, { antiRobot: false, apres }),
  lister: (utilisateurId) => listerMesCommandes(utilisateurId, { avecJeton: true }),
},
```

Les secrets restent lus **à l'appel** (le test statique de 1b, `worker-source.test.ts`, doit rester vert : aucune lecture de `process.env` hors fonction fléchée).

- [ ] **Étape 1 : Écrire les tests qui échouent.** (a) `routes.test.ts` : les cinq gestionnaires sont montés (une requête sur chacun ne répond pas 404 `INTROUVABLE` de route inconnue) ; (b) `worker-source.test.ts` : le source de `worker.ts` contient `antiRobot: false` (la valeur est une décision de sécurité, un test statique la fige) et ne lit pas `process.env` hors fonction fléchée ; (c) `worker-source.test.ts` : `fetch` transmet `ctx` (source contient le troisième paramètre).
- [ ] **Étape 2 : Constater l'échec, câbler, vérifier**

```bash
cd /c/Users/moelo/dev/speedfood/apps/api && npm run test; echo "test=$?"
cd ../.. && npm run typecheck; echo "typecheck=$?"
npm run build:api; echo "build:api=$?"
```

Attendu : `0`, `0`, `0` (la construction réussit et ne contient aucun fichier de Next). Relever la taille de `dist/worker.js`.

- [ ] **Étape 3 : Essai local sous workerd, lecture seule** (`npm run preparer-dev-vars` puis `npm run dev` depuis `apps/api`, port 8788 ; **les `.dev.vars` pointent la base de production : rien de ce qui suit ne doit écrire**). Avec `curl` :
  1. `POST /api/v1/suivi` avec un jeton bien formé mais **inventé** (40 caractères) : attendu 404 `INTROUVABLE` « Commande introuvable. » (lecture de `orders` en production, aucune écriture ; consomme un compteur de limitation) ;
  2. `POST /api/v1/suivi` avec un corps `{}` : 400 « Lien de suivi invalide. » ;
  3. `GET /api/v1/commandes` sans jeton : 401 « Connectez-vous pour voir vos commandes. » ;
  4. **ne pas appeler** `annuler`, `proposition` ni `POST /commandes` (écritures).
  Observer dans les journaux de `wrangler dev` : (a) aucune exception `createHmac`/`randomInt`/`crypto` au chargement ; (b) aucune ligne ne contient un jeton ; (c) le temps de réponse de (1). **Ne jamais coller un jeton dans le chat.**
- [ ] **Étape 4 : Vérifier que `randomInt` fonctionne sous workerd** sans écrire de commande : dans `wrangler dev`, une requête qui n'atteint pas l'insertion ne l'exercera pas ; si l'essai ne peut pas la couvrir, **le noter « non vérifié »** (c'est la génération de la référence `SF-XXXXX` dans `jetons.ts`) plutôt que de créer une commande.
- [ ] **Étape 5 : Enregistrer**

```bash
git add -A && git commit -m "API unique : câblage de production du suivi et des commandes (antiRobot désactivé, alerte du restaurant par waitUntil)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Rapport : taille du paquet ; ce qui a été observé sous workerd et ce qui ne l'a pas pu ; temps de réponse relevé ; absence de fuite de jeton dans les journaux.

---

### Tâche 11 : Documentation, contrôle automatique, mémoire et fusion

**Fichiers :**
- Modifier : `docs/API-UNIQUE.md`, `docs/STATUT-PROJET.md`, `docs/ORGANISATION-DU-DEPOT.md` (si une ligne change), `.github/workflows/controles.yml` (rien à ajouter : `test:api`, `build:api`, `test:unit` couvrent déjà tout ; le vérifier)
- Mémoire : `C:\Users\moelo\.claude\projects\C--Users-moelo-dev-speedfood\memory\redis-upstash-et-refonte-architecture.md`

- [ ] **Étape 1 : `docs/API-UNIQUE.md`** (chiffres vérifiés en relançant les commandes, jamais recopiés de ce plan) : les cinq gestionnaires dans la table des routes (méthode, mode de jeton, cache, service du site) ; la coupure `creation-coeur` / `creation-service` ; modules de relais `suivi` et `commandes` (variable `API_RELAIS`, valeurs permises, **`tout` à éviter** tant que tous les modules ne sont pas validés) ; les trois réglages du relais (lecture par POST, délai par route, corps conservé) ; la section « Observations sur le site » (risques 8, 9 et 10 ; D6 et D7) ; « COMMANDE_JETON_SECRET » : usage, procédure de vérification de la Tâche 12 ; **ce qui n'est pas vérifié** (reprise de la section ci-dessous) ; retirer de « Ce qui reste » ce qui est fait.
- [ ] **Étape 2 : `docs/STATUT-PROJET.md`** : section « Étape 1c-1 : fait, NON déployé, relais éteint pour `suivi` et `commandes` » (plan, vérifié contre supposé, ce qui reste : Tâche 12, 1c-2).
- [ ] **Étape 3 : mémoire** : relire le fichier, garder le frontmatter, ajouter un paragraphe « Étape 1c-1 faite le … (non déployée) » avec le plan, les cinq gestionnaires, la coupure d'`after`, le piège `COMMANDE_JETON_SECRET` (aligner l'API sur le site, jamais l'inverse), ce qui reste.
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

Attendu : tous les codes à `0`, arbre propre. Puis, **après la vague de correctifs de la relecture finale** et avec l'accord de Malika : `git push -u origin etape-1c1-suivi-et-commandes`, lire le contrôle GitHub de la branche (doit être **vert** avant toute fusion), puis `git checkout master && git merge --ff-only etape-1c1-suivi-et-commandes && git push`, relire le contrôle de `master`, supprimer la branche. **Rien n'est déployé.**

---

### Tâche 12 : Mise en service (UNIQUEMENT sur les feux verts de Malika, conduite par le contrôleur avec elle)

Cette tâche touche la production et des **secrets que seule Malika peut saisir ou lire**. Elle n'a lieu que sur sa demande explicite, **un feu vert distinct par pas** ci-dessous, jamais un seul pour tout. Chaque pas est une action dans un message, avec le résultat attendu (elle trouve les opérations compliquées). Retour arrière à tout moment : retirer le module de `API_RELAIS` (ou `API_RELAIS=non`), sans redéployer le code.

**Feu vert 0 : poser le terrain (aucune charge nouvelle).**
- [ ] **Étape 1 : Vérifier `API_RELAIS` actuel.** En service : `public,moi,client,livraison`. **Si la valeur est `tout`, la remplacer d'abord par cette liste** : sinon le déploiement du site (feu vert 1) allumerait `suivi` et `commandes` sans décision. Le noter dans la réponse à Malika.
- [ ] **Étape 2 : Parité de `COMMANDE_JETON_SECRET`** (procédure ci-dessus, points 1 et 2 : noms seulement, puis recopie par Malika du site vers l'API si besoin). Rien ne passe au feu vert 1 tant que les deux Workers n'ont pas le même état (présent des deux côtés ou absent des deux).
- [ ] **Étape 3 : Point de retour.** Noter les versions actuelles des deux Workers (`npx wrangler deployments list`, depuis `apps/web` et `apps/api`).

**Feu vert 1 : déployer le code, relais éteint pour les nouveaux modules** (un déploiement du Worker de l'API, un du site).
- [ ] **Étape 4 : Déployer l'API** (`npm run build` puis déploiement manuel : la construction juste avant est obligatoire, voir `docs/API-UNIQUE.md`), puis **le site** avec la procédure habituelle (version, vérification des pages, version 2.47.0, secrets présents). Rien ne doit changer pour les utilisateurs (`suivi` et `commandes` absents de `API_RELAIS`).
- [ ] **Étape 5 : Vérifier le Worker seul**, sans écriture : `GET /sante` ; `POST /api/v1/suivi` avec un jeton inventé → 404 `INTROUVABLE` ; `GET /api/v1/commandes` sans jeton → 401.

**Feu vert 2 : comparer, en lecture, avec de vrais jetons de Malika.**
- [ ] **Étape 6 : `POST /suivi` face à la production.** Malika crée (ou choisit) **une commande d'essai à elle** (`est_test`), place le jeton de suivi dans une variable d'environnement de **son** terminal (`--corps-env`, Tâche 9) ; `npm run comparer -- --methode POST --autoriser-ecriture --corps-env NOM … /api/v1/suivi` : `0 écart`. (`--autoriser-ecriture` est exigé par le comparateur pour tout POST ; la route est une lecture, Malika l'accepte en connaissance de cause.)
- [ ] **Étape 7 : `GET /commandes` face à la production**, avec son propre jeton porteur (`--jeton-env`, comme `moi` en 1b) : `0 écart`.

**Feu vert 3 : allumer `suivi`.**
- [ ] **Étape 8 :** `API_RELAIS=public,moi,client,livraison,suivi`. Mesurer pendant une période d'usage : temps de réponse, erreurs 1102 dans le tableau Cloudflare (Worker de l'API **et** du site), quota de sous-requêtes. Retour : retirer `suivi`.

**Feu vert 4 : allumer `GET /commandes`** (le module `commandes` couvre aussi le `POST` : ne l'allumer qu'avec le feu vert 5 ci-dessous. **Si Malika veut la lecture seule d'abord**, ajouter un module `commandes-lecture` au plan avant ce pas : à décider, voir « Questions à trancher par Malika »).

**Feu vert 5 : allumer `commandes` (création).** Conditions **toutes** réunies :
- [ ] **Étape 9 : parité du secret confirmée** (Étape 2 et, si Malika l'accepte, l'essai d'idempotence croisée : même clé d'idempotence envoyée au site puis à l'API, une commande d'essai `est_test` : seconde réponse `200`, `idempotent:true`, **même jeton de suivi**).
- [ ] **Étape 10 : mesure de la création sur l'API** (temps de calcul et durée de bout en bout d'**une** commande d'essai) : si le calcul approche les 10 ms du plan gratuit ou la durée relayée approche le délai du relais, **ne pas allumer** ; ajuster le délai (Tâche 8) ou décider du plan payant (décision de coût de Malika, jamais de l'agent).
- [ ] **Étape 11 : l'alerte « page fermée » du restaurateur** arrive bien pour la commande d'essai créée par l'API (risque 3), vérifiée par Malika sur l'appareil du restaurant d'essai.
- [ ] **Étape 12 :** `API_RELAIS=public,moi,client,livraison,suivi,commandes`. Surveiller. Retour : retirer `commandes`.

---

## Questions à trancher par Malika

1. **Un ou deux modules de relais ?** Le plan en propose deux (`suivi`, `commandes`) pour allumer la lecture avant l'écriture (D3), contre un seul module `commandes` dans la demande initiale. Et faut-il un troisième (`commandes-lecture`, pour le seul `GET /commandes`) ?
2. **Essai d'idempotence croisée** (Tâche 12, étape 9) : accepte-t-elle qu'une commande d'essai `est_test` soit écrite en production pour prouver l'égalité du secret ? Sinon `commandes` ne s'allume pas.
3. **Plan gratuit de Cloudflare** : si la mesure de la création dépasse ou approche 10 ms, l'allumage de `commandes` attend une décision de coût (plan payant) qui n'appartient qu'à elle.
4. **Délais du relais** (8 s et 15 s, provisoires) : les accepte-t-elle, sachant qu'une écriture qui dépasse le délai répond 500 alors qu'elle a peut-être abouti ?
5. **`API_RELAIS`** : confirmer la valeur actuelle en production (jamais `tout`).

## Ce qui ne sera PAS vérifié (et le plan le dit)

- **Le comportement sur Cloudflare réel** de la création de commande relayée : durée, calcul (10 ms du plan gratuit), erreurs 1102. Tout ce qui précède la Tâche 12 tourne dans workerd local ou avec de faux services.
- **`randomInt` et `createHmac` sous workerd** pour la génération de la référence et du jeton de suivi : `createHmac` est déjà exercé par les compteurs (1b) ; `randomInt` ne l'est que par une vraie création.
- **Que `ctx.waitUntil` se termine** (les 30 secondes de grâce de Cloudflare) pour l'alerte du restaurant : testé avec un faux contexte seulement. La réception réelle de l'alerte est vérifiée à la main (Tâche 12, étape 11) ou pas du tout.
- **Que le Worker de l'API n'est pas coupé quand le site abandonne l'appel** (délai du relais) : non vérifié. Si une coupure avait lieu pendant la création, une commande sans lignes pourrait exister (risque 2c).
- **L'égalité des secrets de production** : jamais lisible par un agent. Seule l'égalité de **présence** (noms) et, si Malika l'accepte, l'essai d'idempotence croisée la montrent.
- **Le délai de l'application mobile** : non relevé (`mobile/` n'a pas de délai explicite repéré dans `data/`) ; les délais du relais (8 s et 15 s) ne valent que si l'application attend au moins aussi longtemps.
- **La parité exacte de `listerMesCommandes`, `chargerSuiviParJeton`, `annulerParClient`, `repondreProposition`** avec la production, sans vrai jeton : ils sont les **mêmes fonctions** que celles du site (même source), mais leur exécution sous Workers n'est observée qu'à la Tâche 12.
- **Les écritures** (`annuler`, `proposition`, `POST /commandes`) ne sont jamais comparées à la production.
- **L'ordre des clés JSON** (le comparateur l'ignore, comme en 1b) et le message exact quand une table manque.
- **La charge** : aucun essai de charge, aucun essai concurrent.
- **Le coût du relais** dans l'offre gratuite (une sous-requête de plus par appel, deux invocations) et le gain réel pour le site : à mesurer par la Tâche 12.
- **La mémoïsation de `fonctionnaliteActive`** (`cache` de React) dans l'API : mesure de la taille et du nombre de lectures seulement.

## Auto-contrôle du plan

**Couverture de la demande :** dépendances transitives et déplaçabilité → tableau « Dépendances transitives » et Tâche 1 ; `after` → D1 et Tâche 1 ; `server-only` → déjà aliasé (1a), rien à faire ; `COMMANDE_JETON_SECRET` → section dédiée et Tâche 12 ; idempotence, écriture jamais rejouée, délai, push, anti-robot → Risques 1 à 4 et D4/D5 ; ordre des tâches (lecture seule, annuler/proposition, GET puis POST) → Tâches 3 à 6 ; mise en service en feux verts distincts → Tâche 12 ; ce qui n'est pas vérifié → section dédiée.

**Cohérence des noms :** `executerCreationCoeur`, `executerCreationCommande` (inchangé), `Planifier`, `Deps.suivi.{jetonValide, limiterLecture, lire, limiterAnnulation, annuler, limiterReponseProposition, repondreProposition}`, `Deps.commandes.{valider, creer, lister}`, `routeSuivi`, `routeCommandes`, `ctxEssai`, `relaisSiActif(request, module, { lecture?, delaiMs? })`, modules `suivi` et `commandes`, drapeau `--corps-env`. Branche `etape-1c1-suivi-et-commandes`.

**Points qui demandent de la vigilance à l'exécution :** (1) le cœur de création est une **copie conforme** de l'existant, hors l'appel de planification ; (2) l'ordre des contrôles de chaque gestionnaire, qui diffère entre le suivi (corps d'abord) et les commandes (identité d'abord) ; (3) le message d'erreur générique, différent entre `suivi` et `annuler`/`proposition` ; (4) `app.fetch` doit recevoir `ctx` ; (5) le seuil de taille de la sonde doit mordre ; (6) le garde de relais est la première instruction, et `API_RELAIS=tout` est à bannir avant le déploiement ; (7) aucune valeur de secret ni jeton de suivi dans un argument de commande, un journal ou un rapport.
