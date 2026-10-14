-- Liste d'attente par zone : « Prévenez-moi quand un restaurant ouvre ici ».
-- Table réservée au serveur (service role) : aucune lecture ni écriture directe par les navigateurs. Les contacts sont des
-- données personnelles : consentement obligatoire (case cochée côté formulaire, horodaté ici), purge à la demande ou à
-- l'ouverture de la zone.

create table public.zone_alertes (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid references public.communes (id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods (id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'telephone')),
  contact text not null check (char_length(contact) between 6 and 120),
  consentement_le timestamptz not null default now(),
  notifie_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint zone_alertes_une_zone check ((commune_id is null) <> (neighborhood_id is null))
);

-- Un même contact ne s'inscrit qu'une fois par zone.
create unique index zone_alertes_contact_zone_uq
  on public.zone_alertes (contact, coalesce(neighborhood_id, commune_id));
create index zone_alertes_commune_idx on public.zone_alertes (commune_id) where commune_id is not null;
create index zone_alertes_quartier_idx on public.zone_alertes (neighborhood_id) where neighborhood_id is not null;

alter table public.zone_alertes enable row level security;
revoke all on public.zone_alertes from anon, authenticated;
create policy "aucun_acces_direct" on public.zone_alertes for all to anon, authenticated using (false) with check (false);
