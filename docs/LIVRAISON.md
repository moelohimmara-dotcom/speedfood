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
| **1a. Socle** | Calcul des frais (module pur, testé) ; réglages de livraison en console ; point d'arrivée du client (position ou quartier) ; frais réels à la commande ; mode de livraison du restaurant ; migration | **Code écrit et testé (1 826 contrôles unitaires, 147 de cloisonnement) ; migration `20261017170000` **appliquée en production le 17 octobre 2026** (calcul éteint, alertes de sécurité relues : rien d'inattendu) ; code non déployé ; parcours dans un navigateur non joué** |
| **1b. Livraison et dispatch** | Tables `livreurs`, `livraisons`, `livraison_offres`, `livraison_codes` ; machine à états ; répartition par offres avec délai ; livreurs simulés qui répondent seuls ; code de remise à 4 chiffres ; consoles « Livraisons » et « Livreurs » ; bloc livraison dans la commande du restaurant et dans le suivi du client | **Code écrit et testé (1 875 contrôles unitaires, 180 de cloisonnement) ; migration `20261017190000` **appliquée en production le 17 octobre 2026** (alertes de sécurité relues : seulement les 2 fonctions d'aide et la table des codes, attendues) ; code déployé le 17 octobre 2026 (version `c5f66a5d`) ; parcours dans un navigateur non joué** |
| **2. Console livreur et suivi** | `/livreur` (disponibilité, offres, navigation, statuts, code de remise) ; page de suivi client avec carte et heure estimée ; livreurs simulés qui roulent ; comptes livreurs réels liés par l'exploitation | **Code écrit et testé (1 890 contrôles unitaires) ; aucune migration nouvelle ; déployé le 17 octobre 2026 (version `c5f66a5d`) ; parcours dans un navigateur non joué** |
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

## 8. Phase 1b : ce qui existe

- **À l'acceptation d'une commande en livraison** (`appliquerTransitionStatut`, après la transition, sans jamais la faire échouer) : une livraison est créée. Mode `propre` : directement « prête à partir ». Mode `speedfood` : « recherche d'un livreur », puis une **offre** part au livreur disponible le plus proche (position de moins de 10 minutes, dans 15 km), avec un délai réglable (45 s par défaut). Refus ou expiration : offre au suivant ; personne n'est sollicité deux fois.
- **Livreurs simulés** : ils acceptent seuls après 3 secondes ; leur position est rafraîchie à chaque passage de la répartition. Les offres sont traitées **à chaque lecture** des écrans de livraison et du suivi client (pas de tâche planifiée dans le Worker) : tant que personne ne regarde, rien ne bouge.
- **Avancement** : le restaurant qui livre lui-même fait « Je pars livrer » puis « Livrée » avec le **code du client** ; le livreur Speedfood (phase 2 : sa propre console) ; l'exploitation peut tout reprendre en main (affecter, relancer, faire avancer, annuler avec motif, journalisé). Une livraison « livrée » clôt la commande (prête → terminée).
- **Code de remise** : tiré à la création, montré au seul client (suivi), jamais lisible par l'API ; 5 essais puis blocage.
- **Écrans** : `/system/livraisons` et `/system/livraisons/livreurs` (permission `commande.support` : super administrateur et support), bloc « Livraison » dans la carte de commande du restaurant, bloc « Livraison » avec le code dans `/suivi`.
- **Sécurité** : tout est écrit par le serveur (clé de service) ; la RLS limite les lectures (restaurant : ses livraisons et SON livreur ; livreur : ses courses et offres ; exploitation : tout ; codes : personne). Deux petites fonctions oui/non évitent une récursion entre les policies de `livreurs` et de `livraisons`.
- **Limites** : l'avancement du livreur simulé se fait à la main depuis la console (le déplacement automatique viendra avec la carte, phase 2) ; sans console livreur, un vrai livreur ne peut pas encore répondre.

## 9. Phase 2 : ce qui existe

- **Console livreur** `/livreur` (compte lié à une fiche livreur par le super administrateur : `/system/livraisons/livreurs`, « Créer un livreur avec un vrai compte »). Se mettre en ligne ou hors ligne ; la position est envoyée toutes les 8 secondes tant que la page est ouverte ; une **offre** apparaît avec compte à rebours (restaurant, distance, frais) : accepter ou refuser ; puis la course : « Je pars au restaurant », « J'ai récupéré la commande » (seulement quand le restaurant l'a déclarée prête), « Je pars chez le client », « Livrée » avec le code à 4 chiffres, « Client injoignable ». Les coordonnées du client n'apparaissent qu'**après** la récupération.
- **Livreurs simulés** : ils acceptent, partent, roulent vers le restaurant puis le client **en ligne droite à 120 km/h** (temps accéléré : 3 km en environ une minute et demie), attendent que la commande soit prête, la récupèrent, et la remettent en saisissant le vrai code. Tout passe par le même service que pour un vrai livreur. Ils avancent **à chaque rafraîchissement** d'un écran (suivi client toutes les 6 s en livraison, console livreur toutes les 4 s, pages de l'exploitation).
- **Carte** (Leaflet + OpenStreetMap, sans image : repères R, C, L dessinés en CSS) sur le suivi du client (restaurant, adresse, livreur en direct, heure d'arrivée estimée) et, repliée, dans la commande du restaurant. Le téléphone du livreur n'est jamais envoyé au navigateur du client.
- **Limites** : tuiles OpenStreetMap publiques (usage léger seulement : prévoir un fournisseur à compte avant du volume) ; déplacement simulé en ligne droite (pas de service d'itinéraires pour l'instant) ; une application web perd la géolocalisation écran éteint (voir §3) ; aucune notification push d'offre au livreur (la console doit être ouverte).

## 10. Ouverture de l'option « livreur Speedfood » (17 octobre 2026)

Sur décision de la propriétaire, l'option « Un livreur Speedfood » est **ouverte** aux restaurateurs dans « Où je suis, où je livre » (code prêt, **non déployé**). Un restaurant qui la choisit voit ses commandes en livraison passer par la répartition : sans livreur en ligne (ou sans position à moins de 15 km), la course reste « recherche d'un livreur » et l'exploitation est alertée sur `/system/livraisons`. **Avant d'inviter de vrais restaurants à la choisir**, créer des livreurs de démonstration ou de vrais comptes livreurs, et leur dire que les livreurs sont, pendant le pilote, des livreurs de démonstration.
