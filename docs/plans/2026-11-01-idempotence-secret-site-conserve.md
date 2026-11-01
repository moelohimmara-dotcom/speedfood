# Proposition — idempotence avec le secret conservé sur le site

**Statut : orientation VALIDÉE par Malika le 1er novembre 2026 (message « Je valide »), essais locaux autorisés. Aucun déploiement, secret, binding ou essai TEST de production autorisé par cette validation.**

## Problème et preuves

Deux commandes TEST, SF-WMQXU et SF-SC78P, ont été créées pour le même corps de requête ; jetons différents, deux HTTP 201, code 1. Le secret de dérivation est présent sur les deux Workers mais son égalité n’est pas vérifiable depuis les noms affichés. Malika a indiqué ne pas avoir conservé sa valeur originale. La divergence reste une hypothèse principale ; une différence de code réellement déployé n’est pas exclue.

Le site conserve ses valeurs actuelles. Aucune lecture de fichier de secrets, récupération de valeur chiffrée, rotation, export de secret, nouvelle table ou migration n’est prévue. Le verrou de l’essai échoué reste conservé. Les deux commandes TEST ne sont ni supprimées ni annulées automatiquement.

## Décision proposée

Centraliser la dérivation du jeton sur speedfood-app, via un point d’entrée RPC nommé réservé à une liaison de service depuis speedfood-api. Le secret reste dans l’environnement du site ; seul le jeton dérivé nécessaire à la création revient à l’API, en mémoire. Ce jeton est une clé d’accès et reste exclu des journaux, adresses, arguments, captures et rapports.

Parcours proposé : client identifié → API (identité stricte, validation, plafonds) → calcul interne sur le site → création et prix côté API → réponse habituelle. La route du site et le calcul interne utilisent exactement la même fonction pure de dérivation. Aucun appel à la route publique POST commandes du site : pas de rebond site → API → site sur cette route, ni de boucle de relais. Le site ne crée aucune commande pendant le calcul interne.

Le point d’entrée RPC est distinct du fetch public. Aucun endpoint HTTP de signature, aucun paramètre permettant de choisir un secret, un préfixe HMAC ou une destination, aucun export de valeur secrète. Seule la liaison API vers cette méthode précise est prévue. L’accès à cette liaison est une capacité sensible et doit être explicitement autorisé au déploiement.

Le code du site possède déjà un point d’entrée manuel apps/web/worker-entree.js qui délègue à OpenNext et réexporte ses classes. Cloudflare documente les exports nommés WorkerEntrypoint en plus du gestionnaire principal. **La compatibilité de notre emballage OpenNext avec cet ajout doit être prouvée localement ; elle n’est pas tenue pour acquise.**

Sources primaires :
- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/
- https://developers.cloudflare.com/workers/runtime-apis/rpc/visibility/

## Sécurité et comportements imposés

- L’API vérifie le jeton porteur via le vérificateur strict avant tout appel RPC. La méthode interne accepte seulement une clé d’idempotence de la forme existante, jamais un texte arbitraire à signer. Aucun identifiant de compte reçu du navigateur ne remplace l’identité vérifiée.
- Le calcul pur conserve strictement le préfixe, l’encodage, la longueur et la priorité de secret actuels. Aucun changement du jeton pour une même clé traitée par le site. Utiliser le secret effectif du site au moment de l’appel, pas une valeur construite à la compilation. La sélection actuelle COMMANDE_JETON_SECRET sinon service-role est conservée, sans suppression silencieuse du repli historique.
- Injecter le fournisseur asynchrone de jeton dans le service interne de création pour l’API ; le chemin site conserve son calcul actuel. Aucun champ du payload public n’accepte un jeton préfabriqué ni le choix du fournisseur.
- Liaison absente, invalide, délai dépassé, réponse mal formée : refuser la création API AVANT insertion, avec une erreur fixe sans détail sensible. Aucun repli vers le secret API divergent, vers une deuxième création locale ou vers une autre cible. Aucun rejeu automatique d’écriture.
- La méthode de calcul ne dispose d’aucune opération d’écriture métier. Un éventuel nouvel appel de calcul ne doit pas être confondu avec une nouvelle tentative de création ; le premier lot ne programme aucune relance automatique.
- Après obtention du jeton, conserver les contrôles existants : commande existante appartenant au même compte et au même restaurant, prix serveur entiers GNF, droits serveur, TEST décidé côté serveur, contrainte d’unicité et gestion des accès concurrents.
- Tests obligatoires sur deux utilisateurs et deux restaurants, sur les champs supplémentaires forgés, sur les appels HTTP externes à la méthode et sur l’absence de journalisation des clés d’accès. Ne pas créer un service général de signature utilisable par d’autres routes.
- Ce lot ne centralise pas les empreintes de limitation, qui utilisent aussi ce secret. Les compteurs distribués entre les Workers restent un point à analyser lors du chantier limiterParRequete ; ne pas prétendre les avoir unifiés.

