-- Audit du 4 octobre 2026 : la lecture publique ne doit montrer ni les plats archivés (retirés par le restaurateur) ni les
-- mises en avant de restaurants non publiés ou suspendus.
drop policy if exists lecture_publique_menu_restaurants_publies on public.menu_items;
create policy lecture_publique_menu_restaurants_publies on public.menu_items
  for select to public
  using (
    archive_le is null
    and exists (
      select 1 from public.restaurants r
      where r.id = menu_items.restaurant_id and r.publie = true and r.suspendu_le is null
    )
  );

drop policy if exists lecture_publique_mises_en_avant_actives on public.featured_placements;
create policy lecture_publique_mises_en_avant_actives on public.featured_placements
  for select to public
  using (
    actif = true
    and exists (
      select 1 from public.restaurants r
      where r.id = featured_placements.restaurant_id and r.publie = true and r.suspendu_le is null
    )
  );
