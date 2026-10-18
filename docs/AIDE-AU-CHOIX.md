# Aide au choix : « Aide-moi à choisir »

Version 0.1 — 18 octobre 2026. Décisions de la propriétaire (18 octobre 2026) : gamme calculée **avec contestation validée** ; budget en **montant par personne (GNF)** ; assistant sur une **page dédiée** `/aide-au-choix` reliée depuis `/restaurants` ; **quartier retenu sur le compte** possible (facultatif, supprimable).

## 1. À quoi ça sert

Un client qui ne sait pas où manger donne son **budget par personne** et sa **position**. Speedfood lui propose quelques restaurants **ouverts, proches, dont un plat tient dans son budget**, affichés **du moins cher au plus huppé**, avec **la raison** de chaque proposition (distance, plats dans le budget, note). Même logique de fond que les plateformes de livraison, sans promotion payante ni signal caché.

Ce que montrent les recherches consultées : les plateformes classent un utilisateur nouveau sans historique avec des critères de contenu (cuisine, budget, heure, lieu) plutôt qu'avec de l'apprentissage ([Delivery Hero](https://deliveryhero.jobs/blog/personalisation-delivery-hero-ranking-restaurants-for-new-users/)) et traitent le choix comme un compromis entre objectifs (prix, distance, qualité) ([Sample-Rank](https://arxiv.org/pdf/2008.10277)). Google expose cinq niveaux de prix sans en publier la méthode ([Places](https://developers.google.com/maps/documentation/places/ios-sdk/reference/objc/Classes/GMSPlacePriceRange.html)). Choix pour Speedfood : un moteur **déterministe et explicable**, pas d'apprentissage tant qu'il n'y a pas de volume.

## 2. Les trois notions

| Notion | Définition | D'où ça vient |
|---|---|---|
| **Prix typique** d'un restaurant | Médiane des prix (promo comprise) de ses plats **disponibles** | Menu réel du restaurant |
| **Gamme** | Économique / Intermédiaire / Haut de gamme / Premium selon des **seuils en GNF** (défaut 25 000 / 50 000 / 100 000, bornes hautes incluses) | Calculée ; **réglable** par le super administrateur ; **validée** par l'exploitation si le restaurateur la conteste |
| **Budget** | Montant **par personne** donné par le client (5 000 à 1 000 000 GNF) | Saisi par le client |

Pourquoi des seuils absolus plutôt qu'un rang entre restaurants : avec un pilote de quelques restaurants, un rang relatif ne veut rien dire. Les seuils sont réglables à mesure que les prix évoluent (inflation) et que l'offre se diversifie. Un restaurant **sans plat disponible avec un prix n'a pas de gamme** : elle n'est jamais inventée.

## 3. Règles de l'assistant (`src/lib/decouverte/aide-choix.ts`, testé)

1. Sont écartés : restaurants fermés ou qui n'acceptent pas de commandes, restaurants sans plat avec prix (budget invérifiable), restaurants hors rayon.
2. **Position** : distance estimée (vol d'oiseau × 1,3, comme la livraison) si le restaurant a des coordonnées ; sinon il faut qu'il soit dans **le quartier ou la commune choisi**. Aucune distance n'est fabriquée. Dans la zone choisie, la distance n'est pas affichée (le centre de la commune n'est pas la position du client).
3. **Dans votre budget** : au moins un plat disponible à un prix ≤ budget. **Un peu au-dessus** : aucun plat dans le budget mais le moins cher ≤ budget + marge (défaut 25 %), annoncé avec l'écart chiffré.
4. **Tri** : les « dans le budget » d'abord, puis par prix typique croissant (du moins cher au plus huppé), puis distance.
5. **Plafond** (défaut 5, 1 à 10) : si plus de restaurants que de places, on retient **tour à tour le plus proche de chaque gamme** pour que le client voie l'éventail complet, puis on retrie du moins cher au plus huppé.
6. Chaque proposition porte ses **raisons** : « À 1,3 km de vous », « 2 plats dans votre budget, dès 10 000 GNF », « Noté 4,4 sur 12 avis » (note seulement à partir de 5 avis).
7. Liste vide : on dit **pourquoi** avec des compteurs vrais (aucun restaurant publié / aucun ouvert / aucun dans la zone / sans prix / budget trop bas).

## 4. Vie privée

- La **position GPS** sert au calcul de la requête puis est oubliée : ni enregistrée, ni journalisée, **jamais dans l'adresse** de la page (la recherche passe par une action serveur, pas par des paramètres d'URL).
- Seul un **quartier choisi** peut être retenu sur le compte, **sur demande explicite** (case à cocher), avec un lien « L'oublier ». Colonne `client_profils.quartier_prefere_id` (supprimée avec le compte ou mise à `null` si le quartier disparaît).
- Limite de débit : 40 recherches / 10 min / adresse.

## 5. Côté restaurateur — `/restaurant/positionnement`

Lien « Positionnement prix » dans la colonne de gauche. Le restaurateur voit sa **gamme**, son **prix typique**, la fourchette de ses plats, les **repères** (seuils), des **conseils** pour être mieux proposé (placer le restaurant sur la carte, garder 3 plats avec prix, publier, collecter des avis) et peut **demander une autre gamme** avec une explication (10 à 300 caractères). Une seule demande en attente à la fois ; la décision et son motif lui sont montrés. Il ne peut **jamais** fixer sa gamme lui-même (la base refuse la modification à un non-administrateur).

## 6. Côté administration

- **`/system/aide-choix`** (permission `commande.support`) : répartition des restaurants par gamme, **demandes à examiner** (accepter ; refuser avec motif obligatoire), **gammes validées** avec retour au calcul automatique (motif obligatoire), restaurants sans gamme.
- **`/system/parametres/aide-choix`** (`parametres.editer`, super administrateur) : seuils des gammes, rayon par défaut, marge « un peu au-dessus », nombre de propositions.
- Journal d'audit : `gamme.demande_acceptee`, `gamme.demande_refusee`, `gamme.validation_retiree`, `aide_choix.reglages_modifies`.

## 7. Données (migration `20261018120000_aide_au_choix.sql`)

`restaurants.gamme_validee` (protégée par le déclencheur : administrateur système seulement) ; `gamme_demandes` (écritures par le serveur, lisible du restaurant concerné et de l'exploitation, une seule demande en attente par restaurant) ; `parametres_aide_choix` (singleton, super administrateur) ; `client_profils.quartier_prefere_id`. 16 contrôles de cloisonnement.

**Lecture tolérante** : tant que la migration n'est pas appliquée, l'assistant fonctionne avec les valeurs par défaut (seuils 25 000 / 50 000 / 100 000, rayon 5 km, marge 25 %, 5 propositions) ; seules les demandes de gamme et les réglages sont indisponibles.

## 8. Limites connues et suite

- **Volumes** : le catalogue est lu **par pages de 1 000 lignes** jusqu'à la dernière (plafonds de sécurité : 5 000 restaurants, 30 000 plats ; s'ils sont atteints, le journal `catalogue_tronque` le signale et `CatalogueLu.tronque` vaut vrai), et mémorisé **par requête** : plus de plafond silencieux à 500 restaurants et 2 000 plats. Au-delà de ces volumes, passer au filtrage par zone côté base.
- La distance est une **estimation à vol d'oiseau × 1,3**, pas un itinéraire réel ; la zone choisie (quartier, commune) est plus grossière que le GPS.
- Le budget est comparé au **prix d'un plat**, pas à un repas complet (plat + boisson + accompagnement) : à affiner avec les données de commande.
- Pas d'apprentissage ni de préférences individuelles tant qu'il n'y a pas de volume ; pas de lien encore avec le classement « Recommandés » du catalogue.
- À faire : afficher la gamme sur les cartes du catalogue et un filtre de gamme ; tenir compte de l'heure (petit-déjeuner, déjeuner, dîner) ; mesurer (propositions affichées, clics, commandes) avant d'ajuster seuils et marge.
- Parcours non joué en navigateur avec de vrais comptes.
