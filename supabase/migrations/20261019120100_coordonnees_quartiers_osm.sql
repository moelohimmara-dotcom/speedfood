-- Revue du 19 octobre 2026 : dernière collecte des points GPS des vrais quartiers qui n'en avaient pas (Nominatim / OpenStreetMap, script
-- scripts/geocodage-quartiers.mjs). Sur 471 quartiers, 335 sont des quartiers génériques (un « autre quartier » par commune, sans point) ; il
-- restait 45 vrais quartiers sans point. 18 ont été retrouvés : nom IDENTIQUE dans OpenStreetMap et résultat à moins de 20 km (Conakry) ou 40 km du
-- centre de la commune, pour écarter les homonymes. Les 27 autres restent sans point (absents d'OpenStreetMap ou ambigus) et se renseignent depuis
-- la console. Points APPROXIMATIFS, utilisés seulement pour trouver la zone la plus proche d'une position ; la clause `latitude is null` protège
-- tout point déjà renseigné.
update public.neighborhoods n
set latitude = v.lat, longitude = v.lon, coordonnees_source = 'osm-nominatim-2026-10-19'
from (values
  ('53ed54a7-072d-4bcb-a828-184d031882b4'::uuid, 9.60866, -13.61904), -- Bantounka 1 (Lambanyi), 4 km du centre de la commune
  ('2e9a14ff-86ed-4ccf-a5b4-79abc2c20641'::uuid, 9.61249, -13.61457), -- Bantounka 2 (Lambanyi), 3.6 km du centre de la commune
  ('7980d230-b3b0-4f60-855c-5369ea91a814'::uuid, 9.58784, -13.6144), -- Béhanzin (Gbessia), 3 km du centre de la commune
  ('74c41fa1-bef4-40f8-8b87-43f823ae722f'::uuid, 9.66417, -13.54219), -- Dabompa Plateau (Tombolia), 2.4 km du centre de la commune
  ('fea7c436-5689-4846-a7a8-654d76309a8b'::uuid, 9.56554, -13.63819), -- Dabondy 2 (Gbessia), 0.6 km du centre de la commune
  ('796744d2-e529-4bf5-af21-39b00c7b883a'::uuid, 9.56699, -13.64178), -- Dabondy 3 (Gbessia), 0.9 km du centre de la commune
  ('be790a9b-4080-42ab-a91b-ca61dd9b32bf'::uuid, 9.57687, -13.63368), -- Dar-Es-Salam (Gbessia), 0.8 km du centre de la commune
  ('ac0b6020-0dce-4dc1-8624-fe5fcf04ad7e'::uuid, 9.5086, -13.79927), -- Fotoba (Kassa), 6.6 km du centre de la commune
  ('26b49d20-8402-40dc-b85b-341d69fcccb0'::uuid, 9.58653, -13.63544), -- Koloma 1 (Gbessia), 1.9 km du centre de la commune
  ('4f5c4d1f-cebd-47db-b931-c83373f2115c'::uuid, 9.58861, -13.62578), -- Koloma 2 (Gbessia), 2.3 km du centre de la commune
  ('e52b5a3a-9bfa-4a1e-9419-4999d1773c31'::uuid, 9.60571, -13.60907), -- Simbaya 1 (Gbessia), 4.9 km du centre de la commune
  ('1a495302-2ea6-4fcf-ad8e-31fa0ddf2d93'::uuid, 9.61801, -13.61156), -- Simbaya Gare (Lambanyi), 3 km du centre de la commune
  ('26fb6345-68d7-4685-b6f4-30414e518804'::uuid, 9.46562, -13.83349), -- Tamara (Kaloum), 14.8 km du centre de la commune
  ('26372550-809e-4b41-ac7e-0bc8c46d7f3d'::uuid, 9.62651, -13.61327), -- Yembeya (Lambanyi), 2 km du centre de la commune
  ('3f0ef02d-a534-4a16-b850-8c59ac01ff72'::uuid, 9.59145, -13.60135), -- Yimbaya Ecole (Gbessia), 4.3 km du centre de la commune
  ('8931d9a4-4f7f-455a-9f21-21e4370bdb6f'::uuid, 9.59059, -13.60838), -- Yimbaya Permanence (Gbessia), 3.7 km du centre de la commune
  ('6230d153-2da3-46d5-a4b4-1db22c004c38'::uuid, 9.58011, -13.60328), -- Yimbaya Port (Gbessia), 3.6 km du centre de la commune
  ('065e56ea-bda7-4658-9ab9-f98a828c7085'::uuid, 9.59773, -13.60268) -- Yimbaya Tannerie (Gbessia), 4.7 km du centre de la commune
) as v(id, lat, lon)
where n.id = v.id and n.latitude is null and n.longitude is null;
