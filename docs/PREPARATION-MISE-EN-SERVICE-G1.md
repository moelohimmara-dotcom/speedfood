# Préparation de mise en service G1 — fiche livreur Expo, 8 novembre 2026

## Verdict de préparation

**Prêt à déployer, en attente du feu vert distinct de Malika. Rien n'a été déployé par cette préparation.** La mise en service G1 se réduit à un redéploiement du Worker `speedfood-api` : un seul commit d'écart avec la production, aucune migration, aucun secret, aucune liaison ni variable ajoutée ou retirée, site et relais inchangés.

## Ce qui tourne en production (vérifié le 8 novembre)

- `wrangler deployments list` depuis `apps/api` : dernier déploiement **2026-11-05 09:20 UTC**, version `45cfd8bc-dc2e-4e02-9862-bcf0e1d12852` à 100 %. Aucun déploiement depuis.
- Le code source de cette version correspond, pour `apps/api`, `packages/shared` et `supabase/migrations`, au commit **7bcf6de** (dernier commit touchant l'API avant le déploiement ; le commit suivant, 4e52ada à 09:20, ne touche qu'un workflow GitHub).
- Preuve publique au moment de la préparation : `GET /api/v1/catalogue/restaurants` → 200, `GET /api/v1/version` → 200 (Kotlin 2.47.0/code 51).

## L'écart exact à déployer

`git diff 7bcf6de..HEAD -- apps/api packages/shared supabase/migrations` : **un seul commit, 57f80f1** (« consulter sa fiche livreur »), 10 fichiers, **+259 lignes, 0 suppression, 0 migration**.

| Fichier | Rôle |
|---|---|
| `apps/api/src/routes/livreur.ts` | Route `GET /api/v1/livreur/fiche` |
| `apps/api/src/livreur/fiche.ts` | Lecture ciblée de la fiche du compte |
| `apps/api/src/livreur/cablage.ts` | Câblage : client du jeton + limiteur existants |
| `apps/api/src/app.ts`, `worker.ts`, `types.ts` | Montage de la route (+6 lignes) |
| `packages/shared/src/contracts/livreur-fiche.ts` | Contrat et projection stricte (6 champs) |
| `apps/api/tests/livreur-fiche.test.ts`, `livreur-banc-redirection.test.ts`, `deps-essai.ts` | Tests (jamais déployés) |

Les deux commits postérieurs à 57f80f1 sur la branche (881a800 barre de panier, c93a8e5 typecheck) ne touchent que `apps/mobile` ; abab14a ne touche que `docs/`. **Le site `apps/web` n'est pas concerné : aucun redéploiement du site.**

## Garde de sécurité de la route (code relu)

