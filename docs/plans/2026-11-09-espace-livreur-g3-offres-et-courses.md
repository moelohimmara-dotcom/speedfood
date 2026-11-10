# Espace livreur Expo — plan G3 (répondre à l'offre, faire avancer la course), 9 novembre 2026

> **Pour les agents :** plan seulement, **aucun code écrit, aucun déploiement**. Prérequis : G1 et G2 sont en ligne sur l'API (constat du 9 novembre, voir `docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md` §3). Méthode : `PASSATION-CHANTIER-SPEEDFOOD-APP.md` §8.2 (implémenteur, relecteur indépendant, mutations, essai natif). Chaque écriture réelle exige un « oui » distinct de Malika et **un compte livreur de test que Malika n'a pas encore** (voir Risques).

## Goal

Le livreur, dans l'application Expo, accepte ou refuse l'offre affichée par G2, puis fait avancer sa course (vers le restaurant, récupérée, vers le client, livrée avec le code de remise, ou échec avec raison), via l'API unique, sans rejeu automatique et sans changer les règles métier du serveur.

## Success Criteria

- L'écran livreur montre, en plus de G2, la **course en cours** (restaurant, libellé d'étape, frais en GNF entiers) et propose seulement les étapes que le serveur autorise.
- Accepter ou refuser une offre est une action explicite ; l'état affiché ensuite est **relu du serveur**, jamais supposé.
- Le téléphone et l'adresse du client n'apparaissent **qu'après la récupération** de la commande (règle déjà appliquée par le site).
- Une réponse incertaine (réseau, délai) verrouille l'écran en « à vérifier » jusqu'à une relecture réussie ; aucun réessai automatique, surtout pour le code de remise.
- La lecture de l'état ne déclenche toujours aucune écriture (acquis G2).
- Position, notation du client, file/historique et gains restent hors périmètre (G4, G5).

## Constats vérifiés dans le code (9 novembre)

- Services du site déjà prêts, **un seul chemin** (site + natif) dans `apps/web/src/lib/livraison/service-livreur.ts` : `repondreOffreLivreur(utilisateurId, offreId, reponse)` et `avancerMaCourse(utilisateurId, vers, code?, raison?)`. L'identité du livreur se déduit du compte, jamais du corps.
- Routes du site correspondantes (utilisées par Kotlin) : `POST /api/v1/livreur/offre` `{offreId, reponse: "acceptee"|"refusee"}` et `POST /api/v1/livreur/course` `{vers, code?, raison?}`. L'API Hono n'a que `/fiche`, `/etat`, `/en-ligne`.
- `repondreOffre` (service.ts) : mise à jour conditionnelle de l'offre (livreur, `en_attente`, non expirée), puis `assignee` + livreur `en_course` à l'acceptation ; au refus, relance la répartition (`repartir`, écriture voulue et explicite).
- `avancerLivraison` (service.ts) revérifie tout : propriétaire de la course, machine à états (`acteurPeut`), commande « prête » avant récupération, code de remise (essai **réservé avant comparaison**, plafond `ESSAIS_CODE_MAX`, essai rendu seulement si la mise à jour échoue après un bon code), clôture de la commande (« prête » → « terminée »), libération du livreur.
- Règles par mode : groupe Speedfood = toute la chaîne ; livraison par le personnel du restaurant (mode `propre`) = seulement `vers_client`, `livree`, `echec`.
- **Piège A :** `avancerMaCourse` choisit **côté serveur la plus ancienne course active** du livreur ; le client n'envoie pas d'identifiant de course. Un écran périmé pourrait faire avancer une autre course que celle affichée.
- **Piège B :** la lecture historique (`lireEtatLivreur`) renvoie aussi `arriveePoint` (coordonnées brutes du client) et `client.{nom, telephone, adresse}` après récupération. G2 a posé « aucune coordonnée brute du client ne sort ». À arbitrer pour G3 (voir Arbitrages).
- **Piège C :** une réponse perdue sur `livree` ne dit pas si l'essai de code a été consommé ni si la livraison est faite.
- Le contrat partagé d'état G2 est `packages/shared/src/contracts/livreur-etat.ts` ; le câblage est `apps/api/src/livreur/{cablage,etat}.ts` et `apps/api/src/routes/livreur.ts`.

## Arbitrages proposés à Malika (à valider avant le code)

