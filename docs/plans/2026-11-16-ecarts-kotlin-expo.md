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