- GET seule, montée sous `/api/v1/livreur/fiche`, derrière `identifier(strict)` : porteur Supabase vérifié, sinon refus avant toute lecture.
- `limiterParCompte` : plafond par compte, comme les autres routes privées.
- Lecture par le **client du jeton** (RLS de l'utilisateur), jamais par la clé de service ; filtre explicite `.eq('utilisateur_id', …)` en plus de la RLS.
- Projection stricte de six champs (`nom, statut, vehicule, cycle, motifCycle, restaurantNom`) avec listes fermées ; aucun champ supplémentaire ne peut fuiter, aucune donnée de course, position ou client.
- Les services historiques de course ne sont pas importés par cette route (le piège `livreur/etat` qui écrit en lisant n'est pas touché).

## Base de données : prête, rien à appliquer

- Table `public.livreurs` (migration du 17/10) : colonnes `nom`, `statut`, `vehicule` présentes ; `cycle` et `motif_cycle` ajoutés le 17/10 ; `restaurant_id` (FK vers `restaurants`) ajouté le 21/10 pour la jointure du nom.
- Les domaines SQL correspondent exactement aux listes du contrat partagé (statut 3 valeurs, véhicule 4, cycle 6, motif ≤ 300 caractères, nom ≤ 80).
- Policy `livreur_lit_sa_fiche` : `for select to authenticated using (utilisateur_id = auth.uid())`. Si le restaurant rattaché n'est pas visible du livreur, la jointure donne `null` et l'écran affiche « Rattachement non renseigné » — comportement déjà contrôlé au banc G1.
- **Aucune migration dans ce lot : `get_advisors` n'est donc pas requis pour ce déploiement** (aucun changement RLS ni fonction SECURITY DEFINER).

## Contrôles relancés le 8 novembre sur le code à déployer (HEAD abab14a)

| Contrôle | Résultat |
|---|---|
| `npm run build:api` | code 0 ; paquet 1 257 Kio (plafond du dépôt : 1 400 000 octets) |
| `npm run test:api` | **661/661, code 0**, zéro annulation (relance unique, pas sous charge parallèle) |
| `npx wrangler deploy --dry-run` (apps/api) | code 0 ; 1 257,20 Kio ; seule liaison `SITE_JETONS`, variables inchangées |
| Banc natif G1 (8 novembre, rapport CONTROLE-FICHE-LIVREUR-EXPO-2026-11-07.md) | fiche active/suspendue/archivée, absence ≠ panne, relation masquée, réponse tardive écartée ; 12 mutations détectées/restaurées |
| CI GitHub sur 57f80f1 | Contrôles n°88, Android n°30, iPhone n°27 : succès |

## Procédure de déploiement (à exécuter par Malika, après feu vert)

```bat
cd /d C:\Users\moelo\dev\speedfood\apps\api && npx wrangler deploy
```

Attendu : nouvelle version à 100 %, aucun changement de liaison ni de secret signalé par Wrangler. Noter l'identifiant de la nouvelle version dans le compte rendu de mise en service.

## Contrôles après déploiement (dans l'ordre)

1. Publics, sans compte : catalogue 200, version 200.
2. `GET /api/v1/livreur/fiche` sans jeton → refus d'authentification (401), jamais une fiche.
3. Avec la session réelle de l'émulateur (compte non livreur) : ouvrir « Mon compte » → réponse `fiche: null`, aucun écran livreur proposé, aucune erreur.
4. **Vrai compte livreur** : ouvrir l'espace livreur dans l'application et lire sa propre fiche (nom, statut, véhicule, cycle). Ce contrôle exige un compte rattaché à une ligne `livreurs` ; s'il n'en existe pas encore, sa création est une décision séparée, pas un préalable silencieux.
5. Contrôle de non-régression : une commande TEST existante reste lisible dans l'historique et le suivi du compte de l'émulateur (lecture seule).

## Retour arrière

Redéployer la version précédente : `npx wrangler rollback` vers `45cfd8bc` (ou redéploiement depuis 7bcf6de). La route disparaît, tout le reste est inchangé : aucune donnée n'a été écrite par ce lot, aucune migration à défaire. L'application Expo retombe alors sur son message de fiche indisponible, sans casse (cas « panne » déjà contrôlé au banc).

## Ce que ce déploiement ne fait pas

- N'active ni offre, ni course, ni position livreur (lots G2 à G4, plans séparés).
- Ne touche ni au relais du site (`commandes` reste exclu), ni à `CREATION_COMMANDE_API`, ni à aucun secret, ni à l'application Kotlin distribuée.
- Ne prouve ni iPhone physique, ni Android physique : ces essais restent des contrôles distincts.

## Décision demandée

Oui/non de Malika sur le déploiement ci-dessus, exécuté par elle avec la commande fournie. Après le déploiement : contrôles 1 à 3 par l'agent, contrôle 4 selon l'existence d'un compte livreur autorisé.

## Mise en service réalisée le 8 novembre 2026

**Feu vert de Malika dans la conversation ; déploiement exécuté par l'agent sur son instruction explicite.** Préparation d'abord commitée (f9c8095), puis :

- `npx wrangler deploy` depuis `apps/api` : code 0, upload 1 257,20 Kio (identique au dry-run), démarrage 25 ms, liaison `SITE_JETONS` et variable Supabase inchangées. **Nouvelle version : `652d227e-5b40-4684-a8ac-b424fe16779c` à 100 %.** Version précédente conservée pour retour arrière : `45cfd8bc`.
- Contrôles publics après déploiement : catalogue 200, version 200, menu 200.
- Route G1 : sans jeton → **401** ; avec un jeton invalide → **401**. Aucune fiche ne fuite sans session valide.
- Non-régression dans l'application (émulateur, session réelle conservée) : « Compte connecté », historique des commandes relu contre la nouvelle API, aucun message d'erreur.
- **Reste à vérifier (contrôle 4)** : la lecture d'une vraie fiche par un vrai compte livreur. Le compte de l'émulateur n'est pas livreur ; l'écran livreur ne lui est donc pas proposé et la branche `fiche` réelle n'a pas encore été lue en production. Ce contrôle exige un compte rattaché à une ligne `livreurs`, dont la création ou l'identification reste une décision distincte de Malika.
- Aucun autre changement : site non redéployé, relais inchangé (`commandes` toujours exclu), aucun secret touché, application Kotlin inchangée.
