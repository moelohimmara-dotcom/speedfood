-- Revue independante du 19 octobre 2026 (docs/REVUE-2026-10-19.md), points I-2 (1re partie), I-3, I-4 et M-3.
-- Cette migration est ADDITIVE : elle ne retire rien a ce que le code deja en production utilise. Le retrait de la lecture de `jeton_suivi`
-- est dans la migration suivante (20261019100100), a appliquer APRES le deploiement du code qui lit `jeton_recu`.
--
-- I-2. Le jeton de suivi est la SEULE cle d'acces du client a sa commande (suivi, reponse a une proposition de prix, declaration de
-- paiement, notation). Un membre du restaurant pouvait pourtant le lire (policy de lecture sur toutes les colonnes) et agir a la place
-- du client. Cette migration :
--  - ajoute une colonne `jeton_recu`, distincte et en lecture seule, qui sert au lien du recu partage par le restaurateur
--    (`/recu/[jeton]`) : elle n'ouvre ni le suivi, ni les propositions, ni le paiement, ni la notation.
alter table public.orders
  add column if not exists jeton_recu text not null
  default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists orders_jeton_recu_uniq on public.orders (jeton_recu);

-- M-3. Le restaurant et le livreur lisaient `order_id` et `auteur_utilisateur_id` des avis : ils pouvaient retrouver qui a mal note,
-- alors que l'interface n'affiche que le prenom. Ces deux colonnes ne sont plus lisibles par les comptes connectes (le serveur les lit).
revoke select on public.avis from authenticated;
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'avis' and column_name not in ('order_id', 'auteur_utilisateur_id')
  loop
    execute format('grant select (%I) on public.avis to authenticated', c);
  end loop;
end $$;

-- I-3. Les commandes saisies par le personnel du restaurant ne comptent plus dans la frequentation du classement : un restaurateur
-- pouvait gonfler son rang en saisissant des commandes fictives. (Elles ne sont plus notables non plus : voir src/lib/notation/regles.ts.)
create or replace function public.fn_frequentation_restaurants(p_jours integer)
returns table (restaurant_id uuid, commandes integer)
language sql
stable
security definer
set search_path = public
as $$
  select o.restaurant_id, count(*)::integer
  from public.orders o
  where o.statut = 'terminee' and not o.est_test and o.saisie_par is null
    and o.mis_a_jour_le >= now() - make_interval(days => greatest(1, least(p_jours, 365)))
  group by o.restaurant_id;
$$;
revoke execute on function public.fn_frequentation_restaurants(integer) from public, anon, authenticated;
grant execute on function public.fn_frequentation_restaurants(integer) to service_role;

-- I-4. La reinitialisation complete de l'application (suppression de toutes les commandes, restaurants et comptes) restait appelable
-- par un compte connecte, derriere super administrateur + double authentification + jeton de 5 minutes. Avec de vrais clients et sans
-- preproduction, elle est desactivee : plus aucun compte connecte ne peut l'appeler par l'API. Pour la reactiver un jour, UNE migration
-- explicite : `grant execute on function public.fn_reinitialisation_simuler() to authenticated;` et idem pour
-- `fn_reinitialiser_application(uuid, text)`, apres decision ecrite de la proprietaire.
revoke execute on function public.fn_reinitialisation_simuler() from public, anon, authenticated;
revoke execute on function public.fn_reinitialiser_application(uuid, text) from public, anon, authenticated;
