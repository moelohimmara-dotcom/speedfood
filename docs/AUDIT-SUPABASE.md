# Audit de la base Supabase — Speedfood

**Date :** 2026-09-27  
**Projet :** `ggldjdizqrtpetdiohxy` — état des lieux demandé avant de connecter l'application.  
**Méthode :** lecture du schéma via la Management API Supabase (requêtes SQL en lecture seule). Aucune donnée modifiée.

## 1. Identité du projet

| Élément | Valeur |
|---|---|
| Réf du projet | `ggldjdizqrtpetdiohxy` |
| Nom affiché | `mistermarcket@gmail.com's Project` (nom par défaut — à renommer « Speedfood ») |
| Région | `eu-west-1` (Irlande) |
| Moteur | PostgreSQL 17.6 |
| Statut | `ACTIVE_HEALTHY` |
| Création | 2026-09-27 |

## 2. Migrations appliquées (9)

Elles existent **uniquement dans la base distante** (`supabase_migrations.schema_migrations`) — le dépôt ne contient pas de dossier `supabase/migrations/`.

| Version | Nom | Objet |
|---|---|---|
| 20260927163859 | `tables` | Schéma complet des 14 tables publiques |
| 20260927163923 | `fonctions_utilitaires` | Fonctions RLS et helpers |
| 20260927163938 | `triggers` | `touch` + validation des transitions de commande |
| 20260927164046 | `rls` | Politiques de sécurité par rôle |
| 20260927164233 | `durcissement_securite` | `search_path` figé, `revoke` des fonctions, politiques limitées à `authenticated` |
| 20260927164254 | `revoquer_execution_anon` | Exécution des fonctions retirée à `anon` |
| 20260927164347 | `optimisations_perf` | Index |
| 20260927165345 | `onboarding_restaurateur` | `fn_creer_restaurant_et_owner` |
| 20260927170619 | `revoquer_execution_anon_onboarding` | Idem pour la fonction d'onboarding |

## 3. Schéma — 14 tables publiques

**Catalogue :** `restaurants`, `menu_categories`, `menu_items`, `neighborhoods`  
**Commandes :** `orders`, `order_items`, `order_status_events`, `order_proposals`  
**Rôles :** `restaurant_memberships`, `system_admin_memberships`  
**CMS :** `content_pages`, `content_banners`, `featured_placements`  
**Traçabilité :** `audit_events`

RLS activé sur les 14 tables, plus un event trigger `rls_auto_enable` qui active automatiquement le RLS sur toute nouvelle table `public` — bon filet de sécurité.

## 4. Ce qui est conforme au TDR et aux ADR

1. **États de commande** exactement ceux du TDR : `en_attente`, `acceptee`, `refusee`, `prete`, `terminee`, `annulee` (CHECK sur `orders.statut`).
2. **Machine à états validée en base** : `fn_valider_transition_commande` refuse toute transition non prévue (`en_attente→acceptee/refusee/annulee`, `acceptee→prete/annulee`, `prete→terminee`).
3. **Instantané des prix** (ADR-006) : `order_items.nom` et `order_items.prix` copiés à la commande, `menu_item_id` nullable avec `ON DELETE SET NULL` — le reçu survit à la suppression du plat. Prix en entiers GNF, `CHECK (prix >= 0)`.
4. **Propositions révisées** (règle « accord explicite du client ») : `order_proposals` avec `version` unique par commande, `nouveau_sous_total`, `nouveaux_frais_livraison`, statuts `en_attente/acceptee/refusee/expiree`, échéance `expire_le`.
5. **Commande invitée sans compte** (ADR-005) : `orders.jeton_suivi` unique pour le suivi client, `reference` unique.
6. **Isolation par restaurant** (ADR-004) : `fn_est_membre_restaurant` (SECURITY DEFINER, `search_path` figé) + table de memberships `owner/manager`.
7. **Rôles système distincts** (ADR-010) : `super_admin`, `operations`, `content_editor`, `support` — et `fn_est_admin_systeme(roles[])` restreint chaque politique aux rôles concernés.
8. **Durcissement de sécurité sérieux** : fonctions `SECURITY DEFINER` avec `SET search_path`, exécution retirée à `public` et `anon`, politiques sensibles limitées à `authenticated`.
9. **Contraintes de cohérence** : quantité > 0, frais de livraison ≥ 0, mode `retrait|livraison`, un seul restaurant par compte au onboarding.

