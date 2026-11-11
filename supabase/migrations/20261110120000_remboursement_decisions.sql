-- Lot R2 : decision humaine consignee sur un remboursement, moyen choisi, reglage des especes.
-- FICHIER SEUL : NON APPLIQUE sur la base de production (feu vert distinct de Malika requis, puis get_advisors(type: "security")).
--
-- Ce que fait cette migration (le systeme ENREGISTRE des decisions humaines, il ne tranche aucun point de droit) :
--   * `remboursement_decisions` : une ligne par decision, en AJOUT SEUL (aucune modification, aucune suppression, meme par le serveur).
--     Une correction est une NOUVELLE decision qui remplace la precedente (`remplace_id`) : l'historique reste entier.
--     La decision n'est PAS un mouvement d'argent : elle autorise l'etape suivante, qui reste une action distincte et confirmee.
--   * `parametres_remboursement` : reglage de plateforme `remboursement_especes_autorise` (FAUX par defaut). Chaque changement est
--     journalise par la base elle-meme (`parametres_remboursement_journal`, ajout seul) avec son auteur, sa date et son motif.
--   * `remboursements_manuels.decision_id` : lien (facultatif) entre un remboursement fait a la main et la decision qui l'autorisait.
--   * Garde en base : aucun remboursement en especes ne peut etre enregistre tant que le reglage est faux (decision comme trace).
-- Acces : RLS activee, lecture reservee au super administrateur ; AUCUNE ecriture par l'API (le serveur ecrit avec la cle de service).

-- ------------------------------------------------------------------------------------------------------------------ reglage
create table public.parametres_remboursement (
  id boolean primary key default true check (id),
  remboursement_especes_autorise boolean not null default false,
  -- Renseignes par le serveur a chaque changement de valeur ; la base refuse un changement sans auteur ni motif.
  mis_a_jour_par uuid references auth.users (id) on delete set null,
  dernier_motif text check (dernier_motif is null or char_length(dernier_motif) between 5 and 200),
  mis_a_jour_le timestamptz not null default now()
);
insert into public.parametres_remboursement (id) values (true);

create table public.parametres_remboursement_journal (
  id uuid primary key default gen_random_uuid(),
  reglage text not null check (reglage in ('remboursement_especes_autorise')),
  ancienne_valeur boolean not null,
  nouvelle_valeur boolean not null check (nouvelle_valeur is distinct from ancienne_valeur),
  motif text not null check (char_length(motif) between 5 and 200),
  change_par uuid references auth.users (id) on delete set null,
  change_le timestamptz not null default now()
);
create index parametres_remboursement_journal_idx on public.parametres_remboursement_journal (change_le desc);