## Alternatives et raisons

| Option | Conséquence | Avis |
| --- | --- | --- |
| Conserver uniquement la création sur le site et suspendre son portage | Aucun changement immédiat, API de création toujours impropre au relais | Position sûre actuelle, ne termine pas 1c-1 |
| Faire calculer le jeton par le site via RPC | Garde le secret et le schéma, ajoute une dépendance interne par création/rejeu | Recommandée sous réserve de preuve technique et validation |
| Faire créer toutes les commandes par le site derrière l’API | Conserve aussi les notifications du site mais maintient le traitement métier/CPU dans Next | Repli à arbitrer si RPC de calcul impraticable ; pas implémenté silencieusement |
| Introduire une clé d’idempotence persistée indépendamment du secret | Migration de schéma et reprise de l’historique, transaction et RLS à revoir | Hors petit lot et schéma gelé ; décision distincte |
| Remplacer les secrets par une nouvelle valeur commune | Affecte les QR, compteurs et anciens rejeux ; rotation à organiser | Écartée pour ce lot |

Un transfert automatisé du secret vers l’API demanderait des droits de gestion supplémentaires et un mécanisme manipulant sa valeur en production. Aucun endpoint d’export ni jeton Cloudflare privilégié n’est proposé.

## Limites et risques à accepter

1. L’API dépend du site pour le calcul : une panne du site bloque ses nouvelles créations. Les autres modules API ne dépendent pas de ce nouvel appel. La cible d’API entièrement autonome n’est donc pas atteinte ; cette exception doit être consignée dans la décision d’architecture si acceptée.
2. Chaque création ou rejeu API ajoute une invocation interne. Mesurer latence, CPU et consommation de quotas ; aucun coût nul ni maintien certain dans le plan gratuit n’est promis. Aucun forfait ou service créé.
3. Les commandes déjà créées via l’API avec son ancien secret ont une dérivation historique différente. La clé d’idempotence d’origine n’étant pas conservée dans le verrou d’essai, on ne peut pas annoncer une réparation rétroactive. Inventorier les créations API antérieures avant activation ; ne pas rejouer leurs clés. Les liens de suivi stockés restent inchangés. Pour SF-WMQXU/SF-SC78P, conserver les références et ne pas nettoyer automatiquement.
4. Les alertes API restent un chantier séparé : la configuration visible ne contient pas FCM_SERVICE_ACCOUNT ni VAPID_PRIVATE_KEY. Le calcul délégué ne résout pas cette absence. La mise en service reste bloquée jusqu’au contrôle réel de l’alerte.

## Petits lots, après validation d’architecture

### Lot A — preuve locale sans secret réel

Objectif : démontrer une liaison API → entrée nommée sur une copie d’essai locale, avec des valeurs fictives uniquement ; démontrer que le fetch public ne permet pas d’invoquer la méthode. Aucun nouvel environnement cloud. Vérifier empaquetage, appels RPC et délais sous le runtime Cloudflare local. S’il est impossible de prouver la compatibilité OpenNext, arrêter et présenter le résultat avant de coder la suite.

