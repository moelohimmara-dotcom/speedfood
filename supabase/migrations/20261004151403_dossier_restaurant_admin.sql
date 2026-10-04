-- Dossier de validation d'un restaurant pour la console d'administration : les administrateurs ne lisent pas le menu d'un
-- restaurant non publie (RLS), alors que c'est justement ce qu'ils doivent controler avant d'approuver. Agregats et cinq
-- noms de plats seulement, aucune donnee personnelle.
create or replace function public.fn_admin_dossier_restaurant(p_restaurant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resultat jsonb;
begin
  if not public.fn_est_admin_systeme(array['super_admin', 'operations', 'content_editor', 'support']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'plats', (select count(*) from menu_items where restaurant_id = p_restaurant and archive_le is null),
    'plats_disponibles', (select count(*) from menu_items where restaurant_id = p_restaurant and archive_le is null and disponible),
    'plats_avec_photo', (select count(*) from menu_items where restaurant_id = p_restaurant and archive_le is null and photo_url is not null),
    'commandes', (select count(*) from orders where restaurant_id = p_restaurant),
    'apercu_plats', coalesce((select jsonb_agg(t) from (
        select nom, prix from menu_items
        where restaurant_id = p_restaurant and archive_le is null
        order by cree_le limit 5) t), '[]'::jsonb)
  ) into resultat;
  return resultat;
end;
$$;

revoke all on function public.fn_admin_dossier_restaurant(uuid) from public, anon;
grant execute on function public.fn_admin_dossier_restaurant(uuid) to authenticated, service_role;
