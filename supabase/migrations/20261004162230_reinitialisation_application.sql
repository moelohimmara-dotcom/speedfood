-- Reinitialisation complete de l'application (remise a l'etat neuf avant la production). Reservee au super administrateur,
-- session renforcee (aal2) obligatoire, jeton a usage unique de 5 minutes delivre par la simulation, une seule execution par
-- heure. Tout se passe dans UNE transaction : tout est supprime ou rien. Les fichiers du stockage et la sauvegarde
-- preliminaire sont geres par l'application (voir src/lib/system-admin/reinitialisation.ts).
--
-- CONSERVE : comptes super administrateur (et leurs roles), parametres de l'application, quartiers, categories de plats,
-- journal d'audit (qui recoit l'evenement application.reinitialisation).
-- SUPPRIME : restaurants et tout ce qui s'y rattache (menus, options, commandes, lignes, evenements, propositions, mises en
-- avant, abonnements aux alertes, equipes), profils clients, pages d'aide, bannieres, compteurs de limitation, tous les
-- autres comptes.
insert into storage.buckets (id, name, public)
values ('sauvegardes', 'sauvegardes', false)
on conflict (id) do nothing;

create table if not exists public.reinitialisation_jetons (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null,
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null,
  utilise_le timestamptz
);
alter table public.reinitialisation_jetons enable row level security;
revoke all on public.reinitialisation_jetons from public, anon, authenticated;

-- Simulation en lecture seule : compte ce qui serait supprime et delivre le jeton de l'etape suivante.
create or replace function public.fn_reinitialisation_simuler()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  jeton uuid;
  expire timestamptz := now() + interval '5 minutes';
begin
  if not public.fn_est_admin_systeme(array['super_admin']) or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  delete from reinitialisation_jetons where expire_le < now() - interval '1 day';
  insert into reinitialisation_jetons (utilisateur_id, expire_le) values (auth.uid(), expire) returning id into jeton;
  return jsonb_build_object(
    'jeton', jeton,
    'expire_le', expire,
    'supprime', jsonb_build_object(
      'restaurants', (select count(*) from restaurants),
      'plats', (select count(*) from menu_items),
      'commandes', (select count(*) from orders),
      'profils_clients', (select count(*) from client_profils),
      'abonnements_alertes', (select count(*) from push_subscriptions),
      'pages', (select count(*) from content_pages),
      'bannieres', (select count(*) from content_banners),
      'mises_en_avant', (select count(*) from featured_placements),
      'comptes', (select count(*) from auth.users where id not in (select utilisateur_id from system_admin_memberships where role = 'super_admin'))),
    'conserve', jsonb_build_object(
      'super_administrateurs', (select count(*) from system_admin_memberships where role = 'super_admin'),
      'quartiers', (select count(*) from neighborhoods),
      'categories', (select count(*) from menu_categories),
      'evenements_audit', (select count(*) from audit_events))
  );
end;
$$;

create or replace function public.fn_reinitialiser_application(p_jeton uuid, p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m text := btrim(coalesce(p_motif, ''));
  j reinitialisation_jetons%rowtype;
  n_restaurants integer;
  n_commandes integer;
  n_comptes integer;
begin
  if not public.fn_est_admin_systeme(array['super_admin']) or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if length(m) < 10 or length(m) > 500 then
    raise exception 'REFUS:motif' using errcode = 'P0001';
  end if;
  select * into j from reinitialisation_jetons where id = p_jeton for update;
  if not found or j.utilisateur_id <> auth.uid() or j.utilise_le is not null or j.expire_le < now() then
    raise exception 'REFUS:jeton' using errcode = 'P0001';
  end if;
  if exists (select 1 from audit_events where action = 'application.reinitialisation' and horodatage > now() - interval '1 hour') then
    raise exception 'REFUS:limite' using errcode = 'P0001';
  end if;
  update reinitialisation_jetons set utilise_le = now() where id = j.id;

  select count(*) into n_restaurants from restaurants;
  select count(*) into n_commandes from orders;

  delete from order_item_options;
  delete from order_items;
  delete from order_status_events;
  delete from order_proposals;
  delete from orders;
  delete from menu_item_options;
  delete from menu_items;
  delete from menu_sections;
  delete from featured_placements;
  delete from push_subscriptions;
  delete from restaurant_memberships;
  delete from restaurants;
  delete from client_profils;
  delete from content_pages;
  delete from content_banners;
  delete from rate_limits;
  delete from system_admin_memberships where role <> 'super_admin';
  delete from auth.users where id not in (select utilisateur_id from system_admin_memberships where role = 'super_admin');
  get diagnostics n_comptes = row_count;

  insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
  values (auth.uid(), 'application.reinitialisation', 'application', auth.uid()::text,
          m || ' [restaurants: ' || n_restaurants || ', commandes: ' || n_commandes || ', comptes: ' || n_comptes || ']');

  return jsonb_build_object('restaurants', n_restaurants, 'commandes', n_commandes, 'comptes', n_comptes);
end;
$$;

revoke all on function public.fn_reinitialisation_simuler() from public, anon;
grant execute on function public.fn_reinitialisation_simuler() to authenticated;
revoke all on function public.fn_reinitialiser_application(uuid, text) from public, anon;
grant execute on function public.fn_reinitialiser_application(uuid, text) to authenticated;
