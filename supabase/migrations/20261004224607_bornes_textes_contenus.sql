-- Bornes de longueur appliquées par la base (test de sécurité du 4 octobre 2026) : un restaurateur peut écrire dans ses
-- lignes par l'API directe, sans passer par les formulaires qui limitent déjà ces champs. Sans borne, un nom de 100 000
-- caractères était accepté (gonflement du stockage, pages lourdes, saturation du temps de calcul du Worker).
alter table restaurants
  add constraint restaurants_nom_longueur check (char_length(nom) between 1 and 120),
  add constraint restaurants_horaires_longueur check (horaires is null or char_length(horaires) <= 500),
  add constraint restaurants_consignes_longueur check (consignes is null or char_length(consignes) <= 1000),
  add constraint restaurants_motifs_longueur check (coalesce(char_length(suspendu_motif), 0) <= 1000 and coalesce(char_length(motif_correction), 0) <= 1000);
alter table menu_items
  add constraint menu_items_nom_longueur check (char_length(nom) between 1 and 120),
  add constraint menu_items_description_longueur check (description is null or char_length(description) <= 500);
alter table menu_item_options
  add constraint menu_item_options_nom_longueur check (char_length(nom) between 1 and 80);
alter table menu_sections
  add constraint menu_sections_nom_longueur check (char_length(nom) between 1 and 80);
