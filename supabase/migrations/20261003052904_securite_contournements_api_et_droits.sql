-- Revue de securite independante, points 6 (fin) et 13 : contournements par l'API
-- directe et durcissement des droits.

-- 6a. Un membre ne peut plus inserer d'evenements d'historique arbitraires : l'acteur
-- doit etre lui-meme, l'evenement doit decrire le statut REEL de la commande, et la
-- transition doit etre une transition valide.
drop policy if exists membres_ecriture_historique_commandes on public.order_status_events;
create policy membres_ecriture_historique_commandes on public.order_status_events
  for insert to authenticated
  with check (
    acteur = 'restaurant:' || (select auth.uid())::text
    and (statut_precedent, statut_suivant) in (
      ('en_attente', 'acceptee'),
      ('en_attente', 'refusee'),
      ('en_attente', 'annulee'),
      ('acceptee', 'prete'),
      ('acceptee', 'annulee'),
      ('prete', 'terminee')
    )
    and exists (
      select 1 from public.orders o
      where o.id = order_status_events.order_id
        and o.statut = order_status_events.statut_suivant
        and public.fn_est_membre_restaurant(o.restaurant_id)
    )
  );

-- 6b. Un plat ne peut referencer que la section de SON restaurant.
create or replace function public.fn_valider_section_plat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from menu_sections s
    where s.id = new.section_id and s.restaurant_id = new.restaurant_id
  ) then
    raise exception 'Section invalide pour ce restaurant' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_valider_section_plat() from public, anon, authenticated;

drop trigger if exists trg_valider_section_plat on public.menu_items;
create trigger trg_valider_section_plat
  before insert or update of section_id, restaurant_id on public.menu_items
  for each row execute function public.fn_valider_section_plat();

-- 13a. Policies reservees aux administrateurs : jamais evaluees pour `anon`.
alter policy editeurs_gestion_taxonomie_categories on public.menu_categories to authenticated;
alter policy editeurs_gestion_taxonomie_quartiers on public.neighborhoods to authenticated;
alter policy admins_lecture_parametres on public.parametres_application to authenticated;
alter policy super_admin_maj_parametres on public.parametres_application to authenticated;

-- 13b. Defense en profondeur : `anon` n'ecrit jamais dans les tables publiques (les
-- commandes d'invites passent par le serveur avec le service-role, ADR-011) ; ni
-- `anon` ni `authenticated` n'ont besoin de TRUNCATE, REFERENCES ou TRIGGER.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- 13c. Fonction de Supabase (active RLS sur toute nouvelle table) : plus appelable via l'API.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
