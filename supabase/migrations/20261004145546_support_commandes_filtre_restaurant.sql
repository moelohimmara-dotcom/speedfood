-- Support commandes : filtre par restaurant et identifiant du restaurant dans les lignes (liens croises avec la fiche
-- restaurant). Meme controle de role et memes coordonnees masquees qu'avant ; seule la signature change.
drop function if exists public.fn_support_lister_commandes(text, text, boolean, uuid);

create function public.fn_support_lister_commandes(
  p_reference text default null,
  p_statut text default null,
  p_jour boolean default false,
  p_id uuid default null,
  p_restaurant uuid default null
)
returns table (
  id uuid, reference text, statut text, mode text, client_nom text, telephone_masque text, adresse_masquee text,
  sous_total integer, frais_livraison_estime integer, cree_le timestamptz, restaurant_nom text, restaurant_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  return query
    select o.id, o.reference, o.statut, o.mode, o.client_nom,
           public.fn_masquer_telephone(o.client_telephone),
           public.fn_masquer_adresse(o.client_adresse),
           o.sous_total, o.frais_livraison_estime, o.cree_le, r.nom, o.restaurant_id
    from orders o
    left join restaurants r on r.id = o.restaurant_id
    where (p_id is null or o.id = p_id)
      and (p_restaurant is null or o.restaurant_id = p_restaurant)
      and (p_reference is null or p_reference = '' or position(lower(p_reference) in lower(o.reference)) > 0)
      and (p_statut is null or p_statut = '' or o.statut = p_statut)
      and (not coalesce(p_jour, false) or o.cree_le >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    order by o.cree_le desc
    limit 100;
end;
$$;

revoke all on function public.fn_support_lister_commandes(text, text, boolean, uuid, uuid) from public, anon;
grant execute on function public.fn_support_lister_commandes(text, text, boolean, uuid, uuid) to authenticated, service_role;