Fichiers prévus : petit banc d’essai local versionné sous apps/api/tests/ ou apps/api/scripts/, tests de liaison dédiés. Le choix définitif est ajusté à la preuve, sans toucher au Worker de production à ce stade.

### Lot B — calcul partagé et injection interne

Objectif : même dérivation sur les deux portes, écriture API refusée si le calcul interne échoue.

Fichiers envisagés : apps/web/src/lib/commande/jetons.ts ; un module pur de calcul voisin ; apps/web/src/lib/commande/creation.ts ; apps/web/src/lib/commande/creation-coeur.ts ; apps/api/src/types.ts ; apps/api/src/worker.ts ; apps/api/src/routes/commandes.ts si nécessaire pour un refus explicite ; tests associés. La signature exacte d’injection doit empêcher la construction d’un jeton depuis un champ du navigateur. Aucun accès à Next dans le bundle API.

### Lot C — entrée interne et garde de mise en service

Fichiers envisagés : apps/web/worker-entree.js ; module RPC dédié sans import Next ; apps/api/wrangler.jsonc pour une liaison nommée vers le Worker EXISTANT speedfood-app ; garde explicite de POST commandes API, éteinte par défaut ; tests et documentation.

Préserver micro-cache, assets, exports OpenNext, email planifié et routes existantes. La liaison doit appeler le calcul pur, pas le moteur OpenNext. Elle reçoit uniquement les paramètres indispensables, validés.

Cycle de chaque lot de code : test rouge → code → vert → mutation réelle détectée → restauration → relecture spécification/qualité → commit etape-*. Contrôles requis : types, tests unitaires, cloisonnement, API, build API ; ESLint et build Cloudflare du site pour les lots concernés. Les commandes de build qui lisent des fichiers interdits ne sont pas exécutées par l’agent : préparation ou exécution locale par Malika à organiser sans contourner le contrôle verifier-base. Aucun résultat annoncé avant exécution à code 0.

## Cas d’acceptation à prouver

- Même clé et même secret fictif : mêmes 40 caractères sur le chemin site et le chemin API ; des secrets fictifs API différents ne changent plus le résultat API lorsque la liaison est utilisée.
- Rejeu site → API et API → site : une seule insertion, même référence, même jeton, second appel 200 idempotent true, sans nouvelle alerte. Tester aussi deux requêtes concurrentes, avec la contrainte réelle d’unicité dans un environnement local/test autorisé ; de simples faux services ne prouvent pas le comportement SQL.
- Même clé avec compte ou restaurant différent : refus sans fuite de jeton.
- API non autorisée, payload invalide, RPC absent/en panne/lent ou réponse mal formée : aucune insertion, aucun deuxième POST automatique, aucun calcul de repli avec le secret API.
- Module relais éteint : site inchangé ; garde de création API éteinte : POST API refusé, GET et autres modules disponibles. Aucun appel circulaire.
- Valeurs fictives distinctives absentes des sorties et erreurs ; pas de clé ni jeton dans URL, cache ou arguments.
- Contrôler en bout en bout l’alerte après une création neuve, séparément du rejeu et seulement après autorisation d’un essai TEST réel.

## Mise en service proposée — un feu vert par action

0. Avant production, consigner les versions, l’état des bindings et un retour arrière répétable sans connaître les valeurs secrètes. Ne pas supposer qu’un ancien déploiement restaure correctement les bindings. Inventorier l’historique API et préparer l’arrêt de POST commandes API.
1. Malika déploie l’entrée nommée sur le site après contrôles et feu vert distinct. La liaison API n’est pas activée ; aucun changement de secret ou de relais.
2. Malika déploie le câblage API avec POST commandes bloqué par défaut, puis configure la liaison sur autorisation explicite. Contrôle sans insertion avec paramètres invalides et valeurs de test locales ; aucune méthode de diagnostic retournant un secret.
3. Configuration des alertes et mesures : plan distinct, aucune copie ni génération automatique de credentials. Mise en service suspendue si les préconditions ne sont pas remplies.
4. Autorisation distincte de la garde API, puis autorisation distincte d’un nouvel essai TEST borné, avec nouveau verrou séparé. Ne jamais effacer celui de l’échec. Tant que ce contrôle n’est pas passé, ne pas ouvrir un usage mobile réel de cette création API.
5. Seulement après succès, alerte reçue et CPU contrôlé, Malika arbitre l’allumage de commandes. Aucune de ces actions n’est autorisée par l’acceptation du présent plan.

