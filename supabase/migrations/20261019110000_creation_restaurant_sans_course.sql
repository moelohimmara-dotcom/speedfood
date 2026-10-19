-- Revue du 19 octobre 2026, M-9 (simulation sur un vrai PostgreSQL 17, docs/REVUE-2026-10-19.md §11).
-- La fonction d'auto-inscription refuse un deuxieme restaurant pour un meme compte, mais le controle (« existe-t-il deja un rattachement ? ») et
-- l'insertion ne sont pas atomiques : 10 appels simultanes d'un meme compte ont cree 10 restaurants. Correctif : un verrou de transaction propre
-- au compte serialise les appels d'un meme compte ; les comptes differents ne s'attendent pas. Signature et droits inchanges (create or replace
-- conserve les GRANT/REVOKE de la migration 20260927160000 et de 20260927160100).
create or replace function public.fn_creer_restaurant_et_owner(
  p_nom text,
  p_categorie_id uuid,
  p_quartier_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  perform pg_advisory_xact_lock(hashtext('creer_restaurant:' || auth.uid()::text));

  -- Un utilisateur ne peut creer qu'un seul restaurant via ce chemin d'auto-inscription.
  -- Un deuxieme etablissement pour le meme proprietaire passera par le CMS (bloc 8).
  if exists (select 1 from restaurant_memberships where utilisateur_id = auth.uid()) then
    raise exception 'Ce compte est déjà associé à un restaurant.';
  end if;

  insert into restaurants (nom, categorie_id, quartier_id, publie)
  values (p_nom, p_categorie_id, p_quartier_id, false)
  returning id into v_restaurant_id;

  insert into restaurant_memberships (restaurant_id, utilisateur_id, role)
  values (v_restaurant_id, auth.uid(), 'owner');

  return v_restaurant_id;
end;
$$;
