-- Supplements optionnels par plat, choisis par le client a la commande.
-- Instantane fige sur la commande dans order_item_options (meme principe que
-- order_items : nom/prix copies a l'envoi, jamais recalcules ensuite).

create table menu_item_options (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  nom text not null,
  prix integer not null default 0 check (prix >= 0),
  disponible boolean not null default true,
  cree_le timestamptz not null default now()
);
create index idx_menu_item_options_menu_item on menu_item_options(menu_item_id);

alter table menu_item_options enable row level security;

-- NB : les policies "membres_*" ci-dessous ont ete appliquees sans
-- `to authenticated`, ce qui cassait la lecture publique pour anon. Elles sont
-- recreees correctement par 20260928134009_menu_item_options_rls_roles_fix.sql.
create policy "lecture_publique_options_restaurants_publies" on menu_item_options
  for select
  using (exists (
    select 1 from menu_items mi
    join restaurants r on r.id = mi.restaurant_id
    where mi.id = menu_item_options.menu_item_id
      and r.publie = true
      and r.suspendu_le is null
  ));

create policy "membres_lecture_leurs_options" on menu_item_options
  for select
  using (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));

create policy "membres_gestion_leurs_options" on menu_item_options
  for insert
  with check (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));

create policy "membres_maj_leurs_options" on menu_item_options
  for update
  using (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ))
  with check (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));

create policy "membres_suppression_leurs_options" on menu_item_options
  for delete
  using (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));

create table order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  option_id uuid references menu_item_options(id) on delete set null,
  nom text not null,
  prix integer not null check (prix >= 0)
);
create index idx_order_item_options_order_item on order_item_options(order_item_id);

-- Fermee par defaut (aucune policy anon), comme order_items : ecriture par le
-- service-role uniquement (ADR-011). Policies de lecture ajoutees par
-- 20260928134430_order_item_options_lecture_membres_et_support.sql.
alter table order_item_options enable row level security;
