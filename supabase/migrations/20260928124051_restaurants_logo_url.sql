-- Logo du restaurant, distinct de la photo de couverture (photo_url).
alter table restaurants add column if not exists logo_url text;
