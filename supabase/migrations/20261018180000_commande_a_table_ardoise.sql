-- Commande sur place : ardoise de table, numéro d'appel, convive sans compte (voir docs/COMMANDE-SUR-PLACE.md).
--
-- Une SESSION DE TABLE regroupe les commandes successives d'une même table ; l'addition est leur somme et se règle à la fin du repas.
-- Toutes les ÉCRITURES passent par le serveur (clé de service) : l'identité, l'appartenance au restaurant et les règles sont vérifiées côté
-- serveur. Speedfood n'encaisse rien : le serveur marque la table « payée » avec le mode de règlement utilisé.
--
-- Dérogation au TDR v0.2 §5.1 (« aucune écriture sans compte ») : décidée par la propriétaire le 18 octobre 2026, RESTAURANT PAR RESTAURANT
-- (`table_sans_compte`, désactivé par défaut) et seulement pour la commande à table, avec validation du serveur.

-- ---------------------------------------------------------------- réglages du service sur place (par restaurant)
alter table public.restaurants
  add column service_table text not null default 'table' check (service_table in ('table', 'comptoir')),
  add column table_sans_compte boolean not null default false,
  add column table_validation text not null default 'premiere' check (table_validation in ('aucune', 'premiere', 'toutes'));

-- ---------------------------------------------------------------- sessions de table
create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_numero text not null check (char_length(table_numero) between 1 and 10),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'payee', 'annulee')),
  -- Date à laquelle le serveur a validé l'ouverture de la table (les commandes suivantes passent sans nouvelle validation, selon le réglage).
  validee_le timestamptz,
  appel_serveur_le timestamptz,
  addition_demandee_le timestamptz,
  paiement_mode text check (paiement_mode is null or paiement_mode in ('especes', 'orange_money', 'mtn_momo')),
  cloturee_le timestamptz,
  cloturee_par uuid references auth.users (id) on delete set null,
  ouverte_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  constraint table_sessions_cloture_coherente check ((statut = 'ouverte') = (cloturee_le is null))
);
-- Une seule session ouverte par table (sans tenir compte de la casse : « a1 » et « A1 » sont la même table).
create unique index table_sessions_une_ouverte on public.table_sessions (restaurant_id, lower(table_numero)) where statut = 'ouverte';
create index table_sessions_restaurant_idx on public.table_sessions (restaurant_id, ouverte_le desc);

alter table public.table_sessions enable row level security;
create policy "restaurant_lit_ses_sessions_de_table" on public.table_sessions
  for select to authenticated using (public.fn_est_membre_restaurant(restaurant_id));
create policy "exploitation_lecture_sessions_de_table" on public.table_sessions
  for select to authenticated using (public.fn_est_admin_systeme(array['super_admin', 'support']));
revoke all on table public.table_sessions from anon;
revoke insert, update, delete, truncate on table public.table_sessions from authenticated;

-- ---------------------------------------------------------------- commandes : session, numéro d'appel, convive sans compte
alter table public.orders
  add column session_id uuid references public.table_sessions (id) on delete set null,
  add column numero_appel integer check (numero_appel is null or numero_appel > 0),
  add column invite boolean not null default false;
create index orders_session_idx on public.orders (session_id) where session_id is not null;
-- Numéro d'appel : unique par restaurant et par jour (Conakry est à l'heure UTC).
create unique index orders_numero_appel_jour on public.orders (restaurant_id, ((cree_le at time zone 'utc')::date), numero_appel) where numero_appel is not null;

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
     or new.cree_le is distinct from old.cree_le then
    if not fn_est_admin_systeme() then
      raise exception 'Modification non autorisee : un membre de restaurant ne peut changer que le statut d''une commande';
    end if;
  end if;

  return new;
end;
$function$;
