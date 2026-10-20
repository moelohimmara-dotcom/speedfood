-- Paiement en ligne par Speedfood, lot P2 (voir docs/PAIEMENT-ARCHITECTURE.md et docs/STRATEGIE-PAIEMENT.md).
--
-- TOUT EST INACTIF PAR DÉFAUT : l'interrupteur `parametres_paiement.paiement_en_ligne_actif` est éteint, le fournisseur est `simulation`.
-- Aucune table n'est lue ni écrite par l'application tant que le lot P3 n'est pas déployé et l'interrupteur allumé.
--
-- Principes appliqués en base (et non seulement dans le code) :
--   * Toutes les ÉCRITURES passent par le serveur (clé de service) : insert, update, delete et truncate sont retirés à anon et authenticated.
--   * Les LECTURES sont cloisonnées par la RLS : un restaurant ne voit que ses paiements et ses versements, un livreur que ses versements,
--     l'exploitation (super_admin, support) voit tout ; les comptes de versement, le livre de comptes et le journal des notifications ne sont
--     lisibles que par le super administrateur.
--   * Les montants d'un paiement sont IMMUABLES après création ; la somme des parts égale toujours le total ; l'état ne suit que les
--     transitions de la machine à états (miroir de src/lib/paiement/en-ligne/machine.ts, comparé par un test).
--   * Le livre de comptes est en AJOUT SEUL et chaque groupe d'écritures est ÉQUILIBRÉ à la validation de la transaction.
--   * Un paiement d'argent RÉEL (fournisseur autre que `simulation`) ne peut jamais être supprimé, même en cascade depuis une commande.
--   * Un versement par bénéficiaire et par paiement (contrainte d'unicité) : aucune libération double possible.

-- ------------------------------------------------------------------------------------------------------------------ réglages
create table public.parametres_paiement (
  id boolean primary key default true check (id),
  paiement_en_ligne_actif boolean not null default false,
  fournisseur text not null default 'simulation' check (fournisseur in ('simulation', 'chapchap')),
  -- VALEURS DE SIMULATION (Malika, 20 octobre 2026) : à remplacer par les valeurs réelles, sans déploiement.
  frais_mobile_permille_orange integer not null default 15 check (frais_mobile_permille_orange between 0 and 100),
  frais_mobile_permille_mtn integer not null default 17 check (frais_mobile_permille_mtn between 0 and 100),
  frais_speedfood_commande_gnf integer not null default 1000 check (frais_speedfood_commande_gnf >= 0),
  frais_versement_gnf integer not null default 0 check (frais_versement_gnf >= 0),
  delai_expiration_minutes integer not null default 15 check (delai_expiration_minutes between 1 and 120),
  plafond_paiement_gnf integer not null default 500000 check (plafond_paiement_gnf > 0),
  plafond_remboursement_auto_permille integer not null default 300 check (plafond_remboursement_auto_permille between 0 and 1000),
  seuil_litige_humain_gnf integer not null default 50000 check (seuil_litige_humain_gnf >= 0),
  -- Vide tant que Malika n'a pas validé les valeurs : l'écran des réglages affiche alors « valeurs de simulation ».
  valeurs_validees_le timestamptz,
  mis_a_jour_le timestamptz not null default now()
);
insert into public.parametres_paiement (id) values (true);

-- ------------------------------------------------------------------------------------------------------------------ comptes de versement
-- Numéro mobile money d'un restaurant ou d'un livreur, où Speedfood VERSE (jamais un solde détenu par Speedfood). Illisible par l'API
-- sauf pour le super administrateur ; l'application affiche une version masquée, calculée côté serveur.
create table public.comptes_versement (
  id uuid primary key default gen_random_uuid(),
  proprietaire_type text not null check (proprietaire_type in ('restaurant', 'livreur')),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  livreur_id uuid references public.livreurs (id) on delete cascade,
  operateur text not null check (operateur in ('orange_money', 'mtn_momo')),
  numero text not null check (numero ~ '^\+?[0-9]{8,15}$'),
  titulaire_nom text check (titulaire_nom is null or char_length(titulaire_nom) between 2 and 80),
  -- Un compte n'est utilisé pour un versement qu'après vérification (titulaire cohérent avec le restaurant ou le livreur).
  verifie_le timestamptz,
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  constraint comptes_versement_proprietaire check (
    (proprietaire_type = 'restaurant' and restaurant_id is not null and livreur_id is null)
    or (proprietaire_type = 'livreur' and livreur_id is not null and restaurant_id is null)
  )
);
create unique index comptes_versement_restaurant_actif_uq on public.comptes_versement (restaurant_id) where actif and restaurant_id is not null;
create unique index comptes_versement_livreur_actif_uq on public.comptes_versement (livreur_id) where actif and livreur_id is not null;

-- ------------------------------------------------------------------------------------------------------------------ paiements
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id),
  fournisseur text not null check (fournisseur in ('simulation', 'chapchap')),
  operateur text not null check (operateur in ('orange_money', 'mtn_momo')),
  etat text not null default 'cree'
    check (etat in ('cree', 'en_attente', 'confirme', 'libere', 'echoue', 'expire', 'annule', 'rembourse', 'en_litige')),
  repas_gnf integer not null check (repas_gnf > 0),
  frais_livraison_gnf integer not null default 0 check (frais_livraison_gnf >= 0),
  total_gnf integer generated always as (repas_gnf + frais_livraison_gnf) stored,
  livraison_par text not null check (livraison_par in ('aucune', 'livreur_independant', 'restaurant')),
  -- Répartition figée à la création (voir src/lib/paiement/en-ligne/repartition.ts).
  frais_speedfood_gnf integer not null check (frais_speedfood_gnf >= 0),
  frais_mobile_gnf integer not null check (frais_mobile_gnf >= 0),
  restaurant_gnf integer not null check (restaurant_gnf >= 0),
  livreur_gnf integer not null check (livreur_gnf >= 0),
  speedfood_brut_gnf integer not null check (speedfood_brut_gnf >= 0),
  rembourse_gnf integer not null default 0 check (rembourse_gnf >= 0),
  reference_interne text not null unique check (char_length(reference_interne) between 6 and 60),
  reference_externe text unique,
  expire_le timestamptz,
  confirme_le timestamptz,
  libere_le timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  -- La somme des parts est le total : un paiement incohérent ne peut pas exister.
  constraint paiements_parts_egales_total check (restaurant_gnf + livreur_gnf + speedfood_brut_gnf = repas_gnf + frais_livraison_gnf),
  constraint paiements_rembourse_borne check (rembourse_gnf <= repas_gnf + frais_livraison_gnf)
);
create index paiements_restaurant_idx on public.paiements (restaurant_id, cree_le desc);
create index paiements_etat_idx on public.paiements (etat) where etat in ('en_attente', 'confirme', 'en_litige');

