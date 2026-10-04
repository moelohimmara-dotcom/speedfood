-- Statistiques agregees de toute l'application pour le tableau de bord d'administration. Aucune donnee personnelle :
-- uniquement des comptes, des montants et des noms de restaurants ou de plats. Ouvert aux quatre roles systeme ; l'ecran
-- n'affiche chaque bloc que si le role en a la permission. La Guinee est a UTC+0.
create or replace function public.fn_statistiques_application(p_jours integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
      from orders where cree_le >= debut),
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
        where o.cree_le >= debut
        group by r.nom order by count(*) desc, r.nom limit 5) t), '[]'::jsonb),
    'top_plats', coalesce((select jsonb_agg(t) from (
        select i.nom, sum(i.quantite)::int as nb
        from order_items i join orders o on o.id = i.order_id
        where o.cree_le >= debut and o.statut not in ('refusee','annulee')
        group by i.nom order by sum(i.quantite) desc, i.nom limit 5) t), '[]'::jsonb),
    'quartiers', coalesce((select jsonb_agg(t) from (
        select n.nom, count(*)::int as nb
        from orders o join restaurants r on r.id = o.restaurant_id join neighborhoods n on n.id = r.quartier_id
        where o.cree_le >= debut
        group by n.nom order by count(*) desc, n.nom limit 5) t), '[]'::jsonb)
  ) into resultat;

  return resultat;
end;
$$;

revoke all on function public.fn_statistiques_application(integer) from public, anon;
grant execute on function public.fn_statistiques_application(integer) to authenticated, service_role;
