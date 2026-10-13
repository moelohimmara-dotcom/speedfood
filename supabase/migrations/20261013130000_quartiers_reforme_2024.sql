-- Réforme territoriale de Conakry (2024) : quartiers par commune, liste publiée par le ministère
-- de l'Administration du territoire (avril 2024, relayée par Guinéenews le 29 avril 2024).
-- Exclus pour l'instant : « Yattaya centre » et « Nassouroulaye » (présents dans deux communes, à trancher).
-- Non inclus ici : Kaloum, Dixinn, Matam, Kassa (listes de l'annuaire INS 2022 ou de sources secondaires, à valider).

insert into public.communes (ville_id, nom, slug, actif)
select v.id, c.nom, c.slug, c.actif
from public.villes v
cross join (values
  ('Lambanyi', 'lambanyi', true),
  ('Sonfonia', 'sonfonia', true),
  ('Gbessia', 'gbessia', true),
  ('Tombolia', 'tombolia', true),
  ('Kagbelen', 'kagbelen', false),
  ('Sanoyah', 'sanoyah', false),
  ('Manéah', 'maneah', false)
) as c (nom, slug, actif)
where v.slug = 'conakry'
on conflict (ville_id, slug) do nothing;

insert into public.neighborhoods (nom, ordre, commune_id)
select q.nom, q.ordre, c.id
from (values
  ('ratoma', 'Taouyah', 100),
  ('ratoma', 'Ratoma Dispensaire', 101),
  ('ratoma', 'Ratoma Centre', 102),
  ('ratoma', 'Kaporo Rails', 103),
  ('ratoma', 'Hamdallaye 1', 104),
  ('ratoma', 'Hamdallaye 2', 105),
  ('ratoma', 'Koloma Soloprimo', 106),
  ('ratoma', 'Kipé', 107),
  ('ratoma', 'Kaporo Centre', 108),
  ('lambanyi', 'Nongo-centre', 109),
  ('lambanyi', 'Nongo Taady', 110),
  ('lambanyi', 'Lambanyi', 111),
  ('lambanyi', 'Yembeya', 112),
  ('lambanyi', 'Waréah', 113),
  ('lambanyi', 'Simbaya Gare', 114),
  ('lambanyi', 'Bantounka 1', 115),
  ('lambanyi', 'Bantounka 2', 116),
  ('lambanyi', 'Soumambossia', 117),
  ('lambanyi', 'Wanindara', 118),
  ('lambanyi', 'Wanindara Rails', 119),
  ('lambanyi', 'Kinifi', 120),
  ('sonfonia', 'Kobayah', 121),
  ('sonfonia', 'Yattaya Fossidet', 122),
  ('sonfonia', 'Sonfonia Gare 1', 123),
  ('sonfonia', 'Sonfonia Gare 2', 124),
  ('sonfonia', 'Sonfonia Centre 1', 125),
  ('sonfonia', 'Sonfonia Centre 2', 126),
  ('gbessia', 'Dabondy 1', 127),
  ('gbessia', 'Dabondy 2', 128),
  ('gbessia', 'Dabondy 3', 129),
  ('gbessia', 'Dabondy Ecole', 130),
  ('gbessia', 'Dabondy Rails', 131),
  ('gbessia', 'Gbessia Cité 1', 132),
  ('gbessia', 'Gbessia Cité 2', 133),
  ('gbessia', 'Gbessia Cité 3', 134),
  ('gbessia', 'Gbessia Ecole', 135),
  ('gbessia', 'Gbessia Centre', 136),
  ('gbessia', 'Gbessia Port 1', 137),
  ('gbessia', 'Gbessia Port 2', 138),
  ('gbessia', 'Dar-Es-Salam', 139),
  ('gbessia', 'Cité de l''air', 140),
  ('gbessia', 'Béhanzin', 141),
  ('gbessia', 'Tanènè Marché', 142),
  ('gbessia', 'Tanènè Mosquée', 143),
  ('gbessia', 'Yimbaya Ecole', 144),
  ('gbessia', 'Yimbaya Permanence', 145),
  ('gbessia', 'Yimbaya Port', 146),
  ('gbessia', 'Hamdallaye Mosquée', 147),
  ('gbessia', 'Yimbaya Tannerie', 148),
  ('gbessia', 'Simbaya 1', 149),
  ('gbessia', 'Koloma 1', 150),
  ('gbessia', 'Koloma 2', 151),
  ('matoto', 'Matato Centre', 152),
  ('matoto', 'Simbaya 2', 153),
  ('matoto', 'Simbaya Ecole', 154),
  ('matoto', 'Matoto Marché', 155),
  ('matoto', 'Matoto Khabitaya', 156),
  ('matoto', 'Sangoyah Mosquée', 157),
  ('matoto', 'Sangoyah Marché', 158),
  ('matoto', 'Kissosso', 159),
  ('matoto', 'Kissosso Plateau', 160),
  ('matoto', 'Marché Enco 5', 161),
  ('matoto', 'Wanindara Dispensaire', 162),
  ('matoto', 'Wanindara Marché', 163),
  ('tombolia', 'Enta Marché', 164),
  ('tombolia', 'Enta Fassa', 165),
  ('tombolia', 'Tombolia', 166),
  ('tombolia', 'Tombolia Plateau', 167),
  ('tombolia', 'Dabompa Village', 168),
  ('tombolia', 'Dabompa Plateau', 169),
  ('tombolia', 'Lansanayah', 170)
) as q (commune_slug, nom, ordre)
join public.communes c on c.slug = q.commune_slug
join public.villes v on v.id = c.ville_id and v.slug = 'conakry'
on conflict (nom) do nothing;
