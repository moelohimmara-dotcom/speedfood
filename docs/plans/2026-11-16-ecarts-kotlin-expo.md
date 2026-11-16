# Écarts Kotlin et Expo, relevé fin du 16 novembre 2026

Demande de Malika : répliquer dans l'appli Expo toutes les fonctionnalités et caractéristiques de l'ancienne appli Kotlin, car beaucoup manque encore.

**Pourquoi la matrice de 65 lignes ne suffisait pas.** Elle a été dressée à partir des opérations de la couche données Kotlin (une ligne par fonction d'API). Elle ne voit donc pas ce que l'ancienne appli **affiche** et **mémorise** : photos, prix barrés, suppléments, sections du menu, note, zones, bandeaux, réachat, commandes gardées sur le téléphone, rafraîchissement automatique. Une ligne « Reprise » veut dire que la route est reprise, pas que l'écran est aussi riche.

Méthode de ce relevé : lecture des écrans Kotlin (`mobile/shared/.../ui`) et des modèles (`data/Menu.kt`, `data/Restaurant.kt`, `data/RestaurantApi.kt`), comparés au contrat Expo (`packages/shared/src/contracts/catalogue.ts`) et aux écrans montés (`CatalogueReel`, `CompteReel`). Les écarts ci-dessous sont **constatés dans le code**, pas supposés. Ce relevé couvre d'abord le parcours client ; les parcours restaurateur, livreur et Équipe restent à relire écran par écran avec la même méthode.

## Écarts constatés, parcours client

| N° | Écart | Preuve côté Kotlin | État dans Expo | Tranche |
|---|---|---|---|---|
| G1 | Photos et logos : vignette du restaurant (logo, sinon photo) et photo de chaque plat | `Vignette(...)` dans `RestaurantScreen.kt`, `photo_url` et `logo_url` | Contrat sans photo ni logo, cartes en texte seul | 10.1 |
| G2 | Prix promo : prix payé en rouge et prix normal barré | `Plat.prixEffectif`, `enPromo`, `CartePlat` | Le contrat ne donne que le prix effectif, pas le prix normal | 10.1 |
| G3 | Menu par sections (« Entrées », « Plats »…), plats sans section sous « Autres plats » ou « Plats » | `Menu.groupes()`, table `menu_sections` | Liste plate de plats | 10.1 |
| G4 | Note moyenne et nombre d'avis sur la carte et la fiche (« ★ 4,5 (12) ») | `noteMoyenne`, `avis_somme`, `avis_total` | Absente du contrat | 10.1 |
| G5 | Fiche restaurant : horaires, consignes, moyens de paiement acceptés, fraîcheur du statut (« confirmé il y a… »), pastille d'état | `EnteteRestaurant` | Seulement ouvert ou fermé et la date du statut | 10.1 |
| G6 | Suppléments d'un plat (« Piment +500 »), fenêtre de choix avant l'ajout, prix mis à jour | `ChoixOptionsDialogue`, `menu_item_options` | Aucun supplément : le panier ne les connaît pas, alors que le contrat de commande les accepte déjà (`optionIds`) | 10.2 |
| G7 | Panier : suppléments par ligne, prix unitaire, « Ajouter d'autres plats », bandeau « Voir mon panier · N articles · total » sur la fiche | `PanierScreen.kt`, `RestaurantScreen.kt` | Panier sans suppléments, pas de bandeau sur la fiche | 10.2 |
| G8 | « Changer de restaurant ? » : vider le panier et commencer ici en un geste | `AlertDialog` de `RestaurantScreen.kt` | Message demandant de vider le panier à la main | 10.2 |
| G9 | Accueil : choix de zone (« Zone : Kipé, Changer »), liste des zones avec nombre de restaurants, mémorisé | `AccueilRestaurants.kt`, `zonesDisponibles` | Absent | 10.3 |
| G10 | Accueil : sections de restaurants, recherche « un restaurant, un quartier, un plat » | `RechercheEtListe(avecSections = true)` | Recherche simple sur les restaurants chargés | 10.3 |
| G11 | Bannières de l'accueil | `ImageBanniere`, `Composants.kt` | Absentes de l'accueil client (seule la lecture Équipe existe) | 10.3 |
| G12 | Commandes sans compte : gardées sur le téléphone, retrouvées même déconnecté ; « Oublier les commandes de cet appareil » | `CompteScreen.kt` (rubrique « Cet appareil ») | Expo exige un compte pour commander et pour voir ses commandes | à trancher |
| G13 | « Commander à nouveau » depuis une commande passée | `MesCommandesScreen.kt` | Absent | 10.4 |
| G14 | Suivi : rafraîchissement automatique, heure de préparation « Prête vers HH:MM », délai habituel, boutons « Appeler l'assistance » et WhatsApp dans l'écran | `SuiviScreen.kt` | Suivi manuel (bouton « Actualiser »), pas de contact dans l'écran | 10.4 |
| G15 | Mes avis : liste des avis laissés, réponse du restaurant | `AvisClientScreen`, `CarteAvis` | Absent (et sans ligne dans la matrice) | 10.5 |
| G16 | Paramètres : test des notifications, vérification des mises à jour et téléchargement, revoir la visite guidée | `ParametresScreen` | Partiels ou absents, à vérifier un par un | 10.5 |
| G17 | Écran d'entrée « Qui êtes-vous ? » (client, restaurateur, livreur, Équipe) | `EntreeScreen.kt`, `ChoixProfil.kt` | Absent (décision de conception A9) | à trancher |

## Plan

- **10.1 Catalogue riche** : étendre le contrat et la route du catalogue de façon **additive** (champs facultatifs, l'ancienne appli et les versions installées ne sont pas touchées), puis lecture stricte dans l'appli et affichage (G1 à G5). Tests écrits avant le code, côté API et côté appli.
- **10.2 Suppléments, panier et commande** (G6 à G8) : modèle de panier avec suppléments, mémorisation, calcul des totaux, envoi des `optionIds`.
- **10.3 Accueil** (G9 à G11).
- **10.4 Commandes et suivi** (G13, G14).
- **10.5 Avis et paramètres** (G15, G16).
- Ensuite, relevé fin des espaces restaurateur, livreur et Équipe, avec la même méthode.

Règles inchangées : aucun déploiement, publication ni signature sans le feu vert de Malika ; une ligne ne passe « Reprise » qu'avec les cinq conditions de la matrice. Les changements de l'API sont déployés seulement après tests et accord.

## Avancement (16 novembre 2026, branche `lot10-catalogue-riche`, poussée sous `etape-lot10-catalogue`)

Rien de ce qui suit n'est encore compté « Reprise » : le code et les tests sont faits, l'essai sur émulateur reste à faire.

| Écart | État |
|---|---|
| G1 à G5 (photos, promo, sections, note, fiche) | Codés et testés (API 729 tests, appli 825). **API déployée le 16 novembre 2026** (version `bf1d7e9f`), contrôles en ligne bons. Essai émulateur à faire. Les données réelles (un seul restaurant, aucun plat avec photo, section ou supplément) ne montrent pour l'instant que les horaires et un prix barré. |
| G6 à G8 (suppléments, panier, commande, « Changer de restaurant ? ») | Codés et testés. Une ligne du panier = un plat et ses suppléments ; le total compte les suppléments (le serveur compare le sous-total affiché au sien) ; plafond de 20 suppléments par ligne comme le serveur. Le bandeau « Voir mon panier » existait déjà en bas d'écran. Essai émulateur à faire, surtout un vrai plat avec supplément (à créer côté restaurateur ou en base d'essai). |
| G17 (écran « Qui êtes-vous ? ») | Codé et testé. Trois cartes (client, restaurateur, livreur) et un lien « Équipe Speedfood ». Chaque piste lit les droits du compte et mène à l'espace, à la connexion (messages de l'ancienne appli) ou à un refus précis. La décision A9 est tranchée par Malika (« la nouvelle appli ne demande pas… »). Essai émulateur à faire. |