-- ------------------------------------------------------------------------------------------------------------------ decisions
create table public.remboursement_decisions (
  id uuid primary key default gen_random_uuid(),
  -- Un dossier = une commande. `restrict` : une commande qui a une decision ne peut pas etre supprimee (la preuve est gardee).
  order_id uuid not null references public.orders (id) on delete restrict,
  -- Absent quand le client a paye le restaurant par code marchand (aucun paiement en ligne dans le systeme).
  paiement_id uuid references public.paiements (id) on delete restrict,
  litige_id uuid references public.litiges_paiement (id) on delete restrict,
  mode_paiement_origine text not null check (mode_paiement_origine in ('chapchap', 'simulation', 'code_marchand')),
  issue text not null check (issue in ('rembourser_total', 'rembourser_partiel', 'ne_pas_rembourser')),
  -- Montant ENTIER en GNF decide pour le client, calcule par le serveur (jamais lu du navigateur pour un remboursement total).
  montant_gnf integer not null check (montant_gnf >= 0),
  -- `chapchap` est reserve : aucun endpoint de remboursement n'est documente ; le serveur le refuse tant que le systeme ne sait pas le faire.
  moyen text not null check (moyen in ('chapchap', 'mobile_money_manuel', 'especes_dernier_recours', 'aucun')),
  motif text not null check (char_length(btrim(motif)) between 5 and 300),
  -- Reference de l'avis juridique appliquee (texte court). Obligatoire hors du cas « conforme a une regle automatique definie, moyen ordinaire ».
  reference_avis text check (reference_avis is null or char_length(btrim(reference_avis)) between 5 and 200),
  -- Comparaison avec ce que la regle automatique concluait (a titre indicatif) : identique, differente, ou aucune regle applicable.
  ecart_regle text not null check (ecart_regle in ('conforme', 'ecart', 'sans_regle')),
  regle_automatique text check (regle_automatique is null or char_length(regle_automatique) <= 80),
  -- Code marchand : l'argent est chez le restaurant, Speedfood ne le detient pas. La decision doit le reconnaitre.
  argent_chez_restaurant_reconnu boolean not null default false,
  remplace_id uuid references public.remboursement_decisions (id) on delete restrict,
  decide_par uuid references auth.users (id) on delete set null,
  decide_le timestamptz not null default now(),
  constraint remboursement_decisions_montant_coherent check (
    (issue = 'ne_pas_rembourser' and montant_gnf = 0) or (issue in ('rembourser_total', 'rembourser_partiel') and montant_gnf > 0)
  ),
  constraint remboursement_decisions_moyen_coherent check ((issue = 'ne_pas_rembourser') = (moyen = 'aucun')),
  constraint remboursement_decisions_avis_obligatoire check (
    reference_avis is not null or (ecart_regle = 'conforme' and moyen <> 'especes_dernier_recours')
  ),
  constraint remboursement_decisions_code_marchand check (
    (mode_paiement_origine = 'code_marchand') = (paiement_id is null)
    and (mode_paiement_origine <> 'code_marchand' or argent_chez_restaurant_reconnu)
  ),
  constraint remboursement_decisions_chapchap_reserve check (moyen <> 'chapchap' or mode_paiement_origine = 'chapchap')
);
-- Une seule decision « de tete » par commande, et une decision n'est remplacee qu'une fois : l'historique est une chaine sans bifurcation.
create unique index remboursement_decisions_tete_uq on public.remboursement_decisions (order_id) where remplace_id is null;
create unique index remboursement_decisions_remplace_uq on public.remboursement_decisions (remplace_id) where remplace_id is not null;
create index remboursement_decisions_paiement_idx on public.remboursement_decisions (paiement_id) where paiement_id is not null;
create index remboursement_decisions_litige_idx on public.remboursement_decisions (litige_id) where litige_id is not null;

alter table public.remboursements_manuels
  add column decision_id uuid references public.remboursement_decisions (id) on delete restrict;

-- ------------------------------------------------------------------------------------------------------------------ gardes (triggers)
-- Decisions : ajout seul. Seule exception : `decide_par` peut passer a NULL quand le compte de l'auteur est supprime
-- (action referentielle `on delete set null`), sans qu'aucune autre colonne change.
create or replace function public.fn_remboursement_decisions_ajout_seul()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.decide_par is null and old.decide_par is not null
       and (to_jsonb(new) - 'decide_par') = (to_jsonb(old) - 'decide_par') then
      return new;
    end if;
  end if;
  raise exception 'Une decision de remboursement ne se modifie ni ne se supprime : enregistrez une nouvelle decision qui la remplace' using errcode = '23514';
end;
$function$;
revoke execute on function public.fn_remboursement_decisions_ajout_seul() from public, anon, authenticated;
create trigger trg_remboursement_decisions_ajout_seul
  before update or delete on public.remboursement_decisions
  for each row execute function public.fn_remboursement_decisions_ajout_seul();
create trigger trg_remboursement_decisions_pas_de_vidage
  before truncate on public.remboursement_decisions
  for each statement execute function public.fn_remboursement_decisions_ajout_seul();

-- Creation : date posee par la base (jamais par le client), coherence du dossier, espèces seulement si le reglage est vrai.
create or replace function public.fn_remboursement_decisions_creation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_ordre uuid;
  v_paiement_ordre uuid;
  v_litige_paiement uuid;
begin
  new.decide_le := now();
  if new.paiement_id is not null then
    select order_id into v_paiement_ordre from public.paiements where id = new.paiement_id;
    if v_paiement_ordre is distinct from new.order_id then
      raise exception 'Le paiement n''appartient pas a cette commande' using errcode = '23514';
    end if;
  end if;
  if new.litige_id is not null then
    select paiement_id into v_litige_paiement from public.litiges_paiement where id = new.litige_id;
    if new.paiement_id is null or v_litige_paiement is distinct from new.paiement_id then
      raise exception 'Le litige n''appartient pas a ce paiement' using errcode = '23514';
    end if;
  end if;
  if new.remplace_id is not null then
    select order_id into v_ordre from public.remboursement_decisions where id = new.remplace_id;
    if v_ordre is distinct from new.order_id then
      raise exception 'La decision remplacee n''appartient pas a cette commande' using errcode = '23514';
    end if;
  end if;
  if new.moyen = 'especes_dernier_recours'
     and not coalesce((select remboursement_especes_autorise from public.parametres_remboursement where id), false) then
    raise exception 'Le remboursement en especes est desactive dans les reglages de la plateforme' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_remboursement_decisions_creation() from public, anon, authenticated;
