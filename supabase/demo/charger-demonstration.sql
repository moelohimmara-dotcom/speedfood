-- Chargement du contenu de démonstration (lot « presentation-2026-11 »), à exécuter UNE fois, dans une transaction.
-- Tout est fictif : noms, numéros (préfixe 60000 réservé à la démonstration), adresses. Les restaurants portent `donnees_demo` et
-- `demo_lot` ; fn_demo_visibilite / fn_demo_supprimer (migration 20261123090000) les masquent ou les suppriment.
-- Échelle « moyenne » : 60 restaurants, ~1 250 plats (menus de 16 à 26 plats, tous différents), 3 000 commandes d'historique sur 90 jours, ~2 000 avis, 40 livreurs.
-- Répartition : 37 restaurants et 28 livreurs sur 10 communes de Conakry, 23 restaurants et 12 livreurs dans les chefs-lieux des 7 autres
-- régions (Kindia, Coyah, Boké, Kamsar, Labé, Mamou, Faranah, Kankan, Siguiri, N'Zérékoré, Guéckédou) ; ~86 % des commandes à Conakry.
-- Déterministe (graine fixe). Refuse de recharger un lot déjà présent.
do $demo$
declare
  v_lot constant text := 'presentation-2026-11';
  n_hist constant int := 3000;
  n_livreurs constant int := 40;
  cats uuid[];
begin
  if exists (select 1 from public.restaurants where demo_lot = v_lot) then
    raise exception 'Le lot % est déjà chargé : supprimez-le d''abord.', v_lot;
  end if;
  perform set_config('speedfood.chargement_demo', 'on', true);
  perform setseed(0.2611);

  select array_agg(id order by ordre) into cats from public.menu_categories;
  if cats is null or cardinality(cats) < 4 then
    raise exception 'Catégories introuvables : chargement annulé.';
  end if;

  -- ------------------------------------------------------------------ zones : Conakry (10 communes) et les chefs-lieux des 7 autres régions
  -- Conakry : un quartier par commune (préférence aux plus connus, avec coordonnées ; à défaut, celles de la commune). Régions : le quartier générique « Centre » de la ville
  -- (positionné sur les coordonnées de la commune). nb_resto / nb_livreurs : combien de restaurants et de livreurs simulés dans la zone.
  create temp table t_zones on commit drop as
  with poids(cle, nb_resto, nb_livreurs) as (values
    ('Ratoma', 6, 5), ('Matoto', 5, 4), ('Dixinn', 4, 3), ('Matam', 4, 3), ('Kaloum', 4, 3),
    ('Gbessia', 3, 2), ('Lambanyi', 3, 2), ('Sonfonia', 3, 2), ('Tombolia', 3, 2), ('Kassa', 2, 2),
    ('Kindia Centre', 3, 2), ('Coyah Centre', 1, 0), ('Boké Centre', 3, 2), ('Centre de Kamsar', 2, 1), ('Labé Centre', 3, 2),
    ('Mamou Centre', 2, 1), ('Faranah Centre', 2, 1), ('Kankan Centre', 3, 2), ('Siguiri Centre', 1, 0),
    ('N''Zérékoré Centre', 2, 1), ('Guéckédou Centre', 1, 0)),
  conakry as (
    select distinct on (n.commune_id) n.id as quartier_id, c.nom as cle, 'Conakry'::text as region, 'Quartier ' || n.nom as libelle,
           coalesce(n.latitude, c.latitude)::float as lat, coalesce(n.longitude, c.longitude)::float as lng
    from public.neighborhoods n
      join public.communes c on c.id = n.commune_id
      join public.prefectures p on p.id = c.prefecture_id
      join public.regions r on r.id = p.region_id
    where r.nom = 'Conakry' and n.actif and not n.generique and coalesce(n.latitude, c.latitude) is not null
    order by n.commune_id, (n.latitude is not null) desc,
             (n.nom = any (array['Kipé','Taouyah','Nongo','Lambanyi','Hamdallaye','Matam','Camayenne','Coléah Centre','Dixinn Gare','Bonfi','Sonfonia Gare','Gbessia Centre','Kaloum Centre'])) desc,
             n.nom),
  regions_ as (
    select distinct on (n.nom) n.id as quartier_id, n.nom as cle, r.nom as region, n.nom as libelle,
           c.latitude::float as lat, c.longitude::float as lng
    from public.neighborhoods n
      join public.communes c on c.id = n.commune_id
      join public.prefectures p on p.id = c.prefecture_id
      join public.regions r on r.id = p.region_id
    where r.nom <> 'Conakry' and n.actif and n.generique and c.latitude is not null
      and n.nom in (select cle from poids)
    order by n.nom, c.nom)
  select row_number() over (order by (z.region <> 'Conakry'), p.nb_resto desc, z.cle) as z, z.*, p.nb_resto, p.nb_livreurs
  from (select * from conakry union all select * from regions_) z join poids p on p.cle = z.cle;
  if (select coalesce(sum(nb_resto), 0) from t_zones) <> 60 or (select coalesce(sum(nb_livreurs), 0) from t_zones) <> 40
     or (select count(distinct region) from t_zones) <> 8 then
    raise exception 'Zones de démonstration incomplètes (communes ou villes introuvables dans la géographie) : chargement annulé.';
  end if;

  -- Emplacements : chaque zone reçoit ses restaurants et ses livreurs, intercalés pour qu'aucune catégorie ne se concentre au même endroit.
  create temp table t_slots on commit drop as
  select row_number() over (order by (k - 0.5) / z.nb_resto, z.z) as s, z.z
  from t_zones z cross join lateral generate_series(1, z.nb_resto) k where z.nb_resto > 0;
  create temp table t_lslots on commit drop as
  select row_number() over (order by (k - 0.5) / z.nb_livreurs, z.z) as s, z.z
  from t_zones z cross join lateral generate_series(1, z.nb_livreurs) k where z.nb_livreurs > 0;

  -- ------------------------------------------------------------------ restaurants
  create temp table t_resto on commit drop as
  with noms(cat, nom) as (values
    (1,'Chez Mariama'),(1,'La Table Centrale'),(1,'Saveurs de Foutah'),(1,'Chez Tante Fanta'),(1,'Le Riz du Marché'),(1,'Maison Soumah'),(1,'Chez Aïssatou'),(1,'Le Grenier Peul'),(1,'Cuisine de Maman Kadi'),(1,'Chez Oumou Sangaré'),(1,'Le Plat du Jour'),(1,'La Marmite Dorée'),(1,'Chez Kadiatou'),(1,'Les Délices de Hawa'),(1,'Chez Nènè'),
    (2,'Le Braiseur du Marché'),(2,'Grill Central'),(2,'Chez Boubacar Grillades'),(2,'Poulet Braisé du Rond-Point'),(2,'La Flamme d''Or'),(2,'Brochettes du Grand Marché'),(2,'Chez Sory le Griot'),(2,'Maquis du Carrefour'),(2,'Le Feu de Bois'),(2,'Grillades du Soir'),(2,'Chez Mamadou Braise'),(2,'La Braise Dorée'),(2,'Le Capitaine Grillé'),(2,'Brochettes Express'),(2,'Maquis Étoile'),
    (3,'Burger Palace'),(3,'Speed Burger'),(3,'Pizza Corner'),(3,'Le Roi du Shawarma'),(3,'Fast Corner'),(3,'Tacos & Co'),(3,'Burger Station'),(3,'Pizza Express'),(3,'Chicken House'),(3,'Le Sandwich Doré'),(3,'Urban Burger'),(3,'Pizza della Nonna'),(3,'Crispy Chicken Express'),(3,'Snack 224'),(3,'Le Kebab du Centre'),
    (4,'Petit Matin'),(4,'Le Pain Chaud'),(4,'Café de la Gare'),(4,'Chez Néné Déjeuner'),(4,'Les Beignets de Maman'),(4,'La Boulangerie Centrale'),(4,'Café Bonjour'),(4,'Le Croissant Doré'),(4,'Omelette Express'),(4,'Chez Fatoumata Petit-Déj'),(4,'La Bouillie Dorée'),(4,'Le Coin du Matin'),(4,'Pain & Café'),(4,'Les Crêpes Gourmandes'),(4,'Aube Gourmande')),
  num as (select cat, nom, row_number() over (order by cat, nom) as i from noms)
  select gen_random_uuid() as id, num.i, num.cat, num.nom, z.quartier_id, z.region, z.libelle as adresse,
         z.lat + (random() - 0.5) * (case when z.region = 'Conakry' then 0.004 else 0.01 end) as lat,
         z.lng + (random() - 0.5) * (case when z.region = 'Conakry' then 0.004 else 0.01 end) as lng,
         8000 + 1000 * (num.i % 5) as frais,
         case z.region when 'Labé' then 'fouta' when 'Mamou' then 'fouta' when 'Kankan' then 'haute' when 'Faranah' then 'haute' when 'Kindia' then 'basse' when 'Boké' then 'basse' when 'N''Zérékoré' then 'foret' end as groupe,
         -- Popularité : les restaurants de Conakry occupent les premiers rangs (ordre fixe), ceux des régions les derniers.
         row_number() over (order by (z.region <> 'Conakry'), hashtext(num.nom)) as rang
  from num
    join t_slots s on s.s = 1 + (num.i * 7) % 60
    join t_zones z on z.z = s.z;

  insert into public.restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, accepte_commandes, publie, donnees_demo, demo_lot,
                                  latitude, longitude, delai_preparation_minutes, moyens_paiement, mode_vente, livraison_mode, accepte_sur_place, cree_le)
  select id, nom, cats[cat], quartier_id,
         (array['Tous les jours, 11h-23h','Lundi au samedi, 10h-22h','Tous les jours, 12h-00h','Tous les jours, 7h-15h','Tous les jours, 18h-02h'])[case when cat = 4 then 4 when i % 5 = 0 then 3 else 1 + i % 3 end],
         true, true, true, true, v_lot, lat, lng,
         15 + (i * 3) % 26,
         case i % 4 when 0 then array['especes','orange_money'] when 1 then array['especes','orange_money','mtn_momo'] when 2 then array['especes'] else array['orange_money','mtn_momo'] end,
         'autonome',
         case when i % 10 < 4 then 'speedfood' else 'propre' end,
         false,
         now() - ((60 + (i * 11) % 200) || ' days')::interval
  from t_resto;

  -- Chaque restaurant livre dans sa commune (sans zone déclarée, un restaurant ne propose que le retrait).
  insert into public.restaurant_zones_desservies (restaurant_id, commune_id, frais_gnf, delai_minutes)
  select r.id, n.commune_id, r.frais, 25 + (r.i * 3) % 25
  from t_resto r join public.neighborhoods n on n.id = r.quartier_id;

  -- ------------------------------------------------------------------ plats (16 à 26 par restaurant, tirés d'un catalogue de 212 plats)
  -- Chaque restaurant a un menu différent : tirage aléatoire dans le catalogue de sa catégorie (au moins 2 plats par rubrique),
  -- plats régionaux pour les restaurants des régions, niveau de prix propre à chaque restaurant, et options sur une partie des plats.
  create temp table t_catalogue (cat int, pos int, section text, nom text, description text, prix int, reg text) on commit drop;
  insert into t_catalogue values
    (1,1,'Entrées','Salade de tomates et oignons','Tomates fraîches, oignons rouges, huile et citron.',8000,null),
    (1,1,'Entrées','Salade d''avocat','Avocat mûr, tomate, oignon, vinaigrette maison.',12000,null),
    (1,1,'Entrées','Beignets de poisson (5)','Cinq beignets de poisson épicés, sauce piment.',12000,null),
    (1,1,'Entrées','Soupe de poisson','Bouillon de poisson aux légumes et au piment doux.',15000,null),
    (1,1,'Entrées','Salade de concombre à la menthe','Concombre frais, menthe, citron vert.',9000,null),
    (1,1,'Entrées','Fataya au poisson (3)','Trois chaussons farcis au poisson épicé.',12000,null),
    (1,2,'Plats','Riz sauce feuilles de patate','Riz blanc, sauce de feuilles de patate douce mijotée au poisson fumé.',35000,null),
    (1,2,'Plats','Riz gras au poulet','Riz cuit dans la sauce tomate épicée, poulet rôti et légumes.',45000,null),
    (1,2,'Plats','Riz sauce arachide','Sauce d''arachide onctueuse, viande de bœuf tendre.',38000,null),
    (1,2,'Plats','Riz sauce gombo','Gombo frais, poisson fumé et huile de palme rouge.',36000,null),
    (1,2,'Plats','Riz sauce kansiyé','Sauce kansiyé aux épices du terroir, viande de bœuf.',42000,null),
    (1,2,'Plats','Riz au poisson','Riz au poisson entier, carottes, chou et aubergine.',50000,null),
    (1,2,'Plats','Mafé de bœuf','Bœuf mijoté dans une sauce d''arachide, servi avec du riz.',48000,null),
    (1,2,'Plats','Sauce pistache','Sauce à la pâte de pistache, poulet et riz blanc.',40000,null),
    (1,2,'Plats','Foutou sauce graine','Foutou de banane plantain, sauce graine de palme.',45000,null),
    (1,2,'Plats','Attiéké poisson','Attiéké frais, poisson braisé, oignons et piment.',40000,null),
    (1,2,'Plats','Riz sauce aubergine','Aubergines mijotées au poisson fumé, riz blanc.',34000,null),
    (1,2,'Plats','Riz haricots','Haricots rouges mijotés à l''huile, riz blanc.',28000,null),
    (1,2,'Plats','Riz sauce feuilles de manioc','Feuilles de manioc pilées, viande et poisson fumé.',37000,null),
    (1,2,'Plats','Riz yassa au poulet','Poulet mariné aux oignons et au citron, riz blanc.',46000,null),
    (1,2,'Plats','Riz sauce tomate au poisson fumé','Sauce tomate relevée, poisson fumé, riz blanc.',36000,null),
    (1,2,'Plats','Couscous de mil sauce légumes','Couscous de mil, sauce de légumes frais et viande.',32000,null),
    (1,2,'Plats','Riz sauce poulet et légumes','Poulet mijoté aux carottes, pommes de terre et haricots verts.',42000,null),
    (1,2,'Plats','Tô de maïs sauce gombo','Pâte de maïs ferme, sauce gombo au poisson fumé.',30000,null),
    (1,2,'Plats','Pâtes sauce bœuf','Spaghetti, sauce tomate et bœuf haché.',30000,null),
    (1,2,'Plats','Riz sauce légumes et viande','Riz blanc, sauce de légumes variés et morceaux de bœuf.',38000,null),
    (1,3,'Spécialités','Poisson capitaine sauce citron','Capitaine entier, sauce citron-oignon, accompagnement au choix.',70000,null),
    (1,3,'Spécialités','Agneau mijoté aux oignons','Épaule d''agneau confite aux oignons, riz parfumé.',65000,null),
    (1,3,'Spécialités','Ragoût de chèvre','Chèvre mijotée aux épices, pommes de terre et carottes.',68000,null),
    (1,3,'Spécialités','Tripes sauce tomate','Tripes nettoyées, longuement mijotées en sauce tomate.',40000,null),
    (1,3,'Spécialités','Pintade mijotée','Pintade fermière mijotée aux légumes.',60000,null),
    (1,3,'Spécialités','Poulet fermier sauce arachide','Poulet fermier, sauce d''arachide, riz blanc.',55000,null),
    (1,3,'Spécialités','Capitaine fumé en sauce','Capitaine fumé mijoté, sauce pimentée et riz.',65000,null),
    (1,3,'Spécialités','Plat du chef','Assiette généreuse, composée du jour par le chef.',60000,null),
    (1,3,'Spécialités','Fonio sauce gombo','Fonio cuit à la vapeur, sauce gombo et viande.',32000,'fouta'),
    (1,3,'Spécialités','Poulet du Fouta aux oignons','Poulet mijoté aux oignons et au piment, façon Fouta.',55000,'fouta'),
    (1,3,'Spécialités','Haricots à l''huile rouge','Haricots mijotés à l''huile de palme rouge, riz blanc.',28000,'fouta'),
    (1,3,'Spécialités','Tô de mil sauce kansiyé','Pâte de mil, sauce kansiyé parfumée.',34000,'haute'),
    (1,3,'Spécialités','Riz gras de la Haute-Guinée','Riz gras mijoté, poulet et légumes de saison.',45000,'haute'),
    (1,3,'Spécialités','Riz sauce gombo séché','Gombo séché, viande de bœuf, riz blanc.',33000,'haute'),
    (1,3,'Spécialités','Riz au poisson fumé et huile de palme','Riz mijoté au poisson fumé et à l''huile de palme.',45000,'basse'),
    (1,3,'Spécialités','Crevettes sautées au piment','Crevettes sautées à l''ail et au piment, riz blanc.',60000,'basse'),
    (1,3,'Spécialités','Manioc pilé sauce graine','Manioc pilé, sauce graine au poulet fumé.',42000,'foret'),
    (1,3,'Spécialités','Ignames sauce poisson','Ignames bouillies, sauce de poisson aux épices.',38000,'foret'),
    (1,3,'Spécialités','Sauce graine au poulet fumé','Sauce de graines de palme, poulet fumé, riz blanc.',45000,'foret'),
    (1,4,'Accompagnements','Banane plantain frite','Plantain mûr frit, doré et croustillant.',12000,null),
    (1,4,'Accompagnements','Salade composée','Tomate, concombre, oignon et vinaigrette maison.',10000,null),
    (1,4,'Accompagnements','Riz blanc','Portion de riz blanc cuit à la vapeur.',8000,null),
    (1,4,'Accompagnements','Attiéké','Semoule de manioc fine.',12000,null),
    (1,4,'Accompagnements','Alloco','Banane plantain frite à l''oignon et au piment.',14000,null),
    (1,4,'Accompagnements','Haricots rouges','Haricots rouges mijotés à l''huile.',10000,null),
    (1,4,'Accompagnements','Frites d''igname','Igname fraîche frite à la commande.',14000,null),
    (1,5,'Desserts','Salade de fruits','Fruits frais de saison, sucre de canne.',12000,null),
    (1,5,'Desserts','Beignets sucrés (5)','Cinq beignets dorés, sucrés à la commande.',10000,null),
    (1,5,'Desserts','Gâteau de maïs','Gâteau moelleux à la farine de maïs.',8000,null),
    (1,5,'Desserts','Riz au lait','Riz au lait crémeux, cannelle.',10000,null),
    (1,5,'Desserts','Banane caramélisée','Banane mûre poêlée au caramel.',10000,null),
    (1,5,'Desserts','Mangue fraîche','Mangue mûre coupée en lamelles.',8000,null),
    (1,5,'Desserts','Bouillie de fonio au lait','Fonio cuit dans du lait sucré.',10000,'fouta'),
    (1,6,'Boissons','Jus de bissap','Fleurs d''hibiscus infusées, servi bien frais.',8000,null),
    (1,6,'Boissons','Jus de gingembre','Gingembre frais pressé, citron et menthe.',8000,null),
    (1,6,'Boissons','Eau minérale','Bouteille de 1,5 litre.',5000,null),
    (1,6,'Boissons','Jus de baobab','Pulpe de fruit de baobab, lait et sucre.',9000,null),
    (1,6,'Boissons','Jus de citron','Citron pressé, sucre de canne.',8000,null),
    (1,6,'Boissons','Coca-Cola','Bouteille de 50 cl.',8000,null),
    (1,6,'Boissons','Jus d''ananas','Pressé du jour, sans sucre ajouté.',9000,null),
    (1,6,'Boissons','Lait caillé','Lait caillé frais, légèrement sucré.',9000,null),
    (2,1,'Grillades','Poulet braisé entier','Poulet entier mariné et braisé au feu de bois.',120000,null),
    (2,1,'Grillades','Demi-poulet braisé','Demi-poulet mariné, braisé, avec oignons grillés.',65000,null),
    (2,1,'Grillades','Côtelettes d''agneau','Côtelettes marinées, grillées à point.',80000,null),
    (2,1,'Grillades','Poulet yassa','Poulet mariné aux oignons et au citron, riz blanc.',55000,null),
    (2,1,'Grillades','Merguez grillées','Merguez maison, frites et sauce piquante.',35000,null),
    (2,1,'Grillades','Cuisse de poulet braisée','Grosse cuisse de poulet braisée, sauce pimentée.',30000,null),
    (2,1,'Grillades','Gigot de mouton braisé','Gigot mariné et braisé lentement.',95000,null),
    (2,1,'Grillades','Foie grillé','Foie de bœuf grillé aux oignons.',32000,null),
    (2,1,'Grillades','Côte de bœuf grillée','Côte de bœuf épaisse, grillée au feu de bois.',85000,null),
    (2,1,'Grillades','Ailes de poulet épicées (8)','Huit ailes marinées aux épices, grillées.',38000,null),
    (2,1,'Grillades','Poulet fumé','Poulet fumé au bois, peau croustillante.',70000,null),
    (2,1,'Grillades','Brochettes de mouton du Fouta','Mouton mariné, grillé façon Fouta, oignons crus.',48000,'fouta'),
    (2,1,'Grillades','Méchoui de mouton (part)','Part de méchoui, rôti lentement.',75000,'haute'),
    (2,1,'Grillades','Poulet braisé sauce graine','Poulet braisé nappé de sauce graine.',60000,'foret'),
    (2,2,'Poissons & fruits de mer','Poisson braisé','Capitaine braisé entier, sauce tomate-oignon.',75000,null),
    (2,2,'Poissons & fruits de mer','Capitaine braisé','Gros capitaine braisé, citron et piment.',90000,null),
    (2,2,'Poissons & fruits de mer','Dorade grillée','Dorade entière grillée, herbes et citron.',80000,null),
    (2,2,'Poissons & fruits de mer','Crevettes grillées','Crevettes marinées à l''ail, grillées.',85000,null),
    (2,2,'Poissons & fruits de mer','Calamars frits','Anneaux de calamars croustillants, sauce tartare.',60000,null),
    (2,2,'Poissons & fruits de mer','Thon grillé','Pavé de thon grillé, sauce citron.',70000,null),
    (2,2,'Poissons & fruits de mer','Sole grillée','Sole entière grillée au beurre.',75000,null),
    (2,2,'Poissons & fruits de mer','Poisson au four sauce tomate','Poisson cuit au four sur lit de tomates et d''oignons.',70000,null),
    (2,2,'Poissons & fruits de mer','Poisson fumé de Boké braisé','Poisson fumé puis braisé, sauce piquante.',65000,'basse'),
    (2,3,'Brochettes','Brochettes de bœuf (5)','Cinq brochettes de bœuf marinées, sauce pimentée.',40000,null),
    (2,3,'Brochettes','Brochettes de mouton (5)','Cinq brochettes de mouton, oignons et piment.',45000,null),
    (2,3,'Brochettes','Brochettes de poulet (5)','Cinq brochettes de poulet citronné.',38000,null),
    (2,3,'Brochettes','Brochettes mixtes (6)','Bœuf, poulet et mouton, légumes grillés.',50000,null),
    (2,3,'Brochettes','Brochettes de gésiers (5)','Gésiers marinés, grillés et épicés.',30000,null),
    (2,3,'Brochettes','Brochettes de crevettes (4)','Crevettes marinées au citron vert, grillées.',60000,null),
    (2,4,'Accompagnements','Frites','Pommes de terre fraîches, frites à la commande.',15000,null),
    (2,4,'Accompagnements','Alloco','Banane plantain frite à l''oignon et au piment.',14000,null),
    (2,4,'Accompagnements','Attiéké','Semoule de manioc fine.',12000,null),
    (2,4,'Accompagnements','Riz blanc','Portion de riz blanc cuit à la vapeur.',8000,null),
    (2,4,'Accompagnements','Patate douce frite','Patate douce frite, légèrement sucrée.',14000,null),
    (2,4,'Accompagnements','Légumes grillés','Poivrons, aubergines et courgettes grillés.',15000,null),
    (2,5,'Salades & sauces','Salade verte','Laitue, tomate, concombre, vinaigrette.',10000,null),
    (2,5,'Salades & sauces','Sauce pimentée maison','Pot de sauce piment maison.',5000,null),
    (2,5,'Salades & sauces','Salade d''oignons et tomates','Oignons rouges, tomates, huile d''arachide.',8000,null),
    (2,5,'Salades & sauces','Sauce moutarde','Sauce moutarde-oignon pour les grillades.',5000,null),
    (2,5,'Salades & sauces','Salade de chou','Chou blanc, carotte, mayonnaise légère.',8000,null),
    (2,6,'Desserts','Banane braisée','Banane mûre braisée, miel.',10000,null),
    (2,6,'Desserts','Salade de fruits','Fruits frais de saison, sucre de canne.',12000,null),
    (2,6,'Desserts','Glace deux boules','Deux boules de glace au choix.',12000,null),
    (2,7,'Boissons','Coca-Cola','Bouteille de 50 cl.',8000,null),
    (2,7,'Boissons','Jus d''ananas','Pressé du jour, sans sucre ajouté.',9000,null),
    (2,7,'Boissons','Eau minérale','Bouteille de 1,5 litre.',5000,null),
    (2,7,'Boissons','Jus de bissap','Fleurs d''hibiscus infusées, servi bien frais.',8000,null),
    (2,7,'Boissons','Jus de gingembre','Gingembre frais pressé, citron et menthe.',8000,null),
    (2,7,'Boissons','Boisson sans alcool maltée','Boisson maltée bien fraîche, 33 cl.',10000,null),
    (2,7,'Boissons','Thé glacé','Thé infusé au citron, servi glacé.',8000,null),
    (2,7,'Boissons','Jus de mangue','Mangues mûres mixées, sans sucre ajouté.',9000,null),
    (3,1,'Burgers','Burger classique','Steak haché, cheddar, salade, tomate, sauce maison.',40000,null),
    (3,1,'Burgers','Cheeseburger double','Deux steaks, double cheddar, oignons caramélisés.',55000,null),
    (3,1,'Burgers','Burger poulet croustillant','Filet de poulet pané, salade, sauce piquante.',48000,null),
    (3,1,'Burgers','Burger bacon de bœuf','Steak, bacon de bœuf fumé, cheddar, sauce barbecue.',52000,null),
    (3,1,'Burgers','Burger végétarien','Galette de légumes, salade, tomate, sauce yaourt.',38000,null),
    (3,1,'Burgers','Burger épicé','Steak, piment, jalapeños, sauce relevée.',50000,null),
    (3,1,'Burgers','Mini burgers (3)','Trois petits burgers, sauce au choix.',45000,null),
    (3,1,'Burgers','Burger poisson','Filet de poisson pané, salade, sauce tartare.',45000,null),
    (3,2,'Pizzas','Pizza margherita','Tomate, mozzarella, basilic.',60000,null),
    (3,2,'Pizzas','Pizza reine','Tomate, mozzarella, jambon de dinde, champignons.',75000,null),
    (3,2,'Pizzas','Pizza quatre fromages','Mozzarella, chèvre, bleu et emmental.',85000,null),
    (3,2,'Pizzas','Pizza poulet','Poulet mariné, poivrons, oignons, mozzarella.',80000,null),
    (3,2,'Pizzas','Pizza végétarienne','Poivrons, champignons, olives, oignons, mozzarella.',70000,null),
    (3,2,'Pizzas','Pizza orientale','Merguez, poivrons, oignons, mozzarella.',82000,null),
    (3,2,'Pizzas','Pizza thon','Thon, oignons, olives, mozzarella.',78000,null),
    (3,2,'Pizzas','Calzone','Pizza pliée, jambon de dinde, mozzarella, champignons.',75000,null),
    (3,3,'Sandwichs & wraps','Sandwich poulet','Pain frais, poulet grillé, crudités, mayonnaise.',30000,null),
    (3,3,'Sandwichs & wraps','Shawarma poulet','Poulet mariné, sauce à l''ail, pickles, galette chaude.',35000,null),
    (3,3,'Sandwichs & wraps','Shawarma bœuf','Bœuf mariné, sauce tahini, pickles, galette chaude.',38000,null),
    (3,3,'Sandwichs & wraps','Tacos viande hachée','Galette garnie, viande hachée, frites et fromage fondu.',38000,null),
    (3,3,'Sandwichs & wraps','Tacos poulet','Galette garnie, poulet mariné, frites et sauce fromagère.',38000,null),
    (3,3,'Sandwichs & wraps','Wrap poulet crudités','Galette de blé, poulet, crudités, sauce yaourt.',32000,null),
    (3,3,'Sandwichs & wraps','Panini dinde fromage','Panini grillé, dinde fumée, fromage fondu.',30000,null),
    (3,3,'Sandwichs & wraps','Sandwich thon','Pain frais, thon, tomate, œuf dur, mayonnaise.',28000,null),
    (3,3,'Sandwichs & wraps','Sandwich américain','Steak, frites, fromage, sauce au choix, dans un pain chaud.',42000,null),
    (3,3,'Sandwichs & wraps','Kebab','Viande de kebab, salade, oignons, sauce blanche.',36000,null),
    (3,4,'Poulet & snacks','Nuggets de poulet (8)','Huit nuggets dorés et sauce au choix.',30000,null),
    (3,4,'Poulet & snacks','Ailes croustillantes (6)','Six ailes de poulet panées et épicées.',32000,null),
    (3,4,'Poulet & snacks','Poulet frit (2 pièces)','Deux morceaux de poulet frit croustillant.',40000,null),
    (3,4,'Poulet & snacks','Samoussas (4)','Quatre samoussas à la viande, sauce piment.',15000,null),
    (3,4,'Poulet & snacks','Falafels (6)','Six falafels, sauce sésame.',20000,null),
    (3,4,'Poulet & snacks','Onion rings','Rondelles d''oignon panées et dorées.',15000,null),
    (3,4,'Poulet & snacks','Poulet pané','Escalope de poulet panée, sauce au choix.',38000,null),
    (3,4,'Poulet & snacks','Hot-dog','Saucisse de volaille, pain moelleux, oignons frits.',25000,null),
    (3,5,'Accompagnements','Frites','Portion de frites croustillantes.',15000,null),
    (3,5,'Accompagnements','Potatoes','Quartiers de pommes de terre épicés.',17000,null),
    (3,5,'Accompagnements','Salade coleslaw','Chou et carotte, sauce crémeuse.',10000,null),
    (3,5,'Accompagnements','Riz parfumé','Riz parfumé aux épices douces.',10000,null),
    (3,5,'Accompagnements','Frites cheddar','Frites nappées de cheddar fondu.',22000,null),
    (3,6,'Desserts','Glace vanille','Trois boules de glace à la vanille.',12000,null),
    (3,6,'Desserts','Brownie','Brownie fondant au chocolat.',15000,null),
    (3,6,'Desserts','Cookie','Gros cookie aux pépites de chocolat.',8000,null),
    (3,6,'Desserts','Crêpe au chocolat','Crêpe fine nappée de chocolat.',18000,null),
    (3,6,'Desserts','Beignet fourré','Beignet moelleux fourré à la crème.',10000,null),
    (3,7,'Boissons','Milkshake vanille','Glace vanille, lait frais, chantilly.',20000,null),
    (3,7,'Boissons','Coca-Cola','Bouteille de 50 cl.',8000,null),
    (3,7,'Boissons','Jus d''orange','Orange pressée, sans sucre ajouté.',9000,null),
    (3,7,'Boissons','Milkshake chocolat','Glace chocolat, lait frais, copeaux.',20000,null),
    (3,7,'Boissons','Limonade','Limonade maison, citron et menthe.',8000,null),
    (3,7,'Boissons','Eau minérale','Bouteille de 1,5 litre.',5000,null),
    (3,7,'Boissons','Jus de bissap','Fleurs d''hibiscus infusées, servi bien frais.',8000,null),
    (3,7,'Boissons','Café glacé','Café noir glacé, lait et sirop vanille.',15000,null),
    (4,1,'Plats chauds','Omelette pain beurre','Omelette de trois œufs, pain frais et beurre.',15000,null),
    (4,1,'Plats chauds','Pain chaud œufs','Pain chaud garni d''œufs brouillés et d''oignons.',12000,null),
    (4,1,'Plats chauds','Fataya (3)','Trois chaussons farcis au poisson épicé.',12000,null),
    (4,1,'Plats chauds','Bouillie de mil','Bouillie de mil sucrée, lait et vanille.',8000,null),
    (4,1,'Plats chauds','Bouillie de riz au lait','Riz au lait crémeux, cannelle.',10000,null),
    (4,1,'Plats chauds','Haricots et pain','Haricots rouges à l''huile, pain chaud.',12000,null),
    (4,1,'Plats chauds','Œufs au plat et saucisse','Deux œufs au plat, saucisse de volaille, pain.',18000,null),
    (4,1,'Plats chauds','Foie sauté et pain','Foie de bœuf sauté aux oignons, pain chaud.',15000,null),
    (4,1,'Plats chauds','Pain sardine','Pain chaud garni de sardines, oignons et piment.',12000,null),
    (4,1,'Plats chauds','Spaghetti omelette','Spaghetti sautés, omelette et sauce tomate.',14000,null),
    (4,1,'Plats chauds','Bouillie de maïs','Bouillie de maïs douce, lait et sucre.',8000,null),
    (4,1,'Plats chauds','Bouillie de fonio','Bouillie de fonio, lait et sucre de canne.',10000,'fouta'),
    (4,2,'Pains & viennoiseries','Pain au chocolat','Viennoiserie du matin, fourrée au chocolat.',8000,null),
    (4,2,'Pains & viennoiseries','Croissant','Croissant pur beurre, doré et feuilleté.',8000,null),
    (4,2,'Pains & viennoiseries','Baguette beurre et confiture','Demi-baguette fraîche, beurre, confiture.',6000,null),
    (4,2,'Pains & viennoiseries','Pain au lait','Pain moelleux au lait, légèrement sucré.',6000,null),
    (4,2,'Pains & viennoiseries','Brioche','Brioche moelleuse, dorée au four.',8000,null),
    (4,2,'Pains & viennoiseries','Pain complet','Pain complet croustillant.',6000,null),
    (4,2,'Pains & viennoiseries','Petit pain fourré au poulet','Petit pain chaud garni de poulet et de sauce.',12000,null),
    (4,2,'Pains & viennoiseries','Pain aux raisins','Viennoiserie spirale, crème et raisins.',8000,null),
    (4,3,'Douceurs','Beignets (5)','Cinq beignets dorés, sucrés à la commande.',10000,null),
    (4,3,'Douceurs','Crêpes (3)','Trois crêpes, miel ou chocolat.',15000,null),
    (4,3,'Douceurs','Gaufre','Gaufre chaude, sucre glace.',15000,null),
    (4,3,'Douceurs','Gâteau nature','Part de gâteau moelleux.',8000,null),
    (4,3,'Douceurs','Crêpe au miel','Crêpe nappée de miel local.',12000,null),
    (4,3,'Douceurs','Pancakes (3)','Trois pancakes, sirop sucré.',15000,null),
    (4,4,'Boissons chaudes','Café au lait','Café noir allongé de lait chaud.',10000,null),
    (4,4,'Boissons chaudes','Thé à la menthe','Thé vert infusé à la menthe fraîche.',5000,null),
    (4,4,'Boissons chaudes','Café noir','Café noir corsé.',6000,null),
    (4,4,'Boissons chaudes','Chocolat chaud','Chocolat chaud onctueux.',10000,null),
    (4,4,'Boissons chaudes','Thé au lait','Thé noir, lait chaud et sucre.',7000,null),
    (4,4,'Boissons chaudes','Lait chaud sucré','Lait chaud légèrement sucré.',6000,null),
    (4,5,'Boissons fraîches','Jus de bissap','Fleurs d''hibiscus infusées, servi bien frais.',8000,null),
    (4,5,'Boissons fraîches','Yaourt nature','Yaourt frais, pot individuel.',7000,null),
    (4,5,'Boissons fraîches','Jus d''orange','Orange pressée, sans sucre ajouté.',9000,null),
    (4,5,'Boissons fraîches','Jus de gingembre','Gingembre frais pressé, citron et menthe.',8000,null),
    (4,5,'Boissons fraîches','Lait caillé','Lait caillé frais, légèrement sucré.',9000,null),
    (4,5,'Boissons fraîches','Smoothie banane','Banane, lait et miel mixés.',12000,null),
    (4,5,'Boissons fraîches','Eau minérale','Bouteille de 1,5 litre.',5000,null),
    (4,6,'Formules','Formule petit-déjeuner classique','Café, pain, beurre et œufs.',25000,null),
    (4,6,'Formules','Formule gourmande','Omelette, viennoiserie et jus pressé.',32000,null),
    (4,6,'Formules','Formule traditionnelle','Bouillie, beignets et boisson chaude.',18000,null);

  create temp table t_plats on commit drop as
  with pool as (
    select r.id as resto_id, r.i, r.region, c.pos, c.section, c.nom, c.description, c.prix, c.reg,
           row_number() over (partition by r.id, c.section order by random()) as rang_section,
           random() as alea
    from t_resto r join t_catalogue c on c.cat = r.cat and (c.reg is null or c.reg = r.groupe)),
  classe as (
    select pool.*, row_number() over (partition by resto_id order by (reg is null and rang_section > 2), alea) as rang from pool)
  select gen_random_uuid() as id, resto_id, i, pos, section, nom, description,
         greatest(1000, (round(prix * (0.85 + ((i * 37) % 36) / 100.0) * (case when region = 'Conakry' then 1.0 else 0.92 end) * (0.95 + random() * 0.10) / 500.0) * 500))::int as prix
  from classe where rang <= 16 + (i * 5) % 11;

  insert into public.menu_sections (restaurant_id, nom, position)
  select distinct resto_id, section, pos from t_plats;

  insert into public.menu_items (id, restaurant_id, nom, description, prix, disponible, disponibilite_confirmee_le, section_id, cree_le)
  select p.id, p.resto_id, p.nom, p.description, p.prix,
         (random() > 0.04), now() - (random() * interval '40 minutes'),
         (select s.id from public.menu_sections s where s.restaurant_id = p.resto_id and s.nom = p.section),
         now() - interval '30 days'
  from t_plats p;

  -- Options (suppléments) sur environ trois plats sur quatre des rubriques concernées.
  insert into public.menu_item_options (menu_item_id, nom, prix)
  select p.id, o.nom, o.prix
  from t_plats p join (values
    ('Burgers', 'Fromage supplémentaire', 5000), ('Burgers', 'Bacon de bœuf', 8000), ('Burgers', 'Menu frites et boisson', 18000),
    ('Pizzas', 'Taille familiale', 30000), ('Pizzas', 'Fromage double', 10000),
    ('Plats', 'Portion de viande en plus', 12000), ('Plats', 'Œuf dur', 3000),
    ('Grillades', 'Portion de frites', 15000), ('Grillades', 'Piment maison', 2000),
    ('Brochettes', 'Brochettes supplémentaires (2)', 15000),
    ('Sandwichs & wraps', 'Fromage', 5000), ('Sandwichs & wraps', 'Frites', 15000),
    ('Plats chauds', 'Pain supplémentaire', 2000), ('Formules', 'Boisson en plus', 8000)
  ) o (section, nom, prix) on o.section = p.section
  where (hashtext(p.id::text || o.nom) & 3) <> 0;

  -- ------------------------------------------------------------------ livreurs
  create temp table t_livreurs on commit drop as
  with prenoms(p) as (values ('Mamadou'),('Ibrahima'),('Sékou'),('Alpha'),('Mohamed'),('Boubacar'),('Ousmane'),('Thierno'),('Lansana'),('Facinet'),('Moussa'),('Abdoulaye')),
       noms(n) as (values ('Diallo'),('Camara'),('Bah'),('Sylla'),('Barry'),('Condé'),('Soumah'),('Keïta'),('Touré'),('Sow'),('Traoré'),('Bangoura'))
  select gen_random_uuid() as id, g,
         (select p from prenoms offset (g * 5) % 12 limit 1) || ' ' || (select n from noms offset (g * 7 + g / 12) % 12 limit 1) as nom,
         z.region, z.lat, z.lng
  from generate_series(1, n_livreurs) g
    join t_lslots s on s.s = g
    join t_zones z on z.z = s.z;

  insert into public.livreurs (id, nom, telephone, vehicule, statut, latitude, longitude, position_le, simule, donnees_demo, demo_lot, cycle, approuve_le, verifie_speedfood, derniere_course_le, cree_le)
  select l.id, l.nom, '+22460000' || lpad((1000 + l.g * 13)::text, 4, '0'),
         case when l.g % 8 = 0 then 'velo' when l.g % 11 = 0 then 'voiture' else 'moto' end,
         case when l.g % 3 = 0 then 'hors_ligne' else 'disponible' end,
         case when l.g % 3 = 0 then null else l.lat + (random() - 0.5) * 0.006 end,
         case when l.g % 3 = 0 then null else l.lng + (random() - 0.5) * 0.006 end,
         case when l.g % 3 = 0 then null else now() end,
         true, true, v_lot, 'actif', now() - interval '40 days', true, now() - (random() * interval '2 days'), now() - interval '60 days'
  from t_livreurs l;

  -- ------------------------------------------------------------------ commandes d'historique (90 jours)
  create temp table t_cmd on commit drop as
  with base as (
    select g, gen_random_uuid() as id,
           -- 86 % des commandes à Conakry (rangs 1 à 37), le reste dans les régions (rangs 38 à 60), popularité décroissante dans chaque groupe.
           case when random() < 0.86 then 1 + least(36, floor(37 * power(random(), 1.5))::int)
                else 38 + least(22, floor(23 * power(random(), 1.3))::int) end as k,
           random() as r_mode, random() as r_statut, random() as r_heure, random() as r_jour
    from generate_series(1, n_hist) g)
  select b.g, b.id, r.id as resto_id, r.lat, r.lng, r.adresse, r.frais, b.r_mode, b.r_statut, b.r_heure, b.r_jour,
         date_trunc('day', now() - interval '35 minutes' - (b.r_jour * interval '90 days'))
           + (case when b.r_heure < 0.35 then 12 + floor(random() * 3) when b.r_heure < 0.75 then 19 + floor(random() * 4) else 8 + floor(random() * 14) end) * interval '1 hour'
           + floor(random() * 60) * interval '1 minute' as cree_le
  from base b join t_resto r on r.rang = b.k;
  -- Pas de commande dans le futur (jour courant, heures pas encore arrivées).
  update t_cmd set cree_le = cree_le - interval '1 day' where cree_le > now() - interval '35 minutes';

  create temp table t_lignes on commit drop as
  select c.id as order_id, c.g, p.id as menu_item_id, p.nom, p.prix, (1 + floor(random() * 3))::int as quantite
  from t_cmd c
  cross join lateral (select p.* from t_plats p where p.resto_id = c.resto_id order by random() limit (1 + floor(random() * 4))::int) p;

  insert into public.orders (id, reference, jeton_suivi, restaurant_id, client_nom, client_telephone, client_adresse, mode, sous_total, frais_livraison_estime, statut,
                             paiement_statut, est_test, livraison_latitude, livraison_longitude, livraison_distance_m, cree_le, mis_a_jour_le)
  select c.id,
         -- Référence de 5 caractères, même alphabet que les vraies, unique par construction (g ↦ nombre premier avec 2^25).
         'SF-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + ((((c.g * 7919 + 12345) % 33554432) >> (5 * k)) & 31), 1), '' order by k desc)
                   from generate_series(0, 4) k),
         'dem' || replace(c.id::text, '-', ''),
         c.resto_id,
         (array['Aminata','Fatoumata','Mariama','Kadiatou','Hawa','Aïssatou','Ibrahima','Mamadou','Sékou','Alpha','Boubacar','Ousmane','Mohamed','Lansana','Oumou','Nènè'])[1 + c.g % 16]
           || ' ' || (array['Diallo','Camara','Bah','Sylla','Barry','Condé','Soumah','Keïta','Touré','Sow','Traoré','Bangoura'])[1 + (c.g / 16) % 12],
         '+22460' || lpad((10000 + c.g * 7)::text, 5, '0'),
         case when c.r_mode < 0.65 then c.adresse end,
         case when c.r_mode < 0.65 then 'livraison' else 'retrait' end,
         (select sum(l.prix * l.quantite) from t_lignes l where l.order_id = c.id),
         case when c.r_mode < 0.65 then c.frais else 0 end,
         case when c.r_statut < 0.90 then 'terminee' when c.r_statut < 0.96 then 'annulee' else 'refusee' end,
         'non_demande', false,
         case when c.r_mode < 0.65 then c.lat + (random() - 0.5) * 0.016 end,
         case when c.r_mode < 0.65 then c.lng + (random() - 0.5) * 0.016 end,
         case when c.r_mode < 0.65 then 1200 + (c.g * 37) % 6800 end,
         c.cree_le, c.cree_le + interval '45 minutes'
  from t_cmd c;

  insert into public.order_items (order_id, menu_item_id, nom, prix, quantite)
  select order_id, menu_item_id, nom, prix, quantite from t_lignes;

  -- Livraisons terminées des commandes livrées.
  insert into public.livraisons (order_id, restaurant_id, mode, statut, livreur_id, depart_latitude, depart_longitude, arrivee_latitude, arrivee_longitude, distance_m, frais_gnf,
                                 assignee_le, recuperee_le, livree_le, cree_le, mis_a_jour_le)
  select o.id, o.restaurant_id, r.livraison_mode, 'livree',
         -- Livreur de la même région que le restaurant.
         case when r.livraison_mode = 'speedfood' then (select l.id from t_livreurs l where l.region = tr.region order by hashtext(o.id::text || l.g::text) limit 1) end,
         r.latitude, r.longitude, o.livraison_latitude, o.livraison_longitude, o.livraison_distance_m, o.frais_livraison_estime,
         o.cree_le + interval '8 minutes', o.cree_le + interval '28 minutes', o.cree_le + interval '45 minutes', o.cree_le, o.cree_le + interval '45 minutes'
  from public.orders o join public.restaurants r on r.id = o.restaurant_id join t_resto tr on tr.id = r.id
  where r.demo_lot = v_lot and o.mode = 'livraison' and o.statut = 'terminee';

  -- ------------------------------------------------------------------ avis (≈ les deux tiers des commandes terminées)
  insert into public.avis (order_id, cible, auteur, restaurant_id, note, commentaire, prenom_affiche, est_test, cree_le, modifie_le)
  with src as (
    select o.id, o.restaurant_id, o.client_nom, o.cree_le, random() as x
    from public.orders o join public.restaurants r on r.id = o.restaurant_id
    where r.demo_lot = v_lot and o.statut = 'terminee' and random() < 0.74),
  notes as (
    select s.*, case when x < 0.50 then 5 when x < 0.80 then 4 when x < 0.92 then 3 when x < 0.97 then 2 else 1 end as note from src s)
  select o.id, 'restaurant', 'client', o.restaurant_id, o.note,
         case when random() < 0.6 then
           (case o.note
              when 5 then (array['Excellent, livré chaud et dans les temps.','Un régal, je recommande sans hésiter.','Très bon, portions généreuses.','Le meilleur du quartier, merci !','Rapide et délicieux.'])[1 + floor(random() * 5)::int]
              when 4 then (array['Très bon dans l''ensemble.','Bon plat, un peu d''attente.','Je recommande.','Bien servi, bon rapport qualité-prix.'])[1 + floor(random() * 4)::int]
              when 3 then (array['Correct, sans plus.','Bon goût mais livraison un peu longue.','Moyen, peut mieux faire.'])[1 + floor(random() * 3)::int]
              when 2 then (array['Plat tiède à l''arrivée.','Déçu par la quantité.','Trop d''attente.'])[1 + floor(random() * 3)::int]
              else (array['Commande incomplète.','Très déçu, je ne recommande pas.'])[1 + floor(random() * 2)::int] end)
         end,
         split_part(o.client_nom, ' ', 1), false,
         o.cree_le + interval '1 hour' + random() * interval '20 hours',
         o.cree_le + interval '1 hour' + random() * interval '20 hours'
  from notes o;

  -- Réponses du restaurant à une partie des avis écrits.
  update public.avis a
  set reponse_texte = (array['Merci pour votre confiance, à bientôt !','Merci pour votre retour, nous faisons le maximum.','Nous sommes désolés, nous allons faire mieux.'])[1 + floor(random() * 3)::int],
      reponse_le = a.cree_le + interval '3 hours'
  where a.commentaire is not null and a.restaurant_id in (select id from public.restaurants where demo_lot = v_lot) and random() < 0.2;
end
$demo$;