Constats complémentaires de cette relecture :

- **Livreurs** : dans l'ancienne appli, il n'y a **pas** d'inscription de livreur dans l'application. Le compte livreur est ouvert par l'équipe Speedfood, le dossier d'identité se dépose sur le site, et un livreur « candidat » voit « fiche en cours d'examen ». La piste « Je suis livreur » reprend exactement cette règle. Si Malika veut en plus une inscription de livreur dans l'appli, c'est une fonction nouvelle, pas une reprise.
- **Équipe** : les modules existent dans Expo (tableau, commandes support, répartition, exploitation livreurs avec approbation des candidats, établissements, menus, référencements, partenariats, avis, bannières, médias, paramètres, comptes, audit, liste d'attente, mises à jour, finances, paiements). Ce qui manquait était la porte d'entrée, désormais faite.
- **G18 (nouveau, constaté)** : l'ancienne appli a une **barre d'onglets** pour le client (Restaurants, Commandes, Panier, Compte) et **trois coques séparées** selon le profil choisi (client, restaurateur, professionnel). Expo a une page unique avec des fenêtres. C'est un écart de navigation, à trancher avec Malika : la refonte en onglets est un gros chantier de structure.
- **Pas encore relus** : les écrans restaurateur et livreur écran par écran (textes, états, boutons). Le relevé précédent n'a couvert que le parcours client et l'entrée.
### Mise à jour du soir : barre d'onglets et icônes (demande de Malika)

- **G18 (barre d'onglets) : décidé par Malika (« oui pour la barre d'onglets »), codé et testé.** Quatre onglets fixes comme l'ancienne appli : Restaurants, Commandes, Panier, Compte, avec pastille du nombre d'articles sur Panier. Panier et Compte s'affichent dans la page sous la barre ; l'onglet Commandes a sa vue dédiée (liste et suivi). Les espaces restaurateur, livreur et équipe gardent leur coque plein écran sans la barre, comme les « coques » de l'ancienne appli. Essai émulateur à faire.
- **Icônes à la place de boutons** : cœur seul pour les favoris (plein quand le restaurant est en favori), « + » rond pour ajouter un plat, `−`, `+` et corbeille dans le panier, flèche pour « Retour », cercle fléché pour « Actualiser », corbeille pour supprimer une adresse, loupe dans la recherche, Aide et Visite guidée en icônes rondes dans l'en-tête. Chaque bouton à icône seule garde un nom accessible complet (« Supprimer « Maison » », « Ajouter Poulet au panier »), vérifié par un test sur tout le code de l'appli. Les actions graves ou rares gardent leur texte (Commander, Me déconnecter, Supprimer mon compte).
### Essai sur émulateur du 16 novembre 2026 (APK de contrôle, run 60, commit `1c3e25c`)

Installée par-dessus la précédente, sans effacement : le compte de test (client, restaurateur, livreur, équipe) est resté connecté.

Vu et conforme :
- **G17 écran d'entrée** : proposé au premier lancement de cette version, trois cartes avec icône ; la piste « restaurateur » ouvre directement « Espace restaurateur » (barbie food, 16 commandes d'historique, 0 à traiter).
- **G18 barre d'onglets** : quatre onglets, onglet actif marqué ; « Compte » (profil, espaces, verrou) et « Commandes » (vraies commandes, bouton d'actualisation en icône) s'affichent dans la page sous la barre ; « Restaurants » garde la fiche ouverte ; pastille « 1 » sur Panier après un ajout ; bandeau « 1 article · Voir le panier » au-dessus de la barre.
- **G1 à G5 fiche et menu** (données réelles) : vignette à initiale quand il n'y a pas de photo, pastille « Ouvert », « Statut à confirmer (dernière confirmation il y a 12 jours) », cœur seul, plat en promo avec **25 000 GNF en rouge et 30 000 GNF barré**, « À confirmer, dernière confirmation il y a 35 jours », « + » rond.
- **Panier** : actualiser, vider et retirer en icônes, `−` et `+`, total 25 000 GNF au prix promo. La ligne d'essai a été retirée ensuite : le panier est revenu vide.

