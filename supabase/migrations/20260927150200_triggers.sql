-- Triggers : horodatage automatique et validation des transitions de commande.

create trigger trg_restaurants_touch
  before update on restaurants
  for each row execute function fn_touch_mis_a_jour();

create trigger trg_menu_items_touch
  before update on menu_items
  for each row execute function fn_touch_mis_a_jour();

create trigger trg_content_pages_touch
  before update on content_pages
  for each row execute function fn_touch_mis_a_jour();

-- Remplace le touch générique pour orders : fn_valider_transition_commande fait
-- aussi le touch, donc pas de double trigger BEFORE UPDATE dessus.
create trigger trg_orders_valider_transition
  before update on orders
  for each row execute function fn_valider_transition_commande();
