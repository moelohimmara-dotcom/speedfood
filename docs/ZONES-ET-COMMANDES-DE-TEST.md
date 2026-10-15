# Zones de toute la Guinée, aperçu de fiche, commandes de test, console Géographie

Chantier du 14 au 15 octobre 2026. Journal chronologique : `docs/STATUT-PROJET.md` (section du 15 octobre). Ce document garde les **décisions**
et leurs raisons, pour qu'une reprise sans historique de conversation ne les remette pas en cause par erreur.

## 1. Zones : de la région au quartier

- **Modèle** : `regions` → `prefectures` → `communes` → `neighborhoods` (quartiers). Hors Conakry, une commune est une sous-préfecture et son quartier
  générique « Centre de … » (`generique = true`) la représente : il n'est jamais listé. Les zones se comparent **par identifiant, jamais par nom**.
- **Données** : 8 régions, 34 préfectures, 335 communes hors Conakry (source OCHA), importées par migrations (`20261014100000` à `20261014140000`).
- **Adresses** : `/?region=` `?prefecture=` `?commune=` `?quartier=` (slug). Le slug d'un quartier n'est pas stocké : `slugQuartier(nom)`.
- **Position** (« Utiliser ma position ») : géocodage inverse OpenStreetMap (Nominatim) **côté serveur** (`/api/zone/position`), coordonnées arrondies à
  3 décimales, rien n'est enregistré ni journalisé. Rapprochement : nom, puis préfecture, puis proximité (≤ 1,2 km quartier, ≤ 40 km commune).
  Pur et testé : `src/lib/site/zone-position.ts`.
- **Liste d'attente** (« Prévenez-moi ») : table `zone_alertes`, accessible au service-role seulement. Route `/api/zone/alerte`. Les contacts ne sortent que
  par l'export CSV audité (`attente.export`).
- **Zones de livraison** par restaurant : `restaurant_zones_desservies`, affichées « Livre à … ».
- **Statut de lancement** d'une commune (`communes.statut_lancement`, null = automatique) : « Bientôt » et « Pilote » s'affichent au public pour une zone
  sans restaurant ; « Fermée » et « Ouverte » sont des repères internes. Choix volontairement limité : aucun comportement caché.
- **Drapeaux** (`fonctionnalites`) : `zone_position`, `zone_liste_attente`, `zones_livraison`.

## 2. Aperçu de la fiche publique

- `lireVueFiche(restaurantId)` (`src/lib/restaurant/vue-fiche.ts`) : « visiteur », « proprietaire » ou « admin », d'après la **session** et les fonctions SQL
  `fn_est_membre_restaurant` / `fn_est_admin_systeme`. **Jamais d'après un paramètre d'adresse.** Un visiteur sans cookie de session ne déclenche aucun appel
  d'authentification.
- Trois niveaux pour l'équipe et les administrateurs : **aperçu** (défaut, commandes désactivées), **`?vue=visiteur`** (rendu identique à un client, figé par
  `inert` : aucune commande possible), **`?vue=test`** (parcours complet). La page est non indexée (`noindex`).
- Pourquoi une vue visiteur figée : une première version laissait passer une vraie commande depuis « Voir comme un visiteur ».

## 3. Commandes de test

- **Règle** : une commande passée par un membre de l'équipe du restaurant commandé, ou par un administrateur système, est marquée `orders.est_test = true`
  **par le serveur** (`creerCommande`, d'après le compte de la session). Le navigateur n'envoie rien qui puisse forcer ou retirer ce marquage.
- **Immuable** : le déclencheur `fn_proteger_colonnes_commande` refuse tout changement de `est_test` depuis une session (restaurateur, support, administrateur).
- **Exclue des chiffres** : `fn_statistiques_application`, `fn_support_commandes_par_heure`, `fn_support_compter_commandes`, `fn_support_serie_commandes`.
  Toute **nouvelle** fonction qui lit `orders` pour compter ou additionner doit ajouter `not est_test`.
- **Visible** : pastille « Test » dans la console restaurateur et bandeau sur la page de suivi. Le restaurant reçoit l'alerte comme pour une vraie commande
  (utile pour tester) ; aucun client réel n'est prévenu.
- **Limite connue** : un administrateur qui commande réellement pour lui-même est aussi marqué « Test ».

## 4. Console Géographie (`/system/catalogue/geographie`, permission `taxonomie.editer`)

- Une région à la fois. Lignes avec interrupteur « Visible dans les choix » (désactiver ne supprime rien), bouton Enregistrer actif seulement après modification,
  point central contrôlé (latitude 7 à 13, longitude −15,5 à −7) avec suggestion OpenStreetMap **à valider** (une requête par clic).
- **Qualité des données** (`diagnostiquerQualite`) : points centraux manquants (non bloquant), noms en double, noms alternatifs ambigus.
- **Lot** : activer / retirer / statut sur 200 éléments au plus ; une seule trace d'audit par lot.
- **Fusion de quartiers** : `fn_fusionner_quartiers(source, cible)`, atomique, même commune, jamais un quartier générique ; déplace restaurants, clients, zones
  desservies et alertes ; ajoute le nom en nom alternatif ; **désactive** le doublon (jamais supprimé).
- **Export / import CSV** : `/system/catalogue/geographie/export?region=`. L'import est en deux étapes : aperçu (rien d'écrit), puis application après
  confirmation, le serveur **recalculant** les différences sur l'état courant de la base. Il ne crée ni ne supprime rien : seuls les identifiants existants sont modifiés.
- **Carte de couverture** (`/system/catalogue/couverture`) : un point par commune (projection simple, pas de fond de carte).
- **Historique** : lu dans `audit_events` via `fn_lister_audit` (rôles qui ont `systeme.audit`). Pas d'annulation en un clic.

## 5. Pièges payés

- Les règles globales de la console (`fantaisie.css`) imposent 22 × 22 px et un rebond à toutes les cases à cocher sous `.ad-app` : un contrôle personnalisé
  doit porter `.ad-app` et `[type="checkbox"]` pour passer devant.
- Les blocs d'une page d'administration se rangent dans `.ad-pile` (écart de 20 px) ; un `<div>` nu les colle.
- Tester un composant d'administration **dans la coque `.ad-app`** et **avec le volume réel** (46 quartiers sans point, 345 communes), pas sur une page isolée.
- Un fichier « use server » n'exporte que des fonctions asynchrones : constantes et fonctions pures vivent ailleurs (`geographie-outils.ts`).
- Un nombre dans un CSV (longitude négative) ne doit pas être neutralisé comme une formule.
- `zone_alertes` : lecture réservée au service-role, jamais depuis le navigateur.

## 6. Vérifié / non vérifié

**Vérifié** : 1620 contrôles purs (CSV, qualité, import, zones) ; pages publiques en production locale puis réelle ; fusion SQL sur quartiers fictifs
(transaction annulée) ; interface de la console dans la coque `.ad-app` avec le volume réel ; migrations 80 fichiers = 80 en base ; avis de sécurité : un WARN de
plus, `fn_fusionner_quartiers`, qui vérifie le rôle elle-même.

**Non vérifié** (aucune session d'équipe disponible lors du chantier) : actions serveur de la console Géographie (enregistrer, lot, import appliqué, suggestion de
point, historique) ; création d'une commande de test par un restaurateur connecté de bout en bout ; aperçu de fiche en session propriétaire / administrateur ;
annonce « Bientôt / Pilote » sur des données réelles.