create trigger trg_remboursement_decisions_creation
  before insert on public.remboursement_decisions
  for each row execute function public.fn_remboursement_decisions_creation();

-- Reglage : tout changement de valeur exige un auteur et un motif, et ecrit sa ligne de journal dans la meme transaction.
create or replace function public.fn_parametres_remboursement_garde()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
    raise exception 'Le reglage de remboursement ne se supprime pas' using errcode = '23514';
  end if;
  if new.remboursement_especes_autorise is distinct from old.remboursement_especes_autorise then
    if new.mis_a_jour_par is null or new.dernier_motif is null then
      raise exception 'Un changement de reglage exige un auteur et un motif' using errcode = '23514';
    end if;
    insert into public.parametres_remboursement_journal (reglage, ancienne_valeur, nouvelle_valeur, motif, change_par)
      values ('remboursement_especes_autorise', old.remboursement_especes_autorise, new.remboursement_especes_autorise, new.dernier_motif, new.mis_a_jour_par);
    new.mis_a_jour_le := now();
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_parametres_remboursement_garde() from public, anon, authenticated;
create trigger trg_parametres_remboursement_garde
  before update or delete on public.parametres_remboursement
  for each row execute function public.fn_parametres_remboursement_garde();
create trigger trg_parametres_remboursement_pas_de_vidage
  before truncate on public.parametres_remboursement
  for each statement execute function public.fn_parametres_remboursement_garde();

-- Journal : ajout seul (meme exception que les decisions pour la suppression d'un compte auteur).
create or replace function public.fn_parametres_remboursement_journal_ajout_seul()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.change_par is null and old.change_par is not null
       and (to_jsonb(new) - 'change_par') = (to_jsonb(old) - 'change_par') then
      return new;
    end if;
  end if;
  raise exception 'Le journal des reglages est en ajout seul' using errcode = '23514';
end;
$function$;
revoke execute on function public.fn_parametres_remboursement_journal_ajout_seul() from public, anon, authenticated;
create trigger trg_parametres_remboursement_journal_ajout_seul
  before update or delete on public.parametres_remboursement_journal
  for each row execute function public.fn_parametres_remboursement_journal_ajout_seul();
create trigger trg_parametres_remboursement_journal_pas_de_vidage
  before truncate on public.parametres_remboursement_journal
  for each statement execute function public.fn_parametres_remboursement_journal_ajout_seul();

-- Remboursement fait a la main : un nouveau remboursement en especes est refuse tant que le reglage est faux (les anciennes lignes restent lisibles).
create or replace function public.fn_remboursements_manuels_especes_reglage()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.moyen = 'especes'
     and not coalesce((select remboursement_especes_autorise from public.parametres_remboursement where id), false) then
    raise exception 'Le remboursement en especes est desactive dans les reglages de la plateforme' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_remboursements_manuels_especes_reglage() from public, anon, authenticated;
create trigger trg_remboursements_manuels_especes_reglage
  before insert on public.remboursements_manuels
  for each row execute function public.fn_remboursements_manuels_especes_reglage();

-- ------------------------------------------------------------------------------------------------------------------ droits et RLS
alter table public.remboursement_decisions enable row level security;
alter table public.parametres_remboursement enable row level security;
alter table public.parametres_remboursement_journal enable row level security;

revoke all on table public.remboursement_decisions, public.parametres_remboursement, public.parametres_remboursement_journal from anon, authenticated;
grant select on table public.remboursement_decisions, public.parametres_remboursement, public.parametres_remboursement_journal to authenticated;

create policy "super_admin_lecture_remboursement_decisions" on public.remboursement_decisions
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_lecture_parametres_remboursement" on public.parametres_remboursement
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_lecture_parametres_remboursement_journal" on public.parametres_remboursement_journal
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
