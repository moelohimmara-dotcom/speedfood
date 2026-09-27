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
