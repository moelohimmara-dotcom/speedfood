-- Colonnes internes de `restaurants`, partie B : `motif_correction` (correction demandee par l'equipe) et `suspendu_motif` (motif d'une suspension)
-- ne sont plus lisibles par `anon` ni `authenticated` (droits de colonne, meme schema que `orders`, migration 20261019100100).
-- Avant : droit de table entier, donc lisibles pour les restaurants publies par la cle publique et par tout compte connecte.
-- Les droits d'ecriture ne changent pas. `service_role` n'est pas concerne (droits propres).
-- A APPLIQUER APRES la migration 20261118120000 ET le deploiement du site qui lit les motifs par `fn_motifs_restaurants` et filtre par `correction_demandee`
-- (sinon la console restaurateur et l'administration des restaurants echouent).
-- Garde : `select *` sur `restaurants` par un compte connecte ou la cle publique echoue desormais ; le code liste ses colonnes (verifie par les tests).
-- Piege : une colonne ajoutee plus tard a `restaurants` n'a AUCUN droit de lecture tant qu'une migration ne le lui donne pas (un test le garde).
-- Retour arriere (a lancer a la main si besoin) : `grant select on public.restaurants to anon, authenticated;` rend le droit de table entier comme avant.
revoke select on public.restaurants from anon, authenticated;
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'restaurants'
      and column_name not in ('motif_correction', 'suspendu_motif')
  loop
    execute format('grant select (%I) on public.restaurants to anon, authenticated', c);
  end loop;
end $$;
