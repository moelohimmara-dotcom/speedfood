-- Nouvelles catégories de cuisine pour le catalogue (Africain, Libanais et oriental, Italien et pizzas, Indien, Asiatique).
-- Données de référence partagées par tous les restaurants (réels ou de démonstration) : l'ajout ne modifie aucun restaurant existant.
-- Idempotent : sans effet si une catégorie du même nom existe déjà.
insert into public.menu_categories (nom, ordre) values
  ('Africain', 5),
  ('Libanais et oriental', 6),
  ('Italien et pizzas', 7),
  ('Indien', 8),
  ('Asiatique', 9)
on conflict (nom) do nothing;