-- État, immutabilité des montants, remboursement croissant.
create or replace function public.fn_paiement_garde()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.etat <> 'cree' then
      raise exception 'Un paiement est créé à l''état cree' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.order_id is distinct from old.order_id
     or new.restaurant_id is distinct from old.restaurant_id
     or new.fournisseur is distinct from old.fournisseur
     or new.operateur is distinct from old.operateur
     or new.repas_gnf is distinct from old.repas_gnf
     or new.frais_livraison_gnf is distinct from old.frais_livraison_gnf
     or new.livraison_par is distinct from old.livraison_par
     or new.frais_speedfood_gnf is distinct from old.frais_speedfood_gnf
     or new.frais_mobile_gnf is distinct from old.frais_mobile_gnf
     or new.restaurant_gnf is distinct from old.restaurant_gnf
     or new.livreur_gnf is distinct from old.livreur_gnf
     or new.speedfood_brut_gnf is distinct from old.speedfood_brut_gnf
     or new.reference_interne is distinct from old.reference_interne
     or new.cree_le is distinct from old.cree_le then
    raise exception 'Les montants et références d''un paiement ne se modifient pas' using errcode = '23514';
  end if;

  if old.reference_externe is not null and new.reference_externe is distinct from old.reference_externe then
    raise exception 'La référence du prestataire ne se modifie pas' using errcode = '23514';
  end if;

  if new.rembourse_gnf < old.rembourse_gnf then
    raise exception 'Un remboursement enregistré ne diminue pas' using errcode = '23514';
  end if;

  -- Miroir de src/lib/paiement/en-ligne/machine.ts (comparé par scripts/tests/paiement-en-ligne.test.mts).
  if new.etat is distinct from old.etat and not ((old.etat, new.etat) in (
       ('cree', 'en_attente'), ('cree', 'annule'),
       ('en_attente', 'confirme'), ('en_attente', 'echoue'), ('en_attente', 'annule'), ('en_attente', 'expire'),
       ('confirme', 'libere'), ('confirme', 'rembourse'), ('confirme', 'en_litige'),
       ('libere', 'en_litige'),
       ('en_litige', 'libere'), ('en_litige', 'rembourse'),
       ('expire', 'confirme'), ('annule', 'confirme')
     )) then
    raise exception 'Transition de paiement interdite : % vers %', old.etat, new.etat using errcode = '23514';
  end if;

  new.mis_a_jour_le := now();
  return new;