1. **Course pilotée par identifiant attendu.** Le client envoie `livraisonId` (la course affichée) ; le câblage API compare avec la course active lue sous RLS avant d'appeler `avancerMaCourse` ; écart = refus « la course a changé, relisez ». Aucune modification du service du site (Kotlin inchangé). *Recommandé.*
2. **Données du client.** Dans G3 : nom, téléphone et adresse en **texte**, seulement après récupération ; **aucune coordonnée brute** (la carte et la navigation sont G4). Le téléphone s'affiche et peut s'appeler par le téléphone du livreur, sans nouvelle permission. *Recommandé.*
3. **Code de remise.** Saisie de 4 chiffres, **jamais journalisé ni conservé**, non réessayé automatiquement ; après réponse incertaine : « à vérifier » verrouillé, relecture ; message d'essais restants repris du serveur.
4. **Hors périmètre confirmé :** position et arrière-plan (G4), notation du client « à noter », file, historique, gains, dossier, aide, notifications d'offre (G5).

## Steps

### G3a — contrat et API (code local seulement)

- **Contrat partagé** (compléter `livreur-etat.ts` ou créer `livreur-course.ts`) : projection stricte de la course (`livraisonId`, `statut`, `mode`, `libelle`, `commandeReference`, `restaurantNom`, `fraisGnf` entier, `etapesPossibles` calculé par `acteurPeut`, `client` = `{nom, telephone, adresse}` ou `null` avant récupération) ; corps stricts des deux actions.
- **Lecture :** étendre `GET /api/v1/livreur/etat` pour rendre `course`, toujours en lecture pure (aucun import de `traiterOffres`, `repartir`, service d'action ; test statique épinglé comme en E1/G2). Panne de base = erreur visible, jamais un faux « aucune course ».
- **`POST /api/v1/livreur/offre`** `{offreId, reponse}` : porteur strict, plafond par compte, corps à clés exactes, `offreId` UUID, `reponse` ∈ {acceptee, refusee} ; câblé sur `repondreOffreLivreur` du site sans copier ses règles ; refus métier → `VALIDATION` avec le message du service.
- **`POST /api/v1/livreur/course`** `{livraisonId, vers, code?, raison?}` : mêmes gardes, `vers` dans la liste d'étapes livreur, `code` seulement avec `livree` (≤ 12 caractères, comme le service), `raison` seulement avec `echec` (≤ 300) ; contrôle de `livraisonId` (arbitrage 1) puis `avancerMaCourse`. Le code n'apparaît dans aucune réponse ni aucun journal.
- Aucune migration, aucun changement RLS, aucun relais du site, aucun nouveau secret. Surveiller la taille du Worker (1 290 062 octets pour un plafond de 1 400 000).
- Fichiers prévus : `packages/shared/src/contracts/livreur-*.ts` (+ raccord d'une ligne côté site si exigé), `apps/api/src/routes/livreur.ts`, `apps/api/src/livreur/{cablage,etat,course}.ts`, `types.ts`, doublures `tests/deps-essai.ts`, nouveaux tests `apps/api/tests/livreur-offre.test.ts` et `livreur-course.test.ts`.

### G3b — écran Expo

- `LivreurReel.tsx` : sous l'offre, boutons « Accepter » et « Refuser » ; section « Ma course » avec uniquement les étapes de `etapesPossibles` ; saisie du code pour « Livrée » ; saisie d'une raison pour « Échec » (confirmation explicite, action non annulable).
- Écriture disciplinée comme D1–D5 : un seul envoi à la fois, actions verrouillées pendant l'envoi, réponse incertaine = « à vérifier » verrouillé jusqu'à relecture réussie, relecture systématique après succès, **aucun réessai automatique, aucune minuterie, aucune permission nouvelle**.
- Parseur strict (statut inconnu, course malformée, champs excédentaires refusés) ; une ancienne réponse ne réapparaît pas après un changement de compte (garde de G1/G2) ; données du client effacées de l'écran quand la course se termine.
- Fichiers prévus : `apps/mobile/src/connexion/{livreur.ts,LivreurReel.tsx,client.ts,session.ts}` et tests mobiles dédiés ; composants et tokens existants.

### G3c — banc natif local

- Même banc que G1/G2 (projet Expo de contrôle séparé, ports injectés, identités factices, aucune écriture réelle) : offre → accepter → vers le restaurant → récupérée (téléphone du client visible seulement ici) → vers le client → code faux (essais restants) → code bon → course terminée ; refuser une offre ; échec avec raison ; réponse incertaine puis relecture ; course changée côté serveur entre deux lectures (refus de l'arbitrage 1) ; mode `propre` (étapes réduites) ; réponse lente A puis B après changement de compte.

## Validation Plan

1. Tests rouges puis verts. **API :** porteur absent/invalide, plafond, comptes A/B isolés, `offreId` d'un autre livreur refusé, offre expirée refusée, corps à clé inconnue refusé, `vers` hors liste refusé, `code` sans `livree` refusé, `livraisonId` périmé refusé, mode `propre` limité à ses trois étapes, client masqué avant récupération, aucune coordonnée brute du client dans aucune réponse, aucun service d'action atteint par la lecture. **Mobile :** parseur, verrouillage, relecture, « à vérifier », changement de compte, effacement des données du client.
2. **Mutations obligatoires**, restauration exacte en `try/finally` : retirer le contrôle `livraisonId` ; prendre l'identité livreur dans le corps ; laisser sortir `client` avant récupération ; renvoyer ou journaliser le code ; rejouer après réponse incertaine ; appeler le traitement des offres depuis la lecture ; accepter un statut inconnu. Chacune doit faire échouer un test.
3. Le responsable relance lui-même : `npm run typecheck`, `test:api`, `test:unit`, `test:cloisonnement`, `build:api` (Worker < 1 400 000) ; `npm test` et `npx tsc --noEmit` dans `apps/mobile`. Exit 0 exigé.
4. Essai natif G3c sur émulateur avec captures relues ; la session réelle de Malika sur l'émulateur est conservée (ni déconnexion, ni `pm clear`). CI Android et iPhone en complément.
5. **Mise en service séparée** : feux verts distincts de Malika ; comparaison avec la production comme pour G1 ; déploiement de l'API seule ; contrôle sans jeton (401) ; puis **un seul essai réel d'écriture** sur une livraison de TEST avec un compte livreur de test (voir Risques), chaque geste avec son « oui ».

## Risks / Open Questions

- **Pas de compte livreur de test** (Malika n'en a pas, 9 novembre) : aucun essai réel de G1, G2 ni G3 n'est possible tant qu'il n'existe pas. *Décision de Malika :* créer ou désigner un compte et une fiche livreur de test (aucun service ni coût nouveau). Sans cela, G3 reste prouvé seulement par tests et banc.
- Une offre peut expirer entre l'affichage et le tap : message du serveur « Cette offre n'est plus disponible », relecture ; acquis G2.
- Réponse perdue sur `livree` : l'essai de code a pu être consommé ; l'écran dit « à vérifier » et relit ; jamais de renvoi automatique du code.
- Les livraisons de TEST peuvent avancer via la simulation du site (`traiterOffres` simule des livreurs) : ne pas confondre un livreur simulé avec le compte de test ; lire le service avant l'essai réel.
- Retour arrière : commits inverses ciblés sur la branche ; en production, redéployer la version précédente de l'API (`wrangler deployments list` donne les versions) ; aucune migration à défaire ; les statuts de course modifiés par un essai réel se remettent par les écrans d'exploitation du site, jamais par SQL direct.
- Questions ouvertes pour Malika : valider les arbitrages 1 et 2 ; fournir ou autoriser la création d'un compte livreur de test.

## Journal
- 9 novembre, G3a codé (API seule, non déployé) : contrat `livreur-course.ts`, `GET /etat` étendu à la course, `POST /offre`, `POST /course` avec contrôle de `livraisonId`. Relu par un relecteur indépendant (2 tours) : aucun Critique/Important restant. Contrôles relancés par le responsable : typecheck 0, test:api 724/724, cloisonnement 0, build:api 0 (Worker 1 308 553 octets). 19 mutations tuées. `test:unit` échoue sur `design.test.mts` (variables CSS de la refonte du site du 9 novembre), hors lot.
- **Écart à faire valider par Malika avant tout déploiement :** aucune policy RLS ne permet au livreur de lire `orders` ; la référence puis nom/téléphone/adresse du client sont lus avec la clé de service, par un port lié à « ma course » `(livraisonId, livreurId)` (filtre id + livreur_id + statut actif dans la requête, client lu seulement en `recuperee`/`vers_client`). Précédent : `apps/web/src/lib/livraison/livreur.ts`. Alternative propre : fonction `SECURITY DEFINER` par migration.
- Risques notés : `/etat` fait 2 requêtes de plus avec une course active (surveiller le CPU du Worker) et peut renvoyer un 500 transitoire si la course se termine entre deux lectures ; tri secondaire `id` (le service du site n'en a pas) ; banc `serveur.mjs` à durcir et à nettoyer (`libelleLivraison`) en G3c.
- **9 novembre : Malika accepte l'écart « clé de service » ci-dessus** (lecture de la référence, du nom, du téléphone et de l'adresse du client par le port lié à « ma course », après récupération seulement). Cette acceptation ne vaut PAS feu vert de déploiement de G3a : le déploiement exige toujours un oui distinct. Alternative propre (fonction `SECURITY DEFINER` par migration) reportée.
- 9 novembre, G3b (écran Expo) et G3c (banc local) codés, non déployés, relus par un relecteur indépendant : VERDICT SPEC ✅, QUALITÉ ✅, aucun Critique. Contrôles relancés par le responsable : mobile `npm test` 598/598, `tsc` 0, typecheck 0, test:api 724/724, build:api 0, banc `parcours-g3.mjs` 11 parcours OK ; 29 mutations rapportées détectées (relues par le relecteur, non rejouées). Rapports : implémenteur `g3b-rapport.md`, relecture `g3b-revue.md` (dossier temporaire de session, non portable).
- **Important I1 (ordre de déploiement) :** contre l'API G2 en ligne, `/etat` n'a pas `course` : le parseur refuse la réponse et tout l'espace livreur tombe en erreur ; `/offre` et `/course` renverraient 404. **Ordre obligatoire : feu vert puis déploiement de l'API G3a, contrôle 401 sans jeton, vérifier que `/etat` contient `course`, et seulement ensuite diffuser un APK.** Garde facultative de découplage : lire l'absence de la seule clé `course` comme « indisponible » (jamais comme `null`).
- Mineurs ouverts : M1 (erreur de renouvellement du jeton avant tout envoi → « à vérifier » prudent), M3 (carte du client encore affichée pendant « à vérifier » après un succès dont la relecture a échoué : à masquer), M4 (clavier : pas de défilement vers le champ du code/de la raison, à vérifier à l'émulateur), M5 (le banc ne rejoue pas le délai d'abandon de 20 s ni les redirections du vrai client), M6 (trous de mutations : remise à zéro du code au changement de `livraisonId`, garde de génération de `session.ts`), M7 (téléphone sélectionnable mais pas de lien `tel:`), M8 (parseur strict : prévoir une règle de versionnement du contrat).
- Reste : essai natif G3c sur l'émulateur avec le banc factice.
- **10 novembre, essai natif G3c sur l'émulateur (banc factice, aucune donnée réelle) :** un **défaut réel** de G3b a été trouvé : après toute lecture, `lectureEnCours` restait vrai au moment de la publication, donc « Accepter », « Refuser » et « Me mettre hors ligne » restaient grisés en permanence (les 598 tests ne le voyaient pas). Corrigé (test rouge d'abord ; `lire()` remet le drapeau à null avant de publier ; `clientAffiche(course, incertain)` règle aussi M3). Contrôles relancés : mobile 600/600, tsc 0, typecheck 0, test:api 0, build:api 0, parcours-g3 11 OK, 32/32 mutations détectées. **Rejoué sur émulateur après correction :** accepter l'offre (relue : « En course », course affichée) → « Je pars vers le restaurant » → « J'ai récupéré la commande » → client (nom, téléphone, adresse en texte) visible seulement à l'étape « vers le client » → faux code 0000 : « Code incorrect… (4 essais restants) », champ vidé, code non repris → bon code : course « livrée », client effacé, état « Disponible » → réponse incertaine (action appliquée, réponse perdue) : un seul envoi, tous les boutons grisés, « À vérifier », puis « Actualiser mon état » affiche la vérité (offre acceptée). Journal du banc : aucune violation. **M4 confirmé :** le clavier cache le champ du code et le bouton « Livrée » ; la page ne défile pas seule (l'utilisateur peut défiler) : mineur ouvert. Non rejoués à l'émulateur : échec avec raison, course changée, mode propre, réponse lente A puis B (couverts par les tests et le banc automatisé). Reste non prouvé : tout essai contre la vraie API, déploiement de G3a puis APK sur feux verts distincts.
