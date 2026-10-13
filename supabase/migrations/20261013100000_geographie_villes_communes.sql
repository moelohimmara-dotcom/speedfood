-- Bloc 1 (phase 2) : géographie ville -> commune -> quartier (TDR v0.2 §6, BLOC-0 §3.1).
-- APPLIQUÉE en production le 13 octobre 2026, sur autorisation écrite de la propriétaire (projet ggldjdizqrtpetdiohxy).
-- Contrôle get_advisors(security) fait juste après : aucune alerte sur les nouvelles tables.

-- 1. Villes et communes : référence gérée par le CMS.
create table if not exists public.villes (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (char_length(nom) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create table if not exists public.communes (
  id uuid primary key default gen_random_uuid(),
  ville_id uuid not null references public.villes(id) on delete restrict,
  nom text not null check (char_length(nom) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  unique (ville_id, slug)
);

create index if not exists communes_ville_id_idx on public.communes (ville_id);

alter table public.villes enable row level security;
alter table public.communes enable row level security;

-- Lecture publique : seulement les entrées actives (anon et authenticated).
create policy "lecture_publique_villes" on public.villes
  for select to anon, authenticated
  using (actif);

create policy "lecture_publique_communes" on public.communes
  for select to anon, authenticated
  using (actif);

-- Écriture : éditeurs de contenu et super administrateur uniquement, jamais anon.
create policy "editeurs_gestion_villes" on public.villes
  for all to authenticated
  using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

create policy "editeurs_gestion_communes" on public.communes
  for all to authenticated
  using (fn_est_admin_systeme(array['content_editor', 'super_admin']))
  with check (fn_est_admin_systeme(array['content_editor', 'super_admin']));

-- 2. Données de départ : Conakry et ses cinq communes.
insert into public.villes (nom, slug) values ('Conakry', 'conakry')
on conflict (slug) do nothing;

insert into public.communes (ville_id, nom, slug)
select v.id, c.nom, c.slug
from public.villes v
cross join (values
  ('Kaloum', 'kaloum'),
  ('Dixinn', 'dixinn'),
  ('Matam', 'matam'),
  ('Ratoma', 'ratoma'),
  ('Matoto', 'matoto')
) as c (nom, slug)
where v.slug = 'conakry'
on conflict (ville_id, slug) do nothing;

-- 3. Quartiers rattachés à une commune. Nullable : le rattachement des quartiers existants
-- n'est PAS inventé par cette migration. Il doit être fait par la propriétaire (CMS) avant de
-- rendre la colonne obligatoire dans une migration ultérieure.
alter table public.neighborhoods
  add column if not exists commune_id uuid references public.communes(id) on delete restrict;

create index if not exists neighborhoods_commune_id_idx on public.neighborhoods (commune_id);

-- 4. Adresse client rattachée à un quartier (un profil client a au plus un quartier de référence).
alter table public.client_profils
  add column if not exists quartier_id uuid references public.neighborhoods(id) on delete set null;

create index if not exists client_profils_quartier_id_idx on public.client_profils (quartier_id);