## Retour arrière sûr

Bloquer d’abord POST commandes API et retirer commandes du relais si ce module a été allumé, chaque action exécutée par Malika avec son feu vert. Le site continue ses créations avec son secret actuel ; les lectures restent disponibles selon les contrôles effectués. Ne jamais remettre en service la création API utilisant son ancien secret divergent comme solution de repli. Maintenir le calcul interne du site tant qu’un appelant API actif en dépend. Retirer la liaison et l’entrée nommée seulement une fois les appels arrêtés. Aucune commande, aucun jeton stocké et aucun secret n’est supprimé.

Le retour arrière restaure une exploitation où la création passe par le site, pas l’autonomie complète de l’API. Il ne fusionne pas les deux commandes d’essai.

## Décision attendue

Malika valide ou refuse cette exception à l’autonomie API et la préparation locale des lots A à C. En cas d’accord, inscrire la décision dans le registre ADR avec les limites ci-dessus. Aucune mise en production n’est incluse. Le développement mobile conserve son ordre de feuille de route ; aucune date n’est promise par cette proposition.

## Lot A — première preuve locale obtenue le 1er novembre 2026

- Banc versionné : apps/api/tests/rpc-site-local.test.ts et fixture apps/api/tests/fixtures/rpc-calcul-essai.mjs. Le test assemble en mémoire le vrai worker-entree.js, ses dépendances de micro-cache et SMTP, puis lui ajoute une entrée RPC fictive. Le module OpenNext généré est remplacé explicitement par un faux ; aucun .env, .dev.vars ou fichier de secrets lu. Aucun fichier de production modifié.
- Deux Workers locaux tournent dans workerd via Miniflare 5.20260926.0-alpha déjà fourni par Wrangler ; l’adaptateur convertV4MiniflareOptions installé est utilisé. Une valeur fictive distincte existe de chaque côté. L’API appelle l’entrée nommée du site ; le jeton correspond au HMAC calculé indépendamment sous Node avec la valeur fictive du site. Même clé : même résultat ; autre clé : autre résultat ; clé invalide : refus 503 fixe ; appel HTTP direct au chemin de calcul : 404 du faux OpenNext. Aucun jeton imprimé lors du passage réussi.
- Test rouge initial à code 1 (fixture absente), puis vert à code 0. Mutations : longueur 40 → 39 et suppression du refus des clés invalides, chacune détectée à code 1. Fixture restaurée, test vert à code 0. Relecture spécification : secret non exporté, cible de liaison fixée, aucune écriture. Relecture qualité : instance Miniflare toujours fermée dans finally, délai maximal de test de 30 secondes, vérification runtime du fetch (types Fetcher incorrects dans cette version alpha).
- Suite API finale : **239 tests, 239 réussis, code 0** ; build API **code 0**, toujours 1 165 Kio. Types sur la version finale : **code 0**. Le bac à sable refusait les connexions localhost (EACCES) ; les tests de runtime ont été exécutés avec l’autorisation d’ouverture locale, pas en ignorant un test.
- **Limite : preuve de coexistence du wrapper réel et d’une entrée nommée avec OpenNext FACTICE ; pas preuve du vrai bundle OpenNext ni de la production.** Le calcul de la fixture n’est pas le futur module métier partagé. Pas de test SQL ni de bout en bout de création, de panne RPC, de coût de production ou de notification. Aucune fonction RPC ajoutée au site déployable, aucune garde métier modifiée.
- Retour arrière de ce lot : retirer seulement le banc et sa fixture ; aucun état métier créé, aucun réglage à restaurer. Prochaine étape : lots B/C avec intégration du calcul partagé, refus sûr, tests de sécurité et vérification de l’empaquetage réel avant toute proposition de déploiement.

