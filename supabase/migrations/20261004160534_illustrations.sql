-- Illustrations modifiables (logo, couverture, plat) : parametres JSON valides par l'application, jamais de SVG brut.
alter table public.restaurants
  add column if not exists logo_illustration jsonb,
  add column if not exists couverture_illustration jsonb;
alter table public.menu_items add column if not exists illustration jsonb;

-- Garde-fou de forme seulement (objet de petite taille) : la liste blanche des motifs et des couleurs est validee par
-- l'application a l'ecriture ET a la lecture (un contenu invalide n'est simplement pas affiche).
alter table public.restaurants
  add constraint restaurants_logo_illustration_forme check (logo_illustration is null or (jsonb_typeof(logo_illustration) = 'object' and pg_column_size(logo_illustration) < 600)),
  add constraint restaurants_couverture_illustration_forme check (couverture_illustration is null or (jsonb_typeof(couverture_illustration) = 'object' and pg_column_size(couverture_illustration) < 600));
alter table public.menu_items
  add constraint menu_items_illustration_forme check (illustration is null or (jsonb_typeof(illustration) = 'object' and pg_column_size(illustration) < 600));

-- Liste des plats d'un restaurant pour la console d'administration (les administrateurs ne lisent pas le menu d'un
-- restaurant non publie : RLS).
create or replace function public.fn_admin_lister_plats(p_restaurant uuid)
returns table (id uuid, nom text, prix integer, photo_url text, illustration jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['super_admin', 'operations']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  return query
    select m.id, m.nom, m.prix, m.photo_url, m.illustration
    from menu_items m
    where m.restaurant_id = p_restaurant and m.archive_le is null
    order by m.cree_le, m.nom;
end;
$$;

-- Modifier ou supprimer l'illustration d'un logo, d'une couverture ou d'un plat. p_cible : 'logo', 'couverture' ou 'plat'.
create or replace function public.fn_admin_definir_illustration(p_cible text, p_id uuid, p_valeur jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['super_admin', 'operations']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_valeur is not null and (jsonb_typeof(p_valeur) <> 'object' or pg_column_size(p_valeur) >= 600) then
    raise exception 'Illustration invalide' using errcode = '22023';
  end if;
  if p_cible = 'logo' then
    update restaurants set logo_illustration = p_valeur where id = p_id;
  elsif p_cible = 'couverture' then
    update restaurants set couverture_illustration = p_valeur where id = p_id;
  elsif p_cible = 'plat' then
    update menu_items set illustration = p_valeur where id = p_id;
  else
    raise exception 'Cible invalide' using errcode = '22023';
  end if;
  if not found then
    raise exception 'Element introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.fn_admin_lister_plats(uuid) from public, anon;
grant execute on function public.fn_admin_lister_plats(uuid) to authenticated, service_role;
revoke all on function public.fn_admin_definir_illustration(text, uuid, jsonb) from public, anon;
grant execute on function public.fn_admin_definir_illustration(text, uuid, jsonb) to authenticated, service_role;
