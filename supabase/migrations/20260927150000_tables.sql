-- Speedfood — schéma de données (bloc 2, PLAN-EXECUTION.md).
-- Toutes les tables sont créées ici sans policy RLS : elles sont ajoutées dans une
-- migration séparée une fois toutes les tables (et fonctions) en place, pour éviter
-- les dépendances circulaires entre policies et fonctions/tables pas encore créées.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Taxonomie publique (partagée par tous les restaurants)
-- ---------------------------------------------------------------------------

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  ordre integer not null default 0
);

create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique,
  ordre integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Restaurant — le tenant de sécurité (ADR-004)
-- ---------------------------------------------------------------------------

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  categorie_id uuid not null references menu_categories(id),
  quartier_id uuid not null references neighborhoods(id),
  horaires text not null default '',
  consignes text,
  ouvert boolean not null default true,
  -- Non publié tant qu'un administrateur système ne l'a pas validé (TDR.md §6).
  publie boolean not null default false,
  suspendu_le timestamptz,
  suspendu_motif text,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

create index idx_restaurants_categorie on restaurants(categorie_id);
create index idx_restaurants_quartier on restaurants(quartier_id);
create index idx_restaurants_publie on restaurants(publie) where publie = true;

-- ---------------------------------------------------------------------------
-- Memberships — relient un compte auth.users à un restaurant ou à un rôle système
-- ---------------------------------------------------------------------------

create table restaurant_memberships (
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager')),
  cree_le timestamptz not null default now(),
  primary key (restaurant_id, utilisateur_id)
);

create index idx_restaurant_memberships_utilisateur on restaurant_memberships(utilisateur_id);

-- RBAC système distinct des memberships restaurant (ADR-010) : jamais attribué
-- depuis une inscription publique, uniquement par un super_admin via action serveur.
create table system_admin_memberships (
  utilisateur_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'operations', 'content_editor', 'support')),
  cree_le timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  nom text not null,
  description text not null default '',
  -- Montant GNF entier, jamais de virgule flottante (ADR-006).
  prix integer not null check (prix >= 0),
  disponible boolean not null default true,
  -- Suppression logique : un plat référencé par une commande passée n'est jamais supprimé physiquement.
  archive_le timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

create index idx_menu_items_restaurant on menu_items(restaurant_id);

-- ---------------------------------------------------------------------------
-- Commandes (ADR-005 : invité, sans paiement ; ADR-006 : instantané des lignes)
-- ---------------------------------------------------------------------------

create table orders (
  id uuid primary key default gen_random_uuid(),
  -- Référence courte lisible affichée au client (ex. "SF-4KVB9"), générée côté serveur.
  reference text not null unique,
  -- Jeton opaque non devinable, seule clé d'accès au suivi client (TDR.md §6).
  jeton_suivi text not null unique,
  restaurant_id uuid not null references restaurants(id),
  client_nom text not null,
  client_telephone text not null,
  client_adresse text,
  mode text not null check (mode in ('retrait', 'livraison')),
  sous_total integer not null check (sous_total >= 0),
  frais_livraison_estime integer not null default 0 check (frais_livraison_estime >= 0),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'acceptee', 'refusee', 'prete', 'terminee', 'annulee')),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

create index idx_orders_restaurant on orders(restaurant_id);
create index idx_orders_statut on orders(statut);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- Conservé pour traçabilité ; mis à NULL si le plat est supprimé, la ligne garde son instantané.
  menu_item_id uuid references menu_items(id) on delete set null,
  -- Instantané figé au moment de l'envoi : ne jamais recalculer depuis le menu courant (ADR-006).
  nom text not null,
  prix integer not null check (prix >= 0),
  quantite integer not null check (quantite > 0)
);

create index idx_order_items_order on order_items(order_id);

-- Historique des transitions de statut (TDR.md §6 : chaque transition est auditable).
create table order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  statut_precedent text,
  statut_suivant text not null,
  acteur text not null,
  horodatage timestamptz not null default now()
);

create index idx_order_status_events_order on order_status_events(order_id);

-- Proposition de prix/conditions révisée par le restaurant après envoi (bloc 7, à activer plus tard).
create table order_proposals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  version integer not null,
  nouveau_sous_total integer not null check (nouveau_sous_total >= 0),
  nouveaux_frais_livraison integer not null default 0 check (nouveaux_frais_livraison >= 0),
  conditions_modifiees text,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'acceptee', 'refusee', 'expiree')),
  expire_le timestamptz,
  cree_le timestamptz not null default now(),
  repondu_le timestamptz,
  unique (order_id, version)
);

create index idx_order_proposals_order on order_proposals(order_id);

-- ---------------------------------------------------------------------------
-- CMS système (ADR-010, bloc 8 — tables prêtes, policies restrictives en attendant les écrans)
-- ---------------------------------------------------------------------------

create table content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titre text not null,
  contenu text not null default '',
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie')),
  auteur_id uuid references auth.users(id),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  publie_le timestamptz
);

create table content_banners (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  texte text not null default '',
  lien text,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publie')),
  ordre integer not null default 0,
  cree_le timestamptz not null default now()
);

create table featured_placements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  position integer not null default 0,
  actif boolean not null default true,
  debut_le timestamptz,
  fin_le timestamptz,
  cree_le timestamptz not null default now()
);

create index idx_featured_placements_restaurant on featured_placements(restaurant_id);

-- Journal d'audit des actions sensibles du CMS (ADR-010).
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  acteur_id uuid references auth.users(id),
  action text not null,
  cible_type text not null,
  cible_id text not null,
  motif text,
  horodatage timestamptz not null default now()
);

create index idx_audit_events_cible on audit_events(cible_type, cible_id);
