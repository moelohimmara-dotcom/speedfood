-- Textes de promesse modifiables depuis la console admin (signature d'accueil, sous-titre, description de partage).
-- NULL = texte par defaut du code. Longueurs bornees.
alter table public.parametres_application
  add column promesse_signature text check (promesse_signature is null or char_length(promesse_signature) between 1 and 80),
  add column promesse_sous_titre text check (promesse_sous_titre is null or char_length(promesse_sous_titre) between 1 and 220),
  add column promesse_partage text check (promesse_partage is null or char_length(promesse_partage) between 1 and 200);
