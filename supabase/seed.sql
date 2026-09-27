-- Données de développement local — EXPLICITEMENT FICTIVES.
-- Ne jamais exécuter contre un environnement pilote/production (bloc 2, PLAN-EXECUTION.md).
-- Volontairement différentes du prototype (speedfood/prototype/data.js) pour ne jamais
-- confondre "démo produit" et "jeu de données de dev" (AUDIT-BLOC-0.md).

insert into menu_categories (nom, ordre) values
  ('Riz & sauces', 1),
  ('Grillades', 2),
  ('Fast-food', 3),
  ('Petit-déjeuner', 4)
on conflict (nom) do nothing;

insert into neighborhoods (nom, ordre) values
  ('Kaloum', 1),
  ('Dixinn', 2),
  ('Ratoma', 3),
  ('Matam', 4)
on conflict (nom) do nothing;

-- Deux restaurants de dev, l'un publié (visible au catalogue), l'autre non (pour
-- tester que le catalogue public ne montre pas les établissements non validés).
insert into restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, publie)
select
  '00000000-0000-0000-0000-000000000001',
  '[DEV] Restaurant publié',
  (select id from menu_categories where nom = 'Riz & sauces'),
  (select id from neighborhoods where nom = 'Kaloum'),
  'Lun-Sam, 11h-21h',
  true,
  true
where not exists (select 1 from restaurants where id = '00000000-0000-0000-0000-000000000001');

insert into restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, publie)
select
  '00000000-0000-0000-0000-000000000002',
  '[DEV] Restaurant non publié',
  (select id from menu_categories where nom = 'Grillades'),
  (select id from neighborhoods where nom = 'Dixinn'),
  'Tous les jours, 12h-23h',
  true,
  false
where not exists (select 1 from restaurants where id = '00000000-0000-0000-0000-000000000002');

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000001', '[DEV] Plat test 1', 'Ligne de menu de développement', 25000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000001' and nom = '[DEV] Plat test 1'
);

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000001', '[DEV] Plat test 2 (indisponible)', 'Pour tester l’état indisponible', 18000, false
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000001' and nom = '[DEV] Plat test 2 (indisponible)'
);

-- Trois restaurants supplémentaires, publiés, répartis sur d'autres
-- catégories/quartiers — pour que le catalogue public ne montre pas un seul
-- établissement (jusqu'à ce que de vrais restaurateurs soient validés via le
-- bloc 8). Toujours explicitement fictifs, jamais à exécuter en pilote réel.

insert into restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, publie)
select
  '00000000-0000-0000-0000-000000000003',
  '[DEV] Grill Dixinn',
  (select id from menu_categories where nom = 'Grillades'),
  (select id from neighborhoods where nom = 'Dixinn'),
  'Tous les jours, 12h-23h',
  true,
  true
where not exists (select 1 from restaurants where id = '00000000-0000-0000-0000-000000000003');

insert into restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, publie)
select
  '00000000-0000-0000-0000-000000000004',
  '[DEV] Fast Ratoma',
  (select id from menu_categories where nom = 'Fast-food'),
  (select id from neighborhoods where nom = 'Ratoma'),
  'Lun-Dim, 10h-22h',
  false,
  true
where not exists (select 1 from restaurants where id = '00000000-0000-0000-0000-000000000004');

insert into restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, publie)
select
  '00000000-0000-0000-0000-000000000005',
  '[DEV] Café Matam',
  (select id from menu_categories where nom = 'Petit-déjeuner'),
  (select id from neighborhoods where nom = 'Matam'),
  'Lun-Sam, 6h-13h',
  true,
  true
where not exists (select 1 from restaurants where id = '00000000-0000-0000-0000-000000000005');

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000003', '[DEV] Brochettes de bœuf', 'Grillées au feu de bois', 30000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000003' and nom = '[DEV] Brochettes de bœuf'
);

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000003', '[DEV] Poulet grillé', 'Avec attiéké', 28000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000003' and nom = '[DEV] Poulet grillé'
);

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000004', '[DEV] Burger simple', 'Steak, cheddar, salade', 22000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000004' and nom = '[DEV] Burger simple'
);

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000004', '[DEV] Frites', 'Portion moyenne', 10000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000004' and nom = '[DEV] Frites'
);

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000005', '[DEV] Café touba', 'Café épicé traditionnel', 5000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000005' and nom = '[DEV] Café touba'
);

insert into menu_items (restaurant_id, nom, description, prix, disponible)
select '00000000-0000-0000-0000-000000000005', '[DEV] Omelette pain', 'Omelette, pain frais', 12000, true
where not exists (
  select 1 from menu_items where restaurant_id = '00000000-0000-0000-0000-000000000005' and nom = '[DEV] Omelette pain'
);
