-- Réattribution des quartiers des restaurants fictifs de démonstration (19 restaurants) après la réforme de 2024.
-- Les restaurants étaient rattachés aux anciennes lignes de commune (Dixinn, Kaloum, Matam, Ratoma).
-- Chaque restaurant reçoit un quartier réel de sa commune, choisi d'après son nom et l'annuaire INS 2022.
-- « Riz Gras de Bonfi » passe de Ratoma à Matam : le quartier Bonfi est à Matam dans l'annuaire.
-- APPLIQUÉE en production le 13 octobre 2026, sur décision de la propriétaire (données fictives).

update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Dixinn Mosquée') where nom = '[DEV] Grill Dixinn';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Dixinn Centre I') where nom = '[DEV] Restaurant non publié';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Hafia I') where nom = 'Chez Fatoumata';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Dixinn Gare') where nom = 'Dixinn Burger House';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Dixinn Port') where nom = 'Poulet Braisé Dixinn';

update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Coronthie I') where nom = '[DEV] Restaurant publié';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Boulbinet') where nom = 'Café des Ambassades';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Almamya I') where nom = 'La Marmite de Kaloum';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Tombo') where nom = 'Le Braisier du Port';

update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Mafanco') where nom = '[DEV] Café Matam';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Matam Centre') where nom = 'Boulangerie Soleil de Matam';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Matam Lido') where nom = 'Le Grill de Matam';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Touguiwondy') where nom = 'Matam Fast Corner';

update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Taouyah') where nom = '[DEV] Fast Ratoma';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Ratoma Centre') where nom = 'barbie';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Kaporo Centre') where nom = 'barbie food';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Ratoma Dispensaire') where nom = 'Le Matinal de Ratoma';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Hamdallaye 1') where nom = 'Ratoma Snack Express';
update public.restaurants set quartier_id = (select id from public.neighborhoods where nom = 'Bonfi') where nom = 'Riz Gras de Bonfi';
