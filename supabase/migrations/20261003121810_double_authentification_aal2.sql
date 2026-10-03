-- Double authentification FACULTATIVE (TOTP) : une fois qu'un compte a active un facteur, la base
-- n'accorde plus ses droits (administrateur, membre de restaurant) qu'a une session RENFORCEE
-- (niveau aal2, code saisi pendant la connexion). Sans facteur, rien ne change.
--
-- Pourquoi en base et pas seulement dans l'application : sans cela, quelqu'un qui connait le mot
-- de passe obtiendrait une session au seul mot de passe (aal1) et pourrait appeler directement
-- l'API de donnees en contournant les pages. Les fonctions fn_est_admin_systeme et
-- fn_est_membre_restaurant sont utilisees par TOUTES les policies de gestion, donc ce controle
-- les couvre toutes d'un coup.

create or replace function public.fn_session_mfa_suffisante()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke execute on function public.fn_session_mfa_suffisante() from public, anon, authenticated;

create or replace function public.fn_est_admin_systeme(p_roles text[] default '{}'::text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from system_admin_memberships a
    where a.utilisateur_id = auth.uid()
      and (p_roles = '{}' or a.role = any(p_roles))
  ) and public.fn_session_mfa_suffisante();
$$;

create or replace function public.fn_est_membre_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from restaurant_memberships m
    where m.restaurant_id = p_restaurant_id
      and m.utilisateur_id = auth.uid()
  ) and public.fn_session_mfa_suffisante();
$$;