## Lots B/C — intégration locale préparée, pas de mise en production

Le calcul partagé est maintenant dans apps/web/src/lib/commande/jetons-calcul.ts. Le chemin site garde sa priorité de secret et appelle ce calcul. Le format accepte la clé UUID v4 historique et son préfixe panier-. Le service de création reçoit un fournisseur asynchrone uniquement via une option serveur ; aucun champ public ne peut le fournir. Échec ou réponse invalide : arrêt avant l’ouverture de la base. Les vérifications de compte et restaurant du rejeu sont conservées.

L’API transmet l’environnement natif c.env au câblage de production. Le fournisseur apps/api/src/commandes/jeton-interne.ts exige **CREATION_COMMANDE_API=oui** et la liaison **SITE_JETONS**, sinon refuse avec un message fixe. Délai de calcul de 3 secondes, un seul appel, aucune création ni calcul de repli avec le secret API. Les erreurs sont expurgées par le cœur existant (ERREUR_SERVEUR / HTTP 500) ; le 503 du banc d’essai n’est pas le statut métier actuel. Les plafonds existants sont vérifiés avant le calcul.

Le site exporte la classe RPC **JetonsCommande** depuis worker-entree.js ; son implémentation worker-jetons.js lit l’environnement du site et calcule sans import Next ni accès en base. La configuration API contient une liaison nommée vers le Worker EXISTANT speedfood-app. Elle n’est pas installée en production par l’édition du fichier. Le garde-fou d’activation est absent par défaut. Déployer le site avant toute API référençant cette nouvelle entrée ; les autorisations par action restent requises.

Le banc workerd utilise désormais **le vrai calcul partagé, la vraie classe RPC et le vrai fournisseur API**, avec des valeurs fictives distinctes. Quatre Workers locaux vérifient calcul, répétition, différence de clé, entrée invalide, accès HTTP public, garde éteinte et liaison absente. **Le moteur OpenNext reste factice.** La fixture RPC du lot A a été retirée pour éviter de tester une copie du calcul. Une incompatibilité réelle d’appel RPC a été détectée : détacher la méthode puis utiliser .call ne convient pas dans workerd ; l’appel direct sur la liaison fonctionne et est désormais testé.

Nouveaux tests : sept sur calcul/fournisseur ; trois sur le vrai service de création avec base en mémoire (pas du SQL réel) ; un sur la transmission des dépendances du cœur ; un sur la provenance serveur de l’environnement dans la route. Les faux services ne prouvent ni l’unicité SQL concurrente ni une nouvelle création complète. Quatre mutations ont été exécutées et détectées à code 1 : longueur 40 → 39, suppression de la garde, suppression de la validation de réponse RPC, perte de transmission du fournisseur par le cœur. Restauration puis tests ciblés à code 0.

Contrôles : suite API **251/251, code 0** ; types **code 0** ; tests unitaires site **code 0**, aucune occurrence exacte ECHEC dans leur journal ; cloisonnement **489 contrôles, code 0** ; build API **1 167 Kio, code 0**, sans Next dans le paquet ; ESLint des fichiers web modifiés **code 0**. ESLint complet : **code 0**, 0 erreur et 31 avertissements préexistants.

Relecture spécification : règle de dérivation inchangée pour les clés valides, entrée spécialisée sans HTTP de signature, fournisseur jamais lu du corps, identité stricte avant service, pas de tentative automatique, site opérationnel avec son chemin historique. Relecture qualité : erreurs fixes, liaison lue à l’appel, minuterie libérée, appel RPC natif direct, aucun secret stocké ou journalisé. Les tests vérifient les effets en dehors des callbacks dont les erreurs sont volontairement capturées, pour qu’une assertion ne soit pas avalée par le code métier.

