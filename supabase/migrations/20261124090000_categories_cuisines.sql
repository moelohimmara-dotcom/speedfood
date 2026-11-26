-- Nouvelles catégories de cuisine pour le catalogue : une catégorie par grande cuisine (comme les places de marché de livraison),
-- plus « Cuisine du monde » pour les restaurants qui proposent plusieurs cuisines différentes (jamais classés d'après leur première cuisine).
-- Données de référence partagées par tous les restaurants (réels ou de démonstration) : l'ajout ne modifie aucun restaurant existant.
-- Idempotent : sans effet si une catégorie du même nom existe déjà.
insert into public.menu_categories (nom, ordre) values
  ('Africain', 5),
  ('Libanais et oriental', 6),
  ('Italien et pizzas', 7),
  ('Indien', 8),
  ('Asiatique', 9),
  ('Mexicain', 10),
  ('Français', 11),
  ('Méditerranéen', 12),
  ('Maghrébin', 13),
  ('Antillais et créole', 14),
  ('Européen', 15),
  ('Cuisine du monde', 16)
on conflict (nom) do nothing;
