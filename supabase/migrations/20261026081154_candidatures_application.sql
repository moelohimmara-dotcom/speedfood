-- R1 : demande de referencement deposee DEPUIS L'APPLICATION par une personne connectee (formulaire en 5 etapes).
-- La table `referencement_demandes` existe deja (formulaire public du site) : on la prolonge, sans rien casser (colonnes ajoutees avec des valeurs par defaut).
-- Une personne ne peut avoir qu'UNE demande ouverte (la precedente doit avoir ete refusee). Les images d'un candidat vont dans un depot PRIVE :
-- elles ne deviennent publiques que si l'equipe accepte et cree l'etablissement ; 30 jours apres un refus elles sont effacees.
alter table public.referencement_demandes
  add column utilisateur_id uuid references auth.users (id) on delete set null,
  add column origine text not null default 'site' check (origine in ('site', 'application')),
  add column horaires text check (horaires is null or char_length(horaires) <= 200),
  add column moyens_paiement text[] not null default '{}' check (moyens_paiement <@ array['especes', 'orange_money', 'mtn_momo']::text[] and cardinality(moyens_paiement) <= 3),
  add column services text[] not null default '{}' check (services <@ array['livraison', 'retrait', 'sur_place']::text[] and cardinality(services) <= 3),
  add column logo_chemin text check (logo_chemin is null or char_length(logo_chemin) <= 200),
  add column photo_chemin text check (photo_chemin is null or char_length(photo_chemin) <= 200),
  add column menu_brouillon jsonb check (menu_brouillon is null or (jsonb_typeof(menu_brouillon) = 'array' and jsonb_array_length(menu_brouillon) <= 80)),
  add column motif_refus text check (motif_refus is null or char_length(motif_refus) <= 300),
  add column fichiers_effaces_le timestamptz;

create unique index referencement_demandes_une_ouverte_par_compte
  on public.referencement_demandes (utilisateur_id)
  where utilisateur_id is not null and statut <> 'refusee';
create index referencement_demandes_utilisateur_idx on public.referencement_demandes (utilisateur_id) where utilisateur_id is not null;
create index referencement_demandes_purge_idx on public.referencement_demandes (traitee_le) where statut = 'refusee' and fichiers_effaces_le is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidatures', 'candidatures', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
