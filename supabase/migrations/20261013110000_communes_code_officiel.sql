-- Code officiel OCHA (COD-AB Guinée, niveau 3) pour chaque commune de Conakry.
-- Sert à rapprocher nos communes d'une source officielle, indépendamment de leur nom.
-- Source : https://data.humdata.org/dataset/cod-ab-gin (fichier gin_admin3, valide depuis le 4 mars 2016).
-- APPLIQUÉE en production le 13 octobre 2026, sur autorisation écrite de la propriétaire.

alter table public.communes
  add column if not exists code_officiel text unique
    check (code_officiel ~ '^GN[0-9]{8}$');

update public.communes as c
set code_officiel = v.code
from (values
  ('kaloum', 'GN00200102'),
  ('dixinn', 'GN00200101'),
  ('matam', 'GN00200103'),
  ('matoto', 'GN00200104'),
  ('ratoma', 'GN00200105')
) as v (slug, code)
where c.slug = v.slug
  and c.code_officiel is null;
