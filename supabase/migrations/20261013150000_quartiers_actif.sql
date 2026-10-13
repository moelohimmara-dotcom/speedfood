-- Quartiers activables / désactivables depuis la console super administrateur (et le CMS éditeur).
-- Un quartier désactivé reste rattaché à ses restaurants, mais n'est plus proposé à la création de restaurant
-- ni au choix d'un restaurant existant.
-- APPLIQUÉE en production le 13 octobre 2026, sur autorisation écrite de la propriétaire.

alter table public.neighborhoods
  add column if not exists actif boolean not null default true;
