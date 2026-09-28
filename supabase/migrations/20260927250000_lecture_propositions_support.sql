-- Correctif RLS — lecture des propositions révisées par les rôles système
-- (repéré lors de la construction du centre de commandement, bloc 8d bis).
--
-- Le bloc 8d a ouvert `orders`, `order_items` et `order_status_events` aux
-- rôles support/super_admin, mais pas `order_proposals` : les compteurs et la
-- file « propositions en attente » du dashboard restaient à zéro pour ces rôles
-- alors que les lignes existaient (prouvé : JWT super_admin = 0 ligne visible,
-- service_role = lignes visibles).
--
-- Même convention que 20260927240000_bloc8d_support_commandes_audit.sql.
-- Aucune écriture : le support n'a pas à modifier les propositions (immutables
-- côté restaurant/client, ADR-006) ; seule la réponse client passe par les
-- routes serveur (ADR-011).

create policy "support_lecture_propositions" on order_proposals
  for select using (fn_est_admin_systeme(array['support', 'super_admin']));
