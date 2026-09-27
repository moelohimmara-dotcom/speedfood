-- Bloc 8b — Restaurants & comptes (CMS système, PLAN-EXECUTION.md).
--
-- Deux besoins :
-- 1. « Demander une correction » à un restaurant en attente : une colonne texte
--    supplémentaire, protégée comme `publie`/`suspendu_*` par le trigger du
--    bloc 7 (un membre de restaurant ne peut jamais l'effacer ou la falsifier).
-- 2. « Inviter un équipier » : trouver un compte existant par email pour créer
--    un membership. Volontairement PAS d'envoi d'email ni de création de compte
--    ici — aucun canal de notification n'est choisi (ADR-007, bloc 10 bloqué) ;
--    si la personne n'a pas encore de compte, l'admin le voit et l'invitation
--    échoue proprement (message clair), pas de fausse promesse d'email envoyé.

alter table restaurants add column if not exists motif_correction text;

-- Redéfinit le trigger du bloc 7 pour couvrir la nouvelle colonne (mêmes
-- garanties : le service_role n'a pas de JWT utilisateur et n'est pas affecté).
create or replace function fn_proteger_colonnes_restaurant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.publie is distinct from old.publie
     or new.suspendu_le is distinct from old.suspendu_le
     or new.suspendu_motif is distinct from old.suspendu_motif
     or new.motif_correction is distinct from old.motif_correction then
    if not fn_est_admin_systeme() then
      raise exception 'Seul un administrateur systeme peut modifier la publication, la suspension ou la correction demandee d''un restaurant';
    end if;
  end if;

  return new;
end;
$$;

-- Recherche d'un compte existant par email (pour l'invitation d'équipier).
-- Vérifie elle-même la permission (défense en profondeur, en plus du contrôle
-- applicatif) : auth.users n'est jamais exposé directement à l'API publique.
create or replace function fn_trouver_utilisateur_par_email(p_email text)
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not fn_est_admin_systeme(array['operations', 'super_admin']) then
    raise exception 'Permission refusee.';
  end if;

  return query
    select u.id, u.email::text
    from auth.users u
    where u.email = lower(trim(p_email))
    limit 1;
end;
$$;

-- Liste les membres d'un restaurant avec leur email (auth.users n'est pas
-- exposé via PostgREST : ce détour est nécessaire pour un affichage lisible).
create or replace function fn_lister_membres_restaurant(p_restaurant_id uuid)
returns table (utilisateur_id uuid, email text, role text, cree_le timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not fn_est_admin_systeme(array['operations', 'super_admin']) then
    raise exception 'Permission refusee.';
  end if;

  return query
    select m.utilisateur_id, u.email::text, m.role, m.cree_le
    from restaurant_memberships m
    join auth.users u on u.id = m.utilisateur_id
    where m.restaurant_id = p_restaurant_id
    order by m.cree_le;
end;
$$;

revoke execute on function fn_trouver_utilisateur_par_email(text) from public;
revoke execute on function fn_trouver_utilisateur_par_email(text) from anon;
grant execute on function fn_trouver_utilisateur_par_email(text) to authenticated;

revoke execute on function fn_lister_membres_restaurant(uuid) from public;
revoke execute on function fn_lister_membres_restaurant(uuid) from anon;
grant execute on function fn_lister_membres_restaurant(uuid) to authenticated;
