# Espace livreur Expo — plan G2 (état, offre en lecture, disponibilité), 8 novembre 2026

## Goal

Le livreur voit son état réel et son offre en attente dans l'application Expo, et bascule sa disponibilité par une action explicite, via l'API unique, sans reproduire l'écriture cachée de la lecture historique et sans changer les machines à états du serveur.

## Success Criteria

- Dans l'espace livreur : fiche, statut (hors ligne / disponible / en course), et soit l'offre en attente (restaurant, distances, frais, échéance), soit « Aucune offre pour le moment ».
- Un bouton bascule la disponibilité ; l'état affiché après l'action est toujours relu du serveur, jamais supposé.
- La lecture de l'état par l'application ne déclenche aucune expiration, redistribution ni autre écriture serveur.
- Aucune donnée client (nom, téléphone, adresse) ne transite par ce lot ; accepter/refuser une offre reste impossible (G3).

## Approach

Constats vérifiés dans le code le 8 novembre :

- `lireEtatLivreur` (site, encore utilisé par le Kotlin via `/api/v1/livreur/etat`) appelle `traiterOffres()` avant de lire : la lecture historique expire et redistribue les offres. **Ne pas brancher l'API unique dessus.**
- La bascule existe déjà : `basculerEnLigne` (site, `lib/livraison/service-livreur.ts`) dérive le livreur du compte, exige une fiche « actif » pour passer en ligne, refuse pendant une course, et garde la transition atomiquement en base (`neq statut en_course`). Aucune copie de cette règle.
- L'offre lisible sans écrire : lignes `livraison_offres` en `en_attente` non expirées du livreur (la lecture historique filtre déjà `expire_le > maintenant`), plus le restaurant et les frais via la livraison. La redistribution reste aux déclencheurs existants (consoles du site, nouvelles commandes prêtes) et au déclencheur explicite ci-dessous.
- G1 a posé le patron : route de l'API unique derrière le porteur strict, plafond par compte, lecture du jeton sous RLS avec filtre explicite du compte, projection partagée stricte, aucun service d'action importé par une lecture.

Arbitrages validés par Malika le 8 novembre (4 points) :

1. Lecture de l'état **pure** : aucune écriture cachée derrière l'écran.
2. Expiration/redistribution : déclencheurs existants, **plus** la mise en ligne explicite du livreur (voir G2a) ; l'écran affiche l'échéance de l'offre, et une offre échue disparaît à la relecture par son filtre de date.
3. Disponibilité : écriture par tap explicite seulement, réponse incertaine verrouillée jusqu'à relecture, jamais de bascule automatique ni de rejeu.
4. Hors périmètre : offre acceptée/refusée et course (G3), position (G4), notation (G5). Le résidu « le Kotlin garde son comportement » est préservé : les routes du site ne bougent pas.

## Steps

### G2a : contrat et API, code local seulement

