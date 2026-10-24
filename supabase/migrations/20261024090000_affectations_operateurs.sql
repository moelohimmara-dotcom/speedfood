-- Quarts et affectation (lot L2 de la console d'administration) : qui tient quel établissement.
--
-- Une affectation relie un opérateur (membre de l'équipe Speedfood) à un établissement que l'équipe tient
-- (mode de vente « speedfood »). Un établissement n'est tenu que par un seul opérateur à la fois : l'index
-- unique partiel ci-dessous l'impose EN BASE, pas seulement dans l'interface.
--
-- Les écritures passent par deux fonctions réservées (`fn_quarts_prendre`, `fn_quarts_liberer`) : la table est
-- en lecture seule pour les comptes connectés, et les fonctions vérifient le rôle de l'appelant ET celui de
-- l'opérateur avant d'écrire. La lecture est ouverte aux rôles de l'équipe (`support`, `super_admin`), les
-- mêmes rôles qui portent la permission `commande.support` de l'écran `/system/quarts`.

create table if not exists public.affectations_operateurs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  operateur_id uuid not null references auth.users(id) on delete cascade,
  -- Commande à l'origine de la prise : elle dit pourquoi l'établissement a été pris, pas qui s'en occupe.
  commande_id uuid references public.orders(id) on delete set null,
  prise_le timestamptz not null default now(),
  -- `null` = l'opérateur tient encore l'établissement.
  libere_le timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  constraint affectations_operateurs_liberation_apres_prise
    check (libere_le is null or libere_le >= prise_le)
);

alter table public.affectations_operateurs enable row level security;

-- Un établissement, un seul titulaire actif. L'index unique partiel est la règle métier : elle ne peut pas
-- être contournée par un appel direct à la base.
create unique index if not exists affectations_operateurs_etablissement_actif_idx
  on public.affectations_operateurs (restaurant_id)
  where libere_le is null;
create index if not exists affectations_operateurs_operateur_idx
  on public.affectations_operateurs (operateur_id);
create index if not exists affectations_operateurs_restaurant_idx
  on public.affectations_operateurs (restaurant_id);

-- Lecture réservée à l'équipe (support, super administrateur). Aucune policy d'écriture : les mutations
-- passent par les fonctions réservées ci-dessous.
create policy "equipe lit les affectations"
  on public.affectations_operateurs for select to authenticated
  using (public.fn_est_admin_systeme(array['support', 'super_admin']));

revoke all on public.affectations_operateurs from anon;
grant select on public.affectations_operateurs to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions réservées (écritures)
-- ---------------------------------------------------------------------------

-- Prise d'un établissement par un opérateur. Idempotente pour le même opérateur (renvoie l'affectation
-- existante) ; refusée si l'établissement est déjà tenu par quelqu'un d'autre.
create or replace function public.fn_quarts_prendre(
  p_restaurant_id uuid,
  p_commande_id uuid,
  p_operateur_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode_vente text;
  v_role text;
  v_id uuid;
  v_operateur_actif uuid;
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_operateur_id is null then
    raise exception 'Donnees invalides' using errcode = '22023';
  end if;

  select r.mode_vente into v_mode_vente from public.restaurants r where r.id = p_restaurant_id;
  if v_mode_vente is null then
    raise exception 'Etablissement introuvable' using errcode = 'P0002';
  end if;
  if v_mode_vente <> 'speedfood' then
    raise exception 'Cet etablissement n est pas tenu par l equipe Speedfood' using errcode = '22023';
  end if;

  select m.role into v_role from public.system_admin_memberships m where m.utilisateur_id = p_operateur_id;
  if v_role is null or v_role not in ('support', 'super_admin') then
    raise exception 'Cette personne ne fait pas partie de l equipe Speedfood' using errcode = '22023';
  end if;

  if p_commande_id is not null and not exists (
    select 1 from public.orders o where o.id = p_commande_id and o.restaurant_id = p_restaurant_id
  ) then
    raise exception 'Cette commande ne concerne pas cet etablissement' using errcode = '22023';
  end if;

  select a.id into v_id from public.affectations_operateurs a
   where a.restaurant_id = p_restaurant_id and a.libere_le is null;
  if v_id is not null then
    select a.operateur_id into v_operateur_actif from public.affectations_operateurs a where a.id = v_id;
    if v_operateur_actif = p_operateur_id then
      return v_id; -- l'opérateur tient déjà cet établissement : rien à changer
    end if;
    raise exception 'Cet etablissement est deja tenu par un autre operateur' using errcode = '23505';
  end if;

  insert into public.affectations_operateurs (restaurant_id, operateur_id, commande_id)
  values (p_restaurant_id, p_operateur_id, p_commande_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Libération d'un établissement par l'opérateur qui le tient. Renvoie `false` si l'établissement n'était
-- pas tenu (déjà libéré, ou jamais pris) : le refus reste explicite côté écran.
create or replace function public.fn_quarts_liberer(
  p_restaurant_id uuid,
  p_operateur_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_operateur_id is null then
    raise exception 'Donnees invalides' using errcode = '22023';
  end if;

  update public.affectations_operateurs
     set libere_le = now(), mis_a_jour_le = now()
   where id = (
     select a.id from public.affectations_operateurs a
      where a.restaurant_id = p_restaurant_id
        and a.operateur_id = p_operateur_id
        and a.libere_le is null
      limit 1
   );
  get diagnostics v_nb = row_count;
  if v_nb = 0 then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.fn_quarts_prendre(uuid, uuid, uuid) from public, anon;
grant execute on function public.fn_quarts_prendre(uuid, uuid, uuid) to authenticated, service_role;
revoke all on function public.fn_quarts_liberer(uuid, uuid) from public, anon;
grant execute on function public.fn_quarts_liberer(uuid, uuid) to authenticated, service_role;