## 5. État des données

| Table | Lignes | Contenu |
|---|---|---|
| `restaurants` | 4 | 2 avec préfixe `[DEV]`, 2 comptes de test (« Chez Test Auth », « Le Deuxième Compte ») |
| `menu_items` | 1 | `[DEV] Plat test 1` — 25 000 |
| `menu_categories` | 4 | Riz & sauces, Grillades, Fast-food, Petit-déjeuner |
| `neighborhoods` | 4 | Kaloum, Dixinn, Ratoma, Matam |
| `restaurant_memberships` | 2 | 2 owners |
| `system_admin_memberships` | **1** | **✅ CORRIGÉ le 27/09/2026** : premier `super_admin` créé (`admin.speedfood.dev@gmail.com`) via service_role, vérifié par connexion réelle |
| Commandes et dérivés | 0 | — |
| `auth.users` | 3 | Comptes de test |

Les données sont donc **fictives/développement**, conformément à l'avertissement du README. Vérification faite : l'encodage UTF-8 est correct en base (« Petit-déjeuner » stocké proprement).

## 6. Écarts et risques à traiter

### 6.1 Blocage fonctionnel — aucun accès client anonyme aux commandes

Les 4 tables du cycle commande (`orders`, `order_items`, `order_status_events`, `order_proposals`) n'ont **que** des politiques pour les membres de restaurant authentifiés. Il n'existe ni :

- politique d'INSERT pour qu'un client (anon) crée sa commande ;
- politique de lecture par `jeton_suivi` pour qu'il suive sa commande ;
- chemin de réponse du client à une `order_proposal` (pas de politique UPDATE non plus).

Le choix « commande invitée sans compte » n'a donc **aucun chemin de données** à ce jour. Deux options à décider au bloc 7 : fonction `SECURITY DEFINER` (`fn_creer_commande`, `fn_suivre_commande`, `fn_repondre_proposition`) ou routes serveur avec `service_role`. La première garde la logique en base, la seconde centralise dans Next.js.

### 6.2 Élévation de privilèges — un membre de restaurant peut s'auto-publier

> **✅ CORRIGÉ le 27/09/2026** — migration `20260927200000_durcissement_colonnes_protegees.sql` (dépôt de code) : trigger `BEFORE UPDATE` sur `restaurants` interdisant aux non-admins de modifier `publie`, `suspendu_le`, `suspendu_motif`. Vérifié en base (tentative refusée pour un membre).

La politique `membres_maj_leur_restaurant` autorise un UPDATE **sans restriction de colonnes** : un simple `manager` peut donc passer `publie` à `true`, effacer `suspendu_le`/`suspendu_motif`, alors que ces champs relèvent normalement des admins (`admins_maj_restaurants`). Les politiques étant permissives et combinées par OU, la politique membre suffit à contourner la supervision.  
**Correctif :** trigger `BEFORE UPDATE` interdisant aux non-admins de toucher `publie`, `suspendu_le`, `suspendu_motif`, ou basculer ces actions sur des fonctions `SECURITY DEFINER` dédiées.

### 6.3 Instantané de prix modifiable côté restaurant

> **✅ CORRIGÉ le 27/09/2026** — même migration : trigger `BEFORE UPDATE` sur `orders` réservant aux membres la modification du seul `statut` (`reference`, `jeton_suivi`, `client_*`, `mode`, `sous_total`, `frais_livraison_estime` verrouillés hors admin/service_role). Vérifié en base (modification de `sous_total` refusée pour un membre, transition de statut toujours possible).

