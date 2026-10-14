-- Géographie nationale (schéma) : régions et préfectures au-dessus des communes, pour couvrir toute la Guinée.
-- Hiérarchie : région -> préfecture -> commune / sous-préfecture -> quartier. Les communes de Conakry gardent leur ville
-- (réforme de 2024) et sont rattachées à la préfecture de Conakry ; les autres communes n'ont pas de ville (ville_id facultatif).
-- Le quartier « générique » (Centre de …) représente le centre d'une commune hors Conakry tant que ses quartiers réels
-- n'ont pas été ajoutés : un restaurant doit toujours se rattacher à un quartier.

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  code_officiel text unique,
  latitude numeric(8, 5),
  longitude numeric(8, 5),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create table public.prefectures (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete restrict,
  nom text not null check (char_length(nom) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  code_officiel text unique,
  latitude numeric(8, 5),
  longitude numeric(8, 5),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
create index prefectures_region_idx on public.prefectures (region_id);

alter table public.communes alter column ville_id drop not null;
alter table public.communes add column prefecture_id uuid references public.prefectures (id) on delete restrict;
create index communes_prefecture_idx on public.communes (prefecture_id);
-- L'adresse d'une commune (?commune=…) doit désigner une seule commune dans tout le pays.
create unique index communes_slug_unique on public.communes (slug);

alter table public.neighborhoods add column generique boolean not null default false;

alter table public.regions enable row level security;
alter table public.prefectures enable row level security;

create policy "lecture_publique_regions" on public.regions for select to anon, authenticated using (actif);
create policy "lecture_publique_prefectures" on public.prefectures for select to anon, authenticated using (actif);
create policy "editeurs_gestion_regions" on public.regions
  for all to authenticated
  using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));
create policy "editeurs_gestion_prefectures" on public.prefectures
  for all to authenticated
  using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

-- Liste d'attente : une personne peut attendre une région ou une préfecture entière, pas seulement une commune ou un quartier.
alter table public.zone_alertes
  add column prefecture_id uuid references public.prefectures (id) on delete cascade,
  add column region_id uuid references public.regions (id) on delete cascade;
alter table public.zone_alertes drop constraint zone_alertes_une_zone;
alter table public.zone_alertes add constraint zone_alertes_une_zone
  check (num_nonnulls(commune_id, neighborhood_id, prefecture_id, region_id) = 1);
drop index public.zone_alertes_contact_zone_uq;
create unique index zone_alertes_contact_zone_uq
  on public.zone_alertes (contact, coalesce(neighborhood_id, commune_id, prefecture_id, region_id));