end;
$function$;
revoke execute on function public.fn_paiement_garde() from public, anon, authenticated;
create trigger trg_paiement_garde
  before insert or update on public.paiements
  for each row execute function public.fn_paiement_garde();

-- Un paiement d'argent réel n'est jamais supprimé (même en cascade depuis une commande) ; une simulation, ou un paiement qui n'a pas
-- reçu d'argent, peut l'être (réinitialisation de démonstration).
create or replace function public.fn_paiement_interdit_suppression_reelle()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.fournisseur <> 'simulation' and old.etat in ('confirme', 'libere', 'en_litige', 'rembourse') then
    raise exception 'Un paiement d''argent réel ne se supprime pas' using errcode = '23514';
  end if;
  return old;
end;
$function$;
revoke execute on function public.fn_paiement_interdit_suppression_reelle() from public, anon, authenticated;
create trigger trg_paiement_interdit_suppression_reelle
  before delete on public.paiements
  for each row execute function public.fn_paiement_interdit_suppression_reelle();

-- ------------------------------------------------------------------------------------------------------------------ livre de comptes
-- Écriture double, AJOUT SEUL. `cle_idempotence` identifie l'événement (ex. « encaissement », « liberation », « versement:restaurant ») :
-- rejouer le même événement viole l'unicité et ne produit donc aucune écriture en double.
create table public.paiement_ecritures (
  id bigint generated always as identity primary key,
  paiement_id uuid not null references public.paiements (id) on delete cascade,
  groupe_id uuid not null,
  cle_idempotence text not null check (char_length(cle_idempotence) between 3 and 80),
  compte text not null check (compte in (
    'fonds_operateur', 'fonds_a_liberer', 'a_verser_restaurant', 'a_verser_livreur', 'produit_speedfood', 'charge_frais_mobile', 'charge_remboursement'
  )),
  sens text not null check (sens in ('debit', 'credit')),
  montant_gnf integer not null check (montant_gnf > 0),
  cree_le timestamptz not null default now(),
  constraint paiement_ecritures_une_par_compte_et_sens unique (paiement_id, cle_idempotence, compte, sens)
);
create index paiement_ecritures_paiement_idx on public.paiement_ecritures (paiement_id);
create index paiement_ecritures_groupe_idx on public.paiement_ecritures (groupe_id);

-- Ajout seul : aucune modification ; une suppression n'est possible que lorsque le paiement parent a lui-même disparu (cascade d'une
-- simulation, voir le garde ci-dessus), jamais en direct.
create or replace function public.fn_paiement_ecritures_ajout_seul()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Le livre de comptes est en ajout seul' using errcode = '23514';
  end if;
  if exists (select 1 from public.paiements p where p.id = old.paiement_id) then
    raise exception 'Le livre de comptes est en ajout seul' using errcode = '23514';
  end if;
  return old;
end;
$function$;
revoke execute on function public.fn_paiement_ecritures_ajout_seul() from public, anon, authenticated;
create trigger trg_paiement_ecritures_ajout_seul
  before update or delete on public.paiement_ecritures
  for each row execute function public.fn_paiement_ecritures_ajout_seul();

