-- Sections de menu libres par restaurant (Entrees, Plats, Desserts, ou tout
-- autre decoupage choisi par le restaurateur) — un seul niveau, pas de
-- sous-categories (decision explicite : simplicite plutot qu'une taxonomie
-- imposee qui ne conviendrait pas a tous les types de restaurants).
create table menu_sections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  nom text not null,
  position integer not null default 0,
  cree_le timestamptz not null default now()
);
create index idx_menu_sections_restaurant on menu_sections(restaurant_id);

-- Un plat peut appartenir a une section ou rester non classe (retrocompatible
-- avec tous les plats existants, aucune migration de donnees necessaire).
-- on delete set null : supprimer une section ne supprime jamais les plats,
-- ils redeviennent simplement non classes (meme philosophie que archive_le).
alter table menu_items add column if not exists section_id uuid references menu_sections(id) on delete set null;
create index idx_menu_items_section on menu_items(section_id);

alter table menu_sections enable row level security;

-- Policies calquees sur menu_items : celles reservees aux membres portent
-- explicitement `to authenticated` (jamais aucune restriction de role, sinon
-- elles peuvent etre evaluees pour anon et casser la lecture publique).
create policy "lecture_publique_sections_restaurants_publies" on menu_sections
  for select
  using (exists (
    select 1 from restaurants r
    where r.id = menu_sections.restaurant_id
      and r.publie = true
      and r.suspendu_le is null
  ));

create policy "membres_lecture_leurs_sections" on menu_sections
  for select to authenticated
  using (fn_est_membre_restaurant(restaurant_id));

create policy "membres_gestion_leurs_sections" on menu_sections
  for insert to authenticated
  with check (fn_est_membre_restaurant(restaurant_id));

create policy "membres_maj_leurs_sections" on menu_sections
  for update to authenticated
  using (fn_est_membre_restaurant(restaurant_id))
  with check (fn_est_membre_restaurant(restaurant_id));

create policy "membres_suppression_leurs_sections" on menu_sections
  for delete to authenticated
  using (fn_est_membre_restaurant(restaurant_id));
