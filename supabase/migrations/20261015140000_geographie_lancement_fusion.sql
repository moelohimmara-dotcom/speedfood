-- Géographie : statut de lancement par commune et fusion de quartiers en double.

-- Statut de lancement choisi par l'équipe. Null = automatique (déduit des restaurants publiés : « ouverte » s'il y en a, sinon rien d'affiché).
-- « bientot » et « pilote » permettent d'annoncer une zone avant son premier restaurant ; « fermee » la retire des annonces.
alter table public.communes add column statut_lancement text;
alter table public.communes
  add constraint communes_statut_lancement_check check (statut_lancement is null or statut_lancement in ('fermee', 'bientot', 'pilote', 'ouverte'));

-- Fusion : deux quartiers qui désignent le même lieu (« Kipé » et « Kipe Centre »). Le quartier source est désactivé (jamais supprimé),
-- son nom devient un nom alternatif du quartier conservé, et tout ce qui le référençait pointe vers le quartier conservé. Atomique :
-- au moindre échec, rien n'est modifié. Réservée à l'équipe qui gère la taxonomie.
create or replace function public.fn_fusionner_quartiers(p_source uuid, p_cible uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_source public.neighborhoods%rowtype;
  v_cible public.neighborhoods%rowtype;
  v_restaurants integer;
  v_clients integer;
  v_zones integer;
  v_alertes integer;
  v_noms text[];
begin
  if not public.fn_est_admin_systeme(array['super_admin', 'content_editor']) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  if p_source is null or p_cible is null or p_source = p_cible then
    raise exception 'Choisissez deux quartiers differents' using errcode = '22023';
  end if;

  select * into v_source from public.neighborhoods where id = p_source for update;
  select * into v_cible from public.neighborhoods where id = p_cible for update;
  if v_source.id is null or v_cible.id is null then
    raise exception 'Quartier introuvable' using errcode = '22023';
  end if;
  if v_source.generique or v_cible.generique then
    raise exception 'Un quartier « Centre de ... » represente une commune : il ne se fusionne pas' using errcode = '22023';
  end if;
  if v_source.commune_id is distinct from v_cible.commune_id then
    raise exception 'Les deux quartiers doivent etre dans la meme commune' using errcode = '22023';
  end if;

  update public.restaurants set quartier_id = p_cible where quartier_id = p_source;
  get diagnostics v_restaurants = row_count;

  update public.client_profils set quartier_id = p_cible where quartier_id = p_source;
  get diagnostics v_clients = row_count;

  -- Zones desservies : on déplace celles qui ne créent pas de doublon, on retire les autres (le restaurant dessert déjà le quartier conservé).
  delete from public.restaurant_zones_desservies z
   where z.neighborhood_id = p_source
     and exists (select 1 from public.restaurant_zones_desservies o where o.restaurant_id = z.restaurant_id and o.neighborhood_id = p_cible);
  update public.restaurant_zones_desservies set neighborhood_id = p_cible where neighborhood_id = p_source;
  get diagnostics v_zones = row_count;

  update public.zone_alertes set neighborhood_id = p_cible where neighborhood_id = p_source;
  get diagnostics v_alertes = row_count;

  -- Noms alternatifs : ceux du quartier conservé, plus le nom et les alias du quartier fusionné, sans doublon, dix au plus.
  select coalesce(array_agg(n), '{}') into v_noms from (
    select distinct n from unnest(coalesce(v_cible.noms_alternatifs, '{}') || v_source.nom || coalesce(v_source.noms_alternatifs, '{}')) as n
     where lower(n) <> lower(v_cible.nom) limit 10
  ) t;
  update public.neighborhoods set noms_alternatifs = v_noms where id = p_cible;
  update public.neighborhoods set actif = false where id = p_source;

  return jsonb_build_object('restaurants', v_restaurants, 'clients', v_clients, 'zones', v_zones, 'alertes', v_alertes);
end;
$function$;

revoke all on function public.fn_fusionner_quartiers(uuid, uuid) from public, anon;
grant execute on function public.fn_fusionner_quartiers(uuid, uuid) to authenticated;
