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