# Architecture cible de Speedfood : design (30 octobre 2026)

Statut : **design validé partie par partie par Malika le 30 octobre 2026, document en attente de sa relecture.** Aucune ligne de code de la refonte n'est écrite : seul Redis (Upstash) a été avancé, parce qu'il est indépendant du reste et déjà en service (voir §7). Le plan d'implémentation de l'étape 0 sera écrit après approbation de ce document.

## 1. Pourquoi repenser l'architecture

Malika a cité ses quatre raisons, toutes cochées : les **limites techniques** (performance et coût), la **complexité à maintenir**, une **évolution du produit** (l'application devient le canal principal) et l'envie de **repartir sur des bases saines**.

Contraintes retenues : maintenable par une seule personne ; le pilote ne s'arrête jamais (migration progressive) ; rester sur des offres gratuites tant que c'est possible ; Supabase (base, comptes, stockage) est conservé ; aucune dépense, aucun compte ni projet cloud sans consigne explicite de Malika.

## 2. Décisions prises

| # | Décision | Date |
|---|---|---|
| D1 | **Option 2** : application Expo (React Native), site Next.js allégé, API unique, paquets TypeScript partagés | 30 oct. |
| D2 | L'application React Native **remplace** l'application Kotlin (iOS et Android) ; on commence par le profil **client** | 30 oct. |
| D3 | **SQLite local** dans l'application, avec synchronisation « maison » (changements récupérés + file d'envoi) ; PowerSync écarté pour l'instant | 30 oct. |
| D4 | Actions urgentes (accepter, refuser, annuler une commande) **jamais mises en file** hors ligne | 30 oct. |
| D5 | **Redis (Upstash gratuit)** inséré tout de suite dans l'architecture actuelle | 30 oct. |
| D6 | **L'API est un Worker Cloudflare séparé** du site | 30 oct. |
| D7 | Compatibilité des anciennes applications : **au moins six mois** après chaque nouvelle version de l'API | 30 oct. |
| D8 | L'application Kotlin est **gelée** (corrections de sécurité ou de blocage seulement) dès que le client React Native la rattrape | 30 oct. |
| D9 | **Un second projet Supabase gratuit** pour essayer l'API avant de toucher aux commandes et au paiement (création sur consigne de Malika au moment voulu) | 30 oct. |
| D10 | **Le déploiement en production reste manuel**, avec le feu vert explicite de Malika ; l'automatisation ne fait que construire et vérifier | 30 oct. |
| D11 | Le site garde ses quatre métiers : commander et suivre sans installer, console du restaurateur, console de l'équipe, pages publiques | 30 oct. |
| D12 | Pas de compte Apple Developer pour l'instant : la diffusion reste l'APK depuis le site, l'iPhone reste au stade « compile et se lance dans le simulateur » | 29 oct. |

## 3. État actuel (mesuré le 29 et le 30 octobre 2026)

- **Site** : 86 000 lignes de TypeScript, 112 pages, 86 routes d'API v1, déployé sur Cloudflare Workers (OpenNext).
- **Application Kotlin** : 23 000 lignes partagées entre Android et iPhone, 91 écrans, une coque Android de 1 200 lignes. Elle lit le catalogue directement chez Supabase et passe par l'API pour le reste.
- **Base** : Supabase Postgres, région `eu-west-1`, 119 migrations, règles RLS.
- **Performance** : sur le forfait gratuit Cloudflare (10 ms de calcul par requête), les pages consomment 20 à 80 ms et subissent des erreurs 1102 dès 5 à 6 visiteurs simultanés ; les routes d'API en consomment 4 à 6 ms. Mesures du 19 et du 22 octobre 2026.
- **Redis** : actif en production depuis le 30 octobre 2026 (limitation de débit).
- **Duplication** : des règles existent deux fois (par exemple le délai de préparation en TypeScript et en Kotlin), et des fonctions existent sur une seule porte (l'annulation par le client est dans l'application, pas sur le site).

## 4. Architecture cible

Un seul dépôt TypeScript.

```
apps/
  mobile/      Expo (React Native), les trois profils : client, restaurateur, professionnel
  web/         Next.js allégé : pages publiques, commande sans installer, consoles restaurateur et équipe
  api/         Hono sur Cloudflare Workers : l'API unique
packages/
  shared/      schémas zod, types, règles métier pures (prix, statuts, disponibilité, identité), design, textes
  api-client/  client typé de l'API, utilisé par l'application et le site
supabase/      migrations et règles RLS (inchangé)
docs/
legacy/        application Kotlin, gelée puis retirée
```

