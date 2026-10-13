-- Ajout de la commune Kassa, présente dans l'annuaire statistique INS 2022 (tableau 1.3, Conakry).
-- Absente du découpage OCHA (2016) : code_officiel reste vide (null), à compléter si une source officielle le fournit.
-- APPLIQUÉE en production le 13 octobre 2026, sur autorisation écrite de la propriétaire.

insert into public.communes (ville_id, nom, slug)
select v.id, 'Kassa', 'kassa'
from public.villes v
where v.slug = 'conakry'
on conflict (ville_id, slug) do nothing;