**Reste requis avant toute mise en ligne :** cf:build réel du site, essai avec le vrai moteur OpenNext, contrôle SQL/concurrence dans un environnement autorisé, historique API, stratégie de retour arrière de la configuration et alertes. Le script cf:build appelle verifier-base.mjs qui lit .env.local : l’agent ne l’a pas exécuté et n’a pas contourné ce contrôle. Malika peut lancer elle-même la compilation et le contrôle en lecture de la base, sans déployer. Aucun succès de fonctionnalité en production n’est annoncé.

Retour arrière de préparation : revenir sur le lot local. Si une mise en service est ultérieurement autorisée, bloquer d’abord la création API (garde absente/non oui), retirer commandes du relais si allumé, conserver le site et son secret ; ne pas rétablir le chemin API divergent comme service de création. La liaison reste tant que des appels autorisés en dépendent. Aucun secret ni commande supprimé.

## Contrôle après compilation réelle par Malika — 1er novembre 2026

Malika a transmis la fin de cf:build : « Worker saved in .open-next\worker.js » et « OpenNext build complete ». Le code de sortie n’est pas explicitement présent dans cette sortie utilisateur. Les dates du BUILD_ID et du handler généré confirment une génération locale du 1er novembre vers 12 h 28–12 h 29. L’avertissement OpenNext sur le support expérimental du middleware Node reste visible ; ne pas le confondre avec un échec de compilation ni le déclarer résolu. Aucun fichier .env/.dev.vars lu par l’agent.

Assemblage Wrangler 4.142.0 effectué par l’agent en **dry-run**, depuis C:/Users/moelo/dev/diagnostic-workers-20261101 avec configuration minimale publique, fichier d’environnement vide explicite et chargement dotenv désactivé. Pas d’upload de Worker : la sortie dit « --dry-run: exiting now. ». **Code 0**. Paquet local : 22 441,68 Kio / gzip 4 826,75 Kio selon Wrangler. Ces tailles ne prouvent ni le respect des limites du forfait actuel ni le démarrage en production ; forfait non contrôlé ici. Deux modules WebAssembly sont conservés par l’assembleur.

Le test apps/api/tests/rpc-site-local.test.ts possède désormais un mode explicite SPEEDFOOD_ESSAI_OPENNEXT_REEL=oui. Il charge le vrai paquet Wrangler préparé dans le dossier isolé, refuse un paquet contenant le faux moteur, utilise des valeurs fictives et bloque le réseau sortant du Worker site. Sans ce mode, le test standard reste fondé sur OpenNext factice et ne peut pas être cité comme preuve de démarrage du site complet. Le mode réel n’appelle pas de page métier OpenNext par HTTP.

**Résultat du mode réel : code 1**, ERR_RUNTIME_FAILURE au démarrage du service site-local, message workerd « internal error » sans cause déterminée. Avant Wrangler, un assemblage naïf par esbuild avait aussi échoué (adaptations Node et modules WASM non pris en charge par ce banc) ; cet échec du banc ne doit pas être attribué à cf:build.

Contre-épreuve : une copie du même wrapper, avec seulement le nouvel export JetonsCommande retiré, a été assemblée séparément par Wrangler dry-run, **code 0**, puis chargée dans workerd avec valeurs fictives, mêmes date/indicateurs et réseau sortant bloqué. **Échec de démarrage également, code 1.** Ce contrôle retire l’export RPC, pas tous les autres changements du lot ni le code Next nouvellement généré : il montre que l’export seul n’explique pas l’échec, pas que le problème était présent avant ce lot. Aucun déploiement ni appel métier de production.

Commandes du test réel (PowerShell, uniquement après préparation du paquet isolé) :

    $env:SPEEDFOOD_ESSAI_OPENNEXT_REEL='oui'
    node --experimental-strip-types --test tests/rpc-site-local.test.ts