Défauts trouvés à l'essai, corrigés dans le commit suivant (à vérifier sur la prochaine APK) : mots coupés et icône invisible sur l'onglet actif de l'espace restaurateur ; boutons « J'ai un restaurant » et « Changer d'espace » et note d'accueil au-dessus du menu d'une fiche ; grand vide sous chaque plat ; panier vide affichant un nom de restaurant et une note ; titre « Mes commandes » en double.

Non essayé (donnée ou compte manquant) : choix de suppléments et « Changer de restaurant ? » (aucun plat avec supplément en base, un seul restaurant), photo et logo réels, note ★, sections du menu, pistes livreur et équipe, messages de refus et de connexion (le compte de test a tous les rôles et est connecté), ajout d'un plat d'un autre restaurant. Ces points restent « codés, testés » et ne passent pas « Reprise ».

### Mise à jour : commandes et suivi (tranche 10.4)

- **G14 (suivi)** : codé et testé. Pastille d'état avec les mots de l'ancienne appli, frise « Envoyée, Acceptée, Prête, Terminée » (aucune frise si refusée ou annulée), « Prête vers HH:MM » (heure de Conakry) ou délai habituel du restaurant avant sa réponse, livraison estimée, total, message d'assistance après la réponse du restaurant, boutons « Appeler l'assistance Speedfood » et WhatsApp, relecture automatique toutes les 15 s tant que la commande n'est pas finie (jamais pendant une action, réponse ignorée si le compte a changé, bandeau « Connexion perdue »).
- **G13 (Commander à nouveau)** : codé et testé. L'appareil mémorise (10 dernières commandes envoyées, base locale à part, identifiants et quantités seulement, suppléments compris). Le bouton apparaît dans la liste et en fin de suivi ; il relit le menu actuel et rebâtit le panier ; une ligne dont le plat est épuisé, retiré ou dont un supplément a disparu est ignorée et comptée, jamais remplacée ; panier d'un autre restaurant : confirmation « Vider et recommander ». Limite connue : seules les commandes envoyées DEPUIS cet appareil depuis cette version sont recommandables (les anciennes n'ont pas de lignes mémorisées). Essai émulateur à faire.

### Mise à jour : accueil (tranche 10.3)

- **G9 (zones)** : codé et testé. Pastille « Zone : Kipé · Changer » (seulement avec au moins deux zones), fenêtre « Où voulez-vous commander ? » avec « Toutes les zones » et le nombre de restaurants par zone, zone mémorisée sur l'appareil, zone par défaut = la plus fournie, aucune position demandée.
- **G10 (liste et recherche)** : codé et testé. Filtres Tous, Ouverts, On peut commander ; recherche par nom, quartier ou cuisine sans casse ni accents (tous les mots) ; sections « Ouverts maintenant », « Les mieux notés » (3 au plus, avec une vraie note) puis « Tous les restaurants », seulement sans recherche ni filtre et avec au moins 4 restaurants. Constat : le texte de recherche de l'ancienne appli parle d'un plat, mais son code ne cherche que nom, quartier et cuisine ; Expo reprend le comportement réel et l'annonce honnêtement.
- **G11 (bannières)** : écart retiré après relecture. ImageBanniere n'est utilisé que dans les écrans Équipe (bannières et médias), jamais à l'accueil client de l'ancienne appli. Les écrans Équipe correspondants existent déjà dans Expo.
- Essai émulateur à faire (une seule zone en base : la pastille et les sections ne se verront qu'avec des données d'essai).

### Mise à jour : avis et paramètres (tranche 10.5)

- **G15 (Mes avis)** : codé et testé. Rubrique « Mes avis » dans l'espace client : restaurant, étoiles, commentaire (déjà vidé par le serveur s'il est masqué), « En attente de modération », « Réponse du restaurant ». Lecture additive de `GET /client/espace` (le champ `avis` existait déjà côté serveur, l'appli l'ignorait) ; un avis douteux ne casse pas l'espace : la rubrique dit alors que les avis ne peuvent pas être affichés. Aucun déploiement nécessaire.
- **G16 (Paramètres)** : codé et testé. Rubrique « Paramètres » dans l'onglet Compte : notifications avec « Tester les notifications » (connecté ; un POST vers la route du site `/api/v1/appareils/essai`, plafonnée par le serveur ; mêmes messages que l'ancienne appli), version installée, « Vérifier les mises à jour » (Android seulement) avec « Télécharger la nouvelle version », « Revoir la visite guidée », « Oublier les commandes de cet appareil » (efface la mémoire de « Commander à nouveau », avec confirmation). La route d'essai n'existe pas dans l'API : l'appli appelle donc le site, comme pour la vérification de version.
- Rien de tout cela n'est publié. Essai émulateur à faire. Reste à relire : espaces restaurateur et livreur écran par écran.

