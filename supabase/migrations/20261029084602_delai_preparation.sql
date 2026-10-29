-- Heure estimée de préparation (suivi de commande enrichi, 29 octobre 2026) : le restaurateur déclare le délai habituel de préparation, en minutes. Le client voit
-- « prête vers HH:MM » une fois sa commande acceptée (heure d'acceptation + ce délai, calculée par le serveur).
--
-- Colonne facultative (null = pas d'estimation affichée). Ce n'est pas une donnée sensible : elle est destinée au client, donc la lecture publique de la fiche (policy
-- « lecture_publique_restaurants_publies ») peut la montrer. Les membres du restaurant la modifient comme `horaires` ou `consignes` : elle ne fait pas partie des
-- colonnes supervisées par `fn_proteger_colonnes_restaurant` (publication, suspension). Bornes : de 5 minutes à 4 heures.

alter table public.restaurants
  add column if not exists delai_preparation_minutes integer
  check (delai_preparation_minutes is null or delai_preparation_minutes between 5 and 240);

comment on column public.restaurants.delai_preparation_minutes is
  'Délai habituel de préparation déclaré par le restaurateur (minutes, 5 à 240) ; null = pas d''estimation affichée au client.';
