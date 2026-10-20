-- Espace client, suite (21 octobre 2026) : plusieurs adresses, préférences de commande.
--
-- Les adresses : cinq au plus par compte, une « par défaut » au plus ; lecture limitée à leur propriétaire, écritures par le serveur seulement
-- (comme les favoris). Les préférences s'ajoutent au profil client existant (le propriétaire les modifie par sa policy habituelle).

create table public.client_adresses (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  libelle text not null check (char_length(libelle) between 2 and 30),
  adresse text not null check (char_length(adresse) between 5 and 300),
  par_defaut boolean not null default false,
  cree_le timestamptz not null default now()
);
create index client_adresses_utilisateur_idx on public.client_adresses (utilisateur_id);
create unique index client_adresses_une_par_defaut_uq on public.client_adresses (utilisateur_id) where par_defaut;

alter table public.client_adresses enable row level security;
revoke all on table public.client_adresses from anon;
revoke insert, update, delete, truncate on table public.client_adresses from authenticated;
create policy "client_lit_ses_adresses" on public.client_adresses
  for select to authenticated using (utilisateur_id = (select auth.uid()));

create or replace function public.fn_client_adresses_limite()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if (select count(*) from public.client_adresses where utilisateur_id = new.utilisateur_id) >= 5 then
    raise exception 'Cinq adresses au plus' using errcode = '23514';
  end if;
  return new;
end;
$function$;
revoke execute on function public.fn_client_adresses_limite() from public, anon, authenticated;
create trigger trg_client_adresses_limite
  before insert on public.client_adresses
  for each row execute function public.fn_client_adresses_limite();

-- Préférences : mode de remise proposé d'abord à la commande, et notifications de suivi (utilisées par le lot des notifications).
alter table public.client_profils
  add column mode_prefere text check (mode_prefere is null or mode_prefere in ('retrait', 'livraison', 'sur_place')),
  add column notifications_commande boolean not null default true;
