-- Les quatre anciennes lignes « quartiers » (Dixinn, Kaloum, Matam, Ratoma) étaient en réalité des communes,
-- sans rattachement. On les rattache à leur commune : les restaurants qui y figurent suivent désormais la
-- nouvelle structure ville → commune → quartier, sans qu'aucun quartier ne soit inventé.
-- Chaque restaurant devra ensuite choisir son vrai quartier (sélecteur de la console restaurateur ou de la fiche admin).
-- APPLIQUÉE en production le 13 octobre 2026, sur demande écrite de la propriétaire.

update public.neighborhoods as n
set commune_id = c.id
from public.communes as c
where c.slug = lower(n.nom)
  and n.nom in ('Dixinn', 'Kaloum', 'Matam', 'Ratoma')
  and n.commune_id is null;
