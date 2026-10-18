-- Commande saisie par le personnel (mode serveur, voir docs/COMMANDE-SUR-PLACE.md §S2).
--
-- Le serveur prend la commande d'une table sur son téléphone (client sans smartphone, ou qui préfère commander au serveur). La commande
-- est rattachée au COMPTE du membre qui l'a saisie (`saisie_par`) : traçabilité identique à une commande de client. Ce n'est PAS une
-- commande de test (`est_test` reste faux) : elle compte dans les chiffres du restaurant.
alter table public.orders
  add column saisie_par uuid references auth.users (id) on delete set null;

create or replace function public.fn_proteger_colonnes_commande()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.est_test is distinct from old.est_test then
    raise exception 'Le marquage de test d''une commande ne se modifie pas';
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
     or new.livraison_latitude is distinct from old.livraison_latitude
     or new.livraison_longitude is distinct from old.livraison_longitude
     or new.livraison_distance_m is distinct from old.livraison_distance_m
     or new.livraison_gratuite is distinct from old.livraison_gratuite
     or new.table_numero is distinct from old.table_numero
     or new.client_user_id is distinct from old.client_user_id
     or new.session_id is distinct from old.session_id
     or new.numero_appel is distinct from old.numero_appel
     or new.invite is distinct from old.invite
     or new.saisie_par is distinct from old.saisie_par
     or new.cree_le is distinct from old.cree_le then
    if not fn_est_admin_systeme() then
      raise exception 'Modification non autorisee : un membre de restaurant ne peut changer que le statut d''une commande';
    end if;
  end if;

  return new;
end;
$function$;