- Contrat partagé `packages/shared/src/contracts/livreur-etat.ts` : projection stricte de l'état (`fiche` de G1 réutilisée) et de l'offre (`offreId`, `expireLe`, `restaurantNom`, `distanceCourseKm | null`, `distanceRestaurantKm | null`, `fraisGnf` entier). Aucun champ client, aucune coordonnée brute du client ; les points servent au calcul de distance côté serveur et ne sortent pas.
- `GET /api/v1/livreur/etat` dans l'API unique (même montage que `/fiche`) : porteur strict, plafond livreur par compte, lecture sous le jeton (RLS) avec filtre explicite du compte. Rend la fiche projetée et l'offre la plus ancienne non expirée, ou `offre: null`. N'importe ni `traiterOffres`, ni `repartir`, ni aucun service d'action. Compte sans fiche : `etat: null` ; panne de base : erreur serveur, jamais un faux « aucune offre ».
- `POST /api/v1/livreur/en-ligne` `{ enLigne: boolean }` : porteur strict, plafond, corps validé (booléen strict, rien d'autre lu). Câblé sur `basculerEnLigne` du site (déjà utilisé par sa route du même nom), avec **déclencheur explicite** après une mise en ligne réussie : faire avancer les offres (`traiterOffres`), comme le parcours d'administration du site le fait déjà après un passage en ligne — jamais après un passage hors ligne, jamais pendant une lecture. Refus du service (fiche inactive, course en cours, pas livreur) : réponse d'erreur métier avec son message, aucun état supposé côté client.
- Fichiers prévus : `packages/shared/src/contracts/livreur-etat.ts` ; `apps/api/src/routes/livreur.ts` (état + en-ligne) ; `apps/api/src/livreur/etat.ts` (lecture) et compléter `cablage.ts`/`types.ts`/`app.ts`/`worker.ts` en réutilisant les fonctions du site sans les copier ; tests API dédiés. Aucune migration, aucun changement RLS, aucun relais site ajouté (le relais n'est pas le chemin des applications natives).

### G2b : écran Expo

- `LivreurReel` gagne, sous la fiche : la section d'état (statut en clair, offre éventuelle avec restaurant, distances, frais formatés GNF et échéance lisible) et le bouton de disponibilité (« Me mettre en ligne » / « Me mettre hors ligne » ; désactivé et expliqué si la fiche n'est pas « actif » ou si le statut est « en course »).
- Écriture disciplinée comme le reste de l'application : pendant l'envoi, actions verrouillées ; réponse incertaine (réseau, délai) = état « à vérifier » verrouillé jusqu'à une relecture réussie ; après confirmation, relecture systématique de l'état et affichage de la vérité relue. Aucune minuterie, aucune boucle, aucune permission nouvelle (ni localisation, ni notification).
- Parseur strict de l'état : statut inconnu, offre malformée ou champs excédentaires refusés ; panne et absence d'offre affichées distinctement ; une ancienne réponse ne réapparaît pas après un changement de compte (même garde que G1).
- Fichiers prévus : `apps/mobile/src/connexion/livreur.ts`, `LivreurReel.tsx`, tests mobiles dédiés ; réutiliser tokens et composants existants, aucune navigation nouvelle.

### G2c : banc natif local

- Même banc que G1 (projet Expo de contrôle séparé, ports injectés, identités factices) : fiche active hors ligne → mise en ligne → offre factice affichée → échéance dépassée → relecture sans offre → mise hors ligne ; fiche suspendue (bouton refusé avec le message du service simulé) ; panne ; réponse lente A puis B. Aucun appel réel, aucune écriture réelle dans ce banc.

## Validation Plan

1. Tests d'abord en rouge, puis vert, par le même chemin que G1 : API (porteur absent/invalide, plafond, comptes A/B isolés, offre expirée filtrée, offre d'un autre livreur invisible, projection sans champ client ni point client, refus de bascule fiche inactive et en course, corps non booléen refusé, aucun service d'écriture atteint par la lecture — épinglé par test statique comme en E1) ; mobiles (parseur, états, verrouillage, relecture après écriture, changement de compte).
2. Mutations ciblées : appeler le traitement des offres depuis la lecture, retirer le filtre de date d'expiration, accepter un champ offre inconnu, afficher l'ancien statut après une bascule incertaine. Chacune doit faire échouer un test ; restauration exacte ensuite.
3. Suites du dépôt relancées : `test:api`, `typecheck`, `test:unit`, `test:cloisonnement`, `build:api` (Worker sous le plafond de 1 400 000 octets) ; `npm test` et `tsc --noEmit` mobiles. Codes 0 exigés.
4. Banc natif G2c sur émulateur, captures relues. CI Android/iOS en complément (une compilation n'est ni un téléphone ni une distribution).
5. Mise en service séparée, seulement sur feux verts distincts de Malika : comparaison de production comme pour G1, déploiement de l'API, contrôles (état sans jeton refusé ; vraie fiche de test relue), puis **essai réel d'écriture unique** : passer la fiche « Livreur de test Malika » en disponible et la remettre hors ligne, chaque geste autorisé distinctement. Aucun déploiement du site requis par ce lot (ses routes ne changent pas).

## Risks / Open Questions

- Une offre affichée peut expirer entre deux lectures sans être encore redistribuée (les déclencheurs sont les consoles, les commandes prêtes et les mises en ligne) : c'est la vérité affichée avec son échéance, pas une promesse. Accepté par l'arbitrage 2.
- `traiterOffres` fait aussi avancer la simulation de démonstration : le déclencheur « mise en ligne » l'appelle comme le fait déjà l'administration du site ; aucun comportement nouveau, mais il sera épinglé par les tests statiques pour rester visible.
- Si le plafond par compte ou la session du porteur diffère entre `/fiche` et `/etat`, réutiliser strictement le même câblage que G1 plutôt que d'en créer un second.
- Retour arrière : commits inverses ciblés sur la branche ; en production, redéployer la version précédente de l'API (le lot n'écrit aucune donnée nouvelle hors les statuts que le livreur bascule lui-même). Aucune migration à défaire.
- Questions ouvertes : None — les quatre arbitrages sont tranchés ci-dessus ; le déclencheur exact d'expiration en arrière-plan (cron) reste un sujet séparé, hors de ce lot.