Principe directeur : **le serveur décide, le téléphone se souvient.** Les prix, les statuts et les droits se décident toujours côté serveur. Le téléphone garde de quoi continuer à travailler sans réseau.

Flux : application et site passent par l'API ; l'API parle à Supabase ; le temps réel des commandes et les règles RLS restent un accès direct en défense de profondeur.

## 5. L'API unique

**Pourquoi une seule.** Unique veut dire un seul endroit pour les règles (prix, statuts, droits, limites), pas un monolithe figé pour toujours. Une seule porte évite les divergences : l'application et le site ne peuvent plus appliquer des règles différentes. Elle donne aussi un seul périmètre de sécurité, un seul contrat entre les clients et le serveur, une seule gestion de la compatibilité des anciennes applications, une seule chose à surveiller et, par construction, un calcul bien plus léger que celui des pages.

**Un Worker séparé** (`speedfood-api`) : on le déploie sans toucher au site, et un défaut de l'un n'arrête pas l'autre. Coût : un déploiement de plus à gérer.

**Découpage par modules** : catalogue, commandes, suivi, restaurateur, livraison, équipe, identité, paiement. Chaque module expose ses routes et utilise les schémas partagés.

**Chaîne de contrôles de chaque requête**, dans l'ordre :
1. limite de débit (Redis, repli sur la base) ;
2. identité (jeton Supabase vérifié localement, sans appel réseau) ;
3. droits (rôle et restaurant concerné) ;
4. validation (schémas partagés) ;
5. règle métier ;
6. journal d'audit.

**Contrat et versions.** Les formes de données sont décrites une seule fois ; l'application et le site en tirent un client typé, donc une règle qui change fait échouer la compilation des clients qui ne suivent pas. Chaque évolution garde l'ancienne forme (`/v1`, puis `/v2`) pendant **au moins six mois** (D7).

**Anciennes adresses.** Le site relaie `/api/v1/*` vers l'API pour que les applications déjà installées ne voient aucun changement.

**Catalogue.** L'API portera un point d'entrée « changements depuis tel curseur », mis en cache dans Redis avec invalidation par clé : une modification de menu efface la clé, et tous les téléphones voient la nouvelle version.

## 6. L'application React Native et SQLite

**Technologies** : Expo (React Native, TypeScript), Expo Router pour les écrans, `expo-sqlite` avec Drizzle pour décrire les tables en TypeScript, coffre du téléphone (Keychain, Keystore) pour les jetons.

**Ce que SQLite contient.**

| Rôle | Contenu |
|---|---|
| Cache du catalogue | restaurants, catégories, quartiers, menus, plats, options, avec la date de dernière lecture |
| Données de la personne | panier, favoris, adresses, profil, historique de commandes et jetons de suivi |
| File d'envoi | commande, annulation, réponse à une proposition, avis, avec clé d'idempotence |
| Instantanés | dernier statut connu de chaque commande, commandes du jour du restaurateur |

**Ce que SQLite ne contient jamais** : les jetons de connexion (coffre du téléphone), les décisions (prix, statuts, droits), les coordonnées personnelles en excès. La base locale se vide à la déconnexion.

**Tables locales (conceptuelles).** `restaurants`, `categories`, `quartiers`, `plats`, `options_plat`, `curseurs_synchro`, `panier_lignes`, `favoris`, `adresses`, `commandes_locales` et leurs lignes, `statuts_commande`, `profil_local`, `file_envoi`. La file d'envoi garde pour chaque envoi : identifiant, type, contenu, clé d'idempotence, état (en attente, en cours, envoyé, en échec), nombre d'essais, prochain essai, dernière erreur, date de création.

**Synchronisation « maison ».**
- Lecture : le téléphone demande à l'API « ce qui a changé depuis tel curseur » pour chaque table du catalogue, y compris les suppressions, puis range le résultat dans SQLite. En cas de conflit, le serveur gagne.
- Écriture : tout passe par la file d'envoi, jouée dans l'ordre vers l'API, avec une clé d'idempotence par envoi ; la réponse du serveur est la vérité.
- Données de la personne (favoris, adresses) : la dernière écriture gagne, enregistrement par enregistrement. Une commande n'a jamais de conflit : le serveur décide.

