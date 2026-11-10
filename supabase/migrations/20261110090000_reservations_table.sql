-- Lot M2 (10 novembre 2026) : réservation de table, BASE DE DONNÉES SEULEMENT (plan docs/plans/2026-11-10-modes-de-commande-et-remboursements.md, §3 décision 3).
-- Un client demande une table (date, heure, nombre de personnes) ; le restaurant confirme ou refuse. Jamais de confirmation automatique, aucun paiement ni acompte.
-- Un restaurant doit ACTIVER la réservation (`accepte_reservation`, comme `accepte_sur_place`).
--
-- Principes :
--  - La CRÉATION passe par une route serveur (clé de service, lot M3) : aucune policy INSERT pour `anon` ni `authenticated`. Une garde de base (trigger) refuse malgré tout
--    une création incohérente (restaurant qui n'accepte pas les réservations, créneau passé ou trop lointain).
--  - Le suivi d'un invité se fait par jeton, comme pour les commandes ; mais ici on ne stocke QUE le condensé (SHA-256 en hexadécimal) du jeton, jamais le jeton en clair.
--    Le serveur calcule le condensé ; la colonne n'est lisible par aucun compte connecté (droits de colonne), seul le serveur la lit.
--  - Les transitions de statut sont imposées par la base (trigger), pour tous les rôles, clé de service comprise.
--  - Le client n'a pas d'UPDATE direct : son annulation passe par le serveur (M3).
--  - Le restaurant ne modifie que le statut et le motif ; qui a traité et quand sont posés par le trigger (non falsifiables).
--
-- Règles de temps (fuseau : Conakry = UTC+0, sans changement d'heure ; on stocke en timestamptz) :
--  - création : le créneau est dans le futur d'au moins 30 minutes et au plus 60 jours ;
--  - confirmation : seulement tant que le créneau n'est pas passé ;
--  - annulation par le client : seulement tant que le créneau n'est pas passé ;
--  - « honorée » : à partir de 1 heure AVANT le créneau (le client peut arriver en avance) ;
--  - « non honorée » : seulement une fois le créneau passé.
-- Ces bornes sont reprises dans packages/shared/src/reservation/statuts.ts (un test vérifie la parité des statuts et des transitions).

-- ---------------------------------------------------------------------------
-- Réglages du restaurant
-- ---------------------------------------------------------------------------
-- Le restaurateur règle ces colonnes comme `accepte_sur_place` : policy `membres_maj_leur_restaurant` (UPDATE par un membre) ;
-- `fn_proteger_colonnes_restaurant` ne protège que publication, suspension et correction demandée. Aucune policy ni aucun trigger à ajouter.
alter table public.restaurants add column accepte_reservation boolean not null default false;
-- Nombre maximal de couverts (personnes) acceptés par créneau ; `null` = pas de plafond. Le contrôle du quota se fait côté serveur (M3).
alter table public.restaurants add column reservation_capacite_couverts integer
  check (reservation_capacite_couverts is null or reservation_capacite_couverts between 1 and 500);

-- ---------------------------------------------------------------------------
-- Référence lisible : « SF-R- » + 5 caractères sans ambiguïté (mêmes caractères que la référence des commandes `SF-4KVB9`)
-- ---------------------------------------------------------------------------
-- La référence ne donne aucun accès (la clé d'accès est le jeton) : un tirage non cryptographique suffit. En cas de collision (très rare),
-- la contrainte d'unicité refuse l'insertion et le serveur réessaie.
create or replace function public.fn_reference_reservation()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  suffixe text := '';
  i integer;
begin
  for i in 1..5 loop
    suffixe := suffixe || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return 'SF-R-' || suffixe;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table des réservations
-- ---------------------------------------------------------------------------
create table public.reservations_table (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default public.fn_reference_reservation()
    check (reference ~ '^SF-R-[2-9A-HJKMNP-Z]{5}$'),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  -- Compte du client ; null pour un invité (ou si le compte a été supprimé : la réservation reste visible du restaurant).
  client_user_id uuid references auth.users(id) on delete set null,
  -- Condensé SHA-256 (64 caractères hexadécimaux) du jeton de suivi d'un invité. Jamais le jeton en clair. Null pour une réservation liée à un compte.
  jeton_suivi_hash text unique check (jeton_suivi_hash is null or jeton_suivi_hash ~ '^[0-9a-f]{64}$'),
  nom_client text not null check (char_length(btrim(nom_client)) between 2 and 60),
  -- Numéro guinéen normalisé par le serveur (`normaliserTelephone`), même format que les profils clients.
  telephone text not null check (telephone ~ '^\+224[67][0-9]{8}$'),
  nb_personnes integer not null check (nb_personnes between 1 and 12),
  creneau timestamptz not null,
  note text check (note is null or char_length(note) <= 200),
  statut text not null default 'demandee'
    check (statut in ('demandee', 'confirmee', 'refusee', 'annulee_client', 'annulee_restaurant', 'honoree', 'non_honoree')),
  motif_refus text check (motif_refus is null or char_length(motif_refus) between 3 and 200),
  traitee_par uuid references auth.users(id) on delete set null,
  traitee_le timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  -- Un refus ou une annulation par le restaurant s'explique au client.
  constraint reservations_table_motif_obligatoire
    check (statut not in ('refusee', 'annulee_restaurant') or motif_refus is not null),
  -- Dès que la demande est traitée, on sait quand.
  constraint reservations_table_traitee_le_renseignee
    check (statut = 'demandee' or traitee_le is not null)
);

comment on table public.reservations_table is 'Demandes de réservation de table (lot M2). Création par le serveur seulement ; transitions imposées par trigger.';
comment on column public.reservations_table.jeton_suivi_hash is 'SHA-256 hexadécimal du jeton de suivi de l''invité ; le jeton lui-même n''est jamais stocké. Illisible par les comptes connectés.';

create index idx_reservations_table_restaurant_creneau on public.reservations_table (restaurant_id, creneau);
create index idx_reservations_table_client on public.reservations_table (client_user_id) where client_user_id is not null;
-- Les demandes à traiter, pour la console du restaurant.
create index idx_reservations_table_a_traiter on public.reservations_table (restaurant_id, creneau) where statut = 'demandee';

-- ---------------------------------------------------------------------------
-- Garde à la création : refuse une réservation incohérente même si elle vient du serveur
-- ---------------------------------------------------------------------------
create or replace function public.fn_garde_creation_reservation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  select accepte_reservation, publie, suspendu_le into r from public.restaurants where id = new.restaurant_id;
  if not found or r.publie is not true or r.suspendu_le is not null then
    raise exception 'Ce restaurant n''est pas disponible pour une réservation.';
  end if;
  if r.accepte_reservation is not true then
    raise exception 'Ce restaurant n''accepte pas les réservations de table.';
  end if;
  if new.creneau < now() + interval '30 minutes' then
    raise exception 'Le créneau doit être dans plus de 30 minutes.';
  end if;
  if new.creneau > now() + interval '60 days' then
    raise exception 'Le créneau ne peut pas dépasser 60 jours.';
  end if;
  if new.statut <> 'demandee' then
    raise exception 'Une réservation commence toujours à l''état « demandée ».';
  end if;
  -- Il faut un moyen de suivre la réservation : un compte ou un jeton d'invité.
  if new.client_user_id is null and new.jeton_suivi_hash is null then
    raise exception 'Une réservation doit être liée à un compte ou à un jeton de suivi.';
  end if;
  return new;
end;
$$;

create trigger trg_reservations_table_garde_creation
  before insert on public.reservations_table
  for each row execute function public.fn_garde_creation_reservation();

-- ---------------------------------------------------------------------------
-- Garde à la modification : colonnes immuables, transitions, règles de temps, horodatages
-- ---------------------------------------------------------------------------
-- S'applique à tous les rôles, clé de service comprise (c'est la base qui garantit la règle).
create or replace function public.fn_valider_reservation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Colonnes d'identité : figées après la création. Seule exception : `client_user_id` peut passer à null
  -- (suppression du compte : action `on delete set null` de la clé étrangère).
  if new.id is distinct from old.id
     or new.reference is distinct from old.reference
     or new.restaurant_id is distinct from old.restaurant_id
     or new.creneau is distinct from old.creneau
     or new.nb_personnes is distinct from old.nb_personnes
     or new.nom_client is distinct from old.nom_client
     or new.telephone is distinct from old.telephone
     or new.jeton_suivi_hash is distinct from old.jeton_suivi_hash
     or new.cree_le is distinct from old.cree_le
     or (new.client_user_id is distinct from old.client_user_id and new.client_user_id is not null) then
    raise exception 'Cette information d''une réservation ne peut plus être modifiée.';
  end if;

  if new.statut is distinct from old.statut then
    if (old.statut, new.statut) not in (
      ('demandee', 'confirmee'),
      ('demandee', 'refusee'),
      ('demandee', 'annulee_client'),
      ('confirmee', 'annulee_client'),
      ('confirmee', 'annulee_restaurant'),
      ('confirmee', 'honoree'),
      ('confirmee', 'non_honoree')
    ) then
      raise exception 'Changement d''état impossible : de « % » à « % ».', old.statut, new.statut;
    end if;

    -- L'annulation par le client passe par le serveur (clé de service, sans identité) ; un compte connecté ne peut pas la poser à sa place.
    if new.statut = 'annulee_client' and auth.uid() is not null then
      raise exception 'L''annulation par le client se fait par le serveur.';
    end if;
    if new.statut in ('confirmee', 'annulee_client') and old.creneau <= now() then
      raise exception 'Le créneau est passé : cette réservation ne peut plus être confirmée ni annulée par le client.';
    end if;
    if new.statut = 'honoree' and now() < old.creneau - interval '1 hour' then
      raise exception 'Une réservation ne peut être marquée « honorée » que dans l''heure qui précède le créneau, ou après.';
    end if;
    if new.statut = 'non_honoree' and now() < old.creneau then
      raise exception 'Une réservation ne peut être marquée « non honorée » qu''une fois le créneau passé.';
    end if;

    -- Qui a traité la demande, et quand : posé par la base, pas par l'appelant.
    if old.statut = 'demandee' then
      new.traitee_le := now();
      new.traitee_par := auth.uid();
    else
      new.traitee_le := old.traitee_le;
      new.traitee_par := old.traitee_par;
    end if;
  else
    -- Statut inchangé : état final figé (motif compris). Les autres changements (suppression d'un compte lié) passent.
    if old.statut in ('refusee', 'annulee_client', 'annulee_restaurant', 'honoree', 'non_honoree')
       and new.motif_refus is distinct from old.motif_refus then
      raise exception 'Cette réservation est terminée : son motif ne peut plus changer.';
    end if;
    new.traitee_le := old.traitee_le;
  end if;

  new.mis_a_jour_le := now();
  return new;
end;
$$;

create trigger trg_reservations_table_valider
  before update on public.reservations_table
  for each row execute function public.fn_valider_reservation();

-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------
revoke all on public.reservations_table from anon, authenticated;
alter table public.reservations_table enable row level security;

-- Lecture : toutes les colonnes SAUF le condensé du jeton. `select *` échoue donc pour un compte connecté : le code liste ses colonnes.
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'reservations_table' and column_name <> 'jeton_suivi_hash'
  loop
    execute format('grant select (%I) on public.reservations_table to authenticated', c);
  end loop;
end $$;
-- Écriture par un compte connecté : le statut et le motif seulement (qui a traité et quand sont posés par le trigger). Aucun INSERT, aucun DELETE.
grant update (statut, motif_refus) on public.reservations_table to authenticated;
-- `anon` : aucun droit. Le serveur (service_role) garde tous les droits et contourne la RLS.

-- Le restaurateur membre lit et met à jour les réservations de SON restaurant, rien d'autre.
create policy "membres_lecture_leurs_reservations" on public.reservations_table
  for select to authenticated
  using (public.fn_est_membre_restaurant(restaurant_id));

create policy "membres_maj_leurs_reservations" on public.reservations_table
  for update to authenticated
  using (public.fn_est_membre_restaurant(restaurant_id))
  with check (public.fn_est_membre_restaurant(restaurant_id));

-- Le client connecté lit ses propres réservations (pas de modification directe).
create policy "clients_lecture_leurs_reservations" on public.reservations_table
  for select to authenticated
  using (client_user_id = auth.uid());

-- L'équipe d'assistance lit (lecture seule), comme pour les commandes ; ses actions passent par le serveur.
create policy "support_lecture_reservations" on public.reservations_table
  for select to authenticated
  using (public.fn_est_admin_systeme(array['support', 'super_admin']));
