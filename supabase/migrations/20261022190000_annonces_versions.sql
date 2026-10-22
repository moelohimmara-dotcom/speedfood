-- Annonces de nouvelle version de l'application aux appareils installes (notification poussee).
-- Une ligne par numero de version annonce : empeche d'annoncer deux fois la meme version (double clic, deux administrateurs).
-- Table reservee au serveur (cle de service) : aucune policy, aucun acces pour anon ni authenticated.

create table public.annonces_versions (
  version_code integer primary key check (version_code > 0),
  version_nom text not null check (char_length(version_nom) between 1 and 40),
  annoncee_le timestamptz not null default now(),
  annoncee_par uuid references auth.users(id) on delete set null,
  appareils integer not null default 0 check (appareils >= 0),
  envoyes integer not null default 0 check (envoyes >= 0)
);

alter table public.annonces_versions enable row level security;
revoke all on public.annonces_versions from anon, authenticated;
