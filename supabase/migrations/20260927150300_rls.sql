-- Row Level Security — activée sur TOUTES les tables exposées à l'API (ADR-003/004).
-- Principe : refuser par défaut, n'autoriser que ce qui est explicitement nécessaire.
-- Les commandes (orders/order_items/order_status_events/order_proposals) ne reçoivent
-- aucune policy anon d'écriture : la création de commande passe par une route serveur
-- (clé service-role, jamais exposée au navigateur) qui recalcule tout côté serveur —
-- voir ADR-005/006 et src/lib/contracts/. Les membres restaurant peuvent lire/mettre à
-- jour leurs propres commandes une fois l'authentification branchée (bloc 4).

-- ---------------------------------------------------------------------------
-- Taxonomie publique
-- ---------------------------------------------------------------------------

alter table menu_categories enable row level security;
create policy "lecture_publique_categories" on menu_categories
  for select using (true);

alter table neighborhoods enable row level security;
create policy "lecture_publique_quartiers" on neighborhoods
  for select using (true);

-- ---------------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------------

alter table restaurants enable row level security;

create policy "lecture_publique_restaurants_publies" on restaurants
  for select using (publie = true and suspendu_le is null);

create policy "membres_lecture_leur_restaurant" on restaurants
  for select using (fn_est_membre_restaurant(id));

create policy "membres_maj_leur_restaurant" on restaurants
  for update using (fn_est_membre_restaurant(id)) with check (fn_est_membre_restaurant(id));

create policy "admins_lecture_tous_restaurants" on restaurants
  for select using (fn_est_admin_systeme());

create policy "admins_creation_restaurants" on restaurants
  for insert with check (fn_est_admin_systeme(array['operations', 'super_admin']));

create policy "admins_maj_restaurants" on restaurants
  for update using (fn_est_admin_systeme(array['operations', 'super_admin']))
  with check (fn_est_admin_systeme(array['operations', 'super_admin']));

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------

alter table restaurant_memberships enable row level security;

create policy "lecture_sa_propre_membership" on restaurant_memberships
  for select using (utilisateur_id = auth.uid() or fn_est_admin_systeme());

-- L'inscription restaurateur est sur invitation/validation admin (TDR.md §6) :
-- pas d'auto-inscription publique dans restaurant_memberships.
create policy "admins_gestion_memberships" on restaurant_memberships
  for all using (fn_est_admin_systeme(array['operations', 'super_admin']))
  with check (fn_est_admin_systeme(array['operations', 'super_admin']));

alter table system_admin_memberships enable row level security;

create policy "lecture_son_propre_role_systeme" on system_admin_memberships
  for select using (utilisateur_id = auth.uid() or fn_est_admin_systeme(array['super_admin']));

-- Seul super_admin attribue les rôles système (ADR-010) : jamais auto-attribué.
create policy "super_admin_gestion_roles_systeme" on system_admin_memberships
  for all using (fn_est_admin_systeme(array['super_admin']))
  with check (fn_est_admin_systeme(array['super_admin']));

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------

alter table menu_items enable row level security;

create policy "lecture_publique_menu_restaurants_publies" on menu_items
  for select using (
    exists (
      select 1 from restaurants r
      where r.id = menu_items.restaurant_id
        and r.publie = true
        and r.suspendu_le is null
    )
  );

create policy "membres_lecture_leur_menu" on menu_items
  for select using (fn_est_membre_restaurant(restaurant_id));

create policy "membres_gestion_leur_menu" on menu_items
  for insert with check (fn_est_membre_restaurant(restaurant_id));

create policy "membres_maj_leur_menu" on menu_items
  for update using (fn_est_membre_restaurant(restaurant_id)) with check (fn_est_membre_restaurant(restaurant_id));

create policy "membres_suppression_leur_menu" on menu_items
  for delete using (fn_est_membre_restaurant(restaurant_id));

-- ---------------------------------------------------------------------------
-- Commandes — RLS activée, aucune policy anon (voir note en tête de fichier)
-- ---------------------------------------------------------------------------

alter table orders enable row level security;

create policy "membres_lecture_leurs_commandes" on orders
  for select using (fn_est_membre_restaurant(restaurant_id));

create policy "membres_maj_leurs_commandes" on orders
  for update using (fn_est_membre_restaurant(restaurant_id)) with check (fn_est_membre_restaurant(restaurant_id));

alter table order_items enable row level security;

create policy "membres_lecture_lignes_commandes" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and fn_est_membre_restaurant(o.restaurant_id)
    )
  );

alter table order_status_events enable row level security;

create policy "membres_lecture_historique_commandes" on order_status_events
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_status_events.order_id
        and fn_est_membre_restaurant(o.restaurant_id)
    )
  );

create policy "membres_ecriture_historique_commandes" on order_status_events
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_status_events.order_id
        and fn_est_membre_restaurant(o.restaurant_id)
    )
  );

alter table order_proposals enable row level security;

create policy "membres_lecture_propositions" on order_proposals
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_proposals.order_id
        and fn_est_membre_restaurant(o.restaurant_id)
    )
  );

create policy "membres_creation_propositions" on order_proposals
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_proposals.order_id
        and fn_est_membre_restaurant(o.restaurant_id)
    )
  );

-- ---------------------------------------------------------------------------
-- CMS système
-- ---------------------------------------------------------------------------

alter table content_pages enable row level security;

create policy "lecture_publique_contenu_publie" on content_pages
  for select using (statut = 'publie');

create policy "editeurs_gestion_contenu" on content_pages
  for all using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

alter table content_banners enable row level security;

create policy "lecture_publique_bannieres_publiees" on content_banners
  for select using (statut = 'publie');

create policy "editeurs_gestion_bannieres" on content_banners
  for all using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

alter table featured_placements enable row level security;

create policy "lecture_publique_mises_en_avant_actives" on featured_placements
  for select using (actif = true);

create policy "operations_gestion_mises_en_avant" on featured_placements
  for all using (fn_est_admin_systeme(array['operations', 'super_admin']))
  with check (fn_est_admin_systeme(array['operations', 'super_admin']));

-- Journal d'audit : lecture par tout rôle système, écriture par tout rôle système,
-- jamais de modification/suppression (append-only, ADR-010).
alter table audit_events enable row level security;

create policy "admins_lecture_audit" on audit_events
  for select using (fn_est_admin_systeme());

create policy "admins_ecriture_audit" on audit_events
  for insert with check (fn_est_admin_systeme());
