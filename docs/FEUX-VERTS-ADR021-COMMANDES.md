# Feux verts pour débloquer la création de commande par l'API (ADR-021)

**Préparé le 1er novembre 2026. Rien de ce document n'a été exécuté. Aucun agent ne lance ces commandes : c'est Malika qui les exécute, un feu vert à la fois.** Ordre issu de [plans/2026-11-01-idempotence-secret-site-conserve.md](plans/2026-11-01-idempotence-secret-site-conserve.md) (§ « Mise en service proposée ») et de [PASSATION-REFONTE.md](PASSATION-REFONTE.md) (§ 2).

Règles de sécurité qui s'appliquent à chaque pas : aucune valeur de secret dans le chat, un fichier ou une commande visible (les `wrangler secret put` demandent la valeur à l'invite) ; `API_RELAIS=tout` interdit en production ; aucune commande réelle de client pendant les essais (commandes `est_test` seulement) ; on s'arrête au premier résultat inattendu.

## Ce qui bloque encore, côté code (à lever avant les feux verts 5 et 6)

1. **Alerte « nouvelle commande » du restaurateur** : AUCUN secret d'envoi (FCM, VAPID) à copier sur l'API, aucune variable `SITE_URL`, aucun appel HTTP public. Les secrets restent sur le site ; l'API, après une création NOUVELLE (jamais sur rejeu idempotent), appelle la méthode RPC `alerter` de la liaison `SITE_JETONS` déjà prévue, et le site envoie l'alerte après le retour de la RPC. `worker-entree.js` refuse en 404 toute requête externe vers `/api/v1/interne/*`. Le feu vert 1 (site, qui porte `alerter` et la garde) doit être déployé AVANT le feu vert 2 (API). Code et tests locaux faits ; envoi réel FCM/VAPID sous Cloudflare, délai du saut et CPU non prouvés : vérification au feu vert 5 (alerte reçue par le restaurateur d'essai).
2. **Temps de calcul (CPU) de la création sur l'API** : jamais mesuré sous Cloudflare réel. Plan gratuit : 10 ms de CPU par requête. Si la mesure s'en approche, ne pas allumer ; passer au plan Workers payant (5 $/mois) est une décision de coût qui vous appartient.
3. **Égalité des VALEURS de `COMMANDE_JETON_SECRET`** : avec ADR-021 l'API ne calcule plus jamais le jeton elle-même, elle le demande au site (liaison `SITE_JETONS`). Le risque du secret divergent disparaît donc **si** la liaison est en place ; l'essai d'idempotence croisée (feu vert 5) le prouve par le comportement.
4. Le code ADR-021 est sur la branche `etape-adr021-deblocage-commandes` (49 commits d'avance sur `master`) : il faut le fusionner avant de compiler ce qui part en production (feu vert 0).

## Feu vert 0 — fusionner la branche dans `master` (action de Malika)
Pousser `master` est interdit à un agent sans votre accord. À faire par vous, après relecture de la liste des commits :

```bash
git fetch origin
git log --oneline origin/master..origin/etape-adr021-deblocage-commandes
```

Puis fusion via GitHub (demande de fusion, contrôles verts) ou en local. Les contrôles GitHub (tests, typage) doivent être verts avant.

## Feu vert 1 — déployer le SITE avec l'entrée `JetonsCommande`
Effet : le site expose le calcul du jeton à l'API uniquement par liaison interne ; **aucune liaison API n'est encore posée, aucune garde allumée, `API_RELAIS` inchangé**. Aucun changement visible pour les clients.

Avant : noter la version actuelle (retour arrière) :
```bash
cd apps/web && npx wrangler deployments list --name speedfood-app
```
Déployer (4 à 5 minutes) :
```bash
cd apps/web && npm run cf:deploy
```
Contrôler : accueil 200, `/api/v1/version` 200, `/installer` 200, `/api/v1/commandes` sans connexion → 401. Vérifier aussi que `https://speedfood-app.moelohimmara.workers.dev/JetonsCommande/deriver` ne renvoie **aucun** jeton (la capacité ne doit pas être joignable par HTTP public ; le banc local l'a vérifié, pas la production).
Retour arrière : redéployer la version précédente notée plus haut, sans toucher aux secrets.

## Feu vert 2 — déployer l'API avec la création BLOQUÉE
Effet : l'API reçoit le code ADR-021. La garde `CREATION_COMMANDE_API` est absente : `POST /commandes` reste refusé. Le site doit être déployé avant (la liaison `SITE_JETONS` vise l'entrée créée au feu vert 1 ; sans elle le déploiement échoue).

Avant : version actuelle de l'API (retour arrière) :
```bash
cd apps/api && npx wrangler deployments list --name speedfood-api
```
Construire, contrôler, déployer (commande de déploiement à confirmer au premier usage : `wrangler.jsonc` pointe sur `dist/worker.js` sans réassemblage) :
```bash
npm run test:api
npm run build:api
cd apps/api && npx wrangler deploy
```
Contrôler sans rien écrire : `/api/v1/version` 200 ; `POST /api/v1/commandes` sans connexion → 401 ; avec un compte d'essai et un corps invalide → refus de validation, **pas** d'insertion.
Retour arrière : redéployer la version précédente de l'API.

## Feu vert 3 — confirmer la liaison `SITE_JETONS`
La liaison est déjà déclarée dans `apps/api/wrangler.jsonc` et se pose avec le déploiement du feu vert 2. Vérifier seulement (lecture) qu'elle apparaît dans le tableau de bord Cloudflare, Worker `speedfood-api` → Paramètres → Liaisons : service `speedfood-app`, entrée `JetonsCommande`. Rien d'autre à faire ; ce pas existe pour qu'une liaison absente soit constatée avant d'allumer.

## Feu vert 4 — préconditions : alertes, mesure CPU, inventaire
- Alerte restaurateur : passe par la RPC `SITE_JETONS.alerter` du site (voir « Ce qui bloque » 1) ; rien à poser de plus ; l'alerte elle-même se constate au feu vert 5.
- Inventaire des commandes créées auparavant par l'API (historique) : à demander à l'agent en lecture seule sur la base ; ne rien supprimer.
- Mesure CPU : lire dans Cloudflare → `speedfood-api` → Metrics (CPU time, p50/p99) pendant l'essai du feu vert 5.
Mise en service **suspendue** tant que ces conditions ne sont pas remplies.

## Feu vert 5 — allumer la garde et faire l'essai d'idempotence croisée
Effet : l'API peut créer une commande en demandant le jeton au site. **Pas encore relayé** : les clients et l'application n'y passent pas.

Allumer la garde (la valeur se saisit à l'invite, seule la valeur `oui` allume) :
```bash
cd apps/api && npx wrangler secret put CREATION_COMMANDE_API
```
Essai TEST borné, avec un restaurant d'essai et une commande `est_test` : envoyer **la même clé d'idempotence** d'abord au site (relais éteint pour `commandes`), puis à l'API. Attendu : seconde réponse 200, `idempotent: true`, **même jeton de suivi** ; une seule commande en base ; alerte reçue par le restaurateur d'essai ; CPU de l'API relevé. Nouveau verrou d'essai séparé de celui de l'échec précédent (ne jamais effacer ce dernier).
Retour arrière immédiat : bloquer la garde :
```bash
cd apps/api && npx wrangler secret delete CREATION_COMMANDE_API
```

## Feu vert 6 — ajouter `commandes` au relais (le plus sensible)
Seulement si tout le reste est passé. Valeur actuelle de `API_RELAIS` : `public,moi,client,livraison,suivi`. Nouvelle valeur : `public,moi,client,livraison,suivi,commandes` (jamais `tout`) :
```bash
cd apps/web && npx wrangler secret put API_RELAIS
```
Contrôler : une commande TEST depuis l'application, puis `npx wrangler tail speedfood-app --format json` et les métriques (erreurs 1102 = limite de CPU).
Retour arrière immédiat, sans redéployer : remettre la valeur précédente (sans `commandes`) avec la même commande. En dernier recours seulement : `non` éteint tout le relais.

## Après chaque feu vert
Noter dans `docs/STATUT-PROJET.md`, `docs/API-UNIQUE.md` et la mémoire : ce qui est allumé, les mesures, ce qui est vérifié. Supprimer enfin `apps/api/.dev.vars` (contient une clé de production ; ne jamais l'ouvrir).

## Alerte du restaurateur : état au 2 novembre 2026
Construite (code, tests, relecture indépendante en trois tours, verdict « prêt » comme étape éteinte) : l'API appelle `SITE_JETONS.alerter(restaurantId)` ; le site envoie l'alerte après la réponse. Aucun secret d'envoi sur l'API, aucune route publique (`/api/v1/interne/*` répond 404 à l'extérieur).
**À vérifier au feu vert 5 (non prouvé hors Cloudflare réel) :** `after` de Next rattaché au contexte de la RPC et envoi qui survit au retour ; CPU et démarrage à froid d'OpenNext dans l'invocation RPC (plan gratuit 10 ms ; l'échec apparaît dans les journaux du site sous `alerte_interne_statut` / `alerte_interne_echec`, sauf dépassement CPU pur) ; réception réelle par le restaurateur d'essai ; liaison `SITE_JETONS` présente.
**Reporté (mineurs de relecture) :** la garde 404 refuse à tort quelques adresses contenant le mot « interne » avec un espace, un `%` ou un `;` (aucune route publique n'en utilise) ; elle laisse passer `%3F`/`%23` devant le motif, sans effet (OpenNext ne les fait pas correspondre et la route exige de toute façon le jeton d'isolat) ; la boucle de décodage est un doublon de la règle du reste ; le banc OpenNext réel n'a pas été relancé sur un paquet reconstruit.

## Journal de mise en service
- **2 novembre 2026 : feu vert 0 fait.** `master` avancé en simple avance rapide jusqu'à `63a95b8` (contrôles GitHub verts).
- **2 novembre 2026 : feu vert 1 fait** (lancé par Malika, `cf:deploy`). Site : version `71669539-5ecc-4e4c-872c-5ed616f0b4c4` (précédente : `30e67783-8587-4545-9841-82c2ff4bb386`). Contrôlé : accueil, `/installer` (section iPhone présente), `/api/v1/version` 200 ; `/api/v1/commandes` 401 ; `/api/v1/interne/*` (majuscules, encodé) et `/JetonsCommande/deriver` : 404. `API_RELAIS` et secrets inchangés.
- **2 novembre 2026 : feu vert 2 fait** (feu vert de Malika dans la conversation). API : version `66caf901-1072-4783-a4bd-7b67af8d6bdc` (précédente : `7d38bee0-09ce-48da-8a9b-7c36d71f3df2`), tests API à code 0 avant déploiement. Liaison `SITE_JETONS` (`speedfood-app#JetonsCommande`) listée par Wrangler au déploiement (**feu vert 3 constaté**). Contrôlé sans écriture : `/version` 200, `/aide` 200, `/moi` 401, `GET /commandes` 401, `POST /commandes` sans connexion 401, `POST /suivi` corps vide 400. Garde `CREATION_COMMANDE_API` toujours absente : création par l'API refusée. Relais inchangé (`public,moi,client,livraison,suivi`).
- **Reste :** feu vert 4 (mesure CPU, inventaire), feu vert 5 (garde + essai TEST, demande un compte d'essai et la présence de Malika), feu vert 6 (`commandes` dans `API_RELAIS`).
