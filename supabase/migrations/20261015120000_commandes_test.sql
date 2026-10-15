-- Commandes de test : un membre de l'équipe d'un restaurant (ou un administrateur système) qui commande dans SON restaurant passe une
-- commande de TEST. Le marquage est posé par le serveur au moment de la création (jamais par le navigateur) ; la commande suit le parcours
-- complet (acceptation, préparation, suivi) mais n'est comptée dans AUCUN chiffre de l'administration.

alter table public.orders add column est_test boolean not null default false;
create index orders_est_test_idx on public.orders (est_test) where est_test;

-- Le marquage ne se modifie depuis AUCUNE session (restaurateur, support, administrateur) : seul le serveur le pose, à la création.
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
     or new.cree_le is distinct from old.cree_le then
    if not fn_est_admin_systeme() then
      raise exception 'Modification non autorisee : un membre de restaurant ne peut changer que le statut d''une commande';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.fn_support_commandes_par_heure(p_jours integer)
 returns table(heure integer, nb integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 180 then
    raise exception 'Periode invalide' using errcode = '22023';
  end if;
  return query
    select extract(hour from o.cree_le at time zone 'UTC')::int as heure, count(*)::int as nb
    from orders o
    where not o.est_test
      and o.cree_le >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => p_jours - 1)) at time zone 'UTC'
    group by 1
    order by 1;
end;
$function$;

create or replace function public.fn_support_compter_commandes(p_statuts text[] default null::text[], p_depuis timestamp with time zone default null::timestamp with time zone)
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  n integer;
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  select count(*)::int into n
  from orders o
  where not o.est_test
    and (p_statuts is null or o.statut = any(p_statuts))
    and (p_depuis is null or o.cree_le >= p_depuis);
  return n;
end;
$function$;

create or replace function public.fn_support_serie_commandes(p_jours integer)
 returns table(jour date, statut text, nb integer, montant bigint)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.fn_est_admin_systeme(array['support', 'super_admin']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 180 then
    raise exception 'Periode invalide' using errcode = '22023';
  end if;
  return query
    select (o.cree_le at time zone 'UTC')::date as jour,
           o.statut,
           count(*)::int as nb,
           coalesce(sum(o.sous_total), 0)::bigint as montant
    from orders o
    where not o.est_test
      and o.cree_le >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => p_jours - 1)) at time zone 'UTC'
    group by 1, 2
    order by 1, 2;
end;
$function$;

create or replace function public.fn_statistiques_application(p_jours integer)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  debut timestamptz;
  resultat jsonb;
begin
  if not public.fn_est_admin_systeme(array['super_admin', 'operations', 'content_editor', 'support']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_jours is null or p_jours < 1 or p_jours > 180 then
    raise exception 'Periode invalide' using errcode = '22023';
  end if;
  debut := (date_trunc('day', now() at time zone 'UTC') - make_interval(days => p_jours - 1)) at time zone 'UTC';

  select jsonb_build_object(
    'restaurants', (select jsonb_build_object(
        'total', count(*),
        'publies', count(*) filter (where publie and suspendu_le is null),
        'en_attente', count(*) filter (where not publie and suspendu_le is null and motif_correction is null),
        'correction', count(*) filter (where motif_correction is not null),
        'suspendus', count(*) filter (where suspendu_le is not null),
        'ouverts', count(*) filter (where publie and suspendu_le is null and ouvert),
        'acceptent_commandes', count(*) filter (where publie and suspendu_le is null and accepte_commandes),
        'avec_logo', count(*) filter (where publie and suspendu_le is null and logo_url is not null),
        'avec_photo', count(*) filter (where publie and suspendu_le is null and photo_url is not null),
        'nouveaux', count(*) filter (where cree_le >= debut))
      from restaurants),
    'catalogue', (select jsonb_build_object(
        'plats', count(*),
        'disponibles', count(*) filter (where disponible),
        'en_promo', count(*) filter (where prix_promo is not null),
        'avec_photo', count(*) filter (where photo_url is not null),
        'nouveaux', count(*) filter (where cree_le >= debut),
        'supplements', (select count(*) from menu_item_options))
      from menu_items where archive_le is null),
    'commandes', (select jsonb_build_object(
        'total', count(*),
        'livraison', count(*) filter (where mode = 'livraison'),
        'retrait', count(*) filter (where mode <> 'livraison'),
        'panier_moyen', coalesce(round(avg(sous_total) filter (where statut in ('acceptee','prete','terminee')))::bigint, 0),
        'restaurants_actifs', count(distinct restaurant_id))
      from orders where cree_le >= debut and not est_test),
    'propositions', (select jsonb_build_object(
        'total', count(*),
        'acceptees', count(*) filter (where statut = 'acceptee'),
        'refusees', count(*) filter (where statut = 'refusee'),
        'expirees', count(*) filter (where statut = 'expiree'),
        'en_attente', count(*) filter (where statut = 'en_attente'))
      from order_proposals where cree_le >= debut),
    'clients', (select jsonb_build_object(
        'comptes', count(*),
        'nouveaux', count(*) filter (where cree_le >= debut),
        'avec_coordonnees', count(*) filter (where coordonnees_enregistrees_le is not null))
      from client_profils),
    'alertes', (select jsonb_build_object(
        'abonnements', count(*),
        'restaurants_equipes', count(distinct restaurant_id),
        'actifs_7j', count(*) filter (where derniere_reussite_le >= now() - interval '7 days'),
        'en_echec', count(*) filter (where echecs > 0))
      from push_subscriptions),
    'contenus', jsonb_build_object(
        'pages_publiees', (select count(*) from content_pages where statut = 'publie'),
        'pages_brouillon', (select count(*) from content_pages where statut <> 'publie'),
        'bannieres_publiees', (select count(*) from content_banners where statut = 'publie'),
        'bannieres_brouillon', (select count(*) from content_banners where statut <> 'publie'),
        'mises_en_avant_actives', (select count(*) from featured_placements where actif and (fin_le is null or fin_le > now()))),
    'equipes', jsonb_build_object(
        'membres_restaurants', (select count(*) from restaurant_memberships),
        'comptes_systeme', (select count(*) from system_admin_memberships)),
    'audit', jsonb_build_object(
        'evenements', (select count(*) from audit_events where horodatage >= debut)),
    'top_restaurants', coalesce((select jsonb_agg(t) from (
        select r.nom, count(*)::int as nb, coalesce(sum(o.sous_total), 0)::bigint as montant
        from orders o join restaurants r on r.id = o.restaurant_id
        where o.cree_le >= debut and not o.est_test
        group by r.nom order by count(*) desc, r.nom limit 5) t), '[]'::jsonb),
    'top_plats', coalesce((select jsonb_agg(t) from (
        select i.nom, sum(i.quantite)::int as nb
        from order_items i join orders o on o.id = i.order_id
        where o.cree_le >= debut and not o.est_test and o.statut not in ('refusee','annulee')
        group by i.nom order by sum(i.quantite) desc, i.nom limit 5) t), '[]'::jsonb),
    'quartiers', coalesce((select jsonb_agg(t) from (
        select n.nom, count(*)::int as nb
        from orders o join restaurants r on r.id = o.restaurant_id join neighborhoods n on n.id = r.quartier_id
        where o.cree_le >= debut and not o.est_test
        group by n.nom order by count(*) desc, n.nom limit 5) t), '[]'::jsonb)
  ) into resultat;

  return resultat;
end;
$function$;
