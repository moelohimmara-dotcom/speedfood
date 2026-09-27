-- Corrige les avertissements de sécurité relevés par l'advisor Supabase après la
-- migration RLS : search_path mutable, et fonctions utilitaires appelables
-- directement par anon/authenticated via /rest/v1/rpc/... alors qu'elles ne sont
-- destinées qu'à être appelées depuis des policies pour des utilisateurs connectés.

-- 1) search_path fixé sur les fonctions plpgsql (celles en `language sql` l'avaient déjà).
create or replace function fn_touch_mis_a_jour()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.mis_a_jour_le := now();
  return new;
end;
$$;

create or replace function fn_valider_transition_commande()
returns trigger
language plpgsql
set search_path = public
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

-- 2) fn_est_membre_restaurant / fn_est_admin_systeme ne sont utiles que pour des
-- utilisateurs connectés (un visiteur anonyme n'est jamais membre ni admin). On
-- retire le rôle anon de leur exécution, et on restreint aux "authenticated" les
-- policies qui les appellent — nécessaire sinon Postgres refuserait d'évaluer ces
-- policies pour anon (droit d'exécution manquant) et casserait la lecture publique.
revoke execute on function fn_est_membre_restaurant(uuid) from public;
grant execute on function fn_est_membre_restaurant(uuid) to authenticated;

revoke execute on function fn_est_admin_systeme(text[]) from public;
grant execute on function fn_est_admin_systeme(text[]) to authenticated;

alter policy "membres_lecture_leur_restaurant" on restaurants to authenticated;
alter policy "membres_maj_leur_restaurant" on restaurants to authenticated;
alter policy "admins_lecture_tous_restaurants" on restaurants to authenticated;
alter policy "admins_creation_restaurants" on restaurants to authenticated;
alter policy "admins_maj_restaurants" on restaurants to authenticated;

alter policy "lecture_sa_propre_membership" on restaurant_memberships to authenticated;
alter policy "admins_gestion_memberships" on restaurant_memberships to authenticated;

alter policy "lecture_son_propre_role_systeme" on system_admin_memberships to authenticated;
alter policy "super_admin_gestion_roles_systeme" on system_admin_memberships to authenticated;

alter policy "membres_lecture_leur_menu" on menu_items to authenticated;
alter policy "membres_gestion_leur_menu" on menu_items to authenticated;
alter policy "membres_maj_leur_menu" on menu_items to authenticated;
alter policy "membres_suppression_leur_menu" on menu_items to authenticated;

alter policy "membres_lecture_leurs_commandes" on orders to authenticated;
alter policy "membres_maj_leurs_commandes" on orders to authenticated;

alter policy "membres_lecture_lignes_commandes" on order_items to authenticated;

alter policy "membres_lecture_historique_commandes" on order_status_events to authenticated;
alter policy "membres_ecriture_historique_commandes" on order_status_events to authenticated;

alter policy "membres_lecture_propositions" on order_proposals to authenticated;
alter policy "membres_creation_propositions" on order_proposals to authenticated;

alter policy "editeurs_gestion_contenu" on content_pages to authenticated;
alter policy "editeurs_gestion_bannieres" on content_banners to authenticated;
alter policy "operations_gestion_mises_en_avant" on featured_placements to authenticated;

alter policy "admins_lecture_audit" on audit_events to authenticated;
alter policy "admins_ecriture_audit" on audit_events to authenticated;

-- Note : "rls_auto_enable" signalé par le même audit est une fonction interne à la
-- plateforme Supabase, pas une fonction créée par ce dépôt — hors de notre contrôle.
