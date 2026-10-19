-- Relecture independante du 19 octobre 2026 (M2) : `jeton_recu` n'etait pas protege par les declencheurs de mise a jour des commandes ; un membre
-- du restaurant pouvait le remplacer sur ses propres commandes (sans gravite pour la securite, le recu etant en lecture seule, mais cela cassait les
-- liens de recu deja envoyes). Il rejoint `jeton_suivi` parmi les colonnes qu'un compte connecte ne peut pas modifier. Seul le serveur (cle de service,
-- `auth.uid()` nul) peut encore y toucher. Reprend a l'identique les deux fonctions en production, avec la seule ligne ajoutee dans chacune.
create or replace function public.fn_limiter_maj_commande()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and (
    new.id is distinct from old.id
    or new.reference is distinct from old.reference
    or new.jeton_suivi is distinct from old.jeton_suivi
    or new.jeton_recu is distinct from old.jeton_recu
    or new.restaurant_id is distinct from old.restaurant_id
    or new.client_nom is distinct from old.client_nom
    or new.client_telephone is distinct from old.client_telephone
    or new.client_adresse is distinct from old.client_adresse
    or new.mode is distinct from old.mode
    or new.sous_total is distinct from old.sous_total
    or new.frais_livraison_estime is distinct from old.frais_livraison_estime
    or new.cree_le is distinct from old.cree_le
    or new.anonymise_le is distinct from old.anonymise_le
    or new.mis_a_jour_le is distinct from old.mis_a_jour_le
  ) then
    raise exception 'Seul le statut d''une commande peut etre modifie' using errcode = '42501';
  end if;
  return new;
end;
$function$;

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
     or new.jeton_recu is distinct from old.jeton_recu
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