À exécuter depuis apps/api. Le mode échoue volontairement si le paquet préparé manque ou ne démarre pas ; aucun remplacement automatique par un faux. Pour revenir au mode standard dans ce même terminal, retirer cette variable avec Remove-Item Env:SPEEDFOOD_ESSAI_OPENNEXT_REEL. Aucun de ces réglages n’agit sur la production.

**Conclusion : compilation rapportée terminée, assemblage sec vérifié ; démarrage du paquet complet NON validé.** Aucun feu vert de déploiement demandé. Prochain diagnostic : isoler les besoins d’initialisation et de simulation OpenNext/miniflare, sans ouvrir le réseau de production ni charger de secrets réels. Les validations métier (SQL concurrent, historique API, alertes, vrai essai TEST borné) restent nécessaires ensuite.

## Démarrage du vrai paquet OpenNext — cause trouvée et résolue localement (1er novembre 2026, après-midi)

- **Cause de l'échec « internal error » : le banc, pas le paquet.** Le vrai paquet importe deux modules `.wasm` (resvg, yoga). Le banc ne chargeait que le fichier principal, sans ces modules typés `CompiledWasm`. Miniflare 5 alpha refuse l'option `modulesRules` ; le banc passe donc la liste explicite des modules (fichier principal en `ESModule`, chaque `.wasm` en `CompiledWasm`) et ajoute le drapeau `global_fetch_strictly_public` du vrai `wrangler.jsonc`, uniquement en mode réel.
- **Résultat :** `SPEEDFOOD_ESSAI_OPENNEXT_REEL=oui`, test `rpc-site-local`, **code 0** : le paquet complet démarre dans workerd, l'API appelle l'entrée nommée `JetonsCommande`, le jeton est celui du secret factice du site, la clé invalide est refusée, et les liaisons absente ou éteinte refusent.
- **Mutation :** le même test pointé sur le paquet sans l'export RPC (`worker-sans-rpc.js`) échoue à code 1 (démarrage impossible) ; restauration puis code 0. Suite API standard 257/257, types à code 0.
- **Toujours NON vérifié :** création de bout en bout via l'API avec le calcul du site, SQL concurrent, panne RPC en production, coût CPU/invocation supplémentaire, alertes du restaurateur (FCM/VAPID absents de l'API), historique des clés de l'API. Aucun déploiement, secret ni relais modifié.

## Reprise du 1er novembre 2026 (soir) — décision Malika : débloquer `commandes` via ADR-021

- **Décision :** poursuivre OpenNext / ADR-021 avant tout autre chantier pour débloquer l’activation de `commandes`.
- **Recontrôle local OpenNext réel :** `SPEEDFOOD_ESSAI_OPENNEXT_REEL=oui`, `tests/rpc-site-local.test.ts`, **code 0** (1 test, ~5 s). Cause `.wasm` / `CompiledWasm` toujours valable. Suite standard déjà à 257/257 plus tôt dans la session.
- **État code :** lots A/B/C locaux prêts sur la branche ; `CREATION_COMMANDE_API` absente par défaut ; `commandes` hors `API_RELAIS` ; aucun secret ni relais modifié cette reprise.
- **Prochaine mise en service (un feu vert Malika par pas), ordre du plan § « Mise en service proposée » :**
  1. Compiler + déployer le **site** avec l’export `JetonsCommande` (pas de liaison API, pas de garde allumée, pas de changement de `API_RELAIS`).
  2. Déployer l’**API** avec câblage ADR-021, garde `CREATION_COMMANDE_API` **éteinte** (POST création refusé).
  3. Poser / confirmer la liaison `SITE_JETONS` (feu vert distinct).
  4. Alertes FCM/VAPID côté API + inventaire des créations API antérieures (préconditions séparées).
  5. Allumer la garde, nouvel essai TEST d’idempotence croisée (nouveau verrou), puis seulement après succès : `commandes` dans `API_RELAIS`.
- **Retour arrière immédiat si le site casse après l’étape 1 :** redéployer la version site précédente (sans toucher aux secrets).
