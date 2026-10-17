-- Livraison, phase 1a (voir docs/LIVRAISON.md) : réglages des frais, mode de livraison du restaurant,
-- destination et frais calculés enregistrés dans la commande.
--
-- Rien ici ne change le comportement existant tant que la console n'a pas réglé les frais : un restaurant garde
-- le mode « propre » (il livre lui-même, comme aujourd'hui) et la commande garde ses frais à 0 si le calcul
-- n'est pas activé (interrupteur `livraison_frais_actifs`, éteint par défaut).

create table public.parametres_livraison (
  id boolean primary key default true check (id),
  -- Interrupteur du calcul automatique : tant qu'il est éteint, les frais restent « à convenir » (0 GNF).
  frais_actifs boolean not null default false,
  base_gnf integer not null default 5000 check (base_gnf between 0 and 1000000),
  prix_km_gnf integer not null default 2000 check (prix_km_gnf between 0 and 1000000),
  minimum_gnf integer not null default 8000 check (minimum_gnf between 0 and 1000000),
  gratuit_des_gnf integer check (gratuit_des_gnf is null or gratuit_des_gnf between 0 and 100000000),
  rayon_max_km numeric(5,1) not null default 10 check (rayon_max_km > 0 and rayon_max_km <= 200),
  arrondi_gnf integer not null default 500 check (arrondi_gnf between 1 and 10000),
  -- Vitesse moyenne en ville, pour l'heure d'arrivée estimée quand aucun itinéraire n'est disponible.
  vitesse_moyenne_kmh integer not null default 20 check (vitesse_moyenne_kmh between 5 and 80),
  -- Délai laissé à un livreur pour accepter une course (phase 1b).
  delai_offre_secondes integer not null default 45 check (delai_offre_secondes between 10 and 300),
  mis_a_jour_le timestamptz not null default now(),
  mis_a_jour_par uuid references auth.users (id) on delete set null
);

insert into public.parametres_livraison (id) values (true);

alter table public.parametres_livraison enable row level security;

-- Lecture et modification : super_admin seulement (comme les autres paramètres). Le calcul des frais à la commande lit
-- ces valeurs avec la clé de service, côté serveur.
create policy "super_admin_lecture_parametres_livraison" on public.parametres_livraison
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin']));
create policy "super_admin_maj_parametres_livraison" on public.parametres_livraison
  for update to authenticated
  using (public.fn_est_admin_systeme(array['super_admin']))
  with check (public.fn_est_admin_systeme(array['super_admin']));

revoke all on table public.parametres_livraison from anon;
revoke insert, delete, truncate on table public.parametres_livraison from authenticated;

-- Mode de livraison du restaurant : « propre » = il livre avec son personnel (comportement actuel), « speedfood » = il demande
-- un livreur Speedfood (phase 1b), « aucune » = retrait uniquement.
alter table public.restaurants
  add column livraison_mode text not null default 'propre' check (livraison_mode in ('aucune', 'propre', 'speedfood'));

-- Destination et calcul enregistrés dans la commande (valeurs du SERVEUR, jamais du navigateur).
alter table public.orders
  add column livraison_latitude double precision check (livraison_latitude is null or livraison_latitude between -90 and 90),
  add column livraison_longitude double precision check (livraison_longitude is null or livraison_longitude between -180 and 180),
  add column livraison_distance_m integer check (livraison_distance_m is null or livraison_distance_m >= 0),
  add column livraison_gratuite boolean not null default false;

-- Un membre de restaurant ne change que le statut d'une commande : la destination et le calcul de livraison rejoignent
-- la liste des colonnes protégées (même fonction que `commandes_test`, avec quatre colonnes de plus).
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
     or new.cree_le is distinct from old.cree_le then
    if not fn_est_admin_systeme() then
      raise exception 'Modification non autorisee : un membre de restaurant ne peut changer que le statut d''une commande';
    end if;
  end if;

  return new;
end;
$function$;
