-- Contenu de démonstration sur la production (23 novembre 2026), sans bandeau pour le public.
--
-- Le marquage `donnees_demo` (restaurants, livreurs) ne sert qu'à retrouver et gérer le lot. Trois garanties en base :
--   1. toute NOUVELLE commande chez un restaurant de démonstration est une commande de test (jamais vue comme vraie
--      dans les chiffres, ni payée) ; seul le chargement du jeu de données peut poser des commandes d'historique ;
--   2. le lot se masque et se réaffiche en une action (colonne `publie`) ;
--   3. le lot se supprime en une action, avec motif et double authentification, et rien d'autre n'est touché.

-- Le lot de présentation porte son propre repère (`demo_lot`), distinct de `donnees_demo` : les anciennes fiches de développement
-- (« [DEV] … », parfois volontairement non publiées) ne sont donc jamais réaffichées ni supprimées par les actions du lot.
alter table public.restaurants add column if not exists demo_lot text;
alter table public.livreurs add column if not exists demo_lot text;
create index if not exists restaurants_demo_lot_idx on public.restaurants (demo_lot) where demo_lot is not null;
-- Droits de colonne de `restaurants` (migration 20261118120100) : toute colonne ajoutée doit recevoir sa lecture explicitement.
-- `demo_lot` est un simple repère de lot, du même ordre que `donnees_demo` déjà lisible.
grant select (demo_lot) on public.restaurants to anon, authenticated;

-- 1. Commandes chez un restaurant de démonstration : toujours de test, sauf pendant le chargement de l'historique.
create or replace function public.fn_marquer_commande_demo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('speedfood.chargement_demo', true), '') <> 'on'
     and exists (select 1 from restaurants r where r.id = new.restaurant_id and r.donnees_demo) then
    new.est_test := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_marquer_commande_demo on public.orders;
create trigger trg_marquer_commande_demo
  before insert on public.orders
  for each row execute function public.fn_marquer_commande_demo();

-- 2. État du lot (lecture seule).
create or replace function public.fn_demo_etat()
returns jsonb
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if not public.fn_est_admin_systeme(array['super_admin', 'operations', 'content_editor', 'support']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'restaurants', (select count(*) from restaurants where demo_lot is not null),
    'visibles', (select count(*) from restaurants where demo_lot is not null and publie and suspendu_le is null),
    'plats', (select count(*) from menu_items i join restaurants r on r.id = i.restaurant_id where r.demo_lot is not null),
    'commandes', (select count(*) from orders o join restaurants r on r.id = o.restaurant_id where r.demo_lot is not null),
    'avis', (select count(*) from avis a join restaurants r on r.id = a.restaurant_id where r.demo_lot is not null),
    'livreurs', (select count(*) from livreurs where demo_lot is not null)
  );
end;
$$;

-- 3. Masquer ou réafficher le lot.
create or replace function public.fn_demo_visibilite(p_visible boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_visible is null or not public.fn_est_admin_systeme(array['super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  update restaurants set publie = p_visible where demo_lot is not null and publie is distinct from p_visible;
  get diagnostics n = row_count;
  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), case when p_visible then 'demo.reaffichee' else 'demo.masquee' end, 'restaurants', 'demo',
          n || ' restaurant(s) de démonstration');
  return n;
end;
$$;

-- 4. Supprimer le lot.
create or replace function public.fn_demo_supprimer(p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m text := btrim(coalesce(p_motif, ''));
  n_restaurants integer;
  n_commandes integer;
  n_livreurs integer;
begin
  if not public.fn_est_admin_systeme(array['super_admin']) or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if length(m) < 10 or length(m) > 500 then
    raise exception 'REFUS:motif' using errcode = 'P0001';
  end if;

  -- Les commandes d'abord (leurs lignes, livraisons, paiements et avis suivent en cascade), puis les restaurants.
  delete from orders where restaurant_id in (select id from restaurants where demo_lot is not null);
  get diagnostics n_commandes = row_count;
  delete from livreurs where demo_lot is not null;
  get diagnostics n_livreurs = row_count;
  delete from restaurants where demo_lot is not null;
  get diagnostics n_restaurants = row_count;

  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), 'demo.supprimee', 'restaurants', 'demo',
          m || ' [restaurants: ' || n_restaurants || ', commandes: ' || n_commandes || ', livreurs: ' || n_livreurs || ']');
  return jsonb_build_object('restaurants', n_restaurants, 'commandes', n_commandes, 'livreurs', n_livreurs);
end;
$$;

revoke all on function public.fn_demo_etat() from public, anon;
grant execute on function public.fn_demo_etat() to authenticated;
revoke all on function public.fn_demo_visibilite(boolean) from public, anon;
grant execute on function public.fn_demo_visibilite(boolean) to authenticated;
revoke all on function public.fn_demo_supprimer(text) from public, anon;
grant execute on function public.fn_demo_supprimer(text) to authenticated;
