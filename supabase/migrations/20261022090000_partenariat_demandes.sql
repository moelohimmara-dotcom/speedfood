-- Demandes de partenariat (page « Devenir partenaire » : investir, soutenir la communauté, apporter des moyens, contribuer).
-- Table réservée au serveur (service role) : aucune lecture ni écriture directe par les navigateurs. Les coordonnées sont des
-- données personnelles : consentement obligatoire (case cochée côté formulaire, horodaté ici), suppression par l'administration.

create table public.partenariat_demandes (
  id uuid primary key default gen_random_uuid(),
  forme text not null check (forme in ('investir', 'soutenir', 'moyens', 'contribuer')),
  organisation text not null check (char_length(organisation) between 2 and 120),
  nom_contact text not null check (char_length(nom_contact) between 2 and 120),
  contact_type text not null check (contact_type in ('email', 'telephone')),
  contact text not null check (char_length(contact) between 6 and 120),
  message text not null check (char_length(message) between 20 and 1500),
  consentement_le timestamptz not null default now(),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'en_cours', 'traitee', 'classee')),
  traitee_le timestamptz,
  cree_le timestamptz not null default now()
);

create index partenariat_demandes_statut_idx on public.partenariat_demandes (statut, cree_le desc);

alter table public.partenariat_demandes enable row level security;
revoke all on public.partenariat_demandes from anon, authenticated;
create policy "aucun_acces_direct" on public.partenariat_demandes for all to anon, authenticated using (false) with check (false);
