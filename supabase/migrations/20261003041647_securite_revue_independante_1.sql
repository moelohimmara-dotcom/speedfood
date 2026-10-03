-- Corrections de la revue de securite independante du 3 octobre 2026.

-- 1) Un membre de restaurant ne peut ecrire dans photo_url / logo_url qu'une URL
-- publique du bucket `medias` produite par l'application (dossier connu, UUID,
-- extension autorisee) ou null. Sans cela, il pouvait y mettre l'URL d'une
-- image d'un autre restaurant (puis la faire supprimer au remplacement) ou une
-- URL externe (pixel espion sur les pages publiques). Le service-role
-- (auth.uid() null) et les admins systeme ne sont pas concernes : les photos de
-- demonstration hebergees ailleurs restent possibles.
create or replace function fn_valider_url_media()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_forme constant text := '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/medias/(restaurants|plats|logos)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$';
  v_nouvelle_photo text := to_jsonb(new)->>'photo_url';
  v_nouveau_logo text := to_jsonb(new)->>'logo_url';
  v_photo_modifiee boolean;
  v_logo_modifie boolean;
begin
  if auth.uid() is null or fn_est_admin_systeme() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_photo_modifiee := v_nouvelle_photo is distinct from (to_jsonb(old)->>'photo_url');
    v_logo_modifie := v_nouveau_logo is distinct from (to_jsonb(old)->>'logo_url');
  else
    v_photo_modifiee := v_nouvelle_photo is not null;
    v_logo_modifie := v_nouveau_logo is not null;
  end if;

  if v_photo_modifiee and v_nouvelle_photo is not null and v_nouvelle_photo !~ v_forme then
    raise exception 'URL de photo non autorisee' using errcode = '23514';
  end if;
  if v_logo_modifie and v_nouveau_logo is not null and v_nouveau_logo !~ v_forme then
    raise exception 'URL de logo non autorisee' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function fn_valider_url_media() from public, anon, authenticated;

create trigger trg_valider_url_media
  before insert or update on restaurants
  for each row execute function fn_valider_url_media();

create trigger trg_valider_url_media
  before insert or update on menu_items
  for each row execute function fn_valider_url_media();

-- 2) Journal d'audit : un administrateur systeme ne peut inserer que des
-- lignes a son propre nom (l'application ecrit deja acteur_id = auth.uid()).
drop policy if exists "admins_ecriture_audit" on audit_events;
create policy "admins_ecriture_audit" on audit_events
  for insert to authenticated
  with check (acteur_id = (select auth.uid()) and fn_est_admin_systeme());
