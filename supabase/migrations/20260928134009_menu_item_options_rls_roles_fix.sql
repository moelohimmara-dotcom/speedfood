-- Les politiques de gestion par les membres du restaurant doivent etre
-- restreintes au role authenticated, comme sur menu_items : sinon Postgres
-- les evalue aussi pour anon lors d'un SELECT (policies combinees en OR),
-- et l'appel a fn_est_membre_restaurant() echoue par manque de droit
-- d'execution pour anon, bloquant meme la politique de lecture publique.
drop policy if exists "membres_lecture_leurs_options" on menu_item_options;
drop policy if exists "membres_gestion_leurs_options" on menu_item_options;
drop policy if exists "membres_maj_leurs_options" on menu_item_options;
drop policy if exists "membres_suppression_leurs_options" on menu_item_options;

create policy "membres_lecture_leurs_options" on menu_item_options
  for select to authenticated
  using (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));

create policy "membres_gestion_leurs_options" on menu_item_options
  for insert to authenticated
  with check (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));

create policy "membres_maj_leurs_options" on menu_item_options
  for update to authenticated
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
  for delete to authenticated
  using (exists (
    select 1 from menu_items mi
    where mi.id = menu_item_options.menu_item_id
      and fn_est_membre_restaurant(mi.restaurant_id)
  ));
