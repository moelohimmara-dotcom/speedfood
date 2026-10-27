-- Lot I2 (27 octobre 2026) : « un numéro, un titulaire » pour les profils professionnels (candidatures de restaurateurs et livreurs).
-- Deux personnes n'utilisent pas le même numéro, sauf si le titulaire le cède (l'équipe tranche après un appel de vérification, avec motif et trace d'audit).
-- Les numéros des CONSOMMATEURS ne sont pas concernés ici : sans code de vérification, un numéro réservé par un autre bloquerait son vrai propriétaire.
-- Tables privées : aucune policy, aucun accès anon/authenticated (le serveur, en service-role, est le seul à les lire et à les écrire).

create or replace function public.telephone_normalise(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  c text := regexp_replace(coalesce(p, ''), '[\s.\-()]', '', 'g');
  m text[];
begin
  m := regexp_match(c, '^(?:\+|00)?224(?:0)?([67][0-9]{8})$');
  if m is not null then
    return '+224' || m[1];
  end if;
  m := regexp_match(c, '^0?([67][0-9]{8})$');
  if m is not null then
    return '+224' || m[1];
  end if;
  return null;
end;
$$;

create table public.numeros_titulaires (
  telephone text primary key check (telephone ~ '^\+224[67][0-9]{8}$'),
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('candidature', 'livreur')),
  cree_le timestamptz not null default now()
);
create index numeros_titulaires_utilisateur on public.numeros_titulaires (utilisateur_id);

create table public.conflits_numero (
  id uuid primary key default gen_random_uuid(),
  telephone text not null,
  demandeur_id uuid not null references auth.users (id) on delete cascade,
  titulaire_id uuid references auth.users (id) on delete set null,
  source text not null check (source in ('candidature', 'livreur')),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'cede', 'refuse')),
  mail_envoye_le timestamptz,
  cree_le timestamptz not null default now(),
  traite_le timestamptz,
  traite_par uuid references auth.users (id) on delete set null,
  motif text check (motif is null or char_length(motif) <= 300)
);
create unique index conflits_numero_un_ouvert on public.conflits_numero (telephone, demandeur_id) where statut = 'en_attente';
create index conflits_numero_a_envoyer on public.conflits_numero (cree_le) where mail_envoye_le is null;

alter table public.numeros_titulaires enable row level security;
alter table public.conflits_numero enable row level security;
revoke all on public.numeros_titulaires, public.conflits_numero from anon, authenticated;

-- Réserve un numéro pour un compte. Renvoie NULL si c'est fait (ou si le compte le détient déjà), sinon l'identifiant du compte qui le détient : un conflit est alors consigné pour l'équipe.
-- Un numéro illisible (non guinéen) n'est pas réservé : la validation du formulaire s'en charge.
create or replace function public.reserver_numero(p_telephone text, p_utilisateur uuid, p_source text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := public.telephone_normalise(p_telephone);
  titulaire uuid;
begin
  if t is null then
    return null;
  end if;
  insert into public.numeros_titulaires (telephone, utilisateur_id, source) values (t, p_utilisateur, p_source) on conflict (telephone) do nothing;
  select utilisateur_id into titulaire from public.numeros_titulaires where telephone = t;
  if titulaire = p_utilisateur then
    return null;
  end if;
  insert into public.conflits_numero (telephone, demandeur_id, titulaire_id, source) values (t, p_utilisateur, titulaire, p_source) on conflict do nothing;
  return titulaire;
end;
$$;
revoke all on function public.reserver_numero(text, uuid, text) from public, anon, authenticated;

-- Cession décidée par l'équipe : le numéro passe au demandeur, le conflit est clos. Atomique.
create or replace function public.ceder_numero(p_conflit uuid, p_par uuid, p_motif text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select * into c from public.conflits_numero where id = p_conflit and statut = 'en_attente' for update;
  if not found then
    return false;
  end if;
  update public.numeros_titulaires set utilisateur_id = c.demandeur_id, source = c.source, cree_le = now() where telephone = c.telephone;
  update public.conflits_numero set statut = 'cede', traite_le = now(), traite_par = p_par, motif = left(p_motif, 300) where id = c.id;
  return true;
end;
$$;
revoke all on function public.ceder_numero(uuid, uuid, text) from public, anon, authenticated;

-- Numéros déjà portés par des comptes professionnels : le premier arrivé garde le numéro ; une candidature refusée ou une fiche archivée ne retient rien.
insert into public.numeros_titulaires (telephone, utilisateur_id, source)
select distinct on (t) t, uid, src
from (
  select public.telephone_normalise(contact_telephone) as t, utilisateur_id as uid, 'candidature'::text as src, cree_le
    from public.referencement_demandes
   where utilisateur_id is not null and statut <> 'refusee'
  union all
  select public.telephone_normalise(telephone), utilisateur_id, 'livreur', cree_le
    from public.livreurs
   where utilisateur_id is not null and cycle <> 'archive'
) x
where t is not null
order by t, cree_le
on conflict (telephone) do nothing;
