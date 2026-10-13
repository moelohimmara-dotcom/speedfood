-- Suppression des quatre anciennes lignes « quartier » (Dixinn, Kaloum, Matam, Ratoma) : c'étaient des communes,
-- désormais représentées dans la table `communes`. Aucun restaurant ni aucun profil client ne les référence
-- (vérifié avant suppression). Les quartiers réels de ces communes sont dans `neighborhoods`.
-- APPLIQUÉE en production le 13 octobre 2026, sur confirmation écrite de la propriétaire.

delete from public.neighborhoods
where nom in ('Dixinn', 'Kaloum', 'Matam', 'Ratoma')
  and commune_id is not null
  and not exists (select 1 from public.restaurants r where r.quartier_id = neighborhoods.id)
  and not exists (select 1 from public.client_profils p where p.quartier_id = neighborhoods.id);
