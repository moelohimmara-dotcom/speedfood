-- Robustesse sous charge (revue du 19 octobre 2026, essais de concurrence sur un vrai PostgreSQL 17, voir docs/REVUE-2026-10-19.md §6).
-- Deux defauts reproduits avec des transactions reellement simultanees ; migration ADDITIVE (aucune lecture existante n'est retiree).

-- 1. Moyenne des avis. Le declencheur recalculait la somme et le total depuis les avis visibles par SA transaction : deux avis poses en meme
-- temps se masquent mutuellement et la derniere ecriture gagne (essai : 30 avis simultanes, total affiche 2 au lieu de 30, jusqu'au prochain
-- avis). Correctif : prendre d'abord le verrou de la ligne du restaurant ; le calcul suivant (nouvelle instruction, nouvelle vue des donnees
-- validees) voit alors les avis des transactions deja terminees. Verrou `for no key update` (et non `for update`) : l'insertion d'un avis tient deja un verrou de cle etrangere sur la ligne du restaurant, et un verrou plus fort
-- provoquerait des interblocages entre avis simultanes (observe : 28 insertions sur 30 echouees avec `for update`). Les restaurants sont verrouilles dans un ordre fixe.
create or replace function public.fn_recalculer_avis_restaurant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.restaurant_id end,
      case when tg_op <> 'DELETE' then new.restaurant_id end
  ]) as x where x is not null order by 1 loop
    perform 1 from public.restaurants where id = v_id for no key update;
    update public.restaurants r
    set avis_somme = coalesce(s.somme, 0), avis_total = coalesce(s.total, 0)
    from (
      select sum(note)::integer as somme, count(*)::integer as total
      from public.avis
      where restaurant_id = v_id and cible = 'restaurant' and statut in ('publie', 'commentaire_masque') and not est_test
    ) s
    where r.id = v_id;
  end loop;
  return null;
end;
$$;
revoke execute on function public.fn_recalculer_avis_restaurant() from public, anon, authenticated;

-- 2. Numero d'appel au comptoir. L'application lisait le dernier numero du jour, ajoutait 1 et inserait, avec trois essais : des que quelques
-- clients envoient leur commande dans la meme fraction de seconde, la plupart echouent (essai : 5 commandes simultanees, 2 perdues ;
-- 10, 7 perdues ; 50, 44 perdues). Desormais un compteur par restaurant et par jour est incremente de facon atomique (une seule ligne
-- verrouillee le temps de l'incrementation) : chaque appel recoit un numero different. Des numeros peuvent etre sautes si une commande
-- echoue apres l'attribution : c'est sans importance (numero d'appel, pas numero de facture).
create table if not exists public.numeros_appel_jour (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  jour date not null,
  dernier integer not null check (dernier > 0),
  primary key (restaurant_id, jour)
);
alter table public.numeros_appel_jour enable row level security;
revoke all on table public.numeros_appel_jour from public, anon, authenticated;

create or replace function public.fn_attribuer_numero_appel(p_restaurant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jour date := (now() at time zone 'utc')::date;
  v_numero integer;
begin
  -- Premiere attribution du jour : on repart apres le plus grand numero deja pris aujourd'hui (commandes anterieures a ce compteur).
  insert into public.numeros_appel_jour as n (restaurant_id, jour, dernier)
  values (
    p_restaurant, v_jour,
    coalesce((select max(o.numero_appel) from public.orders o where o.restaurant_id = p_restaurant and (o.cree_le at time zone 'utc')::date = v_jour), 0) + 1
  )
  on conflict (restaurant_id, jour) do update set dernier = n.dernier + 1
  returning n.dernier into v_numero;
  return v_numero;
end;
$$;
revoke execute on function public.fn_attribuer_numero_appel(uuid) from public, anon, authenticated;
grant execute on function public.fn_attribuer_numero_appel(uuid) to service_role;
