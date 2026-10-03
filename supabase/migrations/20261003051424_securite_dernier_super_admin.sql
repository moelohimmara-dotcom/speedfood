-- Revue de securite independante, point 5 : le garde-fou « dernier super_admin »
-- ne vivait que dans le code applicatif et se fiait a un parametre `role` envoye par
-- le client ; l'attribution d'un autre role (upsert) pouvait aussi retrograder le
-- dernier super_admin, et l'API directe permettait les deux.
--
-- Correctif en base : un trigger refuse toute suppression ou retrogradation qui
-- laisserait zero super_admin, y compris en cas de deux demandes simultanees
-- (verrou consultatif de transaction).

create or replace function public.fn_garder_dernier_super_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'super_admin' and (tg_op = 'DELETE' or new.role is distinct from 'super_admin') then
    perform pg_advisory_xact_lock(hashtext('speedfood.system_admin_memberships.super_admin'));
    if not exists (
      select 1 from system_admin_memberships
      where role = 'super_admin' and utilisateur_id <> old.utilisateur_id
    ) then
      raise exception 'Dernier super_admin : au moins un compte doit conserver ce role'
        using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_garder_dernier_super_admin() from public, anon, authenticated;

drop trigger if exists trg_garder_dernier_super_admin on public.system_admin_memberships;
create trigger trg_garder_dernier_super_admin
  before update or delete on public.system_admin_memberships
  for each row execute function public.fn_garder_dernier_super_admin();