`membres_maj_leurs_commandes` couvre toutes les colonnes de `orders`, y compris `sous_total`, `client_nom`, `client_telephone`, `reference`. Les lignes `order_items` sont protégées (aucune politique UPDATE), mais le total de la commande reste modifiable après coup, ce qui contredit l'esprit de l'instantané de prix. Idem : trigger de protection des colonnes figées, ou `REVOKE UPDATE` au niveau colonne.

### 6.4 Absence de politique UPDATE sur `order_proposals`

Un restaurateur crée une proposition, mais rien ne permet de la mettre à jour (passage à `acceptee`, `refusee`, `expiree`), ni par le restaurant ni par le client. À cadrer avec le 6.1.

### 6.5 Historique des statuts non garanti

`order_status_events` est rempli par l'application ; rien n'oblige à écrire une ligne à chaque transition. Un trigger sur `orders` (après validation de transition) rendrait l'historique fiable — utile pour le support (bloc 8d).

### 6.6 Schéma incomplet pour le MVP

| Manque | Pourquoi c'est important |
|---|---|
| Pas de téléphone / contact sur `restaurants` | Le prototype dit « Appeler avant retrait » ; le TDR prévoit un contact |
| Pas de modes de service proposés ni de frais de livraison par restaurant | Le TDR : « le retrait et la livraison sont choisis par le restaurant » |
| `menu_categories` sert en réalité de **catégorie de restaurant** (`restaurants.categorie_id`) ; les plats n'ont aucune section de menu | À clarifier : sections dans la carte (ex. Entrées / Plats) ou catégories globales seulement |
| Pas de champ visuel (`couleur`, `emoji`, `note`, image) | Le prototype affiche couleur, emoji et note — décision produit à prendre |
| `menu_items` sans catégorie interne | Pour la présentation de la carte |

### 6.7 Vrac

- **Les migrations ne sont pas versionnées dans le dépôt** : les exporter (`supabase/migrations/`) est le prérequis du bloc 2 de `PLAN-EXECUTION.md`.
- **`system_admin_memberships` est vide** : le CMS est inutilisable tant qu'un `super_admin` n'est pas créé (opération à faire avec la `service_role`, jamais depuis le navigateur).
- **Région `eu-west-1` (Irlande)** : l'ADR-003 demande de mesurer la latence depuis Conakry avant de figer la région. Supabase n'a pas de région africaine : documenter l'arbitrage latence / souveraineté des données.
- **Données de dev à purger** avant tout pilote réel (les `[DEV]` et comptes de test).
- Renommer le projet dans le dashboard (« Speedfood »).
- Pas de `.gitignore` dans le dépôt : à créer avant tout fichier `.env`.

## 7. Corrections de documentation proposées

Les fichiers ci-dessous affirment encore qu'il n'y a pas de base :

1. `README.md` (« Limites actuelles ») : remplacer « aucune base de données partagée » par un renvoi vers ce document et le projet Supabase.
2. `ADR-003` : passer de « Supabase comme option initiale » à décision actée (`ggldjdizqrtpetdiohxy`, PostgreSQL 17, région à confirmer).
3. `AUDIT-BLOC-0.md` §6 (questions bloquantes) : marquer la question de la pile comme résolue.
4. `PLAN-EXECUTION.md` bloc 2 : ne plus « créer » le schéma mais **importer les migrations existantes** et traiter les écarts du §6.
5. `AGENT-INSTRUCTIONS.md` : ajouter la règle « aucune écriture dans la base de production sans passer par une migration versionnée ».

## 8. Sécurité des accès

Le Personal Access Token utilisé pour cet audit a transité par une conversation : **le révoquer** (https://supabase.com/dashboard/account/tokens) et en générer un nouveau, stocké uniquement dans un `.env` local (ignoré par Git). Ne jamais exposer la `service_role` au navigateur (règle déjà posée dans `AGENT-INSTRUCTIONS.md`).
