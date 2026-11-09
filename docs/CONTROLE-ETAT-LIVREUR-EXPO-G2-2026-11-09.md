# Contrôle G2 : état livreur et bascule de disponibilité Expo — 9 novembre 2026

## Périmètre et état
**G2 vérifié localement le 9 novembre 2026, sans déploiement ni verdict production.** G2 ajoute, au-dessus de la fiche G1 : la lecture de l'état du livreur (fiche + offre en attente, en lecture pure) et la bascule explicite de disponibilité (mise en ligne / hors ligne par action du livreur). Aucune acceptation ni refus d'offre (lot G3), aucune position (G4), aucune notation (G5), aucune donnée de client dans le contrat de l'offre. Branche `etape-adr021-deblocage-commandes` ; travail local non committé à la date de ce rapport, au-dessus du commit poussé `082f344`.

## Arbitrages validés par Malika (quatre points)
1. Lecture d'état **pure** : la route de lecture n'appelle aucun traitement des offres. La lecture historique du site (`lireEtatLivreur`) appelle `traiterOffres()` : elle n'est **pas** réutilisée par l'API ; une lecture neuve, sans écriture, la remplace.
2. L'expiration et la redistribution des offres avancent par les déclencheurs existants et par la mise en ligne explicite : `traiterOffres` n'est appelé qu'après une bascule en ligne réussie, jamais pendant une lecture ni après un passage hors ligne.
3. Disponibilité uniquement par action explicite du livreur : un résultat de bascule incertain (réseau, délai, réponse illisible) verrouille le bouton jusqu'à une relecture réussie ; la vérité affichée est toujours relue sur le serveur, jamais supposée.
4. Aucune donnée ni coordonnée de client dans l'offre ; frais en GNF entiers ; une offre au frais non entier ou négatif, ou à l'échéance illisible, est rejetée entière plutôt qu'adoucie.

## Ce qui a été construit
- Contrat partagé `packages/shared/src/contracts/livreur-etat.ts` : fiche G1 + offre à six champs (`offreId`, `expireLe`, `restaurantNom`, deux distances en km ou `null` si inconnues, `fraisGnf` entier), projection stricte et parseurs de réponse stricts.
- API : lecture pure `apps/api/src/livreur/etat.ts` (client du jeton, RLS, filtre `utilisateur_id`, offre la plus ancienne encore valable filtrée par `expire_le`, aucune écriture) ; routes `GET /api/v1/livreur/etat` et `POST /api/v1/livreur/en-ligne` (corps strictement `{ enLigne: boolean }`) dans `apps/api/src/routes/livreur.ts` ; câblage `apps/api/src/livreur/cablage.ts` branchant `basculerEnLigne` du site, sans copier ses règles, et `traiterOffres` uniquement après une mise en ligne réussie.
- Mobile : client et session étendus (`etatLivreur`, `basculerEnLigneLivreur`, erreurs distinguées refus/incertain), contrôleur discipliné `controle-etat-livreur.ts` (dernière réponse valable seulement pour la même session et le même écran, verrouillage incertain, message de refus conservé après relecture), écran `LivreurReel` réécrit (état, offre avec échéance, bouton de disponibilité, aucun bouton Accepter/Refuser).
- Banc de contrôle étendu : scénarios `offre` et `offre_expiree`, bascule factice avec refus si fiche suspendue/archivée, compteurs `bascules` et `declenchements` exposés par `/__etat` ; transport de contrôle autorisant les deux nouvelles routes par des méthodes dédiées (la surface publique historique du transport reste limitée à la fiche et aux commandes du banc).

## Suites et contrôles (relancés après le dernier changement)
- `npm run test:api` : **683/683, code 0** (dont le test de banc G2 : état, bascule avec déclenchement compté, offre, expiration, refus suspendu à 400 sans déclenchement ; et un test du service de lecture réel sur base factice : une offre échue, même plus ancienne, n'est jamais rendue).
- `npm test` mobile : **551/551, code 0** ; `npx tsc --noEmit` mobile : code 0.
- Typecheck racine, tests unitaires, cloisonnement, build API (1 266 Kio) : codes 0.
- Correctif d'outillage au passage : `allowImportingTsExtensions` ajouté aux tsconfig de `packages/shared` et `apps/web` — l'import interne `./livreur-fiche.ts` du contrat partagé est exigé par Node en mode strip-types côté mobile et refusé sans cette option par `tsc`.

## Mutations ciblées du plan (chacune détectée, restauration exacte vérifiée par haché)
1. La lecture `GET /etat` déclenche `avancerOffres` → 2 tests API en échec.
2. Retrait du filtre `.gt('expire_le', …)` de la lecture → le test du service de lecture échoue (offre échue rendue).
3. La projection de l'offre laisse passer les champs inconnus (`...o`, dont un faux champ client) → le test du contrat échoue.
4. Le contrôleur affiche le statut demandé comme vérité après une bascule incertaine, sans verrouillage → le test du contrôleur échoue.

## Essai natif sur émulateur (banc local, 9 novembre)
AVD `speedfood_pixel` sans wipe, APK debug `com.speedfood.clientdemo`, serveur synthétique sur 8797 et Metro de contrôle sur 8081, relais adb 8081/8797. Bandeau « CONTRÔLE LOCAL — DONNÉES FACTICES » reconnu avant toute action. Séquence exercée sur le compte factice A :

- État initial : fiche active, hors ligne, moto, « Aucune offre pour le moment. », boutons « Me mettre en ligne » et « Actualiser mon état ».
- **Défaut de banc trouvé et corrigé pendant l'essai** : la première bascule a été refusée (400) parce que l'adaptateur HTTP du banc ne transmettait pas le corps des POST à l'application Hono. Correction de `serveur.mjs` (corps bufferisé puis transmis), serveur relancé ; la suite API complète est restée verte (683/683).
- « Me mettre en ligne » → état « Disponible » relu, bouton « Me mettre hors ligne » ; compteurs du banc : `bascules: ["A:en_ligne"]`, `declenchements: 1`.
- Scénario `offre` + actualisation : carte « Offre en attente » (restaurant témoin A, course 3,2 km, livreur à 1,6 km, frais 5 000 GNF, échéance affichée, mention que l'acceptation arrive dans un prochain lot). Aucune donnée client, aucun
...[truncated 2705 chars]
## Mise en service et essai réel — 9 novembre 2026
Sur instruction « Commite, déploie et enchaîne » : lot committé (`e996900`), API déployée version `c93312c0-c873-4ded-8e59-da319813e5e7` (retour arrière `f8ddc3bb`), écart limité au seul commit G2, contrôles santé/version 200 et routes livreur à 401 sans jeton ni avec faux jeton. Puis essai réel sur l'émulateur, Malika connectée par elle-même (aucun identifiant transmis à l'agent) : la fiche « Livreur de test Malika » est lue par l'API déployée (active, hors ligne, moto) ; « Me mettre en ligne » écrit réellement et l'état relu affiche « Disponible » ; « Me mettre hors ligne » puis relecture affichent « Hors ligne ». Aucune offre n'a été proposée pendant l'essai et la fiche a été laissée dans son état initial. Au passage, l'émulateur avait perdu son DNS (la route IP fonctionnait) : relancé sans effacement avec un DNS explicite, puis catalogue réel à nouveau chargé. Captures `g2-20` à `g2-22` dans le même dossier hors dépôt.