### Relevé fin des espaces restaurateur et livreur (premier passage, par comparaison des textes)

Méthode : les textes affichés par neuf écrans de l'ancienne appli (livreur : accueil, compte, gains, aide ; restaurateur : console, menu, historique, réglages, compte) comparés au code Expo. Un texte absent ne prouve pas une fonction absente (le libellé peut différer) : chaque ligne ci-dessous est un **écart probable à confirmer sur émulateur avec le compte TEST** avant de coder. Historique et aide livreur : aucun texte absent.

| Réf. | Espace | Écart probable | Ancienne appli | Constat Expo |
|---|---|---|---|---|
| G19 | Livreur | Mode « poste fixe » (écran allumé pendant toute la livraison) | LivreurPosteFixe.kt, case dans l'accueil et le compte | Aucune trace (pas de module pour garder l'écran allumé) |
| G20 | Livreur | Suivi de position écran éteint (choix « Recevoir vos courses écran éteint ? », « Seulement application ouverte ») | surChoixArrierePlan | Aucune trace ; exige une permission de position en arrière-plan, donc une décision produit et un essai sur téléphone |
| G21 | Livreur | Messages d'état de la fiche : « en cours d'examen », « suspendue », « n'est plus active » ; rubrique « Mon dossier » ; « Autoriser la position » et ses messages | LivreurScreen, LivreurCompteScreen | Textes absents ; la lecture de la fiche existe, à comparer |
| G22 | Livreur | « Courses à venir », « Nouvelle course » (offre avec compte à rebours), « Livraison impossible ? » avec motif, « Gain attendu », « Aucune course livrée à afficher » | LivreurScreen, LivreurGainsScreen | Textes absents ; la file, l'offre et les gains existent sous d'autres mots |
| G23 | Restaurateur | Réglages « Horaires et poste de travail » : horaires jour par jour, plats à reconfirmer, **son des nouvelles commandes**, **poste fixe** | RestaurateurReglagesScreen | Horaires et reconfirmation présents dans ServiceMenuReel, mais ni « son des nouvelles commandes » ni « poste fixe » |
| G24 | Restaurateur | « Être alerté application fermée ? » / « Activer l'alerte » | RestaurateurScreen | Autorisation des notifications présente (lot E) mais sans cette invite dédiée dans la console |
| G25 | Restaurateur | « Proposer un changement » (message au client, « Rien n'est préparé avant sa réponse », « Envoyer au client ») et message avant refus définitif | RestaurateurScreen | Textes absents ; la proposition révisée existe côté client (lot B7), à confirmer côté restaurateur |
| G26 | Restaurateur | Menu vide : « ajoutez votre premier plat » ; suppression d'un plat : texte d'avertissement | MenuRestaurateurScreen | Textes absents |

Suite proposée : essai émulateur de l'ensemble du lot 10 et de ces lignes avec le compte TEST, puis tranches 10.6 (livreur : G19 à G22) et 10.7 (restaurateur : G23 à G26). G20 attend une décision de Malika (permission de position en arrière-plan).

### Second passage : comparaison du code Kotlin et Expo (16 novembre 2026, soir)

L'ancienne appli n'étant pas connectée sur l'émulateur (et le mot de passe n'étant jamais saisi), la comparaison s'est faite sur le code. Le premier passage donnait **beaucoup de faux positifs** : plusieurs fonctions existent déjà sous d'autres mots, ou dans le module natif `apps/mobile/modules/speedfood-veille` (services de premier plan : veille du restaurateur avec sonnerie et allumage de l'écran, suivi de position du livreur).

| Réf. | Verdict | Détail |
|---|---|---|
| G19 | **Confirmé** | Kotlin : `PosteFixe` (écran allumé pendant une course, interrupteur « Mode poste fixe » dans l'accueil et le compte du livreur, choix gardé sur l'appareil, absent = non). Expo : aucun module pour garder l'écran allumé (pas d'`expo-keep-awake`, rien dans `speedfood-veille`). |
| G20 | **Déjà couvert en grande partie** | Expo a `SuiviLivreurService` (service de premier plan de localisation, `FOREGROUND_SERVICE_TYPE_LOCATION`), donc le suivi continue écran éteint tant que le service tourne. À vérifier : la permission demandée et l'invite « Recevoir vos courses écran éteint ? » (choix de l'ancienne appli). Décision produit et essai téléphone restent nécessaires. |
| G21 | **Confirmé en partie** | Les libellés de cycle de la fiche existent (« Compte actif », « Dossier en cours »…). Manque la rubrique « Mon dossier » (pièces manquantes, « Votre dossier est complet. »), à brancher sur la même route que Kotlin (`LivreurEspace.kt`, `PieceDossierLivreur`). |
| G22 | **Réfuté pour l'essentiel** | Existent sous d'autres mots : « Offre en attente » (restaurant, distances, frais, Accepter/Refuser), la file des courses, l'échec de livraison avec raison de 300 caractères (`confirmerEchec`), les gains en « frais de course » (choix volontaire : ce n'est pas une paie, voir `gains-livreur.ts`). Reste à comparer : le compte à rebours de l'offre et la liste « Courses à venir ». |
| G23 | **Confirmé** | Kotlin : réglages « son des nouvelles commandes » et « poste fixe » du restaurateur (stockés sur l'appareil, actifs tant qu'ils ne sont pas coupés). Expo : aucun des deux réglages. Les horaires et plats à reconfirmer existent déjà. |
| G24 | **Fonction présente, invite absente** | La veille (`VeilleRestaurateurService`, surveillance portée en TypeScript, sonnerie et écran) existe. Manque l'invite « Être alerté application fermée ? » qui explique et laisse choisir. Application fermée, ce sont les notifications du serveur qui prennent le relais (voir le commentaire de `speedfood-veille/src/index.ts`) : la surveillance continue de l'ancienne appli n'est pas identique. |
| G25 | **Réfuté** | Expo a « Proposer un autre prix » (formulaire à trois champs, récapitulatif ancien prix vers nouveau, confirmation avant envoi). Écart de libellé seulement. |
| G26 | **Mineur** | Menu vide : Kotlin « Votre menu est vide : ajoutez votre premier plat. », Expo « Aucun plat dans le menu. ». Il n'existe aucun texte de suppression de plat dans Kotlin (seulement « Retirer ce supplément » et « Retirer la photo », déjà présents dans Expo). |

