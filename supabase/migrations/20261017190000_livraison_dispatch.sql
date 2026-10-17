-- Livraison, phase 1b (voir docs/LIVRAISON.md) : livreurs, livraisons, offres de course et code de remise.
--
-- Toutes les ÉCRITURES passent par le serveur de l'application (clé de service) : les droits d'insertion, de modification
-- et de suppression sont retirés à anon et authenticated. Les LECTURES par l'API sont limitées par la RLS :
--   * un restaurant ne lit que les livraisons de SES commandes ;
--   * un livreur ne lit que SES courses et SES offres ;
--   * l'exploitation (super_admin, support : permission « commande.support ») lit tout ;
--   * le code de remise n'est lisible par personne via l'API (table réservée au serveur) : ni le restaurant ni le livreur.

create table public.livreurs (
  id uuid primary key default gen_random_uuid(),
  -- Compte du livreur (vrais livreurs, plus tard). Null pour un livreur simulé.
  utilisateur_id uuid unique references auth.users (id) on delete set null,
  nom text not null check (char_length(nom) between 2 and 80),
  telephone text check (telephone is null or char_length(telephone) between 6 and 20),
  vehicule text not null default 'moto' check (vehicule in ('moto', 'velo', 'voiture', 'pied')),
  statut text not null default 'hors_ligne' check (statut in ('hors_ligne', 'disponible', 'en_course')),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  position_le timestamptz,
  -- Livreur de démonstration : ses acceptations et ses déplacements sont produits par le serveur.
  simule boolean not null default false,
  donnees_demo boolean not null default false,
  derniere_course_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint livreurs_position_coherente check ((latitude is null) = (longitude is null))
);
create index livreurs_statut_idx on public.livreurs (statut) where statut = 'disponible';

create table public.livraisons (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id),
  mode text not null check (mode in ('propre', 'speedfood')),
  statut text not null default 'a_assigner'
    check (statut in ('a_assigner', 'offre_envoyee', 'assignee', 'vers_restaurant', 'recuperee', 'vers_client', 'livree', 'echec', 'annulee')),
  livreur_id uuid references public.livreurs (id) on delete set null,
  depart_latitude double precision check (depart_latitude is null or depart_latitude between -90 and 90),
  depart_longitude double precision check (depart_longitude is null or depart_longitude between -180 and 180),
  arrivee_latitude double precision check (arrivee_latitude is null or arrivee_latitude between -90 and 90),
  arrivee_longitude double precision check (arrivee_longitude is null or arrivee_longitude between -180 and 180),
  distance_m integer check (distance_m is null or distance_m >= 0),
  frais_gnf integer not null default 0 check (frais_gnf >= 0),
  essais_code integer not null default 0 check (essais_code >= 0),
  assignee_le timestamptz,
  recuperee_le timestamptz,
  livree_le timestamptz,
  raison text check (raison is null or char_length(raison) <= 300),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);
create index livraisons_restaurant_idx on public.livraisons (restaurant_id, cree_le desc);
create index livraisons_livreur_idx on public.livraisons (livreur_id) where livreur_id is not null;
create index livraisons_statut_idx on public.livraisons (statut) where statut not in ('livree', 'echec', 'annulee');

-- Code de remise à 4 chiffres : montré au client, saisi par le livreur. Jamais lisible par l'API.
create table public.livraison_codes (
  livraison_id uuid primary key references public.livraisons (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$')
);

create table public.livraison_offres (
  id uuid primary key default gen_random_uuid(),
  livraison_id uuid not null references public.livraisons (id) on delete cascade,
  livreur_id uuid not null references public.livreurs (id) on delete cascade,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee', 'expiree')),
  expire_le timestamptz not null,
  cree_le timestamptz not null default now(),
  repondu_le timestamptz,
  -- Un même livreur n'est sollicité qu'une fois pour une livraison.
  unique (livraison_id, livreur_id)
);
create index livraison_offres_livreur_idx on public.livraison_offres (livreur_id, statut);
create index livraison_offres_attente_idx on public.livraison_offres (expire_le) where statut = 'en_attente';

alter table public.livreurs enable row level security;
alter table public.livraisons enable row level security;
alter table public.livraison_codes enable row level security;
alter table public.livraison_offres enable row level security;

-- Deux fonctions d'aide pour les policies : sans elles, `livreurs` et `livraisons` se référenceraient l'une l'autre et PostgreSQL
-- refuserait toute lecture (« récursion infinie dans la policy »). Elles s'exécutent avec les droits du propriétaire, ne répondent
-- qu'à une question oui/non sur le compte connecté, et ne renvoient aucune donnée.
create or replace function public.fn_est_ce_mon_livreur(p_livreur uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.livreurs l where l.id = p_livreur and l.utilisateur_id = auth.uid());
$$;

create or replace function public.fn_mon_restaurant_a_ce_livreur(p_livreur uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.livraisons li
    where li.livreur_id = p_livreur
      and li.statut not in ('livree', 'echec', 'annulee')
      and public.fn_est_membre_restaurant(li.restaurant_id)
  );
$$;

revoke execute on function public.fn_est_ce_mon_livreur(uuid) from public, anon;
revoke execute on function public.fn_mon_restaurant_a_ce_livreur(uuid) from public, anon;
grant execute on function public.fn_est_ce_mon_livreur(uuid) to authenticated;
grant execute on function public.fn_mon_restaurant_a_ce_livreur(uuid) to authenticated;

-- Lectures
create policy "exploitation_lecture_livreurs" on public.livreurs
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
create policy "livreur_lit_sa_fiche" on public.livreurs
  for select to authenticated using (utilisateur_id = auth.uid());

-- Un restaurant voit le livreur affecté à SES commandes (nom, téléphone, position pour le retrait), et seulement lui.
create policy "restaurant_lit_son_livreur" on public.livreurs
  for select to authenticated using (public.fn_mon_restaurant_a_ce_livreur(id));

create policy "exploitation_lecture_livraisons" on public.livraisons
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
create policy "restaurant_lit_ses_livraisons" on public.livraisons
  for select to authenticated using (public.fn_est_membre_restaurant(restaurant_id));
create policy "livreur_lit_ses_livraisons" on public.livraisons
  for select to authenticated using (livreur_id is not null and public.fn_est_ce_mon_livreur(livreur_id));

create policy "exploitation_lecture_offres" on public.livraison_offres
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
create policy "livreur_lit_ses_offres" on public.livraison_offres
  for select to authenticated using (public.fn_est_ce_mon_livreur(livreur_id));

-- Écritures : réservées au serveur (clé de service). Les codes ne sont lisibles par personne via l'API.
revoke all on table public.livreurs, public.livraisons, public.livraison_codes, public.livraison_offres from anon;
revoke insert, update, delete, truncate on table public.livreurs, public.livraisons, public.livraison_offres from authenticated;
revoke all on table public.livraison_codes from authenticated;