-- Chaque groupe est équilibré (débits = crédits) QUAND LA TRANSACTION SE VALIDE : on peut donc insérer les lignes d'un groupe l'une
-- après l'autre, mais un groupe déséquilibré fait échouer la validation.
create or replace function public.fn_paiement_ecritures_equilibre()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_debits bigint;
  v_credits bigint;
begin
  select coalesce(sum(montant_gnf) filter (where sens = 'debit'), 0), coalesce(sum(montant_gnf) filter (where sens = 'credit'), 0)
    into v_debits, v_credits
    from public.paiement_ecritures where groupe_id = new.groupe_id;
  if v_debits <> v_credits then
    raise exception 'Groupe d''écritures déséquilibré : débits % crédits %', v_debits, v_credits using errcode = '23514';
  end if;
  return null;
end;
$function$;
revoke execute on function public.fn_paiement_ecritures_equilibre() from public, anon, authenticated;
create constraint trigger trg_paiement_ecritures_equilibre
  after insert on public.paiement_ecritures
  deferrable initially deferred
  for each row execute function public.fn_paiement_ecritures_equilibre();

-- ------------------------------------------------------------------------------------------------------------------ versements
create table public.paiement_versements (
  id uuid primary key default gen_random_uuid(),
  paiement_id uuid not null references public.paiements (id) on delete cascade,
  beneficiaire_type text not null check (beneficiaire_type in ('restaurant', 'livreur')),
  restaurant_id uuid references public.restaurants (id),
  livreur_id uuid references public.livreurs (id),
  compte_versement_id uuid references public.comptes_versement (id),
  operateur text not null check (operateur in ('orange_money', 'mtn_momo')),
  -- Version masquée pour l'affichage ; le numéro complet reste dans `comptes_versement` (serveur seulement).
  numero_masque text not null check (char_length(numero_masque) between 4 and 30),
  montant_gnf integer not null check (montant_gnf > 0),
  etat text not null default 'a_verser' check (etat in ('a_verser', 'envoye', 'confirme', 'echoue')),
  reference_interne text not null unique check (char_length(reference_interne) between 6 and 60),
  reference_externe text unique,
  tentatives integer not null default 0 check (tentatives >= 0),
  erreur_code text check (erreur_code is null or char_length(erreur_code) <= 60),
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  -- UN seul versement par bénéficiaire et par paiement : aucune libération double possible.
  constraint paiement_versements_un_par_beneficiaire unique (paiement_id, beneficiaire_type),
  constraint paiement_versements_beneficiaire check (
    (beneficiaire_type = 'restaurant' and restaurant_id is not null and livreur_id is null)
    or (beneficiaire_type = 'livreur' and livreur_id is not null and restaurant_id is null)
  )
);
create index paiement_versements_restaurant_idx on public.paiement_versements (restaurant_id) where restaurant_id is not null;
create index paiement_versements_livreur_idx on public.paiement_versements (livreur_id) where livreur_id is not null;
create index paiement_versements_a_traiter_idx on public.paiement_versements (etat) where etat in ('a_verser', 'envoye', 'echoue');

-- ------------------------------------------------------------------------------------------------------------------ notifications reçues
-- Journal d'idempotence : (fournisseur, identifiant de l'événement) est unique, donc un rejeu est reconnu et ignoré. Aucune donnée
-- personnelle : ni numéro de téléphone, ni corps brut.
create table public.paiement_evenements (
  id bigint generated always as identity primary key,
  fournisseur text not null check (fournisseur in ('simulation', 'chapchap')),
  identifiant_evenement text not null check (char_length(identifiant_evenement) between 1 and 120),
  reference_externe text,
  etat_recu text not null check (etat_recu in ('en_attente', 'succes', 'echec', 'annule', 'expire')),
  montant_gnf integer check (montant_gnf is null or montant_gnf >= 0),
  resultat text not null check (char_length(resultat) <= 80),
  recu_le timestamptz not null default now(),
  constraint paiement_evenements_unique unique (fournisseur, identifiant_evenement)
);

