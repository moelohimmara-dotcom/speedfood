# Modèle de données — Speedfood

**Bloc 2** (`PLAN-EXECUTION.md`). Projet Supabase : `ggldjdizqrtpetdiohxy` (région eu-west-1). Migrations dans `supabase/migrations/`, appliquées dans l'ordre chronologique de leur nom.

## Vue d'ensemble

```
menu_categories, neighborhoods (taxonomie publique)
        │
        ▼
    restaurants ──────────┬──────────────┬───────────────────┐
        │                 │              │                   │
        ▼                 ▼              ▼                   ▼
restaurant_memberships  menu_items   orders            featured_placements
        │                              │
        ▼                              ├──> order_items
system_admin_memberships               ├──> order_status_events
        │                              └──> order_proposals
        ▼
content_pages, content_banners, audit_events (CMS, policies restrictives en attendant le bloc 8)
```

## Principe de sécurité (ADR-004)

`restaurants.id` est le tenant. Toute table contenant des données de restaurant porte
un `restaurant_id` (direct ou via jointure) et une policy RLS qui vérifie
l'appartenance via `fn_est_membre_restaurant(restaurant_id)`. **Aucune policy ne fait
confiance à un identifiant fourni par le client** : la fonction vérifie toujours
`auth.uid()` côté serveur contre `restaurant_memberships`.

## Tables

| Table | Rôle | Visibilité publique |
|---|---|---|
| `menu_categories`, `neighborhoods` | Taxonomie partagée (filtres du catalogue) | Lecture publique totale |
| `restaurants` | Fiche établissement | Lecture publique si `publie = true` et `suspendu_le is null` |
| `restaurant_memberships` | Lien compte ↔ restaurant, rôle `owner`/`manager` | Aucune (soi-même ou admin) |
| `system_admin_memberships` | RBAC système (ADR-010), rôles `super_admin`/`operations`/`content_editor`/`support` | Aucune (soi-même ou super_admin) |
| `menu_items` | Plats d'un restaurant, prix GNF entier | Lecture publique si le restaurant est publié |
| `orders` | Commande invité (ADR-005) | Aucune — toute écriture passe par une route serveur (clé service-role) |
| `order_items` | Instantané figé des lignes (ADR-006) | Aucune |
| `order_status_events` | Historique des transitions, acteur + horodatage | Aucune |
| `order_proposals` | Proposition de prix/conditions révisée (bloc 7, pas encore utilisée) | Aucune |
| `content_pages`, `content_banners` | CMS éditorial | Lecture publique si `statut = 'publie'` |
| `featured_placements` | Mise en avant restaurant | Lecture publique si `actif = true` |
| `audit_events` | Journal des actions sensibles CMS, append-only | Aucune (rôles système uniquement) |

## Pourquoi aucune policy publique sur `orders`

Le client crée une commande sans compte (ADR-005). Une policy RLS anonyme
d'écriture sur `orders` obligerait à faire confiance à ce que le navigateur envoie
(prix, total) — exactement ce qu'ADR-006 interdit. À la place :

- La création de commande, le recalcul du total et la génération du jeton de suivi
  se feront dans une route serveur Next.js (bloc 7) utilisant `src/lib/db/admin.ts`
  (clé service-role, jamais exposée au navigateur).
- La consultation du suivi client par jeton opaque passera par cette même route
  serveur, qui vérifie le jeton avant de renvoyer la commande — jamais par une
  policy RLS directe (un jeton n'est pas un rôle Postgres).
- Les membres du restaurant (une fois l'auth branchée au bloc 4) pourront lire et
  modifier directement les commandes de leur établissement via RLS
  (`membres_lecture_leurs_commandes`, `membres_maj_leurs_commandes`).

## Défense en profondeur sur les statuts de commande

La validité des transitions est vérifiée à **deux niveaux indépendants** :
1. Applicatif : `src/lib/contracts/statuts.ts` (`transitionAutorisee`).
2. Base de données : trigger `trg_orders_valider_transition` /
   `fn_valider_transition_commande`, qui rejette toute transition hors de la liste
   autorisée même si elle provient d'un accès direct à la table.

## Fonctions utilitaires

- `fn_est_membre_restaurant(restaurant_id)` : vrai si l'utilisateur connecté est
  owner/manager de ce restaurant. `SECURITY DEFINER`, exécution révoquée pour `anon`.
- `fn_est_admin_systeme(roles[])` : vrai si l'utilisateur connecté a un des rôles
  système donnés (tableau vide = n'importe quel rôle système). Même restriction.
- `fn_touch_mis_a_jour()` : trigger générique qui met à jour `mis_a_jour_le`.

Les deux premières restent appelables par le rôle `authenticated` via RPC direct
(nécessaire pour que les policies RLS les évaluent) : risque résiduel accepté, un
utilisateur connecté peut apprendre un booléen ("suis-je membre de X ?"), aucune
donnée sensible n'est exposée.

## Seeds de développement

`supabase/seed.sql` contient des données explicitement fictives (préfixées `[DEV]`),
volontairement différentes des données du prototype (`speedfood/prototype/data.js`)
pour ne jamais confondre les deux. **Ne jamais exécuter contre un environnement
pilote.** Non encore appliqué au projet Supabase actuel — à lancer manuellement en
développement local une fois nécessaire.

## Vérifié à l'acceptation du bloc 2

- [x] Migration depuis une base vide (5 migrations, appliquées avec succès)
- [x] RLS activée sur les 14 tables
- [x] Advisor de sécurité Supabase : aucun avertissement restant sur notre code
      (seul `rls_auto_enable`, une fonction de plateforme Supabase, reste signalé —
      hors de notre contrôle)
- [x] Montants (`prix`, `sous_total`, `frais_livraison_estime`, etc.) en `integer`,
      jamais `numeric`/`float`
- [x] Testé en conditions réelles via l'API REST avec la vraie clé anon (pas juste
      supposé) : un restaurant non publié est invisible, `orders` et
      `restaurant_memberships` renvoient vide, l'appel direct à
      `fn_est_membre_restaurant` est refusé (`permission denied`) — voir le seed
      `[DEV]` appliqué au projet pour reproduire
- [ ] Isolation testée avec deux comptes réels (membre A ne voit pas les données de
      B) — **à faire au bloc 4**, une fois l'authentification branchée : ce test a
      besoin d'au moins deux utilisateurs `auth.users` réels pour être significatif
