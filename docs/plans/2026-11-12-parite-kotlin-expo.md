# Parité Kotlin vers Expo : matrice et plan de reprise (12 novembre 2026)

> **Plan et inventaire seulement.** Aucun code d'application n'est modifié par ce document. Aucun déploiement, aucune migration, aucun secret. Chaque lot de reprise sera livré sur sa propre branche, avec tests écrits avant le code, essai sur émulateur et, pour les lignes critiques, essai sur un vrai téléphone. Les déploiements en production exigent un feu vert distinct de Malika.

## 1. Décision de Malika et règle de remplacement

**Décision (12 novembre 2026) :** reprendre dans la nouvelle appli Expo (`com.speedfood.mobile`) **toutes** les fonctions de l'ancienne appli Kotlin (`com.speedfood.app`, 2.47.0), **y compris l'espace Équipe**. Dès que l'on est sûr que la nouvelle appli contient tout ce que contient l'ancienne, la remplacer.

**Ce que « remplacer » veut dire.** La clé de signature de l'ancienne appli est perdue : Android refuse toute mise à jour par-dessus. Remplacer signifie faire de la nouvelle appli la **principale** sur `/installer`, inviter les utilisateurs à l'installer, puis à supprimer l'ancienne. L'ancienne ne peut pas être retirée des téléphones à distance. La nouvelle appli est publiée aujourd'hui comme « version d'essai » à côté de l'ancienne (voir `2026-11-11-nouvelle-identite-android.md`).

**Quand une ligne est « Reprise » (porte de sortie).** Une fonction n'est comptée comme reprise que si les cinq conditions sont réunies : (1) l'écran existe dans Expo ; (2) il appelle la même route du site que Kotlin ; (3) des tests écrits avant le code la couvrent, y compris les refus ; (4) elle a été essayée sur émulateur ; (5) pour les lignes critiques (commande, paiement, livreur, Équipe), elle a été essayée sur un vrai téléphone. Sans cela, la ligne reste « À confirmer » ou « Absente ». **Le remplacement n'est proposé que lorsque toutes les lignes sont « Reprise », avec validation de Malika.**

## 2. Constat technique qui borne l'effort

- Le site expose **78 routes `/api/v1/…`** (`apps/web/src/app/api/v1`), dont une trentaine sous `/equipe/…`. L'ancienne appli les appelle directement (`siteUrl` + `/api/v1/…`, couche `mobile/shared/src/commonMain/kotlin/com/speedfood/app/data/`). **La nouvelle appli peut utiliser les mêmes routes : il n'y a pas de serveur à écrire pour reprendre l'Équipe.** Le travail est : code client, écrans, tests, essais.
- Les contrôles d'accès restent côté serveur (rôle du compte, droits d'équipe). L'appli ne tranche jamais un droit toute seule (règle du dépôt).
- Ce qui n'est PAS que de l'interface : fonctions natives Android (service de premier plan, position GPS, sonnerie plein écran, verrou biométrique, connexion Facebook). Elles demandent des modules natifs ou des plugins de configuration Expo, des permissions, et des essais sur appareil réel.
- État du serveur de connexion (lu le 12 novembre) : `GET /api/v1/connexion/fournisseurs` renvoie `{"facebook": true}` : la connexion **Facebook** est active et doit être reprise ; Google n'est pas déclaré actif.

## 3. Matrice

Légende : **Reprise** = les cinq conditions du §1 sont réunies d'après les preuves du dépôt (passation du 8 au 10 novembre) ; **À confirmer** = du code existe mais la parité n'est pas prouvée, ou l'inventaire du 12 novembre ne suffit pas à trancher (à relire écran par écran avant de décider) ; **Absente** = rien d'équivalent trouvé dans `apps/mobile/src`. L'inventaire du 12 novembre est fait sur les opérations des interfaces de la couche données Kotlin (`suspend fun` de chaque `XxxApi`) et sur un recoupement par mots-clés du code Expo : il est fiable pour « Absente », indicatif pour « À confirmer ».

### A. Accès, compte, profil

