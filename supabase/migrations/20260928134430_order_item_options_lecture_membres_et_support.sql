-- order_item_options etait fermee a tout acces (aucune policy). Mais order_items
-- a en plus une policy de lecture pour les membres du restaurant concerne
-- (console restaurant, lue via la session du membre) et pour le support :
-- order_item_options doit avoir les memes, sinon la console ne peut jamais voir
-- les supplements choisis sur ses propres commandes.
create policy "membres_lecture_options_commandes" on order_item_options
  for select to authenticated
  using (exists (
    select 1 from order_items oi
    join orders o on o.id = oi.order_id
    where oi.id = order_item_options.order_item_id
      and fn_est_membre_restaurant(o.restaurant_id)
  ));

create policy "support_lecture_options_commandes" on order_item_options
  for select
  using (fn_est_admin_systeme(array['support', 'super_admin']));
