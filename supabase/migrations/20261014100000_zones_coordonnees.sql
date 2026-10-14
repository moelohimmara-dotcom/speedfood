-- « Utiliser ma position » plus fiable : un point central par commune et par quartier, et des noms alternatifs.
-- Les points viennent d'OpenStreetMap (recherche Nominatim, collecte ponctuelle du 14 octobre 2026) : ils sont APPROXIMATIFS
-- (centre du lieu nommé dans OpenStreetMap) et servent uniquement à trouver la zone la plus proche d'une position.
-- Un quartier sans point (nom absent d'OpenStreetMap) n'a pas de coordonnées : la commune sert alors de repli.
-- Les coordonnées sont modifiables ensuite depuis la console ; `coordonnees_source` garde la trace de leur origine.

alter table public.communes
  add column latitude numeric(8, 5),
  add column longitude numeric(8, 5),
  add column noms_alternatifs text[] not null default '{}',
  add column coordonnees_source text,
  add constraint communes_coordonnees_ck check (
    (latitude is null and longitude is null)
    or (latitude between 7 and 13 and longitude between -15.5 and -7)
  );

alter table public.neighborhoods
  add column latitude numeric(8, 5),
  add column longitude numeric(8, 5),
  add column noms_alternatifs text[] not null default '{}',
  add column coordonnees_source text,
  add constraint neighborhoods_coordonnees_ck check (
    (latitude is null and longitude is null)
    or (latitude between 7 and 13 and longitude between -15.5 and -7)
  );

update public.communes c
set latitude = v.lat, longitude = v.lon, coordonnees_source = 'osm-nominatim-2026-10-14'
from (values
  ('Dixinn', 9.54688, -13.67331),
  ('Gbessia', 9.56928, -13.63397),
  ('Kaloum', 9.51496, -13.70844),
  ('Kassa', 9.47681, -13.74898),
  ('Lambanyi', 9.64455, -13.61361),
  ('Matam', 9.54509, -13.6647),
  ('Matoto', 9.61806, -13.58891),
  ('Ratoma', 9.63063, -13.60784),
  ('Sonfonia', 9.66171, -13.56259),
  ('Tombolia', 9.64439, -13.55142)
) as v(nom, lat, lon)
where c.nom = v.nom;

update public.neighborhoods n
set latitude = v.lat, longitude = v.lon, coordonnees_source = 'osm-nominatim-2026-10-14'
from (values
  ('Dixinn', 'Belle Vue École', 9.55531, -13.6652),
  ('Dixinn', 'Belle Vue Marché I', 9.55774, -13.66841),
  ('Dixinn', 'Belle Vue Marché II', 9.55774, -13.66841),
  ('Dixinn', 'Camayenne', 9.53913, -13.68243),
  ('Dixinn', 'Cameroun', 9.52786, -13.69144),
  ('Dixinn', 'Dixinn Centre I', 9.55193, -13.6672),
  ('Dixinn', 'Dixinn Centre II', 9.55193, -13.6672),
  ('Dixinn', 'Dixinn Gare', 9.55062, -13.66376),
  ('Dixinn', 'Dixinn Gare Rails', 9.54939, -13.66293),
  ('Dixinn', 'Dixinn Mosquée', 9.54752, -13.67188),
  ('Dixinn', 'Dixinn Port', 9.55139, -13.67573),
  ('Dixinn', 'Hafia Château d''eau', 9.55903, -13.65527),
  ('Dixinn', 'Hafia I', 9.56836, -13.65611),
  ('Dixinn', 'Hafia II', 9.56836, -13.65611),
  ('Dixinn', 'Hafia Minière Centre', 9.56344, -13.65102),
  ('Dixinn', 'Hafia Minière I', 9.5678, -13.64824),
  ('Dixinn', 'Hafia Minière II', 9.56344, -13.65102),
  ('Dixinn', 'Hafia Mosquée', 9.55802, -13.65669),
  ('Dixinn', 'Kénien', 9.55351, -13.65993),
  ('Dixinn', 'Landréah', 9.54704, -13.678),
  ('Dixinn', 'Minière Cité', 9.56666, -13.6632),
  ('Gbessia', 'Cité de l''air', 9.56918, -13.63567),
  ('Gbessia', 'Dabondy 1', 9.56255, -13.63721),
  ('Gbessia', 'Dabondy Ecole', 9.56255, -13.63721),
  ('Gbessia', 'Gbessia Centre', 9.56785, -13.62974),
  ('Gbessia', 'Gbessia Cité 1', 9.57117, -13.62994),
  ('Gbessia', 'Gbessia Cité 2', 9.57117, -13.62994),
  ('Gbessia', 'Gbessia Cité 3', 9.57117, -13.62994),
  ('Gbessia', 'Gbessia Ecole', 9.57526, -13.62814),
  ('Gbessia', 'Gbessia Port 1', 9.56211, -13.62744),
  ('Gbessia', 'Gbessia Port 2', 9.56578, -13.62158),
  ('Gbessia', 'Hamdallaye Mosquée', 9.56824, -13.63493),
  ('Kaloum', 'Boulbinet', 9.50578, -13.7159),
  ('Kaloum', 'Coronthie I', 9.51924, -13.70224),
  ('Kaloum', 'Coronthie II', 9.51924, -13.70224),
  ('Kaloum', 'Koulewondy', 9.50917, -13.70705),
  ('Kaloum', 'Manquepas', 9.50598, -13.71094),
  ('Kaloum', 'Sandervalia', 9.50575, -13.70686),
  ('Kaloum', 'Sans Fil', 9.5136, -13.70025),
  ('Kaloum', 'Téminetaye', 9.50976, -13.70372),
  ('Kaloum', 'Tombo', 9.52035, -13.69481),
  ('Lambanyi', 'Kinifi', 9.64555, -13.60847),
  ('Lambanyi', 'Lambanyi', 9.63947, -13.6074),
  ('Lambanyi', 'Wanindara', 9.64146, -13.61211),
  ('Matam', 'Bonfi', 9.55686, -13.63871),
  ('Matam', 'Bonfi Marché', 9.56018, -13.63966),
  ('Matam', 'Bonfi Routière', 9.55512, -13.64283),
  ('Matam', 'Boussoura', 9.54717, -13.65999),
  ('Matam', 'Carrière Centre', 9.55692, -13.65161),
  ('Matam', 'Carrière Cité', 9.56311, -13.64854),
  ('Matam', 'Coléah Centre', 9.53367, -13.67685),
  ('Matam', 'Coléah Cité', 9.53711, -13.67696),
  ('Matam', 'Coléah Domino', 9.53217, -13.67905),
  ('Matam', 'Coléah Imprimerie', 9.53602, -13.67345),
  ('Matam', 'Hermakonon Mosquée', 9.56189, -13.64398),
  ('Matam', 'Hermakonon Permanence', 9.5598, -13.64609),
  ('Matam', 'Lanseboundji', 9.52588, -13.6854),
  ('Matam', 'Madina Centre', 9.53818, -13.66703),
  ('Matam', 'Madina École', 9.54437, -13.66292),
  ('Matam', 'Madina Marché', 9.54107, -13.66503),
  ('Matam', 'Madina Mosquée', 9.54477, -13.667),
  ('Matam', 'Mafanco', 9.5396, -13.66976),
  ('Matam', 'Mafanco Centre', 9.53779, -13.67143),
  ('Matam', 'Matam Centre', 9.5558, -13.64861),
  ('Matam', 'Matam Lido', 9.54963, -13.65238),
  ('Matam', 'Touguiwondy', 9.54886, -13.65753),
  ('Matoto', 'Kissosso', 9.63719, -13.57237),
  ('Matoto', 'Kissosso Plateau', 9.63719, -13.57237),
  ('Matoto', 'Matoto Khabitaya', 9.61921, -13.59085),
  ('Matoto', 'Matoto Marché', 9.60956, -13.5904),
  ('Matoto', 'Sangoyah Marché', 9.61623, -13.58278),
  ('Matoto', 'Sangoyah Mosquée', 9.625, -13.57987),
  ('Matoto', 'Simbaya 2', 9.60378, -13.59655),
  ('Matoto', 'Simbaya Ecole', 9.60867, -13.6009),
  ('Ratoma', 'Hamdallaye 1', 9.57633, -13.64843),
  ('Ratoma', 'Hamdallaye 2', 9.58094, -13.65204),
  ('Ratoma', 'Kaporo Centre', 9.60976, -13.64236),
  ('Ratoma', 'Kaporo Rails', 9.60118, -13.63192),
  ('Ratoma', 'Kipé', 9.60196, -13.65427),
  ('Ratoma', 'Koloma Soloprimo', 9.59536, -13.62477),
  ('Ratoma', 'Ratoma Centre', 9.59187, -13.65381),
  ('Ratoma', 'Ratoma Dispensaire', 9.58408, -13.65708),
  ('Ratoma', 'Taouyah', 9.57855, -13.662),
  ('Sonfonia', 'Sonfonia Centre 1', 9.67954, -13.56203),
  ('Sonfonia', 'Sonfonia Centre 2', 9.68302, -13.55908),
  ('Sonfonia', 'Sonfonia Gare 1', 9.66957, -13.55861),
  ('Sonfonia', 'Sonfonia Gare 2', 9.6682, -13.56158),
  ('Tombolia', 'Enta Fassa', 9.63853, -13.56047),
  ('Tombolia', 'Enta Marché', 9.64188, -13.56265),
  ('Tombolia', 'Tombolia', 9.64627, -13.54819)
) as v(commune, nom, lat, lon)
join public.communes c on c.nom = v.commune
where n.commune_id = c.id and n.nom = v.nom;