**Deux classes d'actions (D4).**
- **Mises en file, rejouées sans risque** : disponibilité d'un plat, horaires, avis, panier.
- **Jamais mises en file** : accepter, refuser ou annuler une commande. Elles tentent le réseau avec des essais visibles ; l'écran dit « en attente de réseau » sans rien promettre.

**Migrations locales** : Drizzle, avec une règle simple : les tables de cache sont jetables (on les efface et on resynchronise) ; seules la file d'envoi et les données de la personne demandent une migration soignée.

**Pourquoi pas PowerSync (aujourd'hui).** Il synchronise la base dans les deux sens et écrirait directement, ce qui contourne la validation des prix par le serveur ; il ajoute un service ; son tarif trouvé (environ 49 dollars par mois) vient d'une source secondaire non vérifiée. La porte reste ouverte si les besoins du restaurateur le justifient plus tard.

## 7. Redis (Upstash), déjà en service

Actif depuis le 30 octobre 2026 : limitation de débit groupée en une requête, avec repli automatique sur la base, interrupteur `LIMITEUR_REDIS=non`, compteur de consommation avec alertes à 70 % et 90 %. Il n'est **jamais** la source de vérité et l'application mobile ne lui parle jamais. Le cache des lectures publiques entrera avec l'API du catalogue (§5). Détail : `docs/REDIS-UPSTASH.md`.

## 8. Le site web

Il garde ses quatre métiers (D11) : commander et suivre sans installer (porte d'entrée par lien WhatsApp), console du restaurateur sur ordinateur, console de l'équipe, pages publiques. Il s'allège : les actions qui écrivent directement passent par l'API, les pages publiques sont mises en cache, et la logique métier quitte les pages. Une évolution plus tardive possible : des consoles en pages statiques parlant à l'API, pour éliminer le calcul de rendu côté serveur ; elle n'est pas décidée.

## 9. Migration par étapes

Chaque étape a une porte de sortie : on ne passe à la suivante que si les contrôles passent, avec retour en arrière possible grâce aux versions de Cloudflare.

| Étape | Contenu | Ce que voient les utilisateurs |
|---|---|---|
| 0. Fondations | Dépôt organisé en `apps` et `packages`, règles pures du site déplacées dans les paquets partagés, contrôle automatique à chaque modification | Rien |
| 1. API unique | Worker `speedfood-api` avec la chaîne de contrôles ; routes déplacées par modules, les plus légères d'abord, puis commandes et suivi ; comparaison de chaque route avec l'ancienne ; relais depuis le site | Rien |
| 2. React Native, client | Projet Expo, SQLite, dépôts de données, synchro et file d'envoi ; parcours complet du restaurant au suivi | Version bêta pour quelques testeurs, à côté de Kotlin |
| 3. Restaurateur | Console des commandes, menu, réglages, avec la règle des actions jamais mises en file | Restaurateurs pilotes sur la nouvelle application |
| 4. Livreur et équipe | Écrans professionnels actuels de l'application ; l'équipe garde le site pour les actions lourdes | Idem |
| 5. Site allégé, retraite de Kotlin | Actions du site vers l'API, pages publiques en cache, retrait de Kotlin après six mois de compatibilité | Site plus rapide |

Dès que le client React Native a la parité avec l'application Kotlin, celle-ci est gelée (D8). **Parité** veut dire : tous les parcours client de l'application Kotlin (restaurants, menu, panier, commande, suivi avec annulation, compte, historique de commandes, notifications, connexion) fonctionnent dans la nouvelle application, chacun vérifié de bout en bout, et au moins quelques testeurs l'ont utilisée sur de vrais téléphones.

## 10. Sécurité, déploiement, tests, coûts

**Sécurité.** Les secrets restent dans les secrets des Workers, jamais dans l'application. Jetons de connexion dans le coffre du téléphone. L'identité est vérifiée localement dans l'API à partir des clés publiques de Supabase ; **le type de signature exact utilisé par le projet est à confirmer à la mise en œuvre**. Garde-fous conservés : RLS, Turnstile pour les commandes sans compte, limites de débit sur Redis, journal d'audit.

**Signature de l'application.** Pour que la nouvelle application s'installe **par-dessus** l'ancienne, elle doit avoir le même identifiant de paquet (`com.speedfood.app`), être signée avec **la même clé** que l'APK actuelle (certificat `E8:1F:0A:C1:27:6F:44:5A:83:42:56:06:B3:64:7A:3D:D0:D3:7C:21:41:5D:4A:9E:78:BE:BA:E8:40:CB:1F:7C`) et porter un numéro de version plus élevé.

**Déploiement.** Contrôle automatique sur GitHub à chaque modification : types, lint, tests, cloisonnement des règles RLS, compilation. **Le déploiement en production reste manuel avec le feu vert de Malika (D10).** L'APK se construit sur GitHub sans service payant ; l'iPhone se compile sur macOS chez GitHub (déjà fait). On ne dépend pas d'Expo EAS, pour limiter comptes et quotas. Un second projet Supabase gratuit sert d'environnement d'essai pour l'API (D9).

**Tests.** Comparaison de chaque route déplacée avec l'ancienne ; règles pures testées dans les paquets partagés ; API testée directement sans réseau ; SQLite et file d'envoi testées avec de vraies bases sur ordinateur ; parcours complets sur émulateur avec un faux serveur. Règle conservée : aucune fonction n'est « livrée » sans essai de bout en bout.

**Coûts.** Aujourd'hui 0 euro (Cloudflare, Supabase, Upstash en offre gratuite). Seuils à surveiller : le quota quotidien de requêtes de Cloudflare, **partagé** entre le site et l'API ; la mise en pause de Supabase gratuit après une semaine d'inactivité ; l'absence de sauvegarde automatique côté Supabase gratuit (les exports hebdomadaires restent essentiels). Le forfait Cloudflare payant (5 dollars par mois selon les sources) lèverait la limite de 10 ms ; la décision reste celle de Malika.

## 11. Ce qui n'est pas vérifié, et les risques

- **Prix et limites des offres** (Cloudflare, Supabase, Upstash, PowerSync, Expo EAS) : relevés dans des sources secondaires ; à confirmer sur les pages officielles avant toute décision d'achat. Le comportement d'Upstash à la limite de l'offre gratuite n'est pas vérifié.
- **Relais du site vers l'API** : son coût dans l'offre gratuite de Cloudflare est à vérifier avant de s'y fier.
- **Poids et fluidité de React Native sur les téléphones d'entrée de gamme de Conakry** : à mesurer sur de vrais appareils ; aucune source ne les a testés.
- **Modules natifs** : la connexion Google, les notifications push et la connexion Facebook demandent une version « développement » d'Expo (et non Expo Go) ; leur état exact sous Expo est à vérifier à l'étape 2.
- **Double maintenance** pendant la transition : limitée par le gel de Kotlin (D8).
- **Un défaut de l'API touche l'application et le site** : atténué par les déploiements progressifs, les retours en arrière et les tests de contrat.
- **iPhone** : jamais essayé sur un vrai téléphone ; la diffusion à des utilisateurs exige un compte Apple Developer, exclu pour l'instant.

## 12. Questions ouvertes

1. Quand créer le second projet Supabase d'essai ? (Création sur consigne explicite de Malika.)
2. Faut-il un outil de suivi des plantages de l'application (par exemple Sentry, offre gratuite) ? Un service externe de plus : à décider plus tard.
3. Passer au forfait Cloudflare payant : à décider selon le trafic réel du pilote.
4. Compte Apple Developer et publication sur les magasins d'applications : reportés.

## 13. Prochaine étape

Après relecture et approbation de ce document : écrire le **plan d'implémentation de l'étape 0** (fondations), avec ses tâches, ses vérifications et sa porte de sortie.

## Sources consultées (30 octobre 2026)

Résultats de recherche web, à confirmer sur les pages officielles : [Compose Multiplatform 1.9 (web en bêta)](https://blog.jetbrains.com/kotlin/2025/09/compose-multiplatform-1-9-0-compose-for-web-beta/), [comparatif Flutter, Kotlin Multiplatform](https://shorebird.dev/blog/flutter-vs-kotlin-multiplatform), [React Native contre Flutter](https://softteco.com/blog/react-native-vs-flutter), [tarifs Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/index.md), [tarifs Supabase 2026](https://makerkit.dev/blog/saas/supabase-pricing), [expo-sqlite et synchro](https://reactnativerelay.com/article/building-offline-first-react-native-apps-2026-expo-sqlite-drizzle-orm-sync-strategies), [tarifs PowerSync](https://powersync.com/pricing), [offre gratuite Upstash](https://costbench.com/software/database-as-service/upstash/free-plan/), [Drizzle avec expo-sqlite](https://rqbv2.drizzle-orm-fe.pages.dev/docs/connect-expo-sqlite), [EAS Build sous Windows](https://expo.dev/blog/build-ios-apps-on-windows-with-cloud-simulators).
