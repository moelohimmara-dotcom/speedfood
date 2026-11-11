-- Lot M5 (10 novembre 2026), M2b : création ATOMIQUE d'une réservation de table. Fichier seul : jamais appliqué sans le feu vert de Malika.
-- Dépend de 20261110090000_reservations_table.sql (table, triggers, droits).
--
-- Pourquoi : jusqu'ici l'API vérifiait la capacité du créneau, le plafond de 3 réservations actives par compte, le doublon de créneau et le rejeu en plusieurs requêtes
-- successives. Deux demandes simultanées pouvaient donc passer ensemble et dépasser la capacité ou le plafond. Cette fonction fait tout dans UNE transaction, derrière deux verrous
-- consultatifs (un par compte, un par restaurant et créneau) : la seconde demande attend la première, puis relit l'état réel.
--
-- Règles reprises à l'identique de l'API (mêmes codes, mêmes messages côté client ; l'API traduit les codes) :
--  - plage horaire : de 10:00 à 22:45 inclus, heure de Conakry = UTC (décision du 10 novembre) ; la plage est aussi dans `packages/shared/src/contracts/reservation.ts` ;
--  - rejeu idempotent : même compte, même restaurant, même créneau, même nombre de personnes, réservation encore active => renvoie l'existante (aucune écriture) ;
--  - fenêtre : au moins 30 minutes d'avance, au plus 60 jours (30 minutes et 60 jours exactement permis, comme la garde de création) ;
--  - restaurant : existant, publié, non suspendu, qui accepte les réservations ;
--  - plafond : 3 réservations actives (demandée ou confirmée, créneau à venir) par compte, tous restaurants confondus ;
--  - doublon : un compte n'a pas deux réservations actives au même créneau ;
--  - capacité : somme des personnes (demandées et confirmées, tous comptes) à ce créneau + cette demande <= capacité du restaurant (null = pas de plafond).
--
-- La plage n'est PAS une contrainte de la table : les contrôles de cloisonnement de M2 créent des réservations à toute heure (maintenant + N jours) et la garde de création de M2 ne la porte pas.
-- Elle est donc imposée ici (seul chemin de création de l'API) et par le serveur avant l'appel ; l'ajouter à la table demanderait de réécrire ces essais.
--
-- Sécurité : SECURITY DEFINER, `search_path` fixé, exécutable par le SEUL rôle de service (jamais `anon` ni `authenticated`). Aucun identifiant n'est cru : le compte est celui du jeton
-- (posé par l'API), le restaurant est relu en base. Colonnes listées, jamais `select *` ni `returning *`. Le condensé du jeton de suivi n'est ni lu ni écrit ni renvoyé.
--
-- Réponse (jsonb) :
--   { "etat": "creee" | "rejeu", "reservation": { colonnes de la réservation + "restaurants": { "nom": ... } } }
--   { "etat": "refus", "code": "<code>" }  avec code parmi : HORS_PLAGE, FENETRE_PROCHE, FENETRE_LOIN, RESTAURANT_INTROUVABLE, RESTAURANT_INDISPONIBLE, RESERVATION_FERMEE,
--                                                         PLAFOND, DOUBLON, CAPACITE, REFERENCE_INDISPONIBLE
-- Une erreur de contrainte ou de garde (nom, téléphone, nombre de personnes hors bornes...) remonte telle quelle : l'API la traduit comme avant.

create or replace function public.fn_creer_reservation_atomique(
  p_client_user_id uuid,
  p_restaurant_id uuid,
  p_nom text,
  p_telephone text,
  p_nb_personnes integer,
  p_creneau timestamptz,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_premier constant integer := 10 * 60;      -- 10:00
  c_dernier constant integer := 22 * 60 + 45; -- 22:45
  c_plafond constant integer := 3;
  c_essais constant integer := 4;
  v_minutes integer;
  v_resto record;
  v_existante uuid;
  v_nb_actives integer;
  v_deja integer;
  v_id uuid;
  v_essai integer := 0;
  v_contrainte text;
begin
  if p_client_user_id is null or p_restaurant_id is null or p_creneau is null or p_nb_personnes is null then
    raise exception 'Demande de réservation incomplète.' using errcode = '22023';
  end if;

  -- Plage horaire (heure UTC = heure de Conakry) : avant tout verrou, c'est un calcul pur.
  v_minutes := extract(hour from (p_creneau at time zone 'UTC'))::integer * 60 + extract(minute from (p_creneau at time zone 'UTC'))::integer;
  if v_minutes < c_premier or v_minutes > c_dernier then
    return jsonb_build_object('etat', 'refus', 'code', 'HORS_PLAGE');
  end if;

  -- Verrous consultatifs de transaction (relâchés à la fin de la transaction), toujours pris dans le MÊME ordre : compte, puis restaurant + créneau.
  -- Deux demandes du même compte s'attendent (plafond, doublon, rejeu) ; deux demandes sur le même créneau d'un restaurant s'attendent (capacité).
  perform pg_advisory_xact_lock(hashtextextended('speedfood:reservation:compte:' || p_client_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('speedfood:reservation:creneau:' || p_restaurant_id::text || ':' || extract(epoch from p_creneau)::text, 0));

  -- Rejeu idempotent : la même demande du même compte renvoie la réservation existante, AVANT la fenêtre, le plafond et le doublon (qui refuseraient à tort un rejeu).
  select r.id into v_existante
  from public.reservations_table r
  where r.client_user_id = p_client_user_id
    and r.restaurant_id = p_restaurant_id
    and r.creneau = p_creneau
    and r.nb_personnes = p_nb_personnes
    and r.statut in ('demandee', 'confirmee')
    and r.creneau > now()
  order by r.cree_le, r.id
  limit 1;
  if found then
    return jsonb_build_object('etat', 'rejeu', 'reservation', public.fn_reservation_pour_client(v_existante));
  end if;

  if p_creneau < now() + interval '30 minutes' then
    return jsonb_build_object('etat', 'refus', 'code', 'FENETRE_PROCHE');
  end if;
  if p_creneau > now() + interval '60 days' then
    return jsonb_build_object('etat', 'refus', 'code', 'FENETRE_LOIN');
  end if;

  select s.publie, s.suspendu_le, s.accepte_reservation, s.reservation_capacite_couverts
    into v_resto
  from public.restaurants s
  where s.id = p_restaurant_id;
  if not found then
    return jsonb_build_object('etat', 'refus', 'code', 'RESTAURANT_INTROUVABLE');
  end if;
  if v_resto.publie is not true or v_resto.suspendu_le is not null then
    return jsonb_build_object('etat', 'refus', 'code', 'RESTAURANT_INDISPONIBLE');
  end if;
  if v_resto.accepte_reservation is not true then
    return jsonb_build_object('etat', 'refus', 'code', 'RESERVATION_FERMEE');
  end if;

  select count(*)::integer into v_nb_actives
  from public.reservations_table r
  where r.client_user_id = p_client_user_id
    and r.statut in ('demandee', 'confirmee')
    and r.creneau > now();
  if v_nb_actives >= c_plafond then
    return jsonb_build_object('etat', 'refus', 'code', 'PLAFOND');
  end if;

  perform 1
  from public.reservations_table r
  where r.client_user_id = p_client_user_id
    and r.statut in ('demandee', 'confirmee')
    and r.creneau > now()
    and r.creneau = p_creneau;
  if found then
    return jsonb_build_object('etat', 'refus', 'code', 'DOUBLON');
  end if;

  if v_resto.reservation_capacite_couverts is not null then
    select coalesce(sum(r.nb_personnes), 0)::integer into v_deja
    from public.reservations_table r
    where r.restaurant_id = p_restaurant_id
      and r.creneau = p_creneau
      and r.statut in ('demandee', 'confirmee');
    if v_deja + p_nb_personnes > v_resto.reservation_capacite_couverts then
      return jsonb_build_object('etat', 'refus', 'code', 'CAPACITE');
    end if;
  end if;

  -- Insertion : colonnes listées ; le statut, la référence et les horodatages viennent de la base. Une collision de référence (un cas sur 28 millions) refait un tirage.
  loop
    v_essai := v_essai + 1;
    begin
      insert into public.reservations_table (restaurant_id, client_user_id, nom_client, telephone, nb_personnes, creneau, note)
      values (p_restaurant_id, p_client_user_id, p_nom, p_telephone, p_nb_personnes, p_creneau, p_note)
      returning id into v_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_contrainte = constraint_name;
      if v_contrainte is distinct from 'reservations_table_reference_key' then
        raise;
      end if;
      if v_essai >= c_essais then
        return jsonb_build_object('etat', 'refus', 'code', 'REFERENCE_INDISPONIBLE');
      end if;
    end;
  end loop;

  return jsonb_build_object('etat', 'creee', 'reservation', public.fn_reservation_pour_client(v_id));
end;
$$;

-- Lecture d'une réservation sous la forme attendue par l'API (mêmes clés que `COLONNES_RESERVATION_CLIENT`). Colonnes listées ; ni compte, ni condensé de jeton, ni traitement.
create or replace function public.fn_reservation_pour_client(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'reference', r.reference,
    'restaurant_id', r.restaurant_id,
    'nom_client', r.nom_client,
    'telephone', r.telephone,
    'nb_personnes', r.nb_personnes,
    'creneau', r.creneau,
    'note', r.note,
    'statut', r.statut,
    'motif_refus', r.motif_refus,
    'cree_le', r.cree_le,
    'restaurants', jsonb_build_object('nom', s.nom)
  )
  from public.reservations_table r
  join public.restaurants s on s.id = r.restaurant_id
  where r.id = p_id;
$$;

comment on function public.fn_creer_reservation_atomique(uuid, uuid, text, text, integer, timestamptz, text) is
  'Lot M5 : crée une réservation de table en une transaction (verrous consultatifs compte et restaurant+créneau). Réservée au rôle de service.';

revoke all on function public.fn_creer_reservation_atomique(uuid, uuid, text, text, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.fn_creer_reservation_atomique(uuid, uuid, text, text, integer, timestamptz, text) to service_role;
revoke all on function public.fn_reservation_pour_client(uuid) from public, anon, authenticated;
grant execute on function public.fn_reservation_pour_client(uuid) to service_role;
