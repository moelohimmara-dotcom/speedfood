-- Bloc 4 — Authentification et onboarding restaurant.
--
-- Décision produit (confirmée par Malika) : auto-inscription libre, restaurant créé
-- non publié par défaut, validation manuelle par un administrateur en attendant le
-- vrai CMS d'invitation (bloc 8). Voir ADR.md, question ouverte #2.
--
-- Un utilisateur authentifié ne peut PAS insérer directement dans `restaurants`
-- (seule la policy "admins_creation_restaurants" le permet). Cette fonction est
-- l'unique chemin par lequel un nouvel utilisateur crée son premier restaurant :
-- elle crée la ligne restaurant ET le membership owner dans la même transaction,
-- sans jamais faire confiance à un restaurant_id fourni par l'appelant (il n'y en
-- a pas — la fonction crée l'id elle-même).

create or replace function fn_creer_restaurant_et_owner(
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

  -- Un utilisateur ne peut créer qu'un seul restaurant via ce chemin d'auto-inscription.
  -- Un deuxième établissement pour le même propriétaire passera par le CMS (bloc 8).
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

-- Seul un utilisateur connecté peut appeler cette fonction (jamais anon : pas de
-- création de restaurant sans compte).
revoke execute on function fn_creer_restaurant_et_owner(text, uuid, uuid) from public;
grant execute on function fn_creer_restaurant_et_owner(text, uuid, uuid) to authenticated;
