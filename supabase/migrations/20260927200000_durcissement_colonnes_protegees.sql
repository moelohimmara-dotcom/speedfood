-- Durcissement RLS — échecs 6.2 et 6.3 de l'audit Supabase (AUDIT-SUPABASE.md)
--
-- 6.2 : la politique "membres_maj_leur_restaurant" autorise un UPDATE sans
--       restriction de colonnes — un simple manager peut passer `publie` à true
--       ou effacer `suspendu_le`/`suspendu_motif`, qui relèvent des admins.
-- 6.3 : la politique "membres_maj_leurs_commandes" couvre toutes les colonnes de
--       `orders` — `sous_total`, `client_nom`, `client_telephone`, `reference`
--       restent modifiables après envoi, ce qui contredit l'instantané de prix
--       (ADR-006).
--
-- Correctif : triggers BEFORE UPDATE qui interdisent aux non-admins de toucher
-- aux colonnes supervisées. Le service_role (création de commande, acceptation
-- de proposition, expiration) n'a pas de JWT utilisateur : `auth.uid()` est NULL
-- et ces opérations serveur restent possibles. Les membres de restaurant ne
-- peuvent modifier que ce qui leur est utile : `orders.statut` (transitions
-- validées par trg_orders_valider_transition) et les champs de fiche restaurant
-- hors supervision (`ouvert`, `horaires`, `consignes`, etc.).
--
-- La RLS et les politiques existantes restent inchangées : ce durcissement est
-- en défense de profondeur, il n'ouvre aucun accès.

create or replace function fn_proteger_colonnes_restaurant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Pas de JWT utilisateur (service_role ou SQL direct) : opération serveur,
  -- supervision assumée hors application (validation admin, bloc 8).
  if auth.uid() is null then
    return new;
  end if;

  if new.publie is distinct from old.publie
     or new.suspendu_le is distinct from old.suspendu_le
     or new.suspendu_motif is distinct from old.suspendu_motif then
    if not fn_est_admin_systeme() then
      raise exception 'Seul un administrateur systeme peut modifier la publication ou la suspension d''un restaurant';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restaurants_proteger_colonnes on restaurants;
create trigger trg_restaurants_proteger_colonnes
  before update on restaurants
  for each row execute function fn_proteger_colonnes_restaurant();

create or replace function fn_proteger_colonnes_commande()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.reference is distinct from old.reference
     or new.jeton_suivi is distinct from old.jeton_suivi
     or new.restaurant_id is distinct from old.restaurant_id
     or new.client_nom is distinct from old.client_nom
     or new.client_telephone is distinct from old.client_telephone
     or new.client_adresse is distinct from old.client_adresse
     or new.mode is distinct from old.mode
     or new.sous_total is distinct from old.sous_total
     or new.frais_livraison_estime is distinct from old.frais_livraison_estime
     or new.cree_le is distinct from old.cree_le then
    if not fn_est_admin_systeme() then
      raise exception 'Modification non autorisee : un membre de restaurant ne peut changer que le statut d''une commande';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_proteger_colonnes on orders;
create trigger trg_orders_proteger_colonnes
  before update on orders
  for each row execute function fn_proteger_colonnes_commande();

-- Convention de durcissement du projet : aucune exécution directe depuis
-- anon/authenticated, même si les fonctions de trigger ne sont pas appelables
-- directement par PostgreSQL.
revoke execute on function fn_proteger_colonnes_restaurant() from public, anon, authenticated;
revoke execute on function fn_proteger_colonnes_commande() from public, anon, authenticated;
