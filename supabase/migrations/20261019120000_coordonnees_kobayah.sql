-- Revue du 19 octobre 2026 : « Utiliser ma position » annonçait Kinifi (Lambanyi) à une personne située à Kobaya, sur la corniche, parce que le quartier
-- « Kobayah » n'avait aucun point GPS et ne pouvait donc jamais être retrouvé comme zone la plus proche.
-- Point relevé par la propriétaire, sur place (GPS du navigateur, précision annoncée 96 m). Approximatif, comme tous les points de zone ; la
-- clause `latitude is null` protège un point déjà renseigné depuis la console.
update public.neighborhoods
set latitude = 9.66100, longitude = -13.60700, coordonnees_source = 'releve-proprietaire-2026-10-19'
where nom = 'Kobayah' and latitude is null and longitude is null;
