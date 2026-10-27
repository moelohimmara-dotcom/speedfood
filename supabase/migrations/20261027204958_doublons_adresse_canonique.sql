-- Garde-fou « une personne, un compte » (27 octobre 2026) : une inscription dont l'adresse e-mail, une fois ramenée à sa forme canonique, existe déjà est SUSPENDUE et signalée à l'équipe.
-- Forme canonique : minuscules, sans espaces ; « +étiquette » retirée ; chez Gmail/Googlemail, points retirés et domaine unifié (c'est la même boîte aux lettres).
-- Rien n'est refusé en silence : le compte est créé puis suspendu (banned_until), l'équipe décide (autoriser = cas légitime, refuser = doublon confirmé).
-- Tables privées : aucune policy, aucun accès pour les rôles anon/authenticated (le service-role du serveur est le seul à les lire et à les écrire).

create or replace function public.email_canonique(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
  local_part text;
  domaine text;
begin
  if position('@' in e) = 0 then
    return e;
  end if;
  local_part := split_part(e, '@', 1);
  domaine := substr(e, position('@' in e) + 1);
  local_part := split_part(local_part, '+', 1);
  if domaine in ('gmail.com', 'googlemail.com') then
    domaine := 'gmail.com';
    local_part := replace(local_part, '.', '');
  end if;
  return local_part || '@' || domaine;
end;
$$;

create table public.identites_canoniques (
  utilisateur_id uuid primary key references auth.users (id) on delete cascade,
  email_canonique text not null,
  cree_le timestamptz not null default now()
);
create index identites_canoniques_email on public.identites_canoniques (email_canonique);

create table public.signalements_doublons (
  id uuid primary key default gen_random_uuid(),
  nouvel_utilisateur_id uuid not null references auth.users (id) on delete cascade,
  utilisateur_existant_id uuid references auth.users (id) on delete set null,
  email_canonique text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'autorise', 'refuse')),
  mail_envoye_le timestamptz,
  cree_le timestamptz not null default now(),
  traite_le timestamptz,
  traite_par uuid references auth.users (id) on delete set null,
  motif text check (motif is null or char_length(motif) <= 300)
);
-- Un seul signalement ouvert par nouveau compte.
create unique index signalements_doublons_un_ouvert on public.signalements_doublons (nouvel_utilisateur_id) where statut = 'en_attente';
create index signalements_doublons_a_envoyer on public.signalements_doublons (cree_le) where mail_envoye_le is null;

alter table public.identites_canoniques enable row level security;
alter table public.signalements_doublons enable row level security;
revoke all on public.identites_canoniques, public.signalements_doublons from anon, authenticated;

-- Inscription : enregistre la forme canonique ; si une AUTRE personne la porte déjà, suspend le nouveau compte 30 jours et crée le signalement.
-- Ne doit jamais faire échouer une inscription : toute erreur est avalée (et journalisée par un avertissement).
create or replace function public.surveiller_inscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canon text;
  existant uuid;
begin
  begin
    if new.email is null or new.email = '' then
      return new;
    end if;
    canon := public.email_canonique(new.email);
    select utilisateur_id into existant
      from public.identites_canoniques
     where email_canonique = canon and utilisateur_id <> new.id
     order by cree_le
     limit 1;
    insert into public.identites_canoniques (utilisateur_id, email_canonique) values (new.id, canon) on conflict (utilisateur_id) do nothing;
    if existant is not null then
      insert into public.signalements_doublons (nouvel_utilisateur_id, utilisateur_existant_id, email_canonique) values (new.id, existant, canon);
      update auth.users set banned_until = now() + interval '30 days' where id = new.id;
    end if;
  exception when others then
    raise warning 'surveiller_inscription : %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.surveiller_inscription() from public, anon, authenticated;

create trigger inscription_surveillee
after insert on auth.users
for each row execute function public.surveiller_inscription();

-- Comptes existants : leur forme canonique est enregistrée (aucun doublon ni suspension rétroactifs : l'équipe examine à part s'il y en a).
insert into public.identites_canoniques (utilisateur_id, email_canonique)
select id, public.email_canonique(email) from auth.users where email is not null and email <> ''
on conflict (utilisateur_id) do nothing;
