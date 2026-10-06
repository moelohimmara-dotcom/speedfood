-- Studio, palier 3 (tâche 6) : pages à blocs. Migration ADDITIVE (aucune colonne, policy ou fonction existante modifiée,
-- sauf le resserrement des droits de LECTURE de colonnes décrit en (3), qui garde à l'identique l'accès aux colonnes
-- existantes).
--
-- (1) content_pages : format ('texte' par défaut : aucune page existante ne change), blocs du brouillon, blocs publiés,
--     numéro de la dernière version publiée. Le JSON est validé par schéma (zod) côté serveur à l'écriture ET à la lecture ;
--     la base n'impose que la forme (objet) et la taille (200 Ko), dernière ligne de défense contre un appel direct.
-- (2) content_pages_versions : historique des publications (20 dernières par page, élagage dans fn_publier_blocs).
--     Lecture, ajout et suppression réservés aux éditeurs (même prédicat que `editeurs_gestion_contenu`), aucune
--     modification (une version est immuable), aucun droit pour anon.
-- (3) Le brouillon de blocs ne doit JAMAIS être lisible par le public. La policy publique de content_pages filtre les
--     LIGNES (statut = 'publie') mais pas les colonnes : sans (3), un visiteur (anon) ou un client connecté pourrait lire
--     `blocs_brouillon` d'une page publiée par l'API directe. On retire donc le droit SELECT de table à anon et
--     authenticated et on le redonne colonne par colonne, sans `blocs_brouillon`. Le brouillon n'est lu que par le
--     serveur (clé de service) après contrôle de la permission et du palier. Écritures inchangées (droits de table).
--     Toute colonne ajoutée plus tard à content_pages devra être ajoutée à ce GRANT si elle doit être lisible.
-- (4) fn_publier_blocs : publication atomique (copie vers blocs_publie + version + statut + élagage en UNE transaction),
--     SECURITY INVOKER : la RLS de l'appelant et la garde des plafonds (trigger fn_garde_palier_contenu de la tâche 4,
--     non modifié : le passage à `statut = 'publie'` exige le palier 2) s'appliquent.
-- (5) fn_garde_palier_blocs : un plafond < 2 sur les pages interdit aussi, par l'API directe, d'écrire l'historique et
--     de changer les blocs publiés (même d'une page hors ligne).

-- (1) ------------------------------------------------------------------------------------------------------------
alter table public.content_pages
  add column format text not null default 'texte' check (format in ('texte', 'blocs')),
  add column blocs_brouillon jsonb
    check (blocs_brouillon is null or (jsonb_typeof(blocs_brouillon) = 'object' and octet_length(blocs_brouillon::text) <= 204800)),
  add column blocs_publie jsonb
    check (blocs_publie is null or (jsonb_typeof(blocs_publie) = 'object' and octet_length(blocs_publie::text) <= 204800)),
  add column blocs_version integer not null default 0 check (blocs_version >= 0);

-- (2) ------------------------------------------------------------------------------------------------------------
create table public.content_pages_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.content_pages(id) on delete cascade,
  version integer not null,
  blocs jsonb not null check (jsonb_typeof(blocs) = 'object' and octet_length(blocs::text) <= 204800),
  auteur_id uuid references auth.users(id) on delete set null,
  motif text check (char_length(motif) <= 200),
  cree_le timestamptz not null default now(),
  unique (page_id, version)
);