-- ------------------------------------------------------------------------------------------------------------------ litiges
create table public.litiges_paiement (
  id uuid primary key default gen_random_uuid(),
  paiement_id uuid not null references public.paiements (id) on delete cascade,
  ouvert_par text not null check (ouvert_par in ('client', 'restaurant', 'livreur', 'systeme')),
  situation text not null check (situation in (
    'restaurant_refuse_ou_annule', 'livreur_ne_livre_pas', 'client_injoignable', 'plat_manquant_ou_errone', 'contestation_apres_liberation'
  )),
  etat text not null default 'ouvert' check (etat in ('ouvert', 'decide_auto', 'a_humain', 'clos')),
  montant_demande_gnf integer check (montant_demande_gnf is null or montant_demande_gnf >= 0),
  preuve_fournie boolean not null default false,
  decision text check (decision is null or decision in ('rembourser_total', 'rembourser_partiel', 'aucun_remboursement', 'humain')),
  regle text check (regle is null or char_length(regle) <= 80),
  remboursement_gnf integer check (remboursement_gnf is null or remboursement_gnf >= 0),
  decide_le timestamptz,
  clos_le timestamptz,
  motif_cloture text check (motif_cloture is null or char_length(motif_cloture) <= 300),
  cree_le timestamptz not null default now()
);
create index litiges_paiement_paiement_idx on public.litiges_paiement (paiement_id);
create index litiges_paiement_a_traiter_idx on public.litiges_paiement (etat) where etat in ('ouvert', 'a_humain');

-- ------------------------------------------------------------------------------------------------------------------ commande
-- Nouveau mode de paiement d'une commande : « speedfood » (paiement en ligne). Les modes existants ne changent pas.
alter table public.orders drop constraint if exists orders_paiement_mode_check;
alter table public.orders add constraint orders_paiement_mode_check
  check (paiement_mode is null or paiement_mode in ('especes', 'orange_money', 'mtn_momo', 'speedfood'));

-- ------------------------------------------------------------------------------------------------------------------ droits et RLS
alter table public.parametres_paiement enable row level security;
alter table public.comptes_versement enable row level security;
alter table public.paiements enable row level security;
alter table public.paiement_ecritures enable row level security;
alter table public.paiement_versements enable row level security;
alter table public.paiement_evenements enable row level security;
alter table public.litiges_paiement enable row level security;

revoke all on table public.parametres_paiement, public.comptes_versement, public.paiements, public.paiement_ecritures,
  public.paiement_versements, public.paiement_evenements, public.litiges_paiement from anon;
revoke insert, update, delete, truncate on table public.parametres_paiement, public.comptes_versement, public.paiements,
  public.paiement_ecritures, public.paiement_versements, public.paiement_evenements, public.litiges_paiement from authenticated;

-- Lectures : l'exploitation lit les paiements, les versements et les litiges ; le super administrateur seul lit le reste.
create policy "exploitation_lecture_paiements" on public.paiements
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
create policy "restaurant_lit_ses_paiements" on public.paiements
  for select to authenticated using (public.fn_est_membre_restaurant(restaurant_id));

create policy "exploitation_lecture_versements" on public.paiement_versements
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
create policy "restaurant_lit_ses_versements" on public.paiement_versements
  for select to authenticated using (restaurant_id is not null and public.fn_est_membre_restaurant(restaurant_id));
create policy "livreur_lit_ses_versements" on public.paiement_versements
  for select to authenticated using (livreur_id is not null and public.fn_est_ce_mon_livreur(livreur_id));

create policy "exploitation_lecture_litiges" on public.litiges_paiement
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
create policy "restaurant_lit_ses_litiges" on public.litiges_paiement
  for select to authenticated using (exists (select 1 from public.paiements p where p.id = paiement_id and public.fn_est_membre_restaurant(p.restaurant_id)));

create policy "super_admin_lecture_ecritures" on public.paiement_ecritures
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_lecture_evenements" on public.paiement_evenements
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_lecture_comptes_versement" on public.comptes_versement
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_lecture_parametres_paiement" on public.parametres_paiement
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
