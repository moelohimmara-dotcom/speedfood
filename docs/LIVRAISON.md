# Livraison : conception et feuille de route

**Version :** 0.1, 17 octobre 2026. **Statut : conception validée par la propriétaire (décisions ci-dessous), implémentation en cours, rien n'est déployé.**

## 0. Pourquoi ce document existe

Le cahier des charges (TDR §3) classait « calcul ou exécution de la livraison par Speedfood » **hors périmètre** : la livraison était laissée aux restaurants, les frais restaient « à convenir » (0 GNF à la commande). Le 17 octobre 2026, la propriétaire décide d'implémenter une vraie livraison, **fonctionnelle même en mode démonstration**, en s'inspirant des plateformes de livraison de repas (Uber Eats, Glovo, Deliveroo, Yassir, Jumia Food). Cette note remplace le TDR sur ce point ; l'ADR correspondant est à écrire (ADR-019) avec la phase 1.

## 1. Décisions de la propriétaire (17 octobre 2026)

| Sujet | Décision |
|---|---|
| Qui livre | **Au choix du restaurant** : ses propres livreurs (avec suivi et statuts) ou un livreur Speedfood |
| Frais | **Base + prix au kilomètre**, réglables depuis la console (base, prix au km, minimum, gratuité à partir de X GNF, rayon maximal) |
| Cartes et itinéraires | **Gratuit, OpenStreetMap** ; aucun compte payant |
| Livreurs | **Simulés d'abord** (mode démonstration fonctionnel) ; vrais livreurs après le pilote, avec cadrage juridique en Guinée |

## 2. Modèle (inspiré des plateformes)

**Acteurs** : client, restaurant, livreur, exploitation (console admin).

**Deux machines à états, séparées.** La commande garde ses états (`en_attente` → `acceptee` → `prete` → `terminee`, ou `refusee`, `annulee`). La **livraison** a les siens :

`a_assigner` → `offre_envoyee` → `assignee` → `vers_restaurant` → `recuperee` → `vers_client` → `livree` (ou `echec`, `annulee`)

Pour un restaurant qui livre lui-même (`propre`), la livraison saute le dispatch : `assignee` (à sa propre personne) → `recuperee` → `vers_client` → `livree`.

**Frais** : `max(minimum, base + prix_km × distance_km)` ; 0 au-delà du seuil de gratuité ; refus au-delà du rayon maximal. Le calcul est **serveur uniquement** (jamais confiance au navigateur), en entiers GNF, arrondi au 500 GNF supérieur. Les frais calculés sont fixés dans la commande à l'envoi ; une proposition de révision du restaurant reste possible (TDR §6).

**Distance** : distance par la route (service de routage OpenStreetMap) ; **repli** si le routage est indisponible : distance à vol d'oiseau (haversine) × 1,3 (coefficient urbain). Points : restaurant (sa position, sinon le centre de son quartier) ; client (sa position partagée, sinon le centre de son quartier).

**Dispatch** : le livreur disponible le plus proche du restaurant reçoit l'offre ; il a `delai_offre_secondes` pour accepter ; sinon l'offre passe au suivant ; si personne n'accepte, la livraison reste `a_assigner` et l'exploitation voit une alerte.

**Remise** : code à 4 chiffres donné au client à l'acceptation de sa commande ; le livreur le saisit pour clore la livraison.

**Suivi** : position du livreur toutes les 5 à 10 secondes (Supabase Realtime) ; carte et heure d'arrivée estimée côté client.

## 3. Bibliothèques et services (gratuits)

