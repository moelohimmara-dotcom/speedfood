-- Livreurs : cycle de vie de la fiche, liens d'activation, dossier, réglages (voir docs/LIVREURS.md).
--
-- Les livreurs existants (livreurs de démonstration) passent « actif » : rien ne change pour eux. Toutes les ÉCRITURES passent par
-- le serveur (clé de service). Les empreintes des liens d'activation ne sont lisibles par personne via l'API ; le dossier
-- (pièce d'identité, contact d'urgence) n'est lisible que par le super administrateur.

alter table public.livreurs
  add column cycle text not null default 'actif'
    check (cycle in ('cree', 'invite', 'candidat', 'actif', 'suspendu', 'archive')),
  add column motif_cycle text check (motif_cycle is null or char_length(motif_cycle) <= 300),
  add column email_invitation text check (email_invitation is null or char_length(email_invitation) <= 120),
  add column approuve_le timestamptz,
  add column approuve_par uuid references auth.users (id) on delete set null;

-- Un téléphone ne porte qu'une fiche non archivée.
create unique index livreurs_telephone_non_archive_uq on public.livreurs (telephone) where telephone is not null and cycle <> 'archive';
create index livreurs_cycle_idx on public.livreurs (cycle);

-- Liens d'activation : seule l'empreinte du jeton est stockée ; usage unique ; expiration.
create table public.livreur_invitations (
  id uuid primary key default gen_random_uuid(),
  livreur_id uuid not null references public.livreurs (id) on delete cascade,
  empreinte text not null unique check (char_length(empreinte) = 64),
  expire_le timestamptz not null,
  utilise_le timestamptz,
  cree_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now()
);
create index livreur_invitations_livreur_idx on public.livreur_invitations (livreur_id);

-- Dossier du livreur : seulement les champs que la console exige (voir réglages).
create table public.livreur_dossiers (
  livreur_id uuid primary key references public.livreurs (id) on delete cascade,
  piece_type text check (piece_type is null or piece_type in ('carte_identite', 'passeport', 'permis', 'autre')),
  piece_numero text check (piece_numero is null or char_length(piece_numero) between 4 and 40),
  urgence_nom text check (urgence_nom is null or char_length(urgence_nom) between 2 and 80),
  urgence_telephone text check (urgence_telephone is null or char_length(urgence_telephone) between 6 and 20),
  consentement_le timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

alter table public.livreur_invitations enable row level security;
alter table public.livreur_dossiers enable row level security;

create policy "super_admin_lecture_dossiers_livreurs" on public.livreur_dossiers
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));

revoke all on table public.livreur_invitations from anon, authenticated;
revoke all on table public.livreur_dossiers from anon;
revoke insert, update, delete, truncate on table public.livreur_dossiers from authenticated;

-- Réglages de la console (super administrateur) : approbation, dossier demandé, validité des liens.
alter table public.parametres_livraison
  add column livreur_approbation_requise boolean not null default true,
  add column livreur_piece_requise boolean not null default false,
  add column livreur_urgence_requise boolean not null default false,
  add column livreur_lien_validite_jours integer not null default 7 check (livreur_lien_validite_jours between 1 and 30);
