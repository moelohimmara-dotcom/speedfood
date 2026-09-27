-- Fonctions utilitaires réutilisées par les policies RLS et les triggers.

create or replace function fn_touch_mis_a_jour()
returns trigger
language plpgsql
as $$
begin
  new.mis_a_jour_le := now();
  return new;
end;
$$;

-- Vrai si l'utilisateur connecté est membre (owner/manager) du restaurant donné.
-- SECURITY DEFINER + search_path fixé : évite qu'une policy RLS sur restaurant_memberships
-- ne se re-déclenche récursivement en appelant cette fonction.
create or replace function fn_est_membre_restaurant(p_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from restaurant_memberships m
    where m.restaurant_id = p_restaurant_id
      and m.utilisateur_id = auth.uid()
  );
$$;

-- Vrai si l'utilisateur connecté a un rôle système parmi ceux fournis (ADR-010).
-- p_roles vide = vrai pour n'importe quel rôle système.
create or replace function fn_est_admin_systeme(p_roles text[] default '{}')
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from system_admin_memberships a
    where a.utilisateur_id = auth.uid()
      and (p_roles = '{}' or a.role = any(p_roles))
  );
$$;

-- Valide les transitions de statut de commande côté base (TDR.md §6), en plus de la
-- validation applicative déjà codée dans src/lib/contracts/statuts.ts. Défense en profondeur :
-- même un accès direct à la table ne peut pas produire une transition invalide.
create or replace function fn_valider_transition_commande()
returns trigger
language plpgsql
as $$
begin
  if new.statut = old.statut then
    return new;
  end if;

  if (old.statut, new.statut) not in (
    ('en_attente', 'acceptee'),
    ('en_attente', 'refusee'),
    ('en_attente', 'annulee'),
    ('acceptee', 'prete'),
    ('acceptee', 'annulee'),
    ('prete', 'terminee')
  ) then
    raise exception 'Transition de statut invalide : % -> %', old.statut, new.statut;
  end if;

  new.mis_a_jour_le := now();
  return new;
end;
$$;
