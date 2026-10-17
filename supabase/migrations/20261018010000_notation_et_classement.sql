-- Notation (avis) et classement du catalogue (voir docs/NOTATION.md).
--
-- Toutes les ÉCRITURES passent par le serveur (clé de service). Aucune lecture publique directe de `avis` : les pages publiques lisent
-- côté serveur, avec des colonnes choisies et sans identifiant de compte. Les agrégats d'un restaurant (somme et nombre de notes)
-- sont recalculés par la base à chaque changement d'avis et protégés contre toute modification par un restaurateur.

-- ---------------------------------------------------------------- agrégats d'un restaurant
alter table public.restaurants
  add column avis_somme integer not null default 0 check (avis_somme >= 0),
  add column avis_total integer not null default 0 check (avis_total >= 0);

create or replace function public.fn_proteger_colonnes_restaurant()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.publie is distinct from old.publie
     or new.suspendu_le is distinct from old.suspendu_le
     or new.suspendu_motif is distinct from old.suspendu_motif
     or new.motif_correction is distinct from old.motif_correction
     or new.avis_somme is distinct from old.avis_somme
     or new.avis_total is distinct from old.avis_total then
    if not fn_est_admin_systeme() then
      raise exception 'Seul un administrateur systeme peut modifier la publication, la suspension, la correction demandee ou les notes d''un restaurant';
    end if;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------- avis
create table public.avis (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  cible text not null check (cible in ('restaurant', 'livreur', 'client')),
  auteur text not null check (auteur in ('client', 'restaurant', 'livreur')),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  livreur_id uuid references public.livreurs (id) on delete set null,
  auteur_utilisateur_id uuid references auth.users (id) on delete set null,
  note smallint not null check (note between 1 and 5),
  etiquettes text[] not null default '{}' check (cardinality(etiquettes) <= 5),
  commentaire text check (commentaire is null or char_length(commentaire) <= 500),
  prenom_affiche text check (prenom_affiche is null or char_length(prenom_affiche) <= 20),
  statut text not null default 'publie' check (statut in ('publie', 'commentaire_masque', 'annule')),
  motif_moderation text check (motif_moderation is null or char_length(motif_moderation) <= 300),
  reponse_texte text check (reponse_texte is null or char_length(reponse_texte) <= 500),
  reponse_le timestamptz,
  reponse_par uuid references auth.users (id) on delete set null,
  est_test boolean not null default false,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  -- Qui note qui : le client note le restaurant et le livreur ; le restaurant et le livreur notent le client.
  constraint avis_combinaison check (
    (auteur = 'client' and cible in ('restaurant', 'livreur'))
    or (auteur in ('restaurant', 'livreur') and cible = 'client')
  ),
  -- Pas de texte libre sur un client.
  constraint avis_pas_de_commentaire_sur_client check (cible <> 'client' or commentaire is null),
  constraint avis_livreur_renseigne check (cible <> 'livreur' and auteur <> 'livreur' or livreur_id is not null),
  unique (order_id, cible, auteur)
);
create index avis_restaurant_idx on public.avis (restaurant_id, cible, statut, cree_le desc);
create index avis_livreur_idx on public.avis (livreur_id, cree_le desc) where livreur_id is not null;
create index avis_auteur_idx on public.avis (auteur_utilisateur_id) where auteur_utilisateur_id is not null;

create table public.avis_signalements (
  id uuid primary key default gen_random_uuid(),
  avis_id uuid not null references public.avis (id) on delete cascade,
  signale_par uuid references auth.users (id) on delete set null,
  motif text not null check (char_length(motif) between 5 and 300),
  traite_le timestamptz,
  traite_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (avis_id, signale_par)
);
create index avis_signalements_attente_idx on public.avis_signalements (cree_le) where traite_le is null;

alter table public.avis enable row level security;
alter table public.avis_signalements enable row level security;

-- Lectures (jamais anonymes) : l'auteur voit ses notes ; un restaurant voit les avis publics qui le concernent ; un livreur voit les
-- notes qui le concernent ; l'exploitation voit tout. Les notes d'un CLIENT ne sont lisibles que de leur auteur et de l'exploitation.
create policy "auteur_lit_ses_avis" on public.avis
  for select to authenticated using (auteur_utilisateur_id = auth.uid());
create policy "restaurant_lit_les_avis_qui_le_concernent" on public.avis
  for select to authenticated using (cible = 'restaurant' and public.fn_est_membre_restaurant(restaurant_id));
create policy "livreur_lit_les_notes_qui_le_concernent" on public.avis
  for select to authenticated using (cible = 'livreur' and livreur_id is not null and public.fn_est_ce_mon_livreur(livreur_id));
create policy "exploitation_lecture_avis" on public.avis
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));

create policy "exploitation_lecture_signalements" on public.avis_signalements
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));

revoke all on table public.avis, public.avis_signalements from anon;
revoke insert, update, delete, truncate on table public.avis, public.avis_signalements from authenticated;

-- ---------------------------------------------------------------- recalcul des agrégats
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
  ]) as x where x is not null loop
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

create trigger avis_recalcul_restaurant
  after insert or update or delete on public.avis
  for each row execute function public.fn_recalculer_avis_restaurant();

-- ---------------------------------------------------------------- fréquentation (commandes terminées par restaurant)
-- Réservée au serveur (clé de service) : aucun compte connecté ne l'appelle.
create or replace function public.fn_frequentation_restaurants(p_jours integer)
returns table (restaurant_id uuid, commandes integer)
language sql
stable
security definer
set search_path = public
as $$
  select o.restaurant_id, count(*)::integer
  from public.orders o
  where o.statut = 'terminee' and not o.est_test
    and o.mis_a_jour_le >= now() - make_interval(days => greatest(1, least(p_jours, 365)))
  group by o.restaurant_id;
$$;

revoke execute on function public.fn_frequentation_restaurants(integer) from public, anon, authenticated;
grant execute on function public.fn_frequentation_restaurants(integer) to service_role;

-- ---------------------------------------------------------------- réglages du classement (super administrateur)
create table public.parametres_classement (
  id boolean primary key default true check (id),
  poids_note integer not null default 50 check (poids_note between 0 and 100),
  poids_prix integer not null default 20 check (poids_prix between 0 and 100),
  poids_frequentation integer not null default 30 check (poids_frequentation between 0 and 100),
  fenetre_frequentation_jours integer not null default 30 check (fenetre_frequentation_jours between 7 and 180),
  mis_a_jour_le timestamptz not null default now(),
  mis_a_jour_par uuid references auth.users (id) on delete set null,
  constraint parametres_classement_somme check (poids_note + poids_prix + poids_frequentation = 100)
);
insert into public.parametres_classement (id) values (true);

alter table public.parametres_classement enable row level security;
create policy "super_admin_lecture_parametres_classement" on public.parametres_classement
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_maj_parametres_classement" on public.parametres_classement
  for update to authenticated
  using (public.fn_est_admin_systeme(array['super_admin']))
  with check (public.fn_est_admin_systeme(array['super_admin']));
revoke all on table public.parametres_classement from anon;
revoke insert, delete, truncate on table public.parametres_classement from authenticated;
