-- Questions de securite FACULTATIVES (barriere d'application, en plus du mot de passe).
--
-- ATTENTION a ce que cela est et n'est pas :
--   * c'est une barriere controlee par l'application (pages /restaurant et /system) ;
--   * ce n'est PAS une double authentification au sens de Supabase : elle ne produit pas de session
--     renforcee (aal2) et ne protege donc pas l'API de donnees appelee directement. Seule l'application
--     d'authentification (TOTP) couvre ce cas, voir la migration double_authentification_aal2.
--
-- Rien n'est lisible ni modifiable par l'API : les tables ont la RLS activee SANS policy et tous les droits
-- sont retires a anon et authenticated. Seul le serveur de l'application (cle de service) les lit et les
-- ecrit, pour comparer les reponses. Les reponses ne sont jamais stockees en clair : une seule empreinte
-- PBKDF2 calculee sur les deux reponses normalisees, avec un sel propre a l'utilisateur.

create table public.securite_questions (
  utilisateur_id uuid primary key references auth.users (id) on delete cascade,
  question_1 text not null check (char_length(question_1) between 3 and 60),
  question_2 text not null check (char_length(question_2) between 3 and 60 and question_2 <> question_1),
  sel text not null check (char_length(sel) between 16 and 128),
  empreinte text not null check (char_length(empreinte) between 32 and 256),
  iterations integer not null default 100000 check (iterations between 10000 and 1000000),
  essais_echoues integer not null default 0 check (essais_echoues >= 0),
  bloque_jusqu timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

-- Codes de secours a usage unique (haute entropie : une empreinte SHA-256 suffit).
create table public.securite_codes_secours (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  empreinte text not null check (char_length(empreinte) between 32 and 256),
  utilise_le timestamptz,
  cree_le timestamptz not null default now(),
  unique (utilisateur_id, empreinte)
);
create index securite_codes_secours_utilisateur_idx on public.securite_codes_secours (utilisateur_id);

-- Sessions (identifiant de session du jeton) pour lesquelles les questions ont ete repondues.
create table public.securite_questions_sessions (
  session_id uuid primary key,
  utilisateur_id uuid not null references auth.users (id) on delete cascade,
  valide_jusqu timestamptz not null,
  cree_le timestamptz not null default now()
);
create index securite_questions_sessions_utilisateur_idx on public.securite_questions_sessions (utilisateur_id);

alter table public.securite_questions enable row level security;
alter table public.securite_codes_secours enable row level security;
alter table public.securite_questions_sessions enable row level security;

revoke all on table public.securite_questions from anon, authenticated;
revoke all on table public.securite_codes_secours from anon, authenticated;
revoke all on table public.securite_questions_sessions from anon, authenticated;

-- Etat pour le compte connecte, utilise par la porte d'entree des consoles et la page de securite.
-- Ne renvoie ni empreinte ni sel : seulement les intitules des questions (non secrets), le nombre de
-- codes de secours restants et si la session courante doit encore repondre.
create or replace function public.fn_questions_etat()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q public.securite_questions%rowtype;
  v_session uuid;
  v_valide boolean;
  v_codes integer;
begin
  if v_uid is null then
    return jsonb_build_object('active', false, 'requise', false, 'codes_restants', 0);
  end if;

  select * into v_q from public.securite_questions where utilisateur_id = v_uid;
  if not found then
    return jsonb_build_object('active', false, 'requise', false, 'codes_restants', 0);
  end if;

  v_session := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_valide := coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or exists (
      select 1 from public.securite_questions_sessions s
      where s.session_id = v_session and s.utilisateur_id = v_uid and s.valide_jusqu > now()
    );

  select count(*)::integer into v_codes
  from public.securite_codes_secours c
  where c.utilisateur_id = v_uid and c.utilise_le is null;

  return jsonb_build_object(
    'active', true,
    'requise', not v_valide,
    'codes_restants', v_codes,
    'question_1', v_q.question_1,
    'question_2', v_q.question_2,
    'bloque_jusqu', v_q.bloque_jusqu
  );
end;
$$;

revoke execute on function public.fn_questions_etat() from public, anon;
grant execute on function public.fn_questions_etat() to authenticated;
