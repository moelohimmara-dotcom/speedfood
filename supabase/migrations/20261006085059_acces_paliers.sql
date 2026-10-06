-- Studio, palier 2 : habilitations par paliers (modèle Meta Business, docs/STUDIO-SUPERADMIN.md §5). Table additive.
-- Une ligne = une personne × un actif × un palier, en « relèvement » (plafond = false : le palier monte) ou en « accès partiel »
-- (plafond = true : le palier est limité). Le palier effectif est calculé en TypeScript (src/lib/system-admin/paliers.ts) :
-- aucune fonction SECURITY DEFINER ici. Palier 5 (Propriétaire) jamais attribuable : réservé au rôle super_admin.
-- Lecture : la personne concernée (ses propres lignes, pour que le serveur calcule SES droits avec SA session) et super_admin.
-- Écriture : super_admin seulement, et `accorde_par` doit être lui-même (traçabilité). Rien pour anon.
--
-- Garde en base des PLAFONDS (revue I1) : la RLS existante donne tout au content_editor sur content_pages, content_banners et
-- contenu_emplacements ; sans garde, un éditeur plafonné pourrait contourner son « accès partiel » par l'API de données
-- (clé anon publique + son mot de passe). Un trigger BEFORE par table appelle `fn_garde_palier_contenu` (SECURITY INVOKER : elle
-- lit `acces_paliers` avec la session de la personne, ce que la RLS « ses propres lignes » permet). Elle ne traite QUE les
-- plafonds (une restriction) : aucun plafond applicable = rien ne change ; session sans utilisateur (service-role, scripts)
-- ou super_admin = rien ne change. Les relèvements ne sont pas traités en base (ils n'ouvrent rien que la RLS n'ouvre déjà).
--
-- SCÉNARIOS À REJOUER AU TEMPS B (cette fonction n'a jamais été exécutée ; voir aussi le script E2E paliers-e2e.mjs) :
--  1. content_editor plafonné à 1 sur contenu:pages, par l'API directe (clé anon + signInWithPassword) :
--     PATCH content_pages {statut:'publie'} sur un brouillon → refusé (42501) ; PATCH {statut:'brouillon'} sur une page publiée
--     → refusé ; PATCH {titre} sur une page publiée → refusé ; INSERT d'un brouillon → accepté ; PATCH {titre} sur un
--     brouillon → accepté ; INSERT direct avec statut 'publie' → refusé ; DELETE d'une page → refusé.
--  2. Le même plafond sur contenu:pages n'a AUCUN effet sur content_banners (insert, publication, suppression acceptés).
--  3. Plafond 1 sur contenu:textes : toute écriture dans contenu_emplacements refusée ; contenu_emplacements sans plafond OK.
--  4. Plafond 1 sur « contenu » : pages, bannières et textes limités ; plafond sur « * » : idem ; plafond sur « theme » : sans
--     effet ; plafond expiré : sans effet.
--  5. super_admin (même avec une ligne plafond posée par le service-role) : sans effet. Service-role : sans effet.
--  6. content_editor SANS habilitation : publie, dépublie, supprime comme avant (non-régression).
--  7. Les actions de la console (Next) donnent les mêmes résultats (elles passent par la session : le trigger s'applique aussi).

create table acces_paliers (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  actif text not null check (actif ~ '^(\*|[a-z_]+(:[a-z_]+)?)$'),
  palier smallint not null check (palier between 0 and 4),
  plafond boolean not null default false,
  expire_le timestamptz,
  accorde_par uuid references auth.users(id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (utilisateur_id, actif, plafond)
);

-- Index de la clé étrangère `accorde_par` (l'unique couvre déjà `utilisateur_id` en tête).
create index idx_acces_paliers_accorde_par on acces_paliers(accorde_par);

alter table acces_paliers enable row level security;

create policy "lecture_ses_paliers_ou_super_admin" on acces_paliers
  for select to authenticated
  using (utilisateur_id = (select auth.uid()) or fn_est_admin_systeme(array['super_admin']));

create policy "super_admin_insertion_paliers" on acces_paliers
  for insert to authenticated
  with check (fn_est_admin_systeme(array['super_admin']) and accorde_par = (select auth.uid()));

create policy "super_admin_maj_paliers" on acces_paliers
  for update to authenticated
  using (fn_est_admin_systeme(array['super_admin']))
  with check (fn_est_admin_systeme(array['super_admin']) and accorde_par = (select auth.uid()));

create policy "super_admin_suppression_paliers" on acces_paliers
  for delete to authenticated
  using (fn_est_admin_systeme(array['super_admin']));

-- Défense en profondeur : aucun droit de table pour anon (la RLS sans policy anon donnerait déjà zéro ligne).
revoke all on acces_paliers from anon;

-- Garde des plafonds sur les tables du Studio. Argument du trigger : l'actif de la table (contenu:pages, contenu:bannieres,
-- contenu:textes). Couverture identique à `actifCouvre` (paliers.ts) : '*', le parent ('contenu') ou l'actif exact, par
-- égalité stricte (jamais par préfixe de texte). Paliers requis : INSERT ≥ 1 (≥ 2 si la ligne arrive déjà publiée) ; UPDATE ≥ 1,
-- ou ≥ 2 si l'ancienne OU la nouvelle ligne est publiée ; DELETE ≥ 2 ; contenu_emplacements : toute écriture ≥ 2 (un texte est
-- en ligne aussitôt, il n'existe pas de brouillon de texte).
create or replace function public.fn_garde_palier_contenu()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_utilisateur uuid := auth.uid();
  v_actif text := tg_argv[0];
  v_parent text := split_part(tg_argv[0], ':', 1);
  v_plafond smallint;
  v_requis smallint;
begin
  -- Pas d'utilisateur (service-role, tâches internes) : la garde ne s'applique pas. Test SÉPARÉ du suivant : un « or » SQL
  -- n'est pas garanti court-circuité, et le service-role n'a pas le droit d'exécuter fn_est_admin_systeme.
  if v_utilisateur is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  -- super_admin : préréglage seul (palier 5 sur tout), comme en TypeScript.
  if public.fn_est_admin_systeme(array['super_admin']) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Plus bas plafond applicable, non expiré (lecture avec la session : RLS « ses propres lignes »).
  select min(p.palier)
    into v_plafond
    from public.acces_paliers p
   where p.utilisateur_id = v_utilisateur
     and p.plafond
     and (p.expire_le is null or p.expire_le > now())
     and p.actif in ('*', v_parent, v_actif);

  if v_plafond is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'contenu_emplacements' then
    v_requis := 2;
  elsif tg_op = 'INSERT' then
    v_requis := case when new.statut = 'publie' then 2 else 1 end;
  elsif tg_op = 'UPDATE' then
    v_requis := case when old.statut = 'publie' or new.statut = 'publie' then 2 else 1 end;
  else
    v_requis := 2;
  end if;

  if v_plafond < v_requis then
    raise exception 'Droits insuffisants (palier %, requis %)', v_plafond, v_requis
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Fonction de trigger uniquement (l'exécution d'un trigger ne vérifie pas ce droit, cf. fn_garder_dernier_super_admin).
revoke execute on function public.fn_garde_palier_contenu() from public, anon, authenticated;

create trigger trg_garde_palier_pages
  before insert or update or delete on public.content_pages
  for each row execute function public.fn_garde_palier_contenu('contenu:pages');

create trigger trg_garde_palier_bannieres
  before insert or update or delete on public.content_banners
  for each row execute function public.fn_garde_palier_contenu('contenu:bannieres');

create trigger trg_garde_palier_textes
  before insert or update or delete on public.contenu_emplacements
  for each row execute function public.fn_garde_palier_contenu('contenu:textes');
