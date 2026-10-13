-- Quartiers complétés : deux quartiers de la réforme 2024 (attribution confirmée par la propriétaire)
-- et les quartiers de Kaloum, Dixinn, Matam et Kassa.
-- Sources : annuaire statistique INS 2022, tableau 1.3 (Kaloum, Dixinn, Matam, Kassa) ;
-- Yattaya centre -> Sonfonia, Nassouroulaye -> Lambanyi (décision de la propriétaire, 13 octobre 2026).
-- Écarts non tranchés, non insérés : « Port » (Kaloum, source secondaire) ; « Matam » (Matam, nom déjà utilisé
-- par une ligne existante de commune, à traiter avec le rattachement des restaurants).
-- APPLIQUÉE en production le 13 octobre 2026, sur autorisation écrite de la propriétaire.

insert into public.neighborhoods (nom, ordre, commune_id)
select q.nom, q.ordre, c.id
from (values
  ('sonfonia', 'Yattaya centre', 200),
  ('lambanyi', 'Nassouroulaye', 201),
  ('kaloum', 'Almamya I', 202),
  ('kaloum', 'Almamya II', 203),
  ('kaloum', 'Boulbinet', 204),
  ('kaloum', 'Coronthie I', 205),
  ('kaloum', 'Coronthie II', 206),
  ('kaloum', 'Koulewondy', 207),
  ('kaloum', 'Manquepas', 208),
  ('kaloum', 'Sandervalia', 209),
  ('kaloum', 'Sans Fil', 210),
  ('kaloum', 'Tamara', 211),
  ('kaloum', 'Téminetaye', 212),
  ('kaloum', 'Tombo', 213),
  ('dixinn', 'Belle Vue École', 214),
  ('dixinn', 'Belle Vue Marché I', 215),
  ('dixinn', 'Belle Vue Marché II', 216),
  ('dixinn', 'Camayenne', 217),
  ('dixinn', 'Cameroun', 218),
  ('dixinn', 'Dixinn Centre I', 219),
  ('dixinn', 'Dixinn Centre II', 220),
  ('dixinn', 'Dixinn Gare', 221),
  ('dixinn', 'Dixinn Gare Rails', 222),
  ('dixinn', 'Dixinn Mosquée', 223),
  ('dixinn', 'Dixinn Port', 224),
  ('dixinn', 'Hafia Château d''eau', 225),
  ('dixinn', 'Hafia I', 226),
  ('dixinn', 'Hafia II', 227),
  ('dixinn', 'Hafia III', 228),
  ('dixinn', 'Hafia Minière I', 229),
  ('dixinn', 'Hafia Minière II', 230),
  ('dixinn', 'Hafia Minière Centre', 231),
  ('dixinn', 'Hafia Mosquée', 232),
  ('dixinn', 'Kénien', 233),
  ('dixinn', 'Landréah', 234),
  ('dixinn', 'Minière Cité', 235),
  ('matam', 'Bonfi', 236),
  ('matam', 'Bonfi Marché', 237),
  ('matam', 'Bonfi Routière', 238),
  ('matam', 'Boussoura', 239),
  ('matam', 'Carrière Centre', 240),
  ('matam', 'Carrière Cité', 241),
  ('matam', 'Coléah Centre', 242),
  ('matam', 'Coléah Cité', 243),
  ('matam', 'Coléah Domino', 244),
  ('matam', 'Coléah Imprimerie', 245),
  ('matam', 'Hermakonon Mosquée', 246),
  ('matam', 'Hermakonon Permanence', 247),
  ('matam', 'Lanseboundji', 248),
  ('matam', 'Madina Centre', 249),
  ('matam', 'Madina Cité (SIG)', 250),
  ('matam', 'Madina Marché', 251),
  ('matam', 'Madina Mosquée', 252),
  ('matam', 'Madina École', 253),
  ('matam', 'Mafanco', 254),
  ('matam', 'Mafanco Centre', 255),
  ('matam', 'Matam Centre', 256),
  ('matam', 'Matam Lido', 257),
  ('matam', 'Touguiwondy', 258),
  ('kassa', 'Kassa Centre', 259),
  ('kassa', 'Fotoba', 260),
  ('kassa', 'Room', 261),
  ('kassa', 'Bana', 262),
  ('kassa', 'Corail', 263),
  ('kassa', 'Blanche', 264)
) as q (commune_slug, nom, ordre)
join public.communes c on c.slug = q.commune_slug
join public.villes v on v.id = c.ville_id and v.slug = 'conakry'
on conflict (nom) do nothing;
