-- Appareils des applications natives pour les notifications poussees (Firebase Cloud Messaging, lot N5).
-- Un appareil = un jeton d'installation d'une application native, rattache au compte connecte dessus.
-- Table reservee au serveur (cle de service) : aucune policy, aucun acces pour anon ni authenticated.
-- Le jeton est un identifiant d'installation, pas un secret de compte, mais il permet d'envoyer des notifications
-- a un telephone : il ne sort donc jamais du serveur. Les notifications ne portent AUCUNE donnee de client
-- (nom, telephone, adresse, montant) : un texte generique par type d'evenement.

create table public.appareils_push (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  jeton text not null unique check (char_length(jeton) between 20 and 4096),
  plateforme text not null check (plateforme in ('android', 'ios')),
  version_app text check (version_app is null or char_length(version_app) <= 40),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  derniere_reussite_le timestamptz,
  echecs integer not null default 0 check (echecs >= 0)
);

create index appareils_push_utilisateur_idx on public.appareils_push (utilisateur_id);

alter table public.appareils_push enable row level security;
revoke all on public.appareils_push from anon, authenticated;