| N° | Fonction Kotlin | Route(s) du site | État Expo | Lot |
|---|---|---|---|---|
| A1 | Connexion e-mail + mot de passe, renouvellement de session (`connecter`, `rafraichir`) | `/moi` et service d'authentification | Reprise (essais TEST réels, compte existant) | |
| A2 | Inscription (`inscrire`) | service d'authentification | Codée, tests OK (inscription dans l'appli, e-mail de confirmation) ; essai émulateur partiel le 12 novembre (écran et 4 validations locales : nom, téléphone, e-mail, mot de passe ; aucun envoi) ; inscription réelle à faire sur un compte jetable | 1 |
| A3 | Mot de passe oublié (`demanderReinitialisation`) | service d'authentification | Codée, tests OK (lien de réinitialisation par e-mail) ; essai émulateur partiel le 12 novembre (écran et e-mail invalide ; aucun envoi) ; envoi réel à faire sur un compte désigné | 1 |
| A4 | Connexion par code (`connecterAvecCode`) | service d'authentification | Codée, tests OK (retour lu seulement sur la page relais du site ou le lien de l'application, code échangé une fois avec le secret PKCE gardé en mémoire) ; essai réel à faire | 1 |
| A5 | Connexion Facebook (fournisseur actif) | `/connexion/fournisseurs` | Codée, tests OK (bouton seulement si le fournisseur est actif côté service d'authentification ET l'interrupteur de l'équipe ouvert ; parcours navigateur PKCE) ; essai réel subordonné à l'application Meta de Malika rendue publique | 1 |
| A6 | Connexion Google (non déclarée active par le site) | `/connexion/fournisseurs` | Codée, tests OK (même parcours navigateur PKCE qu'A5, bouton seulement si Google est actif ; la fenêtre native du téléphone reste une variante ultérieure) ; essai réel à faire | à décider |
| A7 | Verrou de l'appareil (biométrie ou code) | local | Codée, tests OK (règle portée, `expo-local-authentication`) ; réglage vu sur émulateur le 12 novembre avec un compte professionnel (désactivé ; branche « configurez d'abord un verrouillage d'écran » de l'émulateur vérifiée) ; activation et verrouillage à l'ouverture à essayer sur téléphone avec verrouillage configuré | 1 |
| A8 | Suppression de compte (`supprimerCompte`) | `/client/compte` | Codée, tests OK (mot SUPPRIMER, refus compte professionnel, résultat incertain) ; panneau et garde-fou essayés sur émulateur le 12 novembre (mot faux : bouton désactivé ; fermé par « Non, garder », compte intact) ; suppression réelle à faire sur un compte jetable uniquement | 1 |
| A9 | Espaces et rôles (`roles`), choix et changement de profil | `/moi` | À confirmer : rôles lus, entrées restaurateur et livreur présentes ; l'écran « choix du profil » de l'ancienne appli n'existe pas dans Expo (décision de conception à prendre) | 1 |
| A10 | Visite guidée au premier lancement | local | Codée, tests OK (deux séries de deux écrans, proposée une seule fois, rouvrable depuis l'accueil et l'espace restaurateur) ; essai émulateur à faire | 4 |
| A11 | Aide et support, numéro WhatsApp (`whatsapp`, écran Support) | `/aide` | Reprise (tests OK ; essayée sur émulateur le 12 novembre : numéro réel lu, boutons WhatsApp et appel, FAQ) | 1 |
| A12 | Liens profonds (`LiensProfonds`) | local | Codée, tests OK (seuls les hôtes Speedfood connus : restaurant ouvert, commande vers « Mon compte » ; aucune navigation arbitraire) ; essai émulateur à faire | 4 |

### B. Client

| N° | Fonction Kotlin | Route(s) du site | État Expo | Lot |
|---|---|---|---|---|
| B1 | Accueil, liste et recherche de restaurants, disponibilité | catalogue | Reprise | |
| B2 | Fiche restaurant, menu, fiche plat | catalogue | Reprise | |
| B3 | Panier persistant, plats par restaurant | local | Reprise | |
| B4 | Commande retrait ou livraison, estimation de livraison, idempotence | `/commandes`, `/livraison/estimation` | Reprise (essais TEST réels) | |
| B5 | Suivi d'une commande, liste « mes commandes » | `/suivi`, `/commandes` | Reprise (50 commandes maximum) | |
| B6 | Annuler une commande avant la réponse du restaurant | `/suivi/annuler` | Reprise | |
| B7 | Répondre à une proposition de prix du restaurant (`repondreProposition`) | `/suivi/proposition` | Codée, tests OK (accepter ou refuser, confirmation, un seul essai) ; suivi lu sur émulateur le 12 novembre, mais aucune proposition en attente sur les commandes existantes (terminées ou annulées) : réponse à exercer sur un scénario dédié | 1 |
| B8 | Paiement par code marchand, déclaration | `/suivi/paiement` | Reprise | |
| B9 | Favoris (`basculerFavori`) | `/client/favoris` | Reprise (essai émulateur du 12 novembre : état lu sur la fiche, ajout puis retrait, état restauré et relu à chaque fois) | 1 |
| B10 | Adresses enregistrées (`adresse`) | `/client/adresses` | Reprise (essai émulateur du 12 novembre : bouton désactivé à vide, adresse de test ajoutée relue « 1 sur 5 » puis supprimée, retour à « 0 sur 5 ») | 1 |
| B11 | Espace client et profil (`espace`, `profil`) | `/client/espace`, `/client/profil` | Reprise (essai émulateur du 12 novembre : profil relu du serveur, mode préféré changé puis restauré, vérifié par réouverture de l'espace) | 1 |
| B12 | Candidature : déposer, envoyer une image, lire, lire un menu (`deposer`, `envoyerImage`, `lire`, `lireMenu`) | `/candidature`, `/candidature/image`, `/candidature/menu-photo` | Codée, tests OK (formulaire en trois temps, plats et lecture de photo de menu relue avant ajout, images après dépôt ; routes du site comme l'ancienne appli) ; essai émulateur à faire | 4 |
| B13 | Cache hors ligne des restaurants (`RestaurantApiAvecCache`) | local | Codée, tests OK (dernière lecture gardée 7 jours au plus, rendue hors ligne avec son ancienneté, revalidée strictement) ; essai émulateur à faire | 4 |
| B14 | Bandeau et notification de mise à jour | `/version` | Reprise (version d'essai : ouvre `/installer`) | |
| B15 | Notifications push du client (enregistrer, retirer, jeton, essai) | `/appareils`, `/appareils/essai` | À confirmer : enregistrement fait, réception réelle d'une notification jamais vue | 1 |

### C. Restaurateur

| N° | Fonction Kotlin | Route(s) du site | État Expo | Lot |
|---|---|---|---|---|
| C1 | Commandes en cours et actions (`etat`, `agir`) | `/restaurant/commandes`, `/restaurant/commandes/action` | Reprise | |
| C2 | Ouvrir ou fermer le restaurant (`definirStatut`) | `/restaurant/statut` | Reprise | |
| C3 | Proposer un autre prix (`proposer`) | `/restaurant/commandes/proposition` | Reprise | |
| C4 | Confirmer un paiement (`confirmerPaiement`) | `/restaurant/commandes/paiement` | Reprise | |
| C5 | Émettre le document d'une commande (`emettreDocument`) | `/restaurant/commandes/document` | Codée, tests OK (numéros lus sans les liens WhatsApp, reçu seulement si paiement reçu, un seul essai) ; essai émulateur à faire | 2 |
| C6 | Menu : lire et modifier (`menu`, `modifierMenu`) | `/restaurant/menu`, `/restaurant/menu/action` | Reprise | |
| C7 | Photos de plats : envoyer, retirer (`envoyerPhoto`, `retirerPhoto`) | `/restaurant/menu/photo` | À confirmer : envoi et retrait codés (D4c), retrait maintenant couvert par les tests (corps, correspondance relue, verdict) ; essai émulateur à faire | 2 |
| C8 | Historique des commandes (`historique`) | `/restaurant/historique` | Codée, tests OK (lecture paginée stricte, lignes illisibles comptées, aucun essai émulateur : nouvel APK à compiler) ; essai émulateur à faire | 2 |
| C9 | Réglages : charger, délai, horaires (`charger`, `enregistrerDelai`, `enregistrerHoraires`) | `/restaurant/reglages` | Reprise | |
| C10 | Activité du restaurateur (`Activite.restaurant`) | `/restaurant/activite` | Codée, tests OK (lecture stricte des bilans et des récentes, aucune coordonnée retenue) ; essai émulateur à faire | 2 |
| C11 | Sonnerie et écran allumé pour une commande entrante (`AlerteAndroid`) | local | À confirmer : logique de surveillance portée et testée, bandeau au premier plan, et prototype natif de sonnerie + écran allumé écrit (module `speedfood-veille`, branché sur la décision de surveillance) ; compilation CI et essai sur vrai téléphone requis | 2 |
| C12 | Service de surveillance au premier plan (`SurveillanceRestaurateurService`) | `/restaurant/commandes` | Absente : prototype natif écrit (module local `speedfood-veille` : service de premier plan, aucun jeton côté natif, relecture TypeScript toutes les 15 s tant que le processus vit) ; compilation CI et essai sur vrai téléphone requis avant de dire « Codée » | 2 |
| C13 | Notifications du restaurateur (nouvelle commande, clic) | `/appareils` | À confirmer : essai émulateur fait, réception réelle d'une notification jamais vue | 2 |

### D. Livreur

| N° | Fonction Kotlin | Route(s) du site | État Expo | Lot |
|---|---|---|---|---|
| D1 | Fiche, dossier et état (`dossier`, `etat`) | `/livreur/etat` | Reprise (G1, G2) | |
| D2 | Disponibilité en ligne (`enLigne`) | `/livreur/en-ligne` | Reprise (G2) | |
| D3 | Répondre à une offre (`repondreOffre`) | `/livreur/offre` | À confirmer : code et essai émulateur faits (G3), jamais essayée contre la vraie base ni sur téléphone | 3 |
| D4 | Avancer une course, code de remise (`avancer`) | `/livreur/course` | À confirmer : code et essai émulateur faits (G3), idem | 3 |
| D5 | File des courses (`file`) | `/livreur/file` | Codée, tests OK (route du site créée comme D6 ; lecture stricte des courses, suivantes hors course en cours) ; essai émulateur à faire | 3 |
| D6 | Historique des courses (`historique`) | `/livreur/historique` | Codée, tests OK (route du site créée : elle n'existait ni sur le site ni dans l'API ; lecture paginée stricte côté appli) ; essai émulateur à faire, route à déployer avec le site le moment venu | 3 |
| D7 | Gains (écran Gains) | `/livreur/gains` | Codée, tests OK (frais de course, jamais une paie ; route du site comme l'ancienne appli) ; essai émulateur à faire | 3 |
| D8 | Aide du livreur (écran Aide) | local ou `/aide` | Codée, tests OK (assistance conducteur : règles, incident selon la course, numéro lu sur `/aide`) ; essai émulateur à faire | 3 |
| D9 | Position GPS et service de premier plan (`position`, `SuiviLivreur.tour`, `SuiviLivreurService`) | `/livreur/position` | Absente : prototype natif écrit (service de localisation du module `speedfood-veille`, permission demandée au passage en ligne, positions envoyées par la session) ; compilation CI et essai sur vrai téléphone requis avant de dire « Codée » | 3 |
| D10 | Activité du livreur (`Activite.livreur`) | `/livreur/gains` | Codée avec D7 (même route et mêmes données : bilans du jour et de la semaine) ; essai émulateur à faire | 3 |

### E. Équipe (15 modules, aucun dans Expo)

| N° | Module Kotlin (opérations) | Route(s) du site | État Expo | Lot |
|---|---|---|---|---|
| E1 | Tableau, exploitation, moi, commandes, détail, changer le statut, révéler les coordonnées, répartition, actions livraison et livreur (`Equipe`) | `/equipe/tableau`, `/equipe/moi`, `/equipe/commandes(/[id])`, `/equipe/livraisons`, `/equipe/livreurs/action`, `/equipe/repartition` | Codée, tests OK (accès et menu, recherche et détail support aux coordonnées masquées, statut et révélation avec motif tracé, répartition et actions livraison/livreur confirmées puis relues) ; essai émulateur avec un compte d'équipe à faire | 5 |
| E2 | Finances (`finances`) | `/equipe/finances` | Codée, tests OK (relevé lu strictement, lecture seule, lien d'édition vers le site) ; essai émulateur à faire | 5 |
| E3 | Paiements (`paiements`) | `/equipe/paiements` | Codée, tests OK (lecture seule, aucun numéro de versement retenu, décisions d'argent laissées au site) ; essai émulateur à faire | 5 |
| E4 | Restaurants : liste, fiche, enregistrer le profil (`restaurants`, `fiche`, `enregistrerProfil`) | `/equipe/restaurants(/[id](/profil))` | Codée, tests OK (état lu, fiche et menu, profil simple horaires + numéro interne ; publication et suspension laissées au site) ; essai émulateur à faire | 6 |
| E5 | Menus et photos : lire, importer ; confirmer et disponibilité (`lire`, `importer`, `reconfirmer`, `definirDisponibilite`) | `/equipe/menus(/[id](/photo, /import), /confirmer, /disponibilite)` | Codée, tests OK (fraîcheur, plats, reconfirmation, disponibilité, lecture d'une photo de menu relue avant import des plats cochés) ; essai émulateur à faire | 6 |
| E6 | Référencements : demandes, changer le statut, créer un établissement, rattacher un compte, options | `/equipe/referencements(/…)` | Codée, tests OK (demandes sans e-mail ni chemin de fichier, statuts, création depuis les listes officielles, rattachement confirmé) ; essai émulateur à faire | 6 |
| E7 | Partenariats : liste, changer le statut | `/equipe/partenariats(/statut)` | Codée, tests OK (suivi de statut confirmé ; suppression laissée au site) ; essai émulateur à faire | 6 |
| E8 | Avis : lister, modérer (`avis`, `moderer`) | `/equipe/avis(/moderation)` | Codée, tests OK (signalements et alertes lus, décisions avec motif pour retirer du contenu, confirmées puis relues) ; essai émulateur à faire | 7 |
| E9 | Bannières et médias (`bannieres`, `medias`) | `/equipe/bannieres`, `/equipe/medias` | Codée, tests OK (listes lues, troncature signalée ; création et publication laissées au site) ; essai émulateur à faire | 7 |
| E10 | Paramètres (`parametres`) | `/equipe/parametres` | Codée, tests OK (les quatorze réglages lus strictement, consultation seulement) ; essai émulateur à faire | 7 |
| E11 | Comptes (`comptes`) | `/equipe/comptes` | Codée, tests OK (annuaire lu et cherché par e-mail ; suppressions et rôles laissés au site) ; essai émulateur à faire | 8 |
| E12 | Audit (`audit`) | `/equipe/audit` | Codée, tests OK (indicateurs, filtres proposés par le serveur et journal lus) ; essai émulateur à faire | 8 |
| E13 | Liste d'attente : zones, marquer comme prévenu (`zones`, `marquerPrevenue`) | `/equipe/liste-attente(/prevenue)` | Codée, tests OK (zones et nombres seulement, marquage confirmé puis relu) ; essai émulateur à faire | 8 |
| E14 | Mises à jour : annonces de version (`misesAJour`) | `/equipe/mises-a-jour` | Codée, tests OK (version, annonce, interrupteurs et journal lus ; bascules et annonces laissées au site) ; essai émulateur à faire | 8 |
| E15 | Activité et vue d'ensemble de l'équipe | `/equipe/tableau` | Codée avec le tableau de E1 (même lecture : blocs par domaine selon le rôle) ; essai émulateur à faire | 5 |

## 4. Totaux au 12 novembre 2026

Voir §8 : 20 lignes reprises sur 65, 39 à confirmer, 6 absentes.

## 5. Lots proposés (ordre de reprise)

L'ordre suit la valeur pour les utilisateurs actuels et le risque : d'abord ce qui manque à tout le monde ou qui est exigé par les boutiques, ensuite les métiers, ensuite l'administration.

- **Lot 1, client et sécurité (A2 à A5, A7 à A9, A11, B7 à B11, B15).** Suppression de compte, proposition de prix, connexion Facebook et par code, verrou, mot de passe oublié, inscription, aide, favoris, adresses, espace client, réception réelle d'une notification. C'est le socle sans lequel un client ne peut pas quitter l'ancienne appli.
- **Lot 2, restaurateur complet (C5, C7, C8, C10 à C13).** Documents, historique, activité, photos, sonnerie, service de surveillance au premier plan.
- **Lot 3, livreur complet (D3 à D10).** Essai des offres et courses contre la vraie base, gains, historique, aide, position GPS et service de premier plan.
- **Lot 4, reste du client (A10, A12, B12, B13).** Visite guidée, liens profonds, candidature, cache hors ligne.
- **Lots 5 à 8, Équipe.** Lot 5 : exploitation, finances, paiements. Lot 6 : restaurants, menus, référencements, partenariats. Lot 7 : avis, bannières et médias, paramètres. Lot 8 : comptes, audit, liste d'attente, mises à jour.
- **Lot 9, parité finale et remplacement.** Revue ligne par ligne de cette matrice, essais sur plusieurs téléphones (dont un 32 bits), décision de Malika, puis `/installer` : la nouvelle appli devient la principale et l'ancienne passe en second.

Pour chaque lot : tests écrits avant le code (y compris les refus), relecture indépendante, contrôles du dépôt (types, qualité, tests, cloisonnement), compilation par la CI, signature par Malika, essai sur émulateur puis téléphone, déploiement seulement avec un feu vert.

## 6. Points durs et risques

1. **Modules natifs** (service de premier plan, GPS, sonnerie plein écran, verrou biométrique, Facebook) : ils demandent des plugins de configuration Expo, des permissions, et des essais sur un vrai téléphone, car l'émulateur ne les prouve pas toujours. Les restrictions des services de premier plan sous Android récent peuvent obliger à adapter le comportement de l'ancienne appli.
2. **Connexion Facebook :** il faut un client configuré pour le nouvel identifiant `com.speedfood.mobile` et la nouvelle empreinte de signature. À préparer avec Malika (compte développeur Facebook).
3. **Équipe :** ce sont des actions sensibles (paiements, comptes, finances). Les routes du site contrôlent les droits ; le client doit seulement afficher et envoyer, jamais décider. Chaque écran sera testé avec un compte sans droit (refus attendu).
4. **Taille et performance :** l'APK est déjà de 62 Mio. Ajouter une quinzaine de consoles et des modules natifs l'alourdira ; surveiller.
5. **Téléphones 32 bits :** `armeabi-v7a` n'a jamais été exécuté sur un appareil. À prouver avant le remplacement.
6. **Parité fonctionnelle, pas visuelle :** la nouvelle appli peut avoir une autre interface ; ce qui compte, c'est que chaque fonction existe et se comporte de même. Toute différence voulue est consignée ici avec la décision de Malika.
7. **Données locales :** les données locales de l'ancienne appli (panier, session) ne passent pas dans la nouvelle ; les données serveur (comptes, commandes) restent.

## 7. Questions ouvertes pour Malika

- Connexion Google : la reprendre quand même, ou non (le site ne la déclare pas active) ?
- Date visée pour le remplacement, et durée pendant laquelle l'ancienne reste proposée ensuite ?
- Priorité si l'on doit arbitrer : lots métiers (2 et 3) avant le lot 1 ?

## 8. Totaux calculés

| Famille | Lignes | Reprise | À confirmer | Absente |
|---|---|---|---|---|
| A. Accès, compte, profil | 12 | 1 | 8 | 3 |
| B. Client | 15 | 11 | 3 | 1 |
| C. Restaurateur | 13 | 6 | 6 | 1 |
| D. Livreur | 10 | 2 | 7 | 1 |
| E. Équipe | 15 | 0 | 15 | 0 |
| **Total** | **65** | **20** | **39** | **6** |

Soit **20 lignes sur 65 (31 %) réellement reprises** au sens du §1, **39 à confirmer** et **6 absentes**. Ces totaux sont recalculés à chaque mise à jour de la matrice : le remplacement n'est proposé qu'à 65 sur 65 lignes « Reprise ».

## Journal
- 12 novembre 2026 : décision de Malika (tout reprendre, Équipe comprise, puis remplacer) ; matrice établie à partir de la couche données Kotlin, des routes du site et du code Expo. Aucune fonction n'a encore été reprise par ce document.

## Avancement du lot 1 (12 novembre 2026, branche `lot1-client-securite`, non poussée)

Code et tests écrits, **aucun essai sur émulateur ni sur téléphone encore** : ces lignes restent donc « Codée » et ne passent à « Reprise » qu'après les essais (règle du §1).

| Ligne | Commit | Ce qui est fait |
|---|---|---|
| A11 Aide et contact | d16ddc6 | WhatsApp et appel (numéro lu sur `/aide`), FAQ, à propos, liens légaux |
| B7 Propositions de prix | 14f3b5f | proposition lue en entier, accepter ou refuser avec confirmation, un seul essai, suivi relu après la réponse |
| A8 Suppression de compte | 9379cb9 | mot SUPPRIMER vérifié avant le réseau, refus certain distingué de l'incertain, session et coffre effacés sans révocation distante |
| A2 et A3 Inscription, mot de passe oublié | ebbeca8 | mêmes appels `signup` et `recover` que l'ancienne appli, règles locales, messages sans texte brut du serveur |
| B9 à B11 Profil, adresses, favoris | 9d96a95 | écran « Mon espace », cœur de favori sur la fiche restaurant, écritures jamais rejouées (un favori se bascule) |
| A7 Verrou des espaces pro | d42a1ff | règle portée à l'identique, branchement `expo-local-authentication` (nouvelle dépendance officielle d'Expo) |

Reste dans le lot 1 : **A4 et A5** (connexion Facebook, bloquée par le client OAuth et l'application Facebook), **A9** (décision de conception sur le choix du profil), **B15** (réception réelle d'une notification, à essayer avec un compte de test).

À vérifier : l'espace client de Kotlin porte aussi une liste d'**avis** laissés (`EspaceClient.avis`), qui n'a pas de ligne dans la matrice. À relire côté Kotlin avant de dire que l'inventaire est complet.

## Essais sur émulateur du lot 1 (12 novembre 2026, suite)

Contrôles relancés avant les essais : tests mobile 677/677, `tsc` mobile 0, `typecheck` racine 0 (les 8 échecs vus en bac à sable venaient du bac à sable : mêmes fichiers à 10/10 hors bac à sable). Essais menés sur l'émulateur `speedfood-essai` (appli `com.speedfood.clientdemo` du lot), session connectée par Malika elle-même et laissée connectée ; aucune déconnexion, aucune suppression de compte, aucun déploiement. Captures et journaux hors dépôt.

- **B9, B10, B11 passent en « Reprise »** : espace relu du serveur (profil, 0 adresse, 0 favori au départ) ; favori ajouté puis retiré sur la fiche, état relu à chaque fois ; adresse de test ajoutée (« 1 sur 5 ») puis supprimée (« 0 sur 5 ») ; mode préféré passé en Retrait, enregistré (« Modifications enregistrées. »), puis restauré en Livraison et vérifié par réouverture de l'espace.
- **A2 et A3, essai partiel** : écrans et validations locales prouvés en captures (nom, téléphone, e-mail, mot de passe pour A2 ; e-mail invalide pour A3). Aucun envoi réel : l'inscription complète et le lien de réinitialisation demandent un compte jetable désigné.
- **A8, garde-fou seulement** : panneau lu, mot faux (« TEST ») laissant le bouton de suppression désactivé, fermeture par « Non, garder mon compte », compte intact et session toujours connectée. La suppression réelle reste à faire sur un compte jetable.
- **A7, partiel** : réglage affiché avec le compte professionnel connecté (désactivé) ; l'émulateur n'ayant pas de verrouillage d'écran, la branche « configurez d'abord un verrouillage d'écran » est vérifiée. Activation et écran de verrouillage à essayer sur un vrai téléphone.
- **B7, non exercé** : liste et suivi lus (commandes TEST terminées ou annulées) ; aucune proposition en attente à répondre. Demande un scénario dédié (commande en attente + proposition du restaurant), à préparer avec un oui distinct.
- **Incident d'automatisation pendant B11** : une saisie `adb` a temporairement altéré le pseudo affiché (« eloh toim ») et le mode est resté en Retrait après le premier essai de restauration. Corrigé dans la même session : pseudo « elohim » et mode Livraison réenregistrés, puis **vérifiés par réouverture de l'espace** (relecture serveur). Aucune autre donnée touchée ; adresses et favoris revenus à zéro comme au départ.

## Lot 2 commencé : C8 historique du restaurateur (12 novembre 2026, suite)

Premier code du lot 2, sur la branche en cours (à séparer au commit) : domaine pur `historique-restaurateur.ts` (lecture stricte d'une page : statuts finaux seulement, total = sous-total + frais, ligne illisible écartée et comptée, aucune coordonnée client retenue), client `historiqueRestaurant` (page vérifiée avant le réseau, un seul essai), session et section « Historique » de l'espace restaurateur (pages de 20, « Charger la suite » sans doublon, actualisation manuelle). Tests écrits avant le code : 7 nouveaux tests, suite mobile **684/684**, `tsc` mobile et typecheck racine à 0 ; le test des sections existant est mis à jour (Commandes, Service, Menu, Historique). **Aucun essai émulateur** : l'APK installé est une release figée, il faut compiler un nouvel APK de contrôle (CI) avant de marquer C8 « Reprise ». Aucun déploiement.

Suite du lot 2 sur la branche `lot2-restaurateur` : **C10 activité** (domaine `activite-restaurateur.ts`, section « Activité » : aujourd'hui, 7 jours, répartition, dernières terminées ; 5 tests) et **C5 documents** (numéros de reçu/facture lus dans la liste — sans jamais retenir les liens WhatsApp — boutons « Établir le reçu numéroté / une facture » sous les mêmes règles que l'ancienne appli, un seul essai puis relecture ; 10 tests). Pour **C7**, l'envoi et le retrait de photo existaient déjà (D4c) sans couverture du retrait : 3 tests ajoutés (corps `retirer=1`, correspondance relue, verdict après échec). Un test C5 a été corrigé en cours de route : une clé de document absente vaut « pas encore établi » (comme l'ancienne appli), seul un type faux écarte la ligne. Suite mobile **702/702**, types à 0. Essais émulateur de C5, C7, C8 et C10 à grouper sur le prochain APK de contrôle. Restent au lot 2 : C11 sonnerie plein écran, C12 service de premier plan (modules natifs, à prototyper tôt), C13 réception réelle d'une notification restaurateur.

Vers C11/C12 : la logique de surveillance de l'ancienne appli est portée en TypeScript (`surveillance-commandes.ts`, règles et horloge testées : 6 tests, suite à **708/708**) et branchée au premier plan dans l'espace restaurateur (bandeau « Nouvelle commande à traiter » à chaque liste relue qui alerte). C'est la fondation commune ; la sonnerie, l'écran gardé allumé et le service de premier plan restent un chantier natif Android (module local + compilation CI + essai sur vrai téléphone), non écrit à l'aveugle. C13 reste un essai réel à mener avec le prochain APK de contrôle.

## Lot 3 commencé : D7 gains, D6 historique, D8 assistance (branche `lot2-restaurateur`, suite)

Constat avant code : les routes `file`, `historique` et `dossier` que l'ancienne appli appelle n'existent **ni sur le site ni dans l'API unique** ; seuls `etat`, `offre`, `course`, `en-ligne`, `position` et `gains` (site) existent. D7 est donc codée contre la route du site `/livreur/gains`, comme l'ancienne appli (frais de course, jamais une paie ; l'écran ne dit ni « gain » ni « paie » — un test existant l'impose et a fait renommer l'écran en « Mes courses livrées et leurs frais »). Pour D6, la route du site `POST /api/v1/livreur/historique` est créée (même patron que les gains : jeton, livreur tiré du compte, courses livrées paginées par 20, aucune coordonnée client) ; elle ne servira qu'au déploiement du site, le moment venu et avec un feu vert. Côté appli : domaines purs testés avant le code (8 tests), écrans « Mes courses livrées et leurs frais » (gains + historique paginé) et « Assistance conducteur » (D8 : règles de la plateforme, incident selon la course en cours, numéro lu sur `/aide`). D10 se confond avec D7 (même route `/livreur/gains` côté ancienne appli). Suite mobile **716/716**, types mobile et racine à 0, tests unitaires du site à 0. Essais émulateur à grouper avec le prochain APK de contrôle ; D5 (file) demandera la même création de route côté serveur, D9 reste natif (position + service de premier plan).

D5 file, dans la foulée : route du site `GET /api/v1/livreur/file` créée (courses actives projetées par le contrat partagé, client seulement après récupération, course illisible = erreur jamais une file tronquée), domaine `file-livreur.ts` (course en cours : état d'abord, file en repli ; suivantes exclues) et bloc « File des courses » dans l'espace livreur, par la session injectée comme le reste de l'écran (un premier branchement direct au singleton a été refusé par deux tests de câblage existants, corrigé). 3 tests de plus, suite à **719/719**. Au lot 3, il ne reste que D9 (position GPS et service de premier plan, natif) et les essais réels de D3/D4 contre la vraie base.

## Lot 4 : A12 liens profonds, A10 visite guidée, B12 candidature, B13 cache hors ligne

Quatre lignes codées, tests avant le code à chaque fois (4 + 7 + 6 tests) : **A12** — seuls les liens des hôtes Speedfood connus sont interprétés (`/r/…` ouvre la fiche, `/commande/…` ouvre « Mon compte », tout le reste est ignoré) ; **A10** — visite guidée fidèle (deux écrans client, deux restaurateur), proposée une seule fois au premier lancement et rouvrable depuis l'accueil et l'espace restaurateur ; **B12** — candidature complète contre les routes du site : formulaire en trois temps, quartiers du catalogue, plats saisis ou lus sur la photo du menu (relus avant ajout, refusés nommés), envoi en un essai, logo et photo après dépôt ; **B13** — cache hors ligne du catalogue : chaque lecture réussie est gardée dans une base dédiée, rendue hors ligne avec son ancienneté (« Vous êtes hors ligne… »), revalidée strictement et jamais servie après 7 jours ; commander exige toujours le réseau. Suite mobile **736/736**, types à 0. Le lot 4 est entièrement codé ; il ne manque que les essais émulateur, groupés avec le prochain APK de contrôle.

## Lot 5 commencé : espace équipe, tableau, finances, paiements

Fondation de l'espace équipe (entrée « Espace équipe » dans « Mon compte » quand le rôle lu sur `/moi` le donne, sous le même verrou que les autres espaces professionnels ; chaque module est relu par la session et le serveur refuse proprement un module sans droit) et trois lectures codées, tests avant le code (4 + 4 tests) : **tableau de bord** (E1/E15 : blocs commandes, exploitation et catalogue seulement si le rôle y a droit — un bloc absent n'est jamais remplacé par un zéro inventé), **finances** (E2 : relevé L3 en lecture seule, taux marqués « (développement) », édition renvoyée au site) et **paiements en ligne** (E3 : lecture seule, compteurs et versements, aucun numéro de téléphone retenu, décisions d'argent laissées au site). Suite mobile **744/744**, types à 0. Restent au lot 5 : les commandes et actions d'exploitation de E1 (détail, statuts, coordonnées révélées, répartition, actions livraison/livreur) ; puis les lots 6 à 8 (restaurants/menus/référencements/partenariats, avis/bannières/paramètres, comptes/audit/liste d'attente/mises à jour).

E1 complétée ensuite : accès du compte et son menu (natif ou site), recherche de commandes et détail support (coordonnées masquées partout, historique et propositions), changement de statut et révélation des coordonnées — chacun avec motif obligatoire, confirmation, un seul essai et relecture ; poste de répartition (accepter, refuser, prête, remise, annuler) et exploitation livreurs (affecter, relancer, avancer, annuler ; mettre en/hors ligne, approuver, refuser, suspendre, réactiver, archiver, motif où le serveur l'exige). Deux formes ont été corrigées sur le contrat réel du serveur en cours de route : les coordonnées révélées (`{telephone, adresse, devoilees}`) et l'avancement d'une livraison (`{action: 'avancer', vers}`). 9 tests de plus, suite à **753/753**. Le lot 5 est entièrement codé ; il ne manque que les essais émulateur avec un compte d'équipe.

## Lot 6 : établissements, menus, référencements, partenariats

Quatre modules de plus dans l'espace équipe, tests avant le code (5 tests) : **E4 établissements** (état et fiche lus, menu de la fiche, profil simple — horaires et numéro interne — validé comme le serveur ; publication, suspension et suppression restent sur le site, l'écran le dit), **E5 menus** (fraîcheur par établissement, plats, reconfirmation d'un plat ou de tout le menu et disponibilité, confirmées puis relues ; l'import d'un menu écrit et l'envoi d'une photo de plat restent à coder), **E6 référencements** (demandes lues sans e-mail ni chemin de fichier, dossier de candidature résumé, changements de statut avec motif de refus lu par le demandeur, création de l'établissement depuis les listes officielles et rattachement du compte, confirmés puis relus) et **E7 partenariats** (suivi de statut ; suppression laissée au site). Suite mobile **758/758**, types à 0. Restent les lots 7 et 8 : avis et signalements, bannières et médias, paramètres, comptes, audit, liste d'attente et mises à jour.

## Lots 7 et 8 : avis, contenus, comptes, audit, attente, mises à jour

Les sept dernières lignes Équipe, tests avant le code (4 + 4 tests) : **E8 avis** (signalements et alertes de qualité, quatre décisions de modération avec motif exigé pour retirer du contenu public), **E9 bannières et médias** et **E10 paramètres** (lectures seules : publier, envoyer une image ou changer un réglage reste sur le site, l'écran le dit et y renvoie), **E11 comptes** (annuaire cherché par e-mail, affiliations ; suppressions et rôles sur le site), **E12 audit** (indicateurs, filtres proposés par le serveur, journal), **E13 liste d'attente** (zones et nombres seulement, aucun contact ; marquage « prévenue » confirmé puis relu) et **E14 mises à jour** (version publiée, dernière annonce, interrupteurs et nouveautés, en consultation). Suite mobile **766/766**, types mobile et racine à 0. **Toute la famille Équipe est codée.** Il ne reste comme lignes absentes que celles des blocages externes et du natif : A4, A5 et A6 (connexions sociales, décisions et configurations de Malika), C12 (service de premier plan), D9 (position et service livreur) — et, partout, les essais émulateur et téléphone qui feront passer les lignes « Codée » en « Reprise ».

E5 complétée juste après : lecture d'une photo de menu pour un établissement tenu par l'équipe (rien n'est conservé, lignes relues et refusées nommées) et import des plats cochés, préparé et vérifié avant le réseau (une ligne invalide arrête tout et est nommée). 1 test de plus, suite à **767/767**.

## Connexions sociales et prototype natif

**A4, A5 et A6 codées** par le socle commun des connexions sociales : boutons affichés seulement si le service d'authentification a activé le fournisseur (Facebook : et l'interrupteur de l'équipe), parcours navigateur PKCE (le même échange `grant_type=pkce` que l'ancienne appli), code du retour lu seulement sur la page relais du site ou le lien de l'application, secret PKCE gardé en mémoire le temps du parcours. 4 tests, suite à **771/771**. L'essai réel de Facebook reste subordonné à l'application Meta de Malika rendue publique ; Google s'essaiera dès qu'il est actif côté service d'authentification.

**Prototype natif C11/C12/D9 écrit** : module Expo local `apps/mobile/modules/speedfood-veille` (deux services de premier plan Android + pont TypeScript qui se dégrade sans erreur quand le natif est absent, testé). Aucun jeton ne passe côté natif : la session TypeScript garde les lectures (relecture restaurateur toutes les 15 secondes) et envoie les positions du livreur ; le natif sonne, allume l'écran et remonte les positions. Trois tests existants ont borné le prototype : aucun mot de géolocalisation dans l'écran livreur (branchement sorti dans `suivi-livreur.ts`), aucune permission Android écrite dans `app.json` (celles du module vivent dans son propre manifeste). Suite à **772/772**, types à 0. **Aucune compilation Kotlin n'a été vérifiée ici** : la première compilation du module se fera en CI, puis essais sur vrai téléphone ; C12 et D9 restent donc « Absente » dans la matrice tant que ce n'est pas fait.
