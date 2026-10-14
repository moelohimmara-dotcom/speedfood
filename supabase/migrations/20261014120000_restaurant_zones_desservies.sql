-- Zones desservies par restaurant : où un restaurant livre, à quel prix et en combien de temps.
-- Un restaurant sans ligne ne déclare aucune livraison (retrait seulement). Frais et délai sont facultatifs : ils ne s'affichent
-- que s'ils sont renseignés (jamais d'estimation inventée). Une ligne désigne une commune entière OU un quartier.

create table public.restaurant_zones_desservies (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  commune_id uuid references public.communes (id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods (id) on delete cascade,
  frais_gnf integer check (frais_gnf is null or frais_gnf between 0 and 1000000),
  delai_minutes integer check (delai_minutes is null or delai_minutes between 5 and 480),
  cree_le timestamptz not null default now(),
  constraint restaurant_zones_une_zone check ((commune_id is null) <> (neighborhood_id is null))
);

create unique index restaurant_zones_commune_uq on public.restaurant_zones_desservies (restaurant_id, commune_id) where commune_id is not null;
create unique index restaurant_zones_quartier_uq on public.restaurant_zones_desservies (restaurant_id, neighborhood_id) where neighborhood_id is not null;
create index restaurant_zones_restaurant_idx on public.restaurant_zones_desservies (restaurant_id);

alter table public.restaurant_zones_desservies enable row level security;

-- Lecture publique pour les restaurants publiés (affichage « livre chez vous »).
create policy "lecture_publique_zones_desservies" on public.restaurant_zones_desservies
  for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.publie));

-- Les membres du restaurant gèrent leurs zones.
create policy "membres_gerent_zones_desservies" on public.restaurant_zones_desservies
  for all to authenticated
  using (public.fn_est_membre_restaurant(restaurant_id))
  with check (public.fn_est_membre_restaurant(restaurant_id));