| Besoin | Choix | Remarque |
|---|---|---|
| Carte | **MapLibre GL JS** avec tuiles OpenStreetMap | La politique d'usage des tuiles publiques interdit un usage intensif : prévoir un fournisseur de tuiles à compte gratuit (décision plus tard) |
| Itinéraires | **OSRM** ou **OpenRouteService** (offre gratuite) | Le serveur public d'OSRM est réservé à la démonstration ; limites de volume à surveiller |
| Positions en direct | **Supabase Realtime** (déjà dans le projet) | Les positions ne sont pas stockées en historique : seulement la dernière |
| Géographie en base | **PostGIS** (extension Supabase) ou haversine pur en SQL/TypeScript | Haversine pur suffit pour la phase 1 |
| Offres de course | Notification push existante | |
| Application du livreur | Console web installable `/livreur` | Limite : une application web perd la géolocalisation écran éteint ; une application native sera nécessaire pour de vrais livreurs |

## 4. Mode démonstration

Des livreurs **simulés** (`livreurs.simule = true`, `donnees_demo = true`) parcourent réellement l'itinéraire de leur course ; le simulateur est un module serveur (pas un faux écran). Tout ce qui est affiché vient des mêmes tables et du même code que pour un vrai livreur ; seule la source des positions est simulée. Un interrupteur du super administrateur active ou coupe la simulation.

## 5. Phases

| Phase | Contenu | État |
|---|---|---|
| **1a. Socle** | Calcul des frais (module pur, testé) ; réglages de livraison en console ; point d'arrivée du client (position ou quartier) ; frais réels à la commande ; mode de livraison du restaurant ; migration | **Code écrit et testé (1 826 contrôles unitaires, 147 de cloisonnement) ; migration `20261017170000` non appliquée ; non déployé ; parcours dans un navigateur non joué** |
| **1b. Livraison et dispatch** | Tables `livreurs`, `livraisons`, `livraison_offres` ; machine à états ; dispatch ; code de remise ; console admin « Livraisons » | À faire |
| **2. Console livreur et suivi** | `/livreur` (disponibilité, offres, navigation, statuts) ; page de suivi client avec carte et heure estimée ; simulateur de livreurs | À faire |
| **3. Argent** | Gains par course, espèces encaissées à reverser, commission restaurant, tableau de bord | À faire |
| **4. Après pilote** | Vrais livreurs (inscription, pièce d'identité, assurance, cadre juridique), application native, notation | Décision ultérieure |

## 6. Risques et limites déclarés d'avance

- **Aucune garantie de service** : sans livreurs réels, la livraison Speedfood reste démonstrative.
- **Qualité des points** : 90 quartiers sur 136 ont un point central ; **aucun restaurant** n'a encore de position. Le repli (centre du quartier) donne des distances approximatives ; la position exacte du restaurant est à renseigner.
- **Routage gratuit** : limites de volume et disponibilité non garanties ; le repli haversine évite que la commande échoue.
- **Responsabilité** : tant que les livreurs sont ceux des restaurants, la livraison reste leur responsabilité (TDR §10) ; pour des livreurs Speedfood réels, cadre juridique (statut, assurance, accidents) à établir avant.
- **Données personnelles** : la position d'un livreur et l'adresse d'un client sont des données sensibles ; durée de conservation à ajouter à `CONSERVATION-ET-CONFIDENTIALITE.md` avec la phase 1b.

## 7. Points à trancher plus tard

- **Frais par zone déclarés par le restaurant** (`restaurant_zones_desservies.frais_gnf`) et **frais calculés** coexistent : tant que le calcul est éteint, rien ne change ; une fois allumé, la commande utilise le calcul, et les frais de zone ne sont plus qu'indicatifs sur les fiches. À unifier (frais de zone comme remplacement du calcul pour cette zone ?) avant d'allumer le calcul avec de vrais restaurants.
- **Itinéraire réel** (OSRM / OpenRouteService) : la phase 1a estime la route par la distance à vol d'oiseau × 1,3 ; le service d'itinéraires est prévu en phase 2 avec la carte.
- **Interrupteur** : le calcul est livré **éteint** (`parametres_livraison.frais_actifs = false`) ; il s'allume dans `/system/parametres/livraison`.
