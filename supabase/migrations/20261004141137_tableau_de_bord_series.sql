-- Series agregees pour les graphiques du tableau de bord d'administration : aucune donnee personnelle, seulement des
-- comptes et des montants par jour / par heure. Memes droits que fn_support_compter_commandes (support, super_admin).
-- La Guinee est a UTC+0 : les jours et heures UTC sont les jours et heures locaux.
create or replace function public.fn_support_serie_commandes(p_jours integer)
returns table (jour date, statut text, nb integer, montant bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 180 then
    raise exception 'Periode invalide' using errcode = '22023';
  end if;
  return query
    select (o.cree_le at time zone 'UTC')::date as jour,
           o.statut,
           count(*)::int as nb,
           coalesce(sum(o.sous_total), 0)::bigint as montant
    from orders o
    where o.cree_le >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => p_jours - 1)) at time zone 'UTC'
    group by 1, 2
    order by 1, 2;
end;
$$;

create or replace function public.fn_support_commandes_par_heure(p_jours integer)
returns table (heure integer, nb integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 180 then
    raise exception 'Periode invalide' using errcode = '22023';
  end if;
  return query
    select extract(hour from o.cree_le at time zone 'UTC')::int as heure, count(*)::int as nb
    from orders o
    where o.cree_le >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => p_jours - 1)) at time zone 'UTC'
    group by 1
    order by 1;
end;
$$;

revoke all on function public.fn_support_serie_commandes(integer) from public, anon;
revoke all on function public.fn_support_commandes_par_heure(integer) from public, anon;
grant execute on function public.fn_support_serie_commandes(integer) to authenticated, service_role;
grant execute on function public.fn_support_commandes_par_heure(integer) to authenticated, service_role;