-- Index de la clé étrangère `auteur_id` (l'unique couvre déjà `page_id` en tête).
create index idx_content_pages_versions_auteur on public.content_pages_versions(auteur_id);

alter table public.content_pages_versions enable row level security;

create policy "editeurs_lecture_versions" on public.content_pages_versions
  for select to authenticated
  using (public.fn_est_admin_systeme(array['content_editor', 'super_admin']));

create policy "editeurs_ajout_versions" on public.content_pages_versions
  for insert to authenticated
  with check (public.fn_est_admin_systeme(array['content_editor', 'super_admin']) and auteur_id = (select auth.uid()));

create policy "editeurs_suppression_versions" on public.content_pages_versions
  for delete to authenticated
  using (public.fn_est_admin_systeme(array['content_editor', 'super_admin']));

-- Aucun droit pour anon ; pour authenticated, seulement ce que les policies utilisent (pas de UPDATE : version immuable,
-- pas de TRUNCATE qui ignorerait la RLS).
revoke all on public.content_pages_versions from anon, authenticated;
grant select, insert, delete on public.content_pages_versions to authenticated;

-- (3) ------------------------------------------------------------------------------------------------------------
revoke select on public.content_pages from anon, authenticated;
grant select (id, slug, titre, contenu, statut, auteur_id, cree_le, mis_a_jour_le, publie_le, format, blocs_publie, blocs_version)
  on public.content_pages to anon, authenticated;

-- (4) ------------------------------------------------------------------------------------------------------------
-- p_blocs : le brouillon LU puis VALIDÉ par le serveur ; p_jeton : son `mis_a_jour_le` au moment de la lecture. Si la page
-- a changé entre-temps (brouillon réenregistré, autre publication), aucune ligne ne correspond et rien n'est écrit :
-- jamais de blocs_publie différent du brouillon validé, jamais de version sans publication (ni l'inverse).
create or replace function public.fn_publier_blocs(p_page_id uuid, p_blocs jsonb, p_jeton timestamptz, p_motif text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_blocs is null or jsonb_typeof(p_blocs) <> 'object' then
    raise exception 'REFUS:blocs' using errcode = 'P0001';
  end if;
  if v_motif is not null and char_length(v_motif) > 200 then
    raise exception 'REFUS:motif' using errcode = 'P0001';
  end if;

  update public.content_pages
     set blocs_publie = p_blocs,
         blocs_version = blocs_version + 1,
         statut = 'publie',
         publie_le = now()
   where id = p_page_id
     and format = 'blocs'
     and mis_a_jour_le = p_jeton
  returning blocs_version into v_version;

  if v_version is null then
    raise exception 'REFUS:concurrence' using errcode = 'P0001';
  end if;

  insert into public.content_pages_versions (page_id, version, blocs, auteur_id, motif)
  values (p_page_id, v_version, p_blocs, auth.uid(), v_motif);

  -- Conservation des 20 dernières versions de la page.
  delete from public.content_pages_versions
   where page_id = p_page_id
     and version <= v_version - 20;

  return v_version;
end;
$$;

revoke execute on function public.fn_publier_blocs(uuid, jsonb, timestamptz, text) from public, anon;
grant execute on function public.fn_publier_blocs(uuid, jsonb, timestamptz, text) to authenticated;

-- (5) ------------------------------------------------------------------------------------------------------------
-- Même lecture des plafonds que fn_garde_palier_contenu (actif contenu:pages, son parent, '*'), palier requis 2 pour :
-- écrire l'historique (ajouter ou supprimer une version = publier) et changer les blocs PUBLIÉS d'une page (blocs_publie,
-- blocs_version), même sur une page hors ligne : sinon un Contributeur (plafond 1) pourrait y déposer un contenu qu'une
-- simple remise en ligne publierait sans relecture. Le brouillon de blocs reste à 1 (règle de fn_garde_palier_contenu).
create or replace function public.fn_garde_palier_blocs()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_utilisateur uuid := auth.uid();
  v_plafond smallint;
begin
  -- Sur content_pages, seules les écritures touchant les blocs publiés sont concernées (test sans lecture de table).
  if tg_table_name = 'content_pages' then
    if tg_op = 'INSERT' then
      if new.blocs_publie is null and new.blocs_version = 0 then
        return new;
      end if;
    elsif new.blocs_publie is not distinct from old.blocs_publie and new.blocs_version is not distinct from old.blocs_version then
      return new;
    end if;
  end if;

  if v_utilisateur is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if public.fn_est_admin_systeme(array['super_admin']) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select min(p.palier)
    into v_plafond
    from public.acces_paliers p
   where p.utilisateur_id = v_utilisateur
     and p.plafond
     and (p.expire_le is null or p.expire_le > now())
     and p.actif in ('*', 'contenu', 'contenu:pages');

  if v_plafond is not null and v_plafond < 2 then
    raise exception 'Droits insuffisants (palier %, requis %)', v_plafond, 2
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Fonction de trigger uniquement (l'exécution d'un trigger ne vérifie pas ce droit, cf. fn_garde_palier_contenu).
revoke execute on function public.fn_garde_palier_blocs() from public, anon, authenticated;

create trigger trg_garde_palier_versions
  before insert or delete on public.content_pages_versions
  for each row execute function public.fn_garde_palier_blocs();

create trigger trg_garde_palier_blocs_publies
  before insert or update on public.content_pages
  for each row execute function public.fn_garde_palier_blocs();
