-- Bloc 8d — Support des commandes, indicateurs et audit (PLAN-EXECUTION.md).
--
-- Aucune policy RLS n'existait pour un rôle système sur orders/order_items/
-- order_status_events : `support` (et `super_admin`) n'avaient donc aucun
-- moyen de consulter ou d'agir sur une commande, malgré la permission
-- `commande.consulter`/`commande.support` déjà définie au bloc 8a. Vrai trou,
-- comblé ici — réservé à `support`/`super_admin` (pas `operations`, qui n'a
-- pas ces permissions dans la matrice v1.0.0).
--
-- Le trigger `fn_proteger_colonnes_commande` (bloc 7) continue de s'appliquer :
-- même un rôle système ne peut jamais modifier reference/jeton_suivi/montants/
-- coordonnées d'une commande, seul `statut` reste modifiable — l'instantané de
-- prix (ADR-006) reste garanti même pour une action de support.

create policy "support_lecture_commandes" on orders
  for select using (fn_est_admin_systeme(array['support', 'super_admin']));

create policy "support_maj_commandes" on orders
  for update using (fn_est_admin_systeme(array['support', 'super_admin']))
  with check (fn_est_admin_systeme(array['support', 'super_admin']));

create policy "support_lecture_lignes_commandes" on order_items
  for select using (fn_est_admin_systeme(array['support', 'super_admin']));

create policy "support_lecture_historique_commandes" on order_status_events
  for select using (fn_est_admin_systeme(array['support', 'super_admin']));

create policy "support_ecriture_historique_commandes" on order_status_events
  for insert with check (fn_est_admin_systeme(array['support', 'super_admin']));

-- Journal d'audit filtrable (bloc 8d) : auth.users n'est pas exposé via
-- PostgREST, même détour que fn_lister_membres_restaurant (bloc 8b) pour
-- afficher l'email de l'acteur plutôt qu'un UUID brut. Ouvert à tout rôle
-- système (permission `systeme.audit`, accordée aux quatre rôles).
create or replace function fn_lister_audit(
  p_action text default null,
  p_depuis timestamptz default null,
  p_limite integer default 100
)
returns table (
  id uuid,
  acteur_email text,
  action text,
  cible_type text,
  cible_id text,
  motif text,
  horodatage timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not fn_est_admin_systeme() then
    raise exception 'Permission refusee.';
  end if;

  return query
    select e.id, u.email::text, e.action, e.cible_type, e.cible_id, e.motif, e.horodatage
    from audit_events e
    left join auth.users u on u.id = e.acteur_id
    where (p_action is null or e.action = p_action)
      and (p_depuis is null or e.horodatage >= p_depuis)
    order by e.horodatage desc
    limit greatest(1, least(p_limite, 500));
end;
$$;

revoke execute on function fn_lister_audit(text, timestamptz, integer) from public;
revoke execute on function fn_lister_audit(text, timestamptz, integer) from anon;
grant execute on function fn_lister_audit(text, timestamptz, integer) to authenticated;
