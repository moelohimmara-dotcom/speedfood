-- I-2 (2e partie). Le jeton de suivi n'est plus lisible par `anon` ni `authenticated` (droits de colonne) ; seul le serveur (service_role) le lit.
-- Le restaurateur ne lit que `jeton_recu` (ajoute par la migration 20261019100000), en lecture seule.
-- A APPLIQUER APRES le deploiement du code qui n'utilise plus `jeton_suivi` cote console (sinon les listes de commandes du restaurant echouent).
-- Garde : `select *` sur `orders` par un compte connecte echoue desormais ; le code liste ses colonnes (verifie par les tests).
revoke select on public.orders from anon, authenticated;
do $$
declare
  c text;
begin
  for c in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name <> 'jeton_suivi'
  loop
    execute format('grant select (%I) on public.orders to authenticated', c);
  end loop;
end $$;