Reste réel à coder, par ordre de valeur : **G19 + G23** (écran allumé : un seul module `expo-keep-awake` ou un drapeau dans `speedfood-veille`, plus les réglages du téléphone), **G24** (invite d'explication), **G21** (« Mon dossier »), **G26** (texte du menu vide). Tout module natif ajouté oblige à compiler un nouvel APK et à essayer sur téléphone.
### Tranche 10.6 : poste fixe et son (G19, G23), codée le 16 novembre 2026, non essayée

- **Livreur (G19)** : interrupteur « Mode poste fixe » dans l'espace livreur ; choix gardé sur l'appareil (absent = non). L'écran reste allumé seulement pendant une course et il est relâché ensuite ou à la fermeture de l'espace.
- **Restaurateur (G23)** : section « Service », carte « Réglages de ce téléphone » avec « Son des nouvelles commandes » et « Poste fixe », tous deux actifs tant qu'on ne les coupe pas. Son coupé : le bandeau d'alerte s'affiche toujours mais la sonnerie native ne part pas. Poste fixe : l'écran de la console reste allumé tant que l'espace est ouvert.
- **Natif** : nouvelle fonction `GarderEcranAllume` dans `speedfood-veille` (drapeau `FLAG_KEEP_SCREEN_ON` de l'activité). Un ancien APK sans cette fonction ne fait simplement rien. **Le code Kotlin natif n'a pas été compilé** : seule la compilation CI le dira. Essai sur téléphone à faire (écran qui reste allumé, relâché à la sortie).
- Constat annexe : l'offre livreur a déjà son compte à rebours (`libelleEcheanceOffre`), ce qui retire encore un morceau de G22.
- Tests : `preferences-poste.test.ts` (7), 881 tests au total, tsc propre.

### Correction importante : le module natif `speedfood-veille` n'a jamais été compilé (16 novembre 2026, nuit)

Constat à l'essai émulateur : avec le poste fixe actif, la fenêtre n'a pas le drapeau « écran allumé » et **aucun service de premier plan ne tourne**. Le contrôle de l'APK de compilation montre qu'aucune classe `com.speedfood.veille` n'y figure (ni `SpeedfoodVeilleModule`, ni les deux services). Cause : le module n'avait **pas de `android/build.gradle`**, donc l'autolinking d'Expo l'ignorait. Il était écrit « prototype, compilation CI requise » mais n'avait jamais été intégré à un build.

Conséquences, qui **corrigent le second passage** :
- **G20** (suivi de position du livreur) : le service de localisation n'existe pas dans les APK. `veilleNative.demarrerSuiviLivreur()` rend `false` sans rien dire. Le livreur n'envoie donc pas de position depuis l'appli Expo. Ce n'est plus « couvert en grande partie » : c'est **à vérifier et à tester sur téléphone**, avec la permission de localisation (qu'aucun code Expo ne demande non plus).
- **G24** (alerte restaurateur) : la veille native (service, sonnerie, écran allumé) n'existait pas non plus. Seul le bandeau d'alerte dans l'appli et les notifications du serveur fonctionnaient.
- **G19 et G23** (poste fixe) : leur partie « écran allumé » dépend du même module.

Correctifs de ce commit : ajout de `android/build.gradle` (modèle des modules Expo officiels, plugin `expo-module-gradle-plugin`) et de la permission `FOREGROUND_SERVICE_DATA_SYNC`, absente (sur Android 14 et plus, le service de veille du restaurateur aurait fait planter l'appli à l'ouverture de l'espace). Test de présence ajouté. **Le code Kotlin des deux services n'a jamais été compilé** : un échec de compilation CI est possible et il faudra le lire.

Le module étant désormais lié, il demandera des essais sur téléphone avant toute publication : sonnerie du restaurateur, notification de premier plan, position du livreur, permission de localisation.

### Essai émulateur du module natif (16 novembre 2026, 10 h 30, build `6f8a780`)

La CI compile désormais `speedfood-veille` (classes `com.speedfood.veille` présentes dans les dex). Sur l'émulateur, compte TEST, espace restaurateur ouvert avec « Poste fixe » actif (valeur par défaut) :
- `VeilleRestaurateurService` tourne au premier plan (notification 4101, canal `veille_restaurateur`) ;
- `mHoldScreenWindow` désigne la fenêtre de l'appli : l'écran est retenu allumé ;
- en quittant l'espace (« Retour au compte ») : le service est arrêté et l'écran n'est plus retenu ;
- aucun plantage (le service dataSync démarre bien grâce à la permission ajoutée).

Non essayé : poste fixe coupé pendant que l'espace est ouvert, mode poste fixe du livreur avec une course, sonnerie de l'alerte (nouvelle commande réelle), position du livreur (aucune permission de localisation n'est demandée par le code Expo : le service s'arrête seul sans elle, voir G20). Tout cela demande un téléphone ou une commande réelle.

### Tranche 10.7 : consentement au suivi de position du livreur (G20), codée le 16 novembre 2026, non essayée

**Rectificatif** : les notes précédentes disent qu'« aucun code Expo ne demande la permission de localisation ». C'est faux : `brancherSuiviLivreur` la demandait déjà via `PermissionsAndroid` au passage en ligne (ma recherche d'`expo-location` ne pouvait pas le voir). Ce qui manquait réellement :
- l'invite explicative **« Recevoir vos courses écran éteint ? »** avec ses deux choix (« Autoriser le suivi », « Seulement application ouverte »), demandée une fois au passage en ligne, ou quand le livreur est déjà en ligne sans avoir jamais choisi ;
- les messages de position : « Autorisez la position de votre téléphone… » avec le bouton « Autoriser la position », « La position n'est pas disponible sur cet appareil. », « Position en cours de recherche… ».

Codé : `consentement-position.ts` (choix gardé sur l'appareil sous la clé de l'ancienne appli `livreur_suivi_arriere_plan`, absent = pas encore choisi, stockage en panne = on redemande), `suivi-livreur.ts` (le suivi ne démarre qu'après le choix ; sans « écran éteint », il s'arrête quand l'application quitte l'écran et reprend à son retour ; il rapporte refusée, indisponible, en recherche, connue), et dans `LivreurReel.tsx` l'invite, les messages et un interrupteur « Suivi écran éteint » pour changer d'avis. Tests : `consentement-position.test.ts` (6), 888 tests au total.

Essai téléphone indispensable : la permission Android, le service de localisation écran éteint, la reprise au retour dans l'application, le partage de position réel.

### Tranche 10.8 : invite « Être alerté application fermée ? » (G24), codée le 16 novembre 2026, non essayée

- Invite posée **une fois** à l'ouverture de l'espace restaurateur (onglet Commandes), choix « Activer l'alerte » ou « Seulement application ouverte » gardé sur l'appareil (`restaurateur_alerte_arriere_plan`, absent = pas encore choisi). Un interrupteur « Alerte application fermée » dans « Réglages de ce téléphone » (onglet Service) permet de changer d'avis.
- Effet réel : « oui » garde le service de veille natif actif (notification affichée, sonnerie, écran allumé) tant que l'espace est ouvert, application en arrière-plan ou écran éteint. « non » : le service ne démarre que le temps d'une vraie alerte, application ouverte. Avant tout choix, le service ne démarre pas.
- **Différence assumée avec l'ancienne appli** : Kotlin faisait une surveillance réseau continue même application fermée. Cette version ne le fait pas (la lecture des commandes est faite par le TypeScript, qui meurt avec l'application) : application complètement fermée, ce sont les notifications du serveur qui préviennent. Le texte de l'invite le dit au lieu de promettre la surveillance continue. Un vrai équivalent demanderait de porter la lecture des commandes côté natif ou de s'appuyer sur des notifications à haute priorité : à décider, hors de cette tranche.
- Tests : `alerte-arriere-plan.test.ts` (6), 894 tests au total.

### Tranche 10.9 : messages d'état de la fiche livreur (G21, première moitié), codée le 16 novembre 2026, non essayée

- Une fiche non active affiche maintenant le message de l'ancienne appli : « en cours d'examen par l'équipe Speedfood… » (candidat), « suspendue. Motif : … » (suspendu, motif repris du serveur et non doublé dans la fiche), « n'est plus active » (archivée). Écart assumé : une fiche seulement créée ou invitée dit « pas encore activée » (Kotlin disait « plus active » pour toute autre valeur). Tests : `message-cycle-livreur.test.ts` (5), 899 tests au total.
- **« Mon dossier » (seconde moitié de G21) : bloqué, non codé.** L'ancienne appli appelle `GET /api/v1/livreur/dossier`, mais cette route **n'existe pas sur le serveur** (404 en production, vérifié ; aucune route `dossier` dans `apps/web/src/app/api/v1/livreur/`). L'écran Kotlin affiche donc toujours « L'état de votre dossier n'a pas pu être vérifié pour l'instant. » Le porter tel quel ne servirait à rien. Le faire marcher demande une nouvelle route serveur lisant les pièces du dossier d'activation (données d'identité sensibles : seul l'état à jour ou manquant sortirait) et un déploiement : décision de Malika.

### Refonte des boutons et des icônes (16 novembre 2026), codée, non essayée sur émulateur

Demande de Malika : l'aspect des icônes et des boutons « dérange beaucoup », il doit suivre les standards actuels. Constat : un seul niveau de bouton visible (le rempli rouge, jusqu'à cinq empilés sur l'écran Compte), le rouge de l'action et celui du danger presque identiques, des icônes dessinées à la main, de grands ronds rouges pour les actions utilitaires, et trois écrans (commande, panier, règlement) avec leur propre bouton hors système.

- **Icônes** : Lucide (ISC, `lucide-react-native` 1.73.0, version exacte), une icône par import, trait de 2 px sur grille de 24 px. Mêmes noms français qu'avant ; nouveaux : `livreur`, `restaurateur`, `equipe`, `restaurant`, `recu`, `aide`, `chevron`.
- **Boutons à cinq niveaux** dans le bouton canonique : `plein` (action principale, un par écran), `teinte` (sens de `secondaire`), `contour`, `texte`, `danger` (contour rouge). Hauteur 52 px, texte 16 px, icône 22 px, zone de toucher d'une icône seule 48 px, ondulation Android et légère réduction au toucher.
- **Lignes de navigation** (`LigneNavigation`, `GroupeLignes`) : icône dans un rond teinté, titre, aide courte, flèche. L'écran Compte les utilise pour Mon profil, Espace livreur, Espace restaurateur, Espace équipe.
- **Appliqué** : « Retour » en bouton texte avec flèche, « Actualiser » en teinté avec icône (équipe, livreur, restaurateur, historique), « Annuler cette commande », « Oui, annuler », « Supprimer mon compte », « Vider le panier » et la corbeille de chaque ligne en danger, « Suivre » en teinté, écrans de commande, panier et règlement ramenés au bouton canonique, stepper du panier en rond contour.
- Tests : `boutons-icones-refonte.test.ts` (6), trois tests existants adaptés à la nouvelle forme, 905 tests au total.
- À juger à l'écran (émulateur) : proportions, couleur du teinté, lisibilité des icônes à 22 px, état désactivé, bouton « Actualiser » en teinté.

### G26 (menu vide), clos le 16 novembre 2026

Le menu vide dit maintenant « Votre menu est vide : ajoutez votre premier plat. » (texte de l'ancienne appli), sous le bouton « Ajouter un plat » déjà présent. Le texte d'avertissement d'archivage du premier relevé n'existe pas dans Kotlin sous cette forme : Kotlin demande « Archiver « nom » ? » avec une phrase courte, alors qu'Expo a déjà une confirmation plus complète (« il disparaîtra de la carte… ne pourra pas être rétabli depuis l'application »). Rien à porter. 907 tests.

### Bilan des écarts G19 à G26

| Réf. | État |
|---|---|
| G19 poste fixe livreur | codé (10.6), vérifié en partie sur émulateur (réglage gardé) ; écran allumé en course à essayer sur téléphone |
| G20 suivi de position | codé (10.7), à essayer sur téléphone |
| G21 messages de fiche | codés (10.9) ; « Mon dossier » bloqué : la route serveur `/api/v1/livreur/dossier` n'existe pas (404), décision de Malika |
| G22 offres, file, gains | déjà présents sous d'autres mots, rien à porter |
| G23 son et poste fixe restaurateur | codé (10.6), carte vérifiée sur émulateur |
| G24 invite d'alerte | codé (10.8), vérifié sur émulateur ; différence assumée : pas de surveillance continue application fermée |
| G25 proposer un changement | déjà présent (« Proposer un autre prix ») |
| G26 menu vide | clos |

### Refonte des boutons, troisième passage : icônes seules là où le geste est universel (16 novembre 2026)

Retour de Malika sur capture : dans les puces d'onglets de l'espace restaurateur, retirer les textes et ne garder que les icônes, avec de meilleurs cadres ; appliquer la même règle dans toute l'appli, comme les applications à succès : bouton à icône seule quand c'est nécessaire, bouton à texte quand il faut un mot.

Règle retenue : **icône seule** pour retour, actualiser, aide et choix de section (le nom accessible dit toujours l'action en toutes lettres) ; **texte** pour une action qui engage (Commander, Supprimer, Annuler la commande, Enregistrer) ; **ligne de navigation** pour une destination (Mon profil, Espace livreur, modules de l'équipe, File des courses…).
- `OngletsIcones` : commutateur segmenté, icône 24 px, section active en plein ; l'écran affiche le titre de la section active dessous.
- 21 « Actualiser » (teinté + texte) et 8 « Retour » passés en icône seule ; le retour se place à gauche et en encre, l'actualisation à droite.
- Espace restaurateur : en-tête retour à gauche et aide à droite, onglets en icônes, titre de section.
- Les modules de l'équipe (une vingtaine de gros boutons roses) et les trois entrées du livreur (file, courses livrées, assistance) deviennent des lignes de navigation, avec état « actif » pour la ligne ouverte.
- Restent en texte, volontairement : annulations dans un formulaire (« Retour » d'une étape, « Non, garder »), actions qui engagent.
- Le mot « gain » est banni de l'interface (frais de course, pas une paie) : un test du projet l'a rattrapé dans mes propres sous-titres, corrigés aussi sur l'écran Compte.
- 908 tests. À juger à l'écran : taille des icônes seules, lisibilité sans texte, titre de section.

### Revue visuelle des écrans restants (16 novembre 2026, APK `4c8c212`)

Vus sur émulateur : Paramètres, espace livreur, modules de l'équipe, liste des commandes, suivi, panier, écran de commande. Corrigés en local :
- ligne de navigation active : rond d'icône blanc (il disparaissait sur le fond teinté) ;
- liste des commandes : l'actualisation passe sur la ligne du titre, « Commander à nouveau » en contour pour se distinguer de « Suivre » ;
- suivi : l'actualisation passe sur la ligne du titre de la carte, la pastille d'état devient compacte (elle s'étirait sur toute la largeur) ;
- écran de commande : le sélecteur Retrait ou Livraison était un grand bouton rouge plein qui rivalisait avec « Envoyer ma commande » ; il devient un choix teinté et cerclé.
- 912 tests. Non vu : l'espace restaurateur avec l'actualisation à sa nouvelle place, le choix Livraison avec quartiers, la file des courses en ligne.
