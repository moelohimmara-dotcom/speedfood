-- Corrige les avertissements de performance relevés par l'advisor Supabase.
-- Les avertissements "unused_index" et "unindexed_foreign_keys" restants sont
-- attendus sur une base neuve sans trafic et ne sont pas traités ici.
-- "multiple_permissive_policies" (lecture publique + lecture membre séparées sur
-- plusieurs tables) est un compromis de lisibilité assumé pour le pilote ; à
-- fusionner en policies uniques si le volume le justifie après mesure réelle.

-- Index de clé étrangère manquants (accélère les jointures/suppressions en cascade).
create index idx_audit_events_acteur on audit_events(acteur_id);
create index idx_content_pages_auteur on content_pages(auteur_id);
create index idx_order_items_menu_item on order_items(menu_item_id);

-- auth.uid() était réévalué à chaque ligne dans ces deux policies ; (select auth.uid())
-- permet à Postgres de ne l'évaluer qu'une fois par requête (recommandation Supabase).
alter policy "lecture_sa_propre_membership" on restaurant_memberships
  using (utilisateur_id = (select auth.uid()) or fn_est_admin_systeme());

alter policy "lecture_son_propre_role_systeme" on system_admin_memberships
  using (utilisateur_id = (select auth.uid()) or fn_est_admin_systeme(array['super_admin']));
