-- Chargement du contenu de démonstration (lot « presentation-2026-11 »), à exécuter UNE fois, dans une transaction.
-- Tout est fictif : noms, numéros (préfixe 60000 réservé à la démonstration), adresses. Les restaurants portent `donnees_demo` et
-- `demo_lot` ; fn_demo_visibilite / fn_demo_supprimer (migration 20261123090000) les masquent ou les suppriment.
-- Échelle « moyenne » : 60 restaurants, ~2 200 articles (menus de 30 à 50 articles, tous différents, 11 cuisines), 3 000 commandes d'historique sur 90 jours, ~2 000 avis, 40 livreurs.
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
  -- Chaque restaurant reçoit un profil de cuisine tiré au sort (graine fixe), avec des poids différents à Conakry et dans les régions :
  --   guineen  : cuisine guinéenne seule (une partie en maison de grillades), africain : cuisine d'Afrique hors Guinée, afro : guinéen + africain,
  --   mixte    : guinéen + une cuisine du monde, monde : une seule cuisine du monde (100 % italien, 100 % indien…), intl : trois cuisines du monde.
  -- Le nom du restaurant est pris dans une liste de noms fictifs (un peu fantaisistes, sans marque réelle) correspondant à sa cuisine ; sa catégorie suit sa première cuisine.
  create temp table t_monde (n int, cuisine text, poids int, cum int) on commit drop;
  insert into t_monde
  select row_number() over (order by ord), cuisine, poids, sum(poids) over (order by ord)
  from (values (1,'americaine',14),(2,'italienne',11),(3,'libanaise',11),(4,'turque',6),(5,'indienne',8),(6,'chinoise',7),(7,'japonaise',6),(8,'francaise',9),(9,'mexicaine',6),
               (10,'grecque',5),(11,'marocaine',7),(12,'thailandaise',5),(13,'antillaise',3),(14,'roumaine',2)) v(ord, cuisine, poids);

  -- Catégorie de chaque cuisine (une cuisine du monde = sa propre catégorie ; plusieurs cuisines différentes = « Cuisine du monde »),
  -- et catégorie de repli si la migration des catégories n'est pas encore appliquée.
  create temp table t_cuisine_cat (cuisine text, categorie text) on commit drop;
  insert into t_cuisine_cat values
    ('guineenne','Riz & sauces'),('africaine','Africain'),('libanaise','Libanais et oriental'),('turque','Libanais et oriental'),('italienne','Italien et pizzas'),
    ('indienne','Indien'),('chinoise','Asiatique'),('japonaise','Asiatique'),('thailandaise','Asiatique'),('americaine','Fast-food'),('mexicaine','Mexicain'),
    ('francaise','Français'),('grecque','Méditerranéen'),('marocaine','Maghrébin'),('antillaise','Antillais et créole'),('roumaine','Européen');
  create temp table t_categorie_repli (categorie text, repli text) on commit drop;
  insert into t_categorie_repli values
    ('Africain','Riz & sauces'),('Libanais et oriental','Grillades'),('Italien et pizzas','Fast-food'),('Indien','Riz & sauces'),('Asiatique','Fast-food'),
    ('Mexicain','Fast-food'),('Français','Petit-déjeuner'),('Méditerranéen','Grillades'),('Maghrébin','Riz & sauces'),('Antillais et créole','Riz & sauces'),
    ('Européen','Riz & sauces'),('Cuisine du monde','Riz & sauces');

  create temp table t_noms (pool text, nom text) on commit drop;
  insert into t_noms values
    ('guineen','La Calebasse Joyeuse'),('guineen','Chez Mariama et ses Marmites'),('guineen','Le Riz Rouge de Binta'),('guineen','La Marmite qui Chante'),('guineen','Sauce Graine & Compagnie'),
    ('guineen','Le Foutah Gourmand'),('guineen','Chez Tantie Hawa, Sauce Chaude'),('guineen','Le Grenier de Maman Kadi'),('guineen','Les Mille et une Sauces'),('guineen','La Cuisine de Binta'),
    ('guineen','Chez Fanta, Reine du Riz'),('guineen','Le Fouta dans l''Assiette'),('guineen','La Louche Dorée'),('guineen','Chez Sylla, Riz & Merveilles'),('guineen','Le Pilon d''Or'),
    ('guineen','Les Jolies Marmites de Conakry'),('guineen','Maison Soumah, Sauces du Cœur'),('guineen','Le Mortier Gourmand'),('guineen','Chez Oumou, le Riz du Bonheur'),('guineen','La Table du Griot Gourmand'),
    ('guineen','Saveurs de la Calebasse'),('guineen','Le Grain de Sel de Nènè'),('guineen','La Sauce qui Danse'),('guineen','Hawa Bonne Bouche'),
    ('guineen_grill','Le Brasier Joyeux'),('guineen_grill','Chez Sory, Maître du Feu'),('guineen_grill','La Braise qui Fait Rêver'),('guineen_grill','Poulet Roi du Rond-Point'),('guineen_grill','Brochettes & Étoiles'),
    ('guineen_grill','Le Griot du Grill'),('guineen_grill','La Flamme Gourmande'),('guineen_grill','Le Maquis des Étincelles'),('guineen_grill','Chez Boubacar, Fumée & Bonheur'),('guineen_grill','Le Charbon Rieur'),
    ('guineen_grill','Grillades de Minuit'),('guineen_grill','La Grillade Fanfaronne'),('guineen_grill','Le Feu de Camp Gourmand'),('guineen_grill','Chez Mamadou, Roi de la Braise'),('guineen_grill','L''Étoile du Maquis'),
    ('guineen_grill','Le Capitaine Rôti'),
    ('africain','Le Baobab Rieur'),('africain','Mama Afrika Gourmande'),('africain','La Calebasse du Sahel'),('africain','Teranga Maison'),('africain','Le Griot Gourmand'),
    ('africain','Soleil d''Abidjan'),('africain','Chez Awa, Piment & Bonne Humeur'),('africain','La Case aux Mille Saveurs'),('africain','Le Palmier qui Danse'),('africain','Afrique en Fête'),
    ('africain','Maquis du Grand Fleuve'),('africain','La Table du Griot Voyageur'),('africain','Le Tam-Tam Gourmand'),('africain','Saveurs d''Accra'),
    ('afro','Les Saveurs du Grand Fleuve'),('afro','Le Goût du Pays Voisin'),('afro','Racines & Piments'),('afro','Le Pagne Gourmand'),('afro','La Sous-Région à Table'),
    ('afro','Terre d''Afrique en Marmite'),('afro','Cuisine de l''Ouest Heureux'),('afro','Le Palais des Sauces'),('afro','Les Épices du Voisin'),('afro','La Table des Quatre Vents'),
    ('mixte','Le Carrefour Gourmand'),('mixte','Maison Métisse'),('mixte','Saveurs Croisées'),('mixte','Le Pont des Saveurs'),('mixte','La Grande Tablée'),
    ('mixte','Le Comptoir des Copains'),('mixte','Table Ouverte'),('mixte','La Table des Amis'),('mixte','Chez Nous et d''Ailleurs'),('mixte','Les Saveurs Réunies'),
    ('mixte','Le Marché des Saveurs'),('mixte','Cuisine du Cœur'),('mixte','Le Festin Voyageur'),('mixte','La Tablée Pas Pareille'),('mixte','Mi-Fouta Mi-Monde'),
    ('mixte','La Cantine des Curieux'),
    ('intl','Le Tour du Monde en Assiette'),('intl','Globe Cuisine'),('intl','Le Passeport Gourmand'),('intl','Planète Saveurs'),('intl','Monde en Bouche'),
    ('intl','Les Cinq Continents'),('intl','Escale Gourmande'),('intl','La Valise Gourmande'),('intl','Le Globe-Trotteur'),('intl','Cap sur le Monde'),
    ('intl','La Mappemonde Gourmande'),('intl','Tous Azimuts Cuisine'),
    ('americaine','Le Burger Fanfaron'),('americaine','Smash & Fry Club'),('americaine','Poulet Croustillant Club'),('americaine','Le Bun Rieur'),('americaine','Le Roi du Burger Doré'),
    ('americaine','Cheese & Compagnie'),('americaine','Speed Burger Show'),('americaine','Le Poulet qui Croustille'),('americaine','Snack 224'),('americaine','Grill & Burgers Club'),
    ('americaine','Bun Bun Burger'),('americaine','La Frite Dorée'),('americaine','Le Hot-Dog Rigolo'),('americaine','Le Sandwich Doré'),
    ('italienne','Pizza della Nonna'),('italienne','Il Forno Capricieux'),('italienne','Casa Napoli'),('italienne','Trattoria dei Sorrisi'),('italienne','La Piazza Bella'),
    ('italienne','Forno d''Oro'),('italienne','Pasta e Fantasia'),('italienne','Il Giardino Segreto'),('italienne','Villa Margherita'),('italienne','Dolce Vita Pizza'),
    ('italienne','Roma Express'),('italienne','La Mamma Pasta'),('italienne','Le Mandolino Gourmand'),('italienne','Il Pizzaiolo Farceur'),
    ('libanaise','Le Roi du Shawarma'),('libanaise','Le Cèdre Gourmand'),('libanaise','Beyrouth Express'),('libanaise','Mezzé en Fête'),('libanaise','Phénicie'),
    ('libanaise','Al Sham Grill'),('libanaise','Le Jardin de Beyrouth'),('libanaise','Zaatar & Compagnie'),('libanaise','Le Falafel Rieur'),('libanaise','Levant Cuisine'),
    ('libanaise','Le Houmous Heureux'),('libanaise','Les Mille et un Mezzés'),
    ('turque','Le Kebab du Sultan Farceur'),('turque','Istanbul Grill'),('turque','Le Bosphore Gourmand'),('turque','Anatolie Kebab'),('turque','Le Döner du Sultan'),
    ('turque','Pide & Plaisir'),('turque','Ankara Grill'),('turque','Le Palais d''Izmir'),('turque','Le Tourbillon Döner'),('turque','La Lanterne d''Istanbul'),
    ('turque','Çay & Kebab'),
    ('indienne','Le Maharaja Pressé'),('indienne','Bombay Épicé'),('indienne','Taj Épices'),('indienne','Delhi Curry House'),('indienne','Masala Corner'),
    ('indienne','Namaste Cuisine'),('indienne','Le Punjab Joyeux'),('indienne','Curry & Naan'),('indienne','Goa Saveurs'),('indienne','Biryani House'),
    ('indienne','Le Tandoor Rieur'),('indienne','Chai & Samoussas'),
    ('chinoise','Dragon d''Or'),('chinoise','Jade Wok'),('chinoise','Bambou Gourmand'),('chinoise','Canton Palace'),('chinoise','Le Wok qui Rit'),
    ('chinoise','La Muraille Gourmande'),('chinoise','Le Lotus Rouge'),('chinoise','Pékin Gourmand'),('chinoise','Shanghai Express'),('chinoise','Soie d''Orient'),
    ('chinoise','Le Panda Gourmand'),('chinoise','Les Baguettes Joyeuses'),
    ('japonaise','Sakura Sushi'),('japonaise','Tokyo Bento'),('japonaise','Ramen Ya'),('japonaise','Kyoto Maki'),('japonaise','Nippon Corner'),
    ('japonaise','Sushi Zen'),('japonaise','Osaka Kitchen'),('japonaise','Le Bol de Riz Heureux'),('japonaise','Fuji Sushi'),('japonaise','Matcha & Sushi'),
    ('japonaise','Le Tanuki Gourmand'),('japonaise','Les Baguettes du Soleil Levant'),
    ('francaise_matin','Petit Matin'),('francaise_matin','Le Pain Chaud'),('francaise_matin','Café de la Gare'),('francaise_matin','Chez Néné Déjeuner'),('francaise_matin','Les Beignets de Maman'),
    ('francaise_matin','La Boulangerie Centrale'),('francaise_matin','Café Bonjour Soleil'),('francaise_matin','Au Croissant Rêveur'),('francaise_matin','Omelette Express'),('francaise_matin','Chez Fatoumata Petit-Déj'),
    ('francaise_matin','La Bouillie Dorée'),('francaise_matin','Le Coin du Matin'),('francaise_matin','Pain & Café'),('francaise_matin','La Tartine Rieuse'),('francaise_matin','Aube Gourmande'),
    ('francaise_matin','Le Coq Réveille-Matin'),('francaise_matin','La Brioche Câline'),('francaise_matin','Le Rêve du Boulanger'),('francaise_matin','Aurore au Beurre'),('francaise_matin','La Tasse Rieuse'),
    ('francaise_matin','Le Bol du Réveil'),('francaise_matin','La Mie Dorée'),('francaise_matin','Le Chant du Coq'),('francaise_matin','Madame Croissant'),('francaise_matin','Le Réveil Gourmand'),
    ('francaise_matin','Les Tartines de Maman'),('francaise_matin','La Biscotte Joyeuse'),
    ('francaise','Bistrot du Coin'),('francaise','Brasserie Centrale'),('francaise','Crêperie Bretonne'),('francaise','Le Petit Bistrot'),('francaise','La Table Parisienne'),
    ('francaise','Chez Maurice'),('francaise','Le Comptoir Français'),('francaise','Café de Paris Bistro'),('francaise','La Fourchette d''Or'),('francaise','Brasserie des Halles'),
    ('francaise','Le Coq Gourmand'),('francaise','La Cuillère Fantasque'),
    ('grecque','Athènes Grill'),('grecque','Le Parthénon'),('grecque','Souvlaki House'),('grecque','Taverne Grecque'),('grecque','Olympe Grill'),
    ('grecque','Mykonos Kitchen'),('grecque','Santorin'),('grecque','Zorba Grill'),('grecque','Gyros Corner'),('grecque','Le Péloponnèse'),
    ('grecque','La Taverne de Zeus'),('grecque','Le Minotaure Gourmand'),
    ('marocaine','Le Riad'),('marocaine','Tajine d''Or'),('marocaine','Marrakech Saveurs'),('marocaine','Le Palais Marocain'),('marocaine','Casablanca Grill'),
    ('marocaine','Atlas Cuisine'),('marocaine','Couscous Royal'),('marocaine','Fès Gourmand'),('marocaine','La Médina'),('marocaine','Le Souk'),
    ('marocaine','Le Tajine Rieur'),('marocaine','La Théière Enchantée'),
    ('thailandaise','Bangkok Express'),('thailandaise','Thaï Orchid'),('thailandaise','Le Siam'),('thailandaise','Pad Thaï House'),('thailandaise','Lotus Thaï'),
    ('thailandaise','Phuket Kitchen'),('thailandaise','Chiang Mai Saveurs'),('thailandaise','Bangkok Street'),('thailandaise','Thaï Basil'),('thailandaise','Le Palais Thaï'),
    ('thailandaise','Le Wok Épicé de Siam'),('thailandaise','L''Éléphant Gourmand'),
    ('antillaise','Case Créole'),('antillaise','Chez Tantie Colombo'),('antillaise','Saveurs des Îles'),('antillaise','Le Ti Bokit'),('antillaise','Îles en Fête'),
    ('antillaise','Cuisine Créole'),('antillaise','Karukera Saveurs'),('antillaise','Soleil des Antilles'),('antillaise','Case à Colombo'),('antillaise','Madinina Gourmand'),
    ('antillaise','Le Colibri Gourmand'),('antillaise','La Case du Flamboyant'),
    ('roumaine','Les Carpates'),('roumaine','Chez Ion'),('roumaine','Maison Roumaine'),('roumaine','Transylvanie Saveurs'),('roumaine','Le Danube'),
    ('roumaine','Bucarest Cuisine'),('roumaine','Sarmale Maison'),('roumaine','Le Petit Bucarest'),('roumaine','Brașov Gourmand'),('roumaine','Maramureș Table'),
    ('roumaine','Le Petit Loup des Carpates'),('roumaine','La Chaumière de Bucarest'),
    ('mexicaine','Tacos & Co'),('mexicaine','El Sombrero'),('mexicaine','Casa Mexicana'),('mexicaine','Burrito Station'),('mexicaine','Fiesta Tacos'),
    ('mexicaine','Taqueria Latina'),('mexicaine','Cantina Rio'),('mexicaine','El Paso Grill'),('mexicaine','Mariachi Corner'),('mexicaine','Tex & Mex'),
    ('mexicaine','Le Piment Rieur'),('mexicaine','La Fiesta Gourmande');

  create temp table t_profil on commit drop as
  select g.i, z.z, z.region, z.quartier_id, z.libelle, z.lat, z.lng,
         case when z.region = 'Conakry'
           then case when g.u < .17 then 'guineen' when g.u < .27 then 'africain' when g.u < .35 then 'afro' when g.u < .53 then 'mixte' when g.u < .86 then 'monde' else 'intl' end
           else case when g.u < .42 then 'guineen' when g.u < .56 then 'africain' when g.u < .64 then 'afro' when g.u < .86 then 'mixte' when g.u < .98 then 'monde' else 'intl' end
         end as profil,
         (select m.n from t_monde m where m.cum > g.u1 * 100 order by m.cum limit 1) as n1,
         1 + floor(g.u2 * 13)::int as d2,
         1 + floor(g.u3 * 13)::int as d3,
         g.u4
  from (select i, random() as u, random() as u1, random() as u2, random() as u3, random() as u4 from generate_series(1, 60) i) g
    join t_slots s on s.s = 1 + (g.i * 7) % 60
    join t_zones z on z.z = s.z;

  create temp table t_resto1 on commit drop as
  select p.*,
         (p.profil = 'guineen' and p.u4 < 0.35) as grill,
         -- Tirage propre à l'alcool (stable, indépendant des autres tirages) : sert à décider si le restaurant sert des boissons alcoolisées.
         ((hashtext(p.i::text || 'alcool') & 1023) / 1024.0) as ua,
         (select m.cuisine from t_monde m where m.n = p.n1) as w1,
         (select m.cuisine from t_monde m where m.n = ((p.n1 - 1 + p.d2) % 14) + 1) as w2,
         (select m.cuisine from t_monde m where m.n = ((p.n1 - 1 + case when p.d3 = p.d2 then p.d2 % 13 + 1 else p.d3 end) % 14) + 1) as w3,
         -- Un restaurant 100 % français sur deux est un café-boulangerie du matin, l'autre un bistrot.
         (p.profil = 'monde' and p.u4 < 0.5 and (select m.cuisine from t_monde m where m.n = p.n1) = 'francaise') as matin
  from t_profil p;

  create temp table t_resto2 on commit drop as
  select r.*,
         case r.profil when 'guineen' then array['guineenne'] when 'africain' then array['africaine'] when 'afro' then array['guineenne','africaine']
                       when 'mixte' then array['guineenne', r.w1] when 'monde' then array[r.w1] else array[r.w1, r.w2, r.w3] end as cuisines,
         case when r.grill then 'guineen_grill' when r.matin then 'francaise_matin' when r.profil = 'monde' then r.w1 else r.profil end as pool
  from t_resto1 r;

  create temp table t_resto on commit drop as
  with nommes as (
    select r.*, row_number() over (partition by r.pool order by r.i) as rk, (select count(*) from t_noms n where n.pool = r.pool) as nb_noms
    from t_resto2 r)
  select gen_random_uuid() as id, n.i, n.cuisines, n.profil,
         (select t.nom from t_noms t where t.pool = n.pool order by t.nom offset ((n.rk - 1) % n.nb_noms) limit 1)
           || case when n.rk > n.nb_noms then ' ' || n.libelle else '' end as nom,
         case when n.grill then array['Grillades et brochettes','Poissons et fruits de mer']
              when n.matin then array['Sandwichs et croques','Quiches et salades repas','Crêpes salées'] end as restr,
         -- Règle de catégorie : maison de grillades ou café du matin = leur catégorie ; une seule catégorie parmi les cuisines = cette catégorie ;
         -- guinéen + africain = « Africain » ; plusieurs cuisines différentes (mixte, international) = « Cuisine du monde » (jamais la première cuisine).
         case when n.grill then 'Grillades' when n.matin then 'Petit-déjeuner'
              else (select case when count(distinct k.categorie) = 1 then min(k.categorie)
                                when bool_and(u.c in ('guineenne', 'africaine')) then 'Africain'
                                else 'Cuisine du monde' end
                    from unnest(n.cuisines) as u(c) join t_cuisine_cat k on k.cuisine = u.c) end as categorie,
         n.matin,
         -- Boissons alcoolisées : jamais dans une maison de grillades ni un café du matin ; rares dans les restaurants guinéens ou africains,
         -- plus fréquentes dans les restaurants du monde, surtout à Conakry. Elles forment des rubriques à part (Bières, Vins, Cocktails, Spiritueux).
         case when n.grill or n.matin then false
              when n.profil in ('guineen', 'africain') then n.ua < 0.08
              else n.ua < (case when n.region = 'Conakry' then 0.55 else 0.25 end) end as alcool,
         n.quartier_id, n.region, n.libelle as adresse,
         n.lat + (random() - 0.5) * (case when n.region = 'Conakry' then 0.004 else 0.01 end) as lat,
         n.lng + (random() - 0.5) * (case when n.region = 'Conakry' then 0.004 else 0.01 end) as lng,
         8000 + 1000 * (n.i % 5) as frais,
         case n.region when 'Labé' then 'fouta' when 'Mamou' then 'fouta' when 'Kankan' then 'haute' when 'Faranah' then 'haute' when 'Kindia' then 'basse' when 'Boké' then 'basse' when 'N''Zérékoré' then 'foret' end as groupe,
         -- Popularité : les restaurants de Conakry occupent les premiers rangs (ordre fixe), ceux des régions les derniers.
         row_number() over (order by (n.region <> 'Conakry'), hashtext(n.i::text)) as rang
  from nommes n;

  insert into public.restaurants (id, nom, categorie_id, quartier_id, horaires, ouvert, accepte_commandes, publie, donnees_demo, demo_lot,
                                  latitude, longitude, delai_preparation_minutes, moyens_paiement, mode_vente, livraison_mode, accepte_sur_place, cree_le)
  select id, nom,
         coalesce((select c.id from public.menu_categories c where c.nom = r.categorie),
                  (select c.id from public.menu_categories c join t_categorie_repli x on x.repli = c.nom where x.categorie = r.categorie),
                  cats[1]),
         quartier_id,
         (array['Tous les jours, 11h-23h','Lundi au samedi, 10h-22h','Tous les jours, 12h-00h','Tous les jours, 7h-15h','Tous les jours, 18h-02h'])[case when matin then 4 when i % 5 = 0 then 3 else 1 + i % 3 end],
         true, true, true, true, v_lot, lat, lng,
         15 + (i * 3) % 26,
         case i % 4 when 0 then array['especes','orange_money'] when 1 then array['especes','orange_money','mtn_momo'] when 2 then array['especes'] else array['orange_money','mtn_momo'] end,
         'autonome',
         case when i % 10 < 4 then 'speedfood' else 'propre' end,
         false,
         now() - ((60 + (i * 11) % 200) || ' days')::interval
  from t_resto r;

  -- Chaque restaurant livre dans sa commune (sans zone déclarée, un restaurant ne propose que le retrait).
  insert into public.restaurant_zones_desservies (restaurant_id, commune_id, frais_gnf, delai_minutes)
  select r.id, n.commune_id, r.frais, 25 + (r.i * 3) % 25
  from t_resto r join public.neighborhoods n on n.id = r.quartier_id;

  -- ------------------------------------------------------------------ articles (menus par cuisine, inspirés de la structure des places de marché)
  -- Un catalogue par cuisine (guinéenne, africaine, libanaise, turque, italienne, indienne, chinoise, japonaise, américaine, française, mexicaine) + des boissons
  -- communes (cuisine « * »). Chaque cuisine a ses rubriques de plats principaux (ex. « Pizzas », « Currys », « Riz et sauces ») ; le reste suit un socle commun :
  -- entrées chaudes et froides, accompagnements, en-cas, desserts, pâtisseries, menus et formules, et cinq familles de boissons. Tout est halal (ni porc ni alcool).
  -- pos : centaines = famille (1 entrées chaudes, 2 entrées froides, 3 plats principaux, 4 accompagnements, 5 en-cas, 6 desserts, 7 pâtisseries, 8 menus, 9 boissons).
  create temp table t_catalogue (cuisine text, pos int, section text, nom text, description text, prix int, reg text) on commit drop;
  insert into t_catalogue values
    -- ===== GUINÉENNE
    ('guineenne',101,'Entrées chaudes','Beignets de poisson (5)','Cinq beignets de poisson épicés, sauce piment.',12000,null),
    ('guineenne',101,'Entrées chaudes','Soupe de poisson','Bouillon de poisson aux légumes et au piment doux.',15000,null),
    ('guineenne',101,'Entrées chaudes','Fataya au poisson (3)','Trois chaussons farcis au poisson épicé.',12000,null),
    ('guineenne',101,'Entrées chaudes','Beignets de banane plantain (5)','Cinq beignets dorés de banane plantain mûre.',10000,null),
    ('guineenne',101,'Entrées chaudes','Samoussas au bœuf (4)','Quatre samoussas croustillants à la viande épicée.',14000,null),
    ('guineenne',101,'Entrées chaudes','Soupe de légumes au poulet','Bouillon de poulet, carottes, chou et pommes de terre.',14000,null),
    ('guineenne',201,'Entrées froides','Salade de tomates et oignons','Tomates fraîches, oignons rouges, huile et citron.',8000,null),
    ('guineenne',201,'Entrées froides','Salade d''avocat','Avocat mûr, tomate, oignon, vinaigrette maison.',12000,null),
    ('guineenne',201,'Entrées froides','Salade de concombre à la menthe','Concombre frais, menthe, citron vert.',9000,null),
    ('guineenne',201,'Entrées froides','Salade de chou et carottes','Chou et carottes râpés, vinaigrette au citron.',8000,null),
    ('guineenne',201,'Entrées froides','Salade de haricots blancs','Haricots blancs, oignons, tomates et persil.',9000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce feuilles de patate','Riz blanc, sauce de feuilles de patate douce mijotée au poisson fumé.',35000,null),
    ('guineenne',301,'Riz et sauces','Riz gras au poulet','Riz cuit dans la sauce tomate épicée, poulet rôti et légumes.',45000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce arachide','Sauce d''arachide onctueuse, viande de bœuf tendre.',38000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce gombo','Gombo frais, poisson fumé et huile de palme rouge.',36000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce kansiyé','Sauce kansiyé aux épices du terroir, viande de bœuf.',42000,null),
    ('guineenne',301,'Riz et sauces','Riz au poisson','Riz au poisson entier, carottes, chou et aubergine.',50000,null),
    ('guineenne',301,'Riz et sauces','Mafé de bœuf','Bœuf mijoté dans une sauce d''arachide, servi avec du riz.',48000,null),
    ('guineenne',301,'Riz et sauces','Sauce pistache','Sauce à la pâte de pistache, poulet et riz blanc.',40000,null),
    ('guineenne',301,'Riz et sauces','Foutou sauce graine','Foutou de banane plantain, sauce graine de palme.',45000,null),
    ('guineenne',301,'Riz et sauces','Attiéké poisson','Attiéké frais, poisson braisé, oignons et piment.',40000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce aubergine','Aubergines mijotées au poisson fumé, riz blanc.',34000,null),
    ('guineenne',301,'Riz et sauces','Riz haricots','Haricots rouges mijotés à l''huile, riz blanc.',28000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce feuilles de manioc','Feuilles de manioc pilées, viande et poisson fumé.',37000,null),
    ('guineenne',301,'Riz et sauces','Riz yassa au poulet','Poulet mariné aux oignons et au citron, riz blanc.',46000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce tomate au poisson fumé','Sauce tomate relevée, poisson fumé, riz blanc.',36000,null),
    ('guineenne',301,'Riz et sauces','Couscous de mil sauce légumes','Couscous de mil, sauce de légumes frais et viande.',32000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce poulet et légumes','Riz blanc, poulet mijoté et légumes de saison.',42000,null),
    ('guineenne',301,'Riz et sauces','Tô de maïs sauce gombo','Pâte de maïs lisse, sauce gombo à la viande.',30000,null),
    ('guineenne',301,'Riz et sauces','Pâtes sauce bœuf','Spaghetti, sauce tomate et bœuf haché.',30000,null),
    ('guineenne',301,'Riz et sauces','Riz sauce légumes et viande','Riz blanc, sauce de légumes et morceaux de bœuf.',38000,null),
    ('guineenne',301,'Riz et sauces','Fonio sauce gombo','Fonio du Fouta, sauce gombo et viande séchée.',32000,'fouta'),
    ('guineenne',301,'Riz et sauces','Haricots à l''huile rouge','Haricots mijotés à l''huile de palme rouge, riz blanc.',28000,'fouta'),
    ('guineenne',301,'Riz et sauces','Tô de mil sauce kansiyé','Tô de mil, sauce kansiyé et viande de bœuf.',34000,'haute'),
    ('guineenne',301,'Riz et sauces','Riz gras de la Haute-Guinée','Riz gras à la viande, oignons et épices du terroir.',45000,'haute'),
    ('guineenne',301,'Riz et sauces','Riz sauce gombo séché','Sauce de gombo séché, poisson fumé, riz blanc.',33000,'haute'),
    ('guineenne',301,'Riz et sauces','Manioc pilé sauce graine','Manioc pilé, sauce graine de palme et viande.',42000,'foret'),
    ('guineenne',301,'Riz et sauces','Ignames sauce poisson','Ignames bouillies, sauce de poisson aux tomates.',38000,'foret'),
    ('guineenne',301,'Riz et sauces','Sauce graine au poulet fumé','Sauce graine, poulet fumé, riz ou foutou.',45000,'foret'),
    ('guineenne',302,'Spécialités et viandes','Agneau mijoté aux oignons','Épaule d''agneau mijotée aux oignons et au poivre.',65000,null),
    ('guineenne',302,'Spécialités et viandes','Ragoût de chèvre','Chèvre mijotée longuement, sauce brune épicée.',68000,null),
    ('guineenne',302,'Spécialités et viandes','Tripes sauce tomate','Tripes de bœuf mijotées à la tomate et au piment.',40000,null),
    ('guineenne',302,'Spécialités et viandes','Pintade mijotée','Pintade mijotée aux oignons, servie avec du riz.',60000,null),
    ('guineenne',302,'Spécialités et viandes','Poulet fermier sauce arachide','Poulet fermier, sauce d''arachide, riz blanc.',55000,null),
    ('guineenne',302,'Spécialités et viandes','Plat du chef','Le plat du jour du chef, demandez-le au comptoir.',60000,null),
    ('guineenne',302,'Spécialités et viandes','Poulet du Fouta aux oignons','Poulet mijoté aux oignons, façon Fouta.',55000,'fouta'),
    ('guineenne',303,'Poissons et fruits de mer','Poisson capitaine sauce citron','Darne de capitaine, sauce citron et oignons.',70000,null),
    ('guineenne',303,'Poissons et fruits de mer','Capitaine fumé en sauce','Capitaine fumé mijoté en sauce, riz blanc.',65000,null),
    ('guineenne',303,'Poissons et fruits de mer','Crevettes sautées au piment','Crevettes sautées à l''ail et au piment.',60000,null),
    ('guineenne',303,'Poissons et fruits de mer','Poisson braisé','Poisson entier braisé au charbon, oignons et piment.',75000,null),
    ('guineenne',303,'Poissons et fruits de mer','Capitaine braisé','Capitaine braisé, sauce pimentée maison.',90000,null),
    ('guineenne',303,'Poissons et fruits de mer','Dorade grillée','Dorade entière grillée, citron et légumes.',80000,null),
    ('guineenne',303,'Poissons et fruits de mer','Crevettes grillées','Crevettes grillées au beurre d''ail.',85000,null),
    ('guineenne',303,'Poissons et fruits de mer','Calamars frits','Calamars frits croustillants, sauce citron.',60000,null),
    ('guineenne',303,'Poissons et fruits de mer','Thon grillé','Pavé de thon grillé, légumes sautés.',70000,null),
    ('guineenne',303,'Poissons et fruits de mer','Poisson au four sauce tomate','Poisson cuit au four, sauce tomate.',70000,null),
    ('guineenne',303,'Poissons et fruits de mer','Riz au poisson fumé et huile de palme','Riz cuit au poisson fumé et à l''huile de palme.',45000,'basse'),
    ('guineenne',303,'Poissons et fruits de mer','Poisson fumé de Boké braisé','Poisson fumé braisé, accompagné de riz.',65000,'basse'),
    ('guineenne',304,'Grillades et brochettes','Poulet braisé entier','Poulet entier braisé au charbon, piment à part.',120000,null),
    ('guineenne',304,'Grillades et brochettes','Demi-poulet braisé','Demi-poulet braisé, oignons et piment.',65000,null),
    ('guineenne',304,'Grillades et brochettes','Côtelettes d''agneau','Côtelettes d''agneau grillées au charbon.',80000,null),
    ('guineenne',304,'Grillades et brochettes','Poulet yassa','Poulet mariné aux oignons et au citron.',55000,null),
    ('guineenne',304,'Grillades et brochettes','Merguez grillées','Merguez grillées, moutarde.',35000,null),
    ('guineenne',304,'Grillades et brochettes','Cuisse de poulet braisée','Cuisse de poulet braisée.',30000,null),
    ('guineenne',304,'Grillades et brochettes','Gigot de mouton braisé','Gigot de mouton braisé, oignons.',95000,null),
    ('guineenne',304,'Grillades et brochettes','Foie grillé','Foie de bœuf grillé aux oignons.',32000,null),
    ('guineenne',304,'Grillades et brochettes','Côte de bœuf grillée','Côte de bœuf grillée au charbon.',85000,null),
    ('guineenne',304,'Grillades et brochettes','Ailes de poulet épicées (8)','Huit ailes de poulet marinées et grillées.',38000,null),
    ('guineenne',304,'Grillades et brochettes','Poulet fumé','Poulet fumé au bois, piment à part.',70000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes de bœuf (5)','Cinq brochettes de bœuf, oignons.',40000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes de mouton (5)','Cinq brochettes de mouton grillées.',45000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes de poulet (5)','Cinq brochettes de poulet marinées.',38000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes mixtes (6)','Six brochettes, bœuf, mouton et poulet.',50000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes de gésiers (5)','Cinq brochettes de gésiers.',30000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes de crevettes (4)','Quatre brochettes de crevettes.',60000,null),
    ('guineenne',304,'Grillades et brochettes','Brochettes de mouton du Fouta','Brochettes de mouton, marinade du Fouta.',48000,'fouta'),
    ('guineenne',304,'Grillades et brochettes','Méchoui de mouton (part)','Part de méchoui de mouton rôti.',75000,'haute'),
    ('guineenne',304,'Grillades et brochettes','Poulet braisé sauce graine','Poulet braisé nappé de sauce graine.',60000,'foret'),
    ('guineenne',400,'Accompagnements','Banane plantain frite','Plantain mûr frit, doré.',12000,null),
    ('guineenne',400,'Accompagnements','Riz blanc','Portion de riz blanc.',8000,null),
    ('guineenne',400,'Accompagnements','Attiéké','Attiéké frais, portion.',12000,null),
    ('guineenne',400,'Accompagnements','Alloco','Bananes plantains frites, piment.',14000,null),
    ('guineenne',400,'Accompagnements','Haricots rouges','Haricots rouges mijotés.',10000,null),
    ('guineenne',400,'Accompagnements','Frites d''igname','Frites d''igname croustillantes.',14000,null),
    ('guineenne',400,'Accompagnements','Sauce pimentée maison','Petit pot de sauce pimentée.',5000,null),
    ('guineenne',500,'En-cas','Beignets de haricots (5)','Cinq beignets de haricots, sauce piment.',8000,null),
    ('guineenne',500,'En-cas','Arachides grillées','Un sachet d''arachides grillées au sel.',4000,null),
    ('guineenne',500,'En-cas','Maïs grillé','Épi de maïs grillé au charbon.',5000,null),
    ('guineenne',500,'En-cas','Brochette de bœuf à l''oignon','Une brochette de bœuf, oignons et piment.',8000,null),
    ('guineenne',500,'En-cas','Chips de plantain','Fines tranches de plantain frites et salées.',6000,null),
    ('guineenne',500,'En-cas','Galettes de mil (4)','Quatre galettes de mil dorées.',7000,null),
    ('guineenne',600,'Desserts','Salade de fruits','Fruits frais de saison.',12000,null),
    ('guineenne',600,'Desserts','Riz au lait','Riz au lait à la cannelle.',10000,null),
    ('guineenne',600,'Desserts','Banane caramélisée','Banane mûre caramélisée.',10000,null),
    ('guineenne',600,'Desserts','Mangue fraîche','Mangue de saison coupée.',8000,null),
    ('guineenne',600,'Desserts','Bouillie de fonio au lait','Fonio cuit au lait sucré.',10000,'fouta'),
    ('guineenne',700,'Pâtisseries','Gâteau de maïs','Part de gâteau de maïs tiède.',8000,null),
    ('guineenne',700,'Pâtisseries','Beignets sucrés (5)','Cinq beignets sucrés.',10000,null),
    ('guineenne',700,'Pâtisseries','Gâteau au gingembre','Part de gâteau moelleux au gingembre frais.',9000,null),
    ('guineenne',700,'Pâtisseries','Sablés à la noix de coco','Six sablés à la noix de coco râpée.',8000,null),
    ('guineenne',700,'Pâtisseries','Gâteau à la banane','Part de gâteau à la banane mûre.',9000,null),
    ('guineenne',800,'Menus et formules','Menu riz sauce et boisson','Un riz sauce au choix et une boisson fraîche.',45000,null),
    ('guineenne',800,'Menus et formules','Menu grillade et alloco','Une grillade au choix, alloco et une boisson.',70000,null),
    ('guineenne',800,'Menus et formules','Plateau familial (4 personnes)','Riz, deux sauces, poulet braisé et boissons.',250000,null),
    -- ===== AFRICAINE (Sénégal, Côte d'Ivoire, Nigeria, Cameroun, Congo)
    ('africaine',101,'Entrées chaudes','Pastels au poisson (4)','Quatre pastels farcis au poisson, sauce tomate.',15000,null),
    ('africaine',101,'Entrées chaudes','Accras de morue (6)','Six beignets de morue épicés.',14000,null),
    ('africaine',101,'Entrées chaudes','Soupe de poisson pimentée','Soupe de poisson à la sénégalaise, très relevée.',16000,null),
    ('africaine',101,'Entrées chaudes','Beignets de haricots (5)','Beignets de niébé dorés, sauce piment.',9000,null),
    ('africaine',101,'Entrées chaudes','Poulet pané en entrée (4)','Quatre morceaux de poulet pané épicé.',16000,null),
    ('africaine',201,'Entrées froides','Salade de chou et crudités','Chou, carotte, tomate, vinaigrette moutarde.',9000,null),
    ('africaine',201,'Entrées froides','Salade d''avocat aux crevettes','Avocat, crevettes, citron vert.',20000,null),
    ('africaine',201,'Entrées froides','Salade de tomates à l''oignon','Tomates et oignons, huile et citron.',8000,null),
    ('africaine',201,'Entrées froides','Salade de niébé','Haricots niébé, oignon, huile de palme douce.',9000,null),
    ('africaine',301,'Riz et plats du Sénégal','Thiéboudienne (riz au poisson)','Riz rouge, poisson, carotte, chou, manioc et aubergine.',55000,null),
    ('africaine',301,'Riz et plats du Sénégal','Yassa poulet','Poulet mariné aux oignons et au citron, riz blanc.',46000,null),
    ('africaine',301,'Riz et plats du Sénégal','Mafé poulet','Poulet mijoté dans une sauce d''arachide, riz blanc.',45000,null),
    ('africaine',301,'Riz et plats du Sénégal','Thiébou yapp','Riz à la viande de bœuf, légumes et sauce tomate.',52000,null),
    ('africaine',301,'Riz et plats du Sénégal','Dibi d''agneau','Agneau grillé au charbon, oignons et moutarde.',60000,null),
    ('africaine',301,'Riz et plats du Sénégal','Domoda','Ragoût d''arachide à la viande et aux légumes.',44000,null),
    ('africaine',302,'Plats d''Afrique de l''Ouest','Riz jollof au poulet','Riz jollof épicé, poulet braisé et plantain.',48000,null),
    ('africaine',302,'Plats d''Afrique de l''Ouest','Riz jollof au bœuf','Riz jollof épicé et bœuf mijoté.',50000,null),
    ('africaine',302,'Plats d''Afrique de l''Ouest','Attiéké poisson braisé','Attiéké, poisson braisé, oignons et tomates.',45000,null),
    ('africaine',302,'Plats d''Afrique de l''Ouest','Kédjenou de poulet','Poulet mijoté à l''étouffée avec légumes, façon ivoirienne.',50000,null),
    ('africaine',302,'Plats d''Afrique de l''Ouest','Poulet DG','Poulet sauté aux plantains et aux légumes, façon camerounaise.',52000,null),
    ('africaine',302,'Plats d''Afrique de l''Ouest','Poisson braisé alloco','Poisson braisé avec alloco et piment.',55000,null),
    ('africaine',303,'Soupes et fufu','Egusi et fufu','Soupe de graines de courge, viande, fufu.',48000,null),
    ('africaine',303,'Soupes et fufu','Soupe de gombo et fufu','Soupe de gombo, poisson fumé et fufu.',46000,null),
    ('africaine',303,'Soupes et fufu','Ndolé au poisson','Feuilles amères, arachide et poisson, façon camerounaise.',50000,null),
    ('africaine',303,'Soupes et fufu','Soupe de poisson épicée et banku','Soupe pimentée au poisson et pâte de maïs.',46000,null),
    ('africaine',303,'Soupes et fufu','Poulet moambé','Poulet à la sauce de noix de palme, façon congolaise.',52000,null),
    ('africaine',303,'Soupes et fufu','Saka-saka et riz','Feuilles de manioc pilées, poisson fumé, riz.',40000,null),
    ('africaine',304,'Grillades et suya','Suya de bœuf','Brochettes de bœuf à la poudre d''arachide épicée.',45000,null),
    ('africaine',304,'Grillades et suya','Suya de poulet','Poulet grillé à la poudre suya, oignons.',42000,null),
    ('africaine',304,'Grillades et suya','Poulet braisé alloco','Poulet braisé au charbon, alloco et piment.',55000,null),
    ('africaine',304,'Grillades et suya','Tilapia braisé','Tilapia entier braisé, oignons et sauce pimentée.',60000,null),
    ('africaine',304,'Grillades et suya','Gigot d''agneau braisé','Gigot d''agneau braisé aux épices.',90000,null),
    ('africaine',400,'Accompagnements','Alloco','Plantains frits, piment.',14000,null),
    ('africaine',400,'Accompagnements','Riz blanc','Portion de riz blanc.',8000,null),
    ('africaine',400,'Accompagnements','Attiéké','Attiéké frais.',12000,null),
    ('africaine',400,'Accompagnements','Fufu de plantain','Boule de fufu de plantain.',10000,null),
    ('africaine',500,'En-cas','Brochette de poulet suya','Une brochette de poulet suya.',9000,null),
    ('africaine',500,'En-cas','Arachides grillées','Arachides grillées au sel.',4000,null),
    ('africaine',500,'En-cas','Chin chin','Petits biscuits croquants frits, noix de muscade.',6000,null),
    ('africaine',500,'En-cas','Plantain frit en sachet','Chips de plantain salées.',6000,null),
    ('africaine',600,'Desserts','Salade de fruits tropicaux','Mangue, ananas et papaye.',12000,null),
    ('africaine',600,'Desserts','Thiakry','Dessert de mil au lait caillé et à la vanille.',12000,null),
    ('africaine',600,'Desserts','Banane flambée','Banane flambée, sucre et cannelle.',12000,null),
    ('africaine',700,'Pâtisseries','Beignets sucrés (5)','Cinq beignets sucrés.',10000,null),
    ('africaine',700,'Pâtisseries','Gâteau à la noix de coco','Part de gâteau à la noix de coco.',9000,null),
    ('africaine',700,'Pâtisseries','Puff puff (6)','Six petits beignets moelleux, saupoudrés de sucre.',9000,null),
    ('africaine',800,'Menus et formules','Menu thiéb et boisson','Un thiéboudienne et une boisson fraîche.',58000,null),
    ('africaine',800,'Menus et formules','Menu grillade et alloco','Une grillade au choix, alloco et une boisson.',70000,null),
    ('africaine',800,'Menus et formules','Plateau à partager (4 personnes)','Riz jollof, poulet braisé, suya et boissons.',260000,null),
    ('africaine',920,'Jus et smoothies','Jus de tamarin','Tamarin frais, sucre de canne.',9000,null),
    ('africaine',920,'Jus et smoothies','Jus de gingembre piquant','Gingembre, citron et une pointe de piment.',8000,null),
    ('africaine',930,'Boissons lactées','Fura da nono','Boisson de mil et de lait caillé.',10000,null),
    -- ===== BOISSONS COMMUNES (toutes cuisines)
    ('*',910,'Boissons chaudes','Café noir','Café noir serré.',6000,null),
    ('*',910,'Boissons chaudes','Café au lait','Café filtre et lait chaud.',10000,null),
    ('*',910,'Boissons chaudes','Thé à la menthe','Thé vert à la menthe fraîche.',5000,null),
    ('*',910,'Boissons chaudes','Thé au lait','Thé noir et lait sucré.',7000,null),
    ('*',910,'Boissons chaudes','Chocolat chaud','Chocolat chaud onctueux.',10000,null),
    ('*',910,'Boissons chaudes','Infusion de kinkéliba','Infusion de feuilles de kinkéliba.',5000,null),
    ('*',910,'Boissons chaudes','Lait chaud sucré','Lait chaud légèrement sucré.',6000,null),
    ('*',920,'Jus et smoothies','Jus de bissap','Fleurs d''hibiscus, sucre et menthe.',8000,null),
    ('*',920,'Jus et smoothies','Jus de gingembre','Gingembre frais pressé, citron et menthe.',8000,null),
    ('*',920,'Jus et smoothies','Jus de baobab','Pulpe de baobab, sucre et eau fraîche.',9000,null),
    ('*',920,'Jus et smoothies','Jus de citron','Citron pressé, sucre de canne.',8000,null),
    ('*',920,'Jus et smoothies','Jus d''ananas','Ananas frais pressé.',9000,null),
    ('*',920,'Jus et smoothies','Jus d''orange','Orange pressée, sans sucre ajouté.',9000,null),
    ('*',920,'Jus et smoothies','Jus de mangue','Mangue mûre mixée.',9000,null),
    ('*',920,'Jus et smoothies','Jus citron vert et menthe','Citron vert, menthe et eau pétillante.',9000,null),
    ('*',920,'Jus et smoothies','Smoothie banane','Banane, lait et miel mixés.',12000,null),
    ('*',920,'Jus et smoothies','Smoothie mangue ananas','Mangue, ananas et un peu de lait.',12000,null),
    ('*',930,'Boissons lactées','Lait caillé','Lait caillé frais, légèrement sucré.',9000,null),
    ('*',930,'Boissons lactées','Yaourt nature','Yaourt nature, pot individuel.',7000,null),
    ('*',930,'Boissons lactées','Yaourt à boire à la fraise','Yaourt à boire parfumé à la fraise.',9000,null),
    ('*',930,'Boissons lactées','Milkshake vanille','Glace vanille mixée au lait.',20000,null),
    ('*',930,'Boissons lactées','Milkshake chocolat','Glace au chocolat mixée au lait.',20000,null),
    ('*',940,'Sodas et rafraîchissements','Soda cola','Boisson gazeuse au cola, 33 cl.',8000,null),
    ('*',940,'Sodas et rafraîchissements','Soda orange','Boisson gazeuse à l''orange, 33 cl.',8000,null),
    ('*',940,'Sodas et rafraîchissements','Limonade','Limonade pétillante, 33 cl.',8000,null),
    ('*',940,'Sodas et rafraîchissements','Boisson maltée sans alcool','Boisson maltée sans alcool, 33 cl.',10000,null),
    ('*',940,'Sodas et rafraîchissements','Thé glacé','Thé noir glacé, citron.',8000,null),
    ('*',940,'Sodas et rafraîchissements','Café glacé','Café glacé, lait et sucre.',15000,null),
    ('*',940,'Sodas et rafraîchissements','Gingembre pétillant','Boisson pétillante au gingembre.',9000,null),
    ('*',950,'Eaux','Eau minérale 1,5 L','Bouteille de 1,5 litre.',5000,null),
    ('*',950,'Eaux','Eau minérale 50 cl','Petite bouteille de 50 cl.',3000,null),
    ('*',950,'Eaux','Eau gazeuse 33 cl','Eau pétillante, 33 cl.',6000,null),
    ('*',950,'Eaux','Eau citronnée','Eau fraîche au citron, 50 cl.',7000,null),
    ('*',940,'Sodas et rafraîchissements','Bière sans alcool','Bière blonde sans alcool, 33 cl.',10000,null),
    ('*',945,'Boissons énergisantes','Boisson énergisante 25 cl','Boisson énergisante gazeuse, canette de 25 cl.',15000,null),
    ('*',945,'Boissons énergisantes','Boisson énergisante 50 cl','Boisson énergisante gazeuse, grande canette de 50 cl.',22000,null),
    ('*',945,'Boissons énergisantes','Boisson énergisante sans sucre','Boisson énergisante sans sucre, 25 cl.',16000,null),
    ('*',945,'Boissons énergisantes','Boisson isotonique','Boisson de l''effort aux électrolytes, 50 cl.',14000,null),
    ('*',947,'Mocktails','Mojito sans alcool','Citron vert, menthe, sucre de canne et eau pétillante.',30000,null),
    ('*',947,'Mocktails','Piña colada sans alcool','Ananas, lait de coco et glace pilée.',32000,null),
    ('*',947,'Mocktails','Sunrise sans alcool','Jus d''orange, grenadine et glace.',28000,null),
    ('*',947,'Mocktails','Cocktail de fruits frais','Mangue, ananas, passion et menthe.',30000,null),
    ('*',947,'Mocktails','Gingembre citron vert','Gingembre, citron vert et eau pétillante.',26000,null),
    ('*a',960,'Bières','Bière blonde 33 cl','Bière blonde fraîche, bouteille de 33 cl.',22000,null),
    ('*a',960,'Bières','Bière blonde 65 cl','Bière blonde fraîche, grande bouteille de 65 cl.',35000,null),
    ('*a',960,'Bières','Bière brune 33 cl','Bière brune aux notes de caramel, 33 cl.',25000,null),
    ('*a',960,'Bières','Bière pression 25 cl','Bière blonde servie à la pression.',18000,null),
    ('*a',960,'Bières','Bière de blé 50 cl','Bière blanche légère, notes d''agrumes.',32000,null),
    ('*a',970,'Vins','Vin rouge (verre)','Un verre de vin rouge, 15 cl.',35000,null),
    ('*a',970,'Vins','Vin blanc (verre)','Un verre de vin blanc sec, 15 cl.',35000,null),
    ('*a',970,'Vins','Vin rosé (verre)','Un verre de vin rosé frais, 15 cl.',35000,null),
    ('*a',970,'Vins','Vin rouge (bouteille)','Bouteille de vin rouge, 75 cl.',180000,null),
    ('*a',970,'Vins','Vin blanc (bouteille)','Bouteille de vin blanc sec, 75 cl.',180000,null),
    ('*a',970,'Vins','Vin rosé (bouteille)','Bouteille de vin rosé, 75 cl.',170000,null),
    ('*a',970,'Vins','Vin effervescent (bouteille)','Vin mousseux brut, 75 cl.',250000,null),
    ('*a',980,'Cocktails','Mojito','Rhum blanc, citron vert, menthe, sucre de canne et eau pétillante.',55000,null),
    ('*a',980,'Cocktails','Piña colada','Rhum blanc, ananas et lait de coco.',60000,null),
    ('*a',980,'Cocktails','Margarita','Tequila, triple sec et citron vert.',60000,null),
    ('*a',980,'Cocktails','Caïpirinha','Cachaça, citron vert et sucre de canne.',55000,null),
    ('*a',980,'Cocktails','Daiquiri fraise','Rhum blanc, fraise et citron vert.',58000,null),
    ('*a',980,'Cocktails','Cosmopolitan','Vodka, liqueur d''orange, jus de canneberge et citron vert.',65000,null),
    ('*a',980,'Cocktails','Spritz','Vin effervescent, liqueur amère et eau pétillante.',55000,null),
    ('*a',980,'Cocktails','Gin tonic','Gin, tonic et zeste de citron.',50000,null),
    ('*a',990,'Spiritueux et digestifs','Whisky (4 cl)','Whisky, servi nature ou avec glaçons.',45000,null),
    ('*a',990,'Spiritueux et digestifs','Rhum ambré (4 cl)','Rhum vieilli, servi nature.',40000,null),
    ('*a',990,'Spiritueux et digestifs','Vodka (4 cl)','Vodka, servie glacée.',40000,null),
    ('*a',990,'Spiritueux et digestifs','Gin (4 cl)','Gin, servi avec glaçons.',40000,null),
    ('*a',990,'Spiritueux et digestifs','Cognac (4 cl)','Cognac, servi nature.',60000,null),
    ('*a',990,'Spiritueux et digestifs','Tequila (4 cl)','Tequila, citron et sel.',45000,null),
    ('*a',990,'Spiritueux et digestifs','Liqueur de café (4 cl)','Liqueur de café, servie glacée.',40000,null),
    ('*a',990,'Spiritueux et digestifs','Liqueur d''amande (4 cl)','Liqueur d''amande, servie nature.',40000,null),
    -- ===== LIBANAISE
    ('libanaise',101,'Entrées chaudes','Mezzé de falafels (6)','Six falafels croustillants, sauce tarator.',20000,null),
    ('libanaise',101,'Entrées chaudes','Kebbé frit (4)','Quatre kebbés de bœuf et de boulgour.',24000,null),
    ('libanaise',101,'Entrées chaudes','Sambousek à la viande (4)','Quatre chaussons croustillants à la viande.',22000,null),
    ('libanaise',101,'Entrées chaudes','Fatayer aux épinards (4)','Quatre petits triangles aux épinards et au citron.',20000,null),
    ('libanaise',101,'Entrées chaudes','Soupe de lentilles','Soupe de lentilles corail, cumin, citron.',15000,null),
    ('libanaise',201,'Entrées froides','Houmous','Purée de pois chiches, tahini, huile d''olive.',20000,null),
    ('libanaise',201,'Entrées froides','Moutabal','Purée d''aubergine fumée, tahini.',22000,null),
    ('libanaise',201,'Entrées froides','Taboulé libanais','Persil, tomate, boulgour, menthe, citron.',18000,null),
    ('libanaise',201,'Entrées froides','Fattoush','Salade croquante, pain grillé, sumac.',20000,null),
    ('libanaise',201,'Entrées froides','Labneh à l''huile d''olive','Fromage de yaourt, huile d''olive, menthe.',18000,null),
    ('libanaise',301,'Shawarma et wraps','Shawarma poulet','Poulet mariné, ail, cornichons, pain libanais.',35000,null),
    ('libanaise',301,'Shawarma et wraps','Shawarma bœuf','Bœuf mariné, tahini, tomate, persil.',38000,null),
    ('libanaise',301,'Shawarma et wraps','Shawarma mixte','Poulet et bœuf, sauce à l''ail.',42000,null),
    ('libanaise',301,'Shawarma et wraps','Sandwich falafel','Falafels, légumes, tahini, pain libanais.',28000,null),
    ('libanaise',301,'Shawarma et wraps','Wrap kafta','Kafta de bœuf grillée, oignon, sumac.',36000,null),
    ('libanaise',302,'Grillades et plateaux','Chich taouk','Brochettes de poulet marinées, riz, sauce à l''ail.',55000,null),
    ('libanaise',302,'Grillades et plateaux','Kafta grillée','Brochettes de bœuf haché aux herbes, riz.',58000,null),
    ('libanaise',302,'Grillades et plateaux','Brochettes d''agneau','Cubes d''agneau marinés, grillés au charbon.',70000,null),
    ('libanaise',302,'Grillades et plateaux','Grillade mixte','Chich taouk, kafta et agneau, riz et salade.',90000,null),
    ('libanaise',302,'Grillades et plateaux','Plateau mezzé (2 personnes)','Houmous, moutabal, taboulé, falafels, pain.',85000,null),
    ('libanaise',303,'Spécialités libanaises','Kebbé au yaourt','Boulettes de kebbé dans une sauce au yaourt.',50000,null),
    ('libanaise',303,'Spécialités libanaises','Mjadra','Lentilles et riz aux oignons caramélisés.',30000,null),
    ('libanaise',303,'Spécialités libanaises','Mouloukhieh au poulet','Feuilles de corète mijotées, poulet, riz.',50000,null),
    ('libanaise',303,'Spécialités libanaises','Poulet à l''ail (Farrouj)','Poulet grillé, sauce à l''ail, frites.',52000,null),
    ('libanaise',304,'Manakish et pains','Manakish au zaatar','Pain plat au thym et à l''huile d''olive.',18000,null),
    ('libanaise',304,'Manakish et pains','Manakish au fromage','Pain plat garni de fromage fondu.',22000,null),
    ('libanaise',304,'Manakish et pains','Manakish à la viande','Pain plat garni de viande hachée épicée.',25000,null),
    ('libanaise',400,'Accompagnements','Riz libanais aux vermicelles','Riz parfumé aux vermicelles dorés.',14000,null),
    ('libanaise',400,'Accompagnements','Frites','Frites croustillantes.',15000,null),
    ('libanaise',400,'Accompagnements','Pain libanais','Pain plat chaud.',5000,null),
    ('libanaise',500,'En-cas','Falafel pita','Falafels dans un petit pain pita.',15000,null),
    ('libanaise',500,'En-cas','Cornet de frites à l''ail','Frites et sauce à l''ail.',14000,null),
    ('libanaise',500,'En-cas','Olives et cornichons','Petite assiette d''olives et cornichons.',8000,null),
    ('libanaise',600,'Desserts','Muhallabieh','Crème de lait à l''eau de fleur d''oranger.',14000,null),
    ('libanaise',600,'Desserts','Riz au lait libanais','Riz au lait, eau de rose, pistaches.',14000,null),
    ('libanaise',600,'Desserts','Salade de fruits à l''eau de rose','Fruits frais, eau de rose.',14000,null),
    ('libanaise',700,'Pâtisseries','Baklava (4)','Quatre baklavas aux pistaches et au miel.',22000,null),
    ('libanaise',700,'Pâtisseries','Knefeh','Fromage chaud, semoule dorée et sirop.',20000,null),
    ('libanaise',700,'Pâtisseries','Maamoul aux dattes (4)','Quatre biscuits fourrés aux dattes.',16000,null),
    ('libanaise',800,'Menus et formules','Menu shawarma','Un shawarma, frites et une boisson.',52000,null),
    ('libanaise',800,'Menus et formules','Menu grillade','Une grillade, riz, salade et une boisson.',78000,null),
    ('libanaise',800,'Menus et formules','Plateau mezzé et grillades (4 personnes)','Mezzés variés et grillades à partager.',240000,null),
    ('libanaise',910,'Boissons chaudes','Café libanais à la cardamome','Café fin parfumé à la cardamome.',8000,null),
    ('libanaise',940,'Sodas et rafraîchissements','Limonade à la menthe','Citron, menthe et eau de fleur d''oranger.',10000,null),
    ('libanaise',940,'Sodas et rafraîchissements','Jallab','Sirop de dattes et de raisin, pignons.',12000,null),
    -- ===== TURQUE
    ('turque',101,'Entrées chaudes','Soupe de lentilles turque','Soupe de lentilles rouges, citron et piment doux.',14000,null),
    ('turque',101,'Entrées chaudes','Börek au fromage (4)','Quatre feuilletés au fromage frit.',20000,null),
    ('turque',101,'Entrées chaudes','Sigara böreği (6)','Six rouleaux croustillants au fromage.',22000,null),
    ('turque',101,'Entrées chaudes','Mücver','Galettes de courgette et d''herbes.',18000,null),
    ('turque',201,'Entrées froides','Salade du berger (Çoban)','Tomate, concombre, poivron, persil.',14000,null),
    ('turque',201,'Entrées froides','Haydari','Yaourt épais, ail et menthe.',14000,null),
    ('turque',201,'Entrées froides','Houmous turc','Pois chiches, tahini, paprika.',16000,null),
    ('turque',201,'Entrées froides','Piyaz','Salade de haricots blancs et oignons.',14000,null),
    ('turque',301,'Döner et kebabs','Döner de poulet','Poulet à la broche, pain, salade, sauces.',35000,null),
    ('turque',301,'Döner et kebabs','Döner de bœuf','Bœuf à la broche, pain, oignons au sumac.',38000,null),
    ('turque',301,'Döner et kebabs','Döner durum (dürüm)','Döner roulé dans une galette fine.',36000,null),
    ('turque',301,'Döner et kebabs','Assiette de döner et riz','Döner, riz, salade et sauce yaourt.',50000,null),
    ('turque',301,'Döner et kebabs','Döner dans le pain','Döner dans un pain moelleux, crudités.',32000,null),
    ('turque',302,'Iskender et plats','Iskender kebab','Döner sur du pain, sauce tomate, yaourt, beurre fondu.',60000,null),
    ('turque',302,'Iskender et plats','Iskender de poulet','Poulet à la broche sur pain, sauce tomate, yaourt.',55000,null),
    ('turque',302,'Iskender et plats','Köfte grillées','Boulettes de bœuf grillées, riz et salade.',52000,null),
    ('turque',302,'Iskender et plats','Beyti kebab','Viande hachée roulée dans un lavash, sauce tomate.',58000,null),
    ('turque',303,'Pides et lahmacun','Lahmacun','Galette fine à la viande hachée épicée.',20000,null),
    ('turque',303,'Pides et lahmacun','Pide au fromage','Pain bateau garni de fromage fondu.',28000,null),
    ('turque',303,'Pides et lahmacun','Pide à la viande','Pain bateau garni de viande hachée.',32000,null),
    ('turque',303,'Pides et lahmacun','Pide au poulet','Pain bateau garni de poulet et poivrons.',32000,null),
    ('turque',304,'Grillades turques','Adana kebab','Brochette de bœuf haché pimenté, grillée.',55000,null),
    ('turque',304,'Grillades turques','Chiche de poulet','Brochettes de poulet marinées au yaourt.',50000,null),
    ('turque',304,'Grillades turques','Côtelettes d''agneau','Côtelettes d''agneau grillées, riz et salade.',80000,null),
    ('turque',304,'Grillades turques','Grillade mixte turque','Adana, chiche et köfte, riz et salade.',85000,null),
    ('turque',400,'Accompagnements','Riz turc au vermicelle','Riz pilaf aux vermicelles.',12000,null),
    ('turque',400,'Accompagnements','Frites','Frites croustillantes.',15000,null),
    ('turque',400,'Accompagnements','Pain pide','Pain plat chaud.',5000,null),
    ('turque',500,'En-cas','Simit','Pain en anneau au sésame.',8000,null),
    ('turque',500,'En-cas','Gözleme au fromage','Galette fine fourrée au fromage et aux épinards.',16000,null),
    ('turque',500,'En-cas','Börek individuel','Un feuilleté au fromage.',10000,null),
    ('turque',600,'Desserts','Sütlaç','Riz au lait cuit au four.',14000,null),
    ('turque',600,'Desserts','Künefe','Fromage chaud, cheveux d''ange, sirop.',24000,null),
    ('turque',600,'Desserts','Halva','Halva au sésame, tranche.',12000,null),
    ('turque',700,'Pâtisseries','Baklava turc (4)','Quatre baklavas aux noix et au sirop.',22000,null),
    ('turque',700,'Pâtisseries','Lokum (100 g)','Loukoums à la rose et à la pistache.',14000,null),
    ('turque',700,'Pâtisseries','Tulumba (6)','Six beignets frits au sirop.',14000,null),
    ('turque',800,'Menus et formules','Menu döner','Un döner, frites et une boisson.',50000,null),
    ('turque',800,'Menus et formules','Menu iskender','Un iskender et une boisson.',72000,null),
    ('turque',800,'Menus et formules','Plateau grillades (4 personnes)','Grillades variées, riz, salades.',230000,null),
    ('turque',910,'Boissons chaudes','Thé turc','Thé noir servi dans un verre tulipe.',5000,null),
    ('turque',910,'Boissons chaudes','Café turc','Café fin à la turque.',8000,null),
    ('turque',930,'Boissons lactées','Ayran','Yaourt battu, sel et eau fraîche.',8000,null),
    -- ===== ITALIENNE
    ('italienne',101,'Entrées chaudes','Arancini (4)','Quatre boulettes de riz, mozzarella et sauce tomate.',28000,null),
    ('italienne',101,'Entrées chaudes','Pain à l''ail gratiné','Pain grillé à l''ail et à la mozzarella.',16000,null),
    ('italienne',101,'Entrées chaudes','Minestrone','Soupe de légumes et de haricots à l''italienne.',16000,null),
    ('italienne',101,'Entrées chaudes','Mozzarella frite (6)','Six bâtonnets de mozzarella panés.',22000,null),
    ('italienne',201,'Entrées froides','Caprese','Tomate, mozzarella, basilic, huile d''olive.',22000,null),
    ('italienne',201,'Entrées froides','Salade César au poulet','Poulet grillé, salade, croûtons, parmesan.',28000,null),
    ('italienne',201,'Entrées froides','Bruschetta tomate basilic','Quatre toasts à la tomate fraîche et au basilic.',16000,null),
    ('italienne',201,'Entrées froides','Salade de pâtes','Pâtes froides, thon, tomate et olives.',20000,null),
    ('italienne',301,'Pizzas','Pizza margherita','Tomate, mozzarella, basilic.',60000,null),
    ('italienne',301,'Pizzas','Pizza reine','Tomate, mozzarella, jambon de dinde, champignons.',75000,null),
    ('italienne',301,'Pizzas','Pizza quatre fromages','Mozzarella, gorgonzola, parmesan, chèvre.',85000,null),
    ('italienne',301,'Pizzas','Pizza poulet','Tomate, mozzarella, poulet grillé, oignons.',80000,null),
    ('italienne',301,'Pizzas','Pizza végétarienne','Poivrons, aubergines, courgettes, olives.',70000,null),
    ('italienne',301,'Pizzas','Pizza thon','Tomate, mozzarella, thon, oignons, olives.',78000,null),
    ('italienne',301,'Pizzas','Calzone','Pizza pliée, jambon de dinde, mozzarella, tomate.',75000,null),
    ('italienne',302,'Pâtes','Spaghetti bolognaise','Sauce tomate et bœuf haché mijotée.',50000,null),
    ('italienne',302,'Pâtes','Penne arrabbiata','Sauce tomate pimentée à l''ail.',42000,null),
    ('italienne',302,'Pâtes','Tagliatelles carbonara de volaille','Crème, parmesan, poulet fumé.',55000,null),
    ('italienne',302,'Pâtes','Lasagnes au bœuf','Lasagnes gratinées, béchamel et tomate.',58000,null),
    ('italienne',302,'Pâtes','Fusilli au pesto','Pesto de basilic, pignons, parmesan.',46000,null),
    ('italienne',303,'Risottos et gnocchis','Risotto aux champignons','Riz arborio crémeux aux champignons.',52000,null),
    ('italienne',303,'Risottos et gnocchis','Risotto aux crevettes','Riz arborio, crevettes et citron.',65000,null),
    ('italienne',303,'Risottos et gnocchis','Gnocchis à la crème de parmesan','Gnocchis de pommes de terre, sauce crémeuse.',50000,null),
    ('italienne',304,'Viandes et poissons','Escalope milanaise','Escalope de poulet panée, tomate et spaghetti.',60000,null),
    ('italienne',304,'Viandes et poissons','Saltimbocca de volaille','Volaille, sauge, sauce au vin blanc sans alcool.',62000,null),
    ('italienne',304,'Viandes et poissons','Dorade au citron','Dorade rôtie, citron et herbes.',75000,null),
    ('italienne',400,'Accompagnements','Pommes de terre rôties','Pommes de terre au romarin.',14000,null),
    ('italienne',400,'Accompagnements','Salade verte','Salade, vinaigrette balsamique.',10000,null),
    ('italienne',400,'Accompagnements','Pain focaccia','Pain à l''huile d''olive et au romarin.',10000,null),
    ('italienne',500,'En-cas','Mini pizzas (4)','Quatre mini pizzas au fromage.',25000,null),
    ('italienne',500,'En-cas','Panzerotti (3)','Trois chaussons frits à la mozzarella.',20000,null),
    ('italienne',500,'En-cas','Part de pizza margherita','Une part de pizza à emporter.',12000,null),
    ('italienne',600,'Desserts','Tiramisù','Mascarpone, café et cacao.',20000,null),
    ('italienne',600,'Desserts','Panna cotta aux fruits rouges','Crème cuite vanillée, coulis.',18000,null),
    ('italienne',600,'Desserts','Glace italienne (2 boules)','Deux boules au choix.',14000,null),
    ('italienne',700,'Pâtisseries','Cannoli (2)','Deux cannoli à la ricotta sucrée.',18000,null),
    ('italienne',700,'Pâtisseries','Biscotti aux amandes','Biscuits croquants aux amandes.',10000,null),
    ('italienne',700,'Pâtisseries','Part de tarte au citron','Tarte citron meringuée.',16000,null),
    ('italienne',800,'Menus et formules','Menu pizza','Une pizza au choix et une boisson.',68000,null),
    ('italienne',800,'Menus et formules','Menu pâtes','Des pâtes au choix, un dessert et une boisson.',62000,null),
    ('italienne',800,'Menus et formules','Pizza familiale à partager','Grande pizza pour 3 à 4 personnes et boissons.',140000,null),
    ('italienne',910,'Boissons chaudes','Espresso','Espresso italien.',8000,null),
    ('italienne',910,'Boissons chaudes','Cappuccino','Espresso, lait chaud mousseux.',12000,null),
    ('italienne',940,'Sodas et rafraîchissements','Limonata','Limonade italienne pétillante.',10000,null),
    -- ===== INDIENNE
    ('indienne',101,'Entrées chaudes','Samoussas aux légumes (3)','Trois samoussas croustillants, chutney de menthe.',14000,null),
    ('indienne',101,'Entrées chaudes','Pakoras d''oignons (6)','Six beignets d''oignon à la farine de pois chiches.',14000,null),
    ('indienne',101,'Entrées chaudes','Soupe de lentilles (Dal shorba)','Soupe de lentilles épicée, citron.',14000,null),
    ('indienne',101,'Entrées chaudes','Poulet 65','Poulet frit, piment, feuilles de curry.',30000,null),
    ('indienne',201,'Entrées froides','Salade indienne (Kachumber)','Concombre, tomate, oignon, citron.',10000,null),
    ('indienne',201,'Entrées froides','Raita','Yaourt, concombre et menthe.',10000,null),
    ('indienne',201,'Entrées froides','Chaat de pois chiches','Pois chiches, tamarin, oignon, coriandre.',14000,null),
    ('indienne',301,'Tandoor','Poulet tandoori (demi)','Demi-poulet mariné au yaourt et aux épices, grillé au four.',55000,null),
    ('indienne',301,'Tandoor','Poulet tikka (6)','Six morceaux de poulet marinés, grillés au tandoor.',48000,null),
    ('indienne',301,'Tandoor','Brochettes de kebab seekh (4)','Quatre brochettes d''agneau haché épicé.',50000,null),
    ('indienne',301,'Tandoor','Crevettes tandoori','Crevettes marinées aux épices, grillées.',70000,null),
    ('indienne',301,'Tandoor','Paneer tikka','Fromage paneer mariné et grillé.',42000,null),
    ('indienne',302,'Currys','Poulet au beurre (Butter chicken)','Poulet dans une sauce tomate crémeuse au beurre.',52000,null),
    ('indienne',302,'Currys','Poulet tikka masala','Poulet grillé dans une sauce tomate épicée.',52000,null),
    ('indienne',302,'Currys','Korma de poulet','Poulet dans une sauce douce aux noix de cajou.',52000,null),
    ('indienne',302,'Currys','Curry d''agneau (Rogan josh)','Agneau mijoté aux épices du Cachemire.',62000,null),
    ('indienne',302,'Currys','Curry de pois chiches (Chana masala)','Pois chiches mijotés, tomate et épices.',34000,null),
    ('indienne',302,'Currys','Dal tadka','Lentilles jaunes, ail et cumin.',32000,null),
    ('indienne',303,'Biryanis et riz','Biryani de poulet','Riz basmati parfumé, poulet et épices.',55000,null),
    ('indienne',303,'Biryanis et riz','Biryani d''agneau','Riz basmati, agneau mijoté, oignons frits.',65000,null),
    ('indienne',303,'Biryanis et riz','Biryani aux légumes','Riz basmati, légumes et épices.',42000,null),
    ('indienne',303,'Biryanis et riz','Riz pilaf au cumin','Riz basmati au cumin.',14000,null),
    ('indienne',304,'Pains (naan)','Naan nature','Pain cuit au four tandoor.',8000,null),
    ('indienne',304,'Pains (naan)','Naan à l''ail','Naan à l''ail et à la coriandre.',10000,null),
    ('indienne',304,'Pains (naan)','Naan au fromage','Naan fourré au fromage fondu.',14000,null),
    ('indienne',304,'Pains (naan)','Roti complet','Galette de blé complet.',8000,null),
    ('indienne',400,'Accompagnements','Riz basmati','Riz basmati nature.',12000,null),
    ('indienne',400,'Accompagnements','Pickles indiens','Petit pot de pickles épicés.',6000,null),
    ('indienne',400,'Accompagnements','Papadum (3)','Trois galettes de lentilles croustillantes.',6000,null),
    ('indienne',500,'En-cas','Pani puri (6)','Six boules croustillantes, eau épicée au tamarin.',14000,null),
    ('indienne',500,'En-cas','Samoussa chaat','Samoussa écrasé, pois chiches, yaourt, tamarin.',16000,null),
    ('indienne',500,'En-cas','Bhel puri','Riz soufflé, oignon, tomate, chutneys.',12000,null),
    ('indienne',600,'Desserts','Gulab jamun (3)','Trois beignets au lait, sirop de rose.',14000,null),
    ('indienne',600,'Desserts','Kheer','Riz au lait cardamome et pistaches.',14000,null),
    ('indienne',600,'Desserts','Kulfi à la mangue','Glace indienne à la mangue.',14000,null),
    ('indienne',700,'Pâtisseries','Jalebi','Spirales frites au sirop safrané.',12000,null),
    ('indienne',700,'Pâtisseries','Barfi aux noix de cajou (4)','Quatre carrés de confiserie au lait.',14000,null),
    ('indienne',700,'Pâtisseries','Rasmalai (2)','Deux galettes de fromage au lait parfumé.',16000,null),
    ('indienne',800,'Menus et formules','Thali végétarien','Dal, légumes, riz, naan et dessert.',55000,null),
    ('indienne',800,'Menus et formules','Thali au poulet','Curry de poulet, riz, naan et dessert.',65000,null),
    ('indienne',800,'Menus et formules','Menu duo à partager','Deux currys, riz, deux naans et boissons.',130000,null),
    ('indienne',910,'Boissons chaudes','Masala chai','Thé aux épices et au lait.',8000,null),
    ('indienne',930,'Boissons lactées','Lassi à la mangue','Yaourt battu et mangue.',12000,null),
    ('indienne',930,'Boissons lactées','Lassi salé','Yaourt battu, cumin et menthe.',10000,null),
    -- ===== CHINOISE
    ('chinoise',101,'Entrées chaudes','Rouleaux de printemps (4)','Quatre rouleaux croustillants aux légumes et au poulet.',18000,null),
    ('chinoise',101,'Entrées chaudes','Soupe aigre-piquante','Soupe au poulet, champignons noirs et tofu.',16000,null),
    ('chinoise',101,'Entrées chaudes','Raviolis vapeur au poulet (6)','Six raviolis cuits à la vapeur, sauce soja.',20000,null),
    ('chinoise',101,'Entrées chaudes','Beignets de crevettes (6)','Six beignets de crevettes croustillants.',24000,null),
    ('chinoise',101,'Entrées chaudes','Soupe wonton','Bouillon de poulet, raviolis wonton, ciboule.',18000,null),
    ('chinoise',201,'Entrées froides','Salade de concombre pimentée','Concombre écrasé, ail, huile pimentée.',12000,null),
    ('chinoise',201,'Entrées froides','Salade de chou chinois','Chou, carotte, vinaigre, sésame.',12000,null),
    ('chinoise',201,'Entrées froides','Salade de nouilles froides','Nouilles, concombre, sauce sésame.',16000,null),
    ('chinoise',301,'Dim sum','Dim sum de crevettes (Har gow) (4)','Quatre raviolis transparents aux crevettes.',22000,null),
    ('chinoise',301,'Dim sum','Siu mai de poulet (4)','Quatre bouchées vapeur au poulet.',20000,null),
    ('chinoise',301,'Dim sum','Brioches vapeur au poulet (2)','Deux brioches fourrées au poulet.',18000,null),
    ('chinoise',301,'Dim sum','Panier de dim sum variés','Assortiment de dim sum vapeur.',45000,null),
    ('chinoise',302,'Riz sauté et nouilles','Riz cantonais','Riz sauté, œuf, petits pois, poulet et crevettes.',32000,null),
    ('chinoise',302,'Riz sauté et nouilles','Nouilles sautées au poulet','Nouilles de blé sautées, légumes et poulet.',34000,null),
    ('chinoise',302,'Riz sauté et nouilles','Nouilles sautées au bœuf','Nouilles sautées, bœuf et oignons.',38000,null),
    ('chinoise',302,'Riz sauté et nouilles','Chow mein aux légumes','Nouilles croustillantes aux légumes.',30000,null),
    ('chinoise',302,'Riz sauté et nouilles','Riz sauté aux crevettes','Riz sauté, crevettes, œuf, ciboule.',40000,null),
    ('chinoise',303,'Plats de viande','Poulet aigre-doux','Poulet frit, ananas, poivrons, sauce aigre-douce.',45000,null),
    ('chinoise',303,'Plats de viande','Poulet kung pao','Poulet sauté, cacahuètes, piment.',46000,null),
    ('chinoise',303,'Plats de viande','Bœuf aux oignons','Bœuf sauté aux oignons et à la sauce soja.',50000,null),
    ('chinoise',303,'Plats de viande','Bœuf sauce poivre noir','Bœuf, poivrons, sauce au poivre noir.',52000,null),
    ('chinoise',303,'Plats de viande','Poulet au citron','Poulet pané, sauce au citron.',44000,null),
    ('chinoise',304,'Poissons et crevettes','Crevettes sautées à l''ail','Crevettes sautées, ail, gingembre.',60000,null),
    ('chinoise',304,'Poissons et crevettes','Crevettes aigre-douces','Crevettes frites, sauce aigre-douce.',60000,null),
    ('chinoise',304,'Poissons et crevettes','Poisson vapeur au gingembre','Filet de poisson cuit à la vapeur, gingembre et ciboule.',65000,null),
    ('chinoise',400,'Accompagnements','Riz blanc vapeur','Riz blanc cuit à la vapeur.',8000,null),
    ('chinoise',400,'Accompagnements','Légumes sautés à l''ail','Brocoli, chou, carotte sautés.',16000,null),
    ('chinoise',400,'Accompagnements','Pain vapeur (3)','Trois petits pains vapeur.',8000,null),
    ('chinoise',500,'En-cas','Nems au poulet (3)','Trois nems croustillants.',14000,null),
    ('chinoise',500,'En-cas','Brochettes de poulet sauce satay','Deux brochettes, sauce aux cacahuètes.',16000,null),
    ('chinoise',500,'En-cas','Crackers aux crevettes','Chips de crevettes.',6000,null),
    ('chinoise',600,'Desserts','Perles de coco','Perles de tapioca, lait de coco, mangue.',14000,null),
    ('chinoise',600,'Desserts','Banane caramélisée','Banane frite enrobée de caramel.',14000,null),
    ('chinoise',600,'Desserts','Salade de fruits au litchi','Fruits frais et litchis.',14000,null),
    ('chinoise',700,'Pâtisseries','Beignets de sésame (4)','Quatre boules frites au sésame et à la pâte de haricot.',12000,null),
    ('chinoise',700,'Pâtisseries','Gâteau de lune (1)','Gâteau fourré à la pâte de lotus.',14000,null),
    ('chinoise',700,'Pâtisseries','Tartelettes aux œufs (2)','Deux tartelettes à la crème d''œuf.',12000,null),
    ('chinoise',800,'Menus et formules','Menu riz cantonais','Riz cantonais, un nem et une boisson.',42000,null),
    ('chinoise',800,'Menus et formules','Menu poulet et nouilles','Un plat de poulet, nouilles et une boisson.',55000,null),
    ('chinoise',800,'Menus et formules','Banquet à partager (4 personnes)','Quatre plats, riz, nems et boissons.',200000,null),
    ('chinoise',910,'Boissons chaudes','Thé au jasmin','Thé vert parfumé au jasmin.',6000,null),
    ('chinoise',910,'Boissons chaudes','Thé vert nature','Thé vert chaud.',5000,null),
    ('chinoise',940,'Sodas et rafraîchissements','Bubble tea au lait','Thé au lait et perles de tapioca.',16000,null),
    -- ===== JAPONAISE
    ('japonaise',101,'Entrées chaudes','Soupe miso','Bouillon miso, tofu, algues.',12000,null),
    ('japonaise',101,'Entrées chaudes','Gyoza de poulet (5)','Cinq raviolis poêlés au poulet.',22000,null),
    ('japonaise',101,'Entrées chaudes','Tempura de crevettes (4)','Quatre crevettes en beignet léger.',30000,null),
    ('japonaise',101,'Entrées chaudes','Edamame au sel','Fèves de soja cuites à la vapeur.',12000,null),
    ('japonaise',201,'Entrées froides','Salade d''algues (Wakame)','Algues, sésame, vinaigre de riz.',14000,null),
    ('japonaise',201,'Entrées froides','Salade de concombre au sésame','Concombre, vinaigre de riz, sésame.',12000,null),
    ('japonaise',201,'Entrées froides','Tataki de thon','Thon mi-cuit, sauce ponzu.',32000,null),
    ('japonaise',301,'Sushis et makis','Sushis saumon (6)','Six sushis au saumon.',40000,null),
    ('japonaise',301,'Sushis et makis','Sushis thon (6)','Six sushis au thon.',42000,null),
    ('japonaise',301,'Sushis et makis','Makis concombre (6)','Six makis concombre.',22000,null),
    ('japonaise',301,'Sushis et makis','Makis avocat (6)','Six makis à l''avocat.',24000,null),
    ('japonaise',301,'Sushis et makis','California rolls crevette (8)','Huit rolls, crevette, avocat, sésame.',38000,null),
    ('japonaise',301,'Sushis et makis','Plateau de sushis (18 pièces)','Sushis et makis assortis.',95000,null),
    ('japonaise',302,'Sashimi et chirashi','Sashimi de saumon (8)','Huit tranches de saumon cru.',45000,null),
    ('japonaise',302,'Sashimi et chirashi','Sashimi de thon (8)','Huit tranches de thon cru.',48000,null),
    ('japonaise',302,'Sashimi et chirashi','Chirashi saumon','Bol de riz vinaigré, tranches de saumon.',55000,null),
    ('japonaise',303,'Ramen et plats chauds','Ramen au poulet','Nouilles, bouillon de poulet, œuf, ciboule.',45000,null),
    ('japonaise',303,'Ramen et plats chauds','Yakisoba au poulet','Nouilles sautées, poulet et légumes.',38000,null),
    ('japonaise',303,'Ramen et plats chauds','Poulet katsu et riz','Poulet pané, sauce katsu, riz, chou.',45000,null),
    ('japonaise',303,'Ramen et plats chauds','Udon aux crevettes','Nouilles udon, bouillon et crevettes tempura.',48000,null),
    ('japonaise',304,'Bento et donburi','Bento poulet teriyaki','Poulet teriyaki, riz, salade, gyoza.',58000,null),
    ('japonaise',304,'Bento et donburi','Bento saumon','Saumon grillé, riz, légumes, miso.',65000,null),
    ('japonaise',304,'Bento et donburi','Donburi au bœuf','Bol de riz, bœuf émincé sucré-salé.',52000,null),
    ('japonaise',400,'Accompagnements','Riz japonais','Riz vapeur.',8000,null),
    ('japonaise',400,'Accompagnements','Gingembre mariné','Petite portion de gingembre mariné.',4000,null),
    ('japonaise',400,'Accompagnements','Salade de chou japonaise','Chou, sauce au sésame.',10000,null),
    ('japonaise',500,'En-cas','Onigiri au thon (2)','Deux boules de riz fourrées au thon.',14000,null),
    ('japonaise',500,'En-cas','Brochettes yakitori de poulet (3)','Trois brochettes de poulet grillées.',20000,null),
    ('japonaise',500,'En-cas','Takoyaki (6)','Six boulettes de pâte au poulpe.',22000,null),
    ('japonaise',600,'Desserts','Mochi glacés (3)','Trois mochis fourrés à la glace.',18000,null),
    ('japonaise',600,'Desserts','Glace au thé vert','Deux boules de glace au matcha.',14000,null),
    ('japonaise',600,'Desserts','Salade de fruits japonaise','Fruits frais de saison.',14000,null),
    ('japonaise',700,'Pâtisseries','Dorayaki (2)','Deux pancakes fourrés à la pâte de haricot rouge.',14000,null),
    ('japonaise',700,'Pâtisseries','Taiyaki (2)','Deux gaufres en forme de poisson, crème.',14000,null),
    ('japonaise',700,'Pâtisseries','Roulé au matcha','Part de gâteau roulé au thé vert.',16000,null),
    ('japonaise',800,'Menus et formules','Menu sushi','Dix sushis, soupe miso et une boisson.',68000,null),
    ('japonaise',800,'Menus et formules','Menu ramen','Un ramen, trois gyoza et une boisson.',62000,null),
    ('japonaise',800,'Menus et formules','Plateau à partager (2 personnes)','Sushis, makis, tempura et boissons.',125000,null),
    ('japonaise',910,'Boissons chaudes','Thé vert japonais (sencha)','Thé vert chaud.',6000,null),
    ('japonaise',910,'Boissons chaudes','Latte matcha','Thé matcha et lait chaud.',14000,null),
    ('japonaise',940,'Sodas et rafraîchissements','Thé glacé au jasmin','Thé au jasmin glacé, citron.',9000,null),
    -- ===== AMÉRICAINE
    ('americaine',101,'Entrées chaudes','Ailes de poulet épicées (6)','Six ailes croustillantes, sauce barbecue.',32000,null),
    ('americaine',101,'Entrées chaudes','Onion rings','Rondelles d''oignon panées, sauce.',15000,null),
    ('americaine',101,'Entrées chaudes','Bâtonnets de mozzarella (6)','Six bâtonnets de mozzarella panés.',22000,null),
    ('americaine',101,'Entrées chaudes','Nuggets de poulet (8)','Huit nuggets de poulet, sauce au choix.',30000,null),
    ('americaine',201,'Entrées froides','Salade coleslaw','Chou et carottes, sauce crémeuse.',10000,null),
    ('americaine',201,'Entrées froides','Salade César au poulet','Poulet grillé, salade, croûtons, parmesan.',28000,null),
    ('americaine',201,'Entrées froides','Salade de maïs et tomates','Maïs, tomates, oignon rouge, vinaigrette.',12000,null),
    ('americaine',301,'Burgers','Burger classique','Bœuf, salade, tomate, oignon, sauce maison.',40000,null),
    ('americaine',301,'Burgers','Cheeseburger double','Deux steaks, double cheddar, cornichons.',55000,null),
    ('americaine',301,'Burgers','Burger poulet croustillant','Poulet pané, salade, mayonnaise.',48000,null),
    ('americaine',301,'Burgers','Burger bacon de bœuf','Bœuf, bacon de bœuf fumé, cheddar.',52000,null),
    ('americaine',301,'Burgers','Burger végétarien','Galette de légumes, avocat, tomate.',38000,null),
    ('americaine',301,'Burgers','Burger épicé','Bœuf, jalapeños, cheddar, sauce piquante.',50000,null),
    ('americaine',301,'Burgers','Burger poisson','Filet de poisson pané, sauce tartare.',45000,null),
    ('americaine',302,'Poulet frit et tenders','Poulet frit (2 pièces)','Deux pièces de poulet frit croustillant.',40000,null),
    ('americaine',302,'Poulet frit et tenders','Tenders de poulet (5)','Cinq filets de poulet panés.',35000,null),
    ('americaine',302,'Poulet frit et tenders','Seau de poulet frit (8 pièces)','Huit pièces de poulet frit à partager.',110000,null),
    ('americaine',302,'Poulet frit et tenders','Sandwich poulet frit','Poulet frit, salade, mayonnaise, pain brioché.',42000,null),
    ('americaine',303,'Hot-dogs et sandwichs','Hot-dog classique','Saucisse de volaille, moutarde, oignons.',25000,null),
    ('americaine',303,'Hot-dogs et sandwichs','Hot-dog au fromage','Saucisse de volaille, cheddar fondu.',30000,null),
    ('americaine',303,'Hot-dogs et sandwichs','Club sandwich','Poulet, œuf, tomate, salade, pain de mie.',38000,null),
    ('americaine',303,'Hot-dogs et sandwichs','Sandwich américain','Steak, frites, fromage, sauce.',42000,null),
    ('americaine',304,'Salades repas','Salade poulet croustillant','Salade, poulet pané, maïs, sauce miel-moutarde.',34000,null),
    ('americaine',304,'Salades repas','Salade bœuf et avocat','Bœuf grillé, avocat, tomates.',40000,null),
    ('americaine',400,'Accompagnements','Frites','Frites croustillantes.',15000,null),
    ('americaine',400,'Accompagnements','Frites cheddar','Frites nappées de cheddar fondu.',22000,null),
    ('americaine',400,'Accompagnements','Potatoes','Quartiers de pommes de terre épicés.',17000,null),
    ('americaine',400,'Accompagnements','Maïs en grains','Maïs au beurre.',10000,null),
    ('americaine',500,'En-cas','Cornet de frites','Un cornet de frites à emporter.',12000,null),
    ('americaine',500,'En-cas','Mini burgers (3)','Trois petits burgers.',45000,null),
    ('americaine',500,'En-cas','Pop-corn de poulet','Bouchées de poulet panées.',20000,null),
    ('americaine',600,'Desserts','Glace vanille','Deux boules de glace à la vanille.',12000,null),
    ('americaine',600,'Desserts','Sundae chocolat','Glace vanille, sauce chocolat, cacahuètes.',18000,null),
    ('americaine',600,'Desserts','Apple pie','Chausson chaud aux pommes.',14000,null),
    ('americaine',700,'Pâtisseries','Brownie','Brownie au chocolat fondant.',15000,null),
    ('americaine',700,'Pâtisseries','Cookie aux pépites de chocolat','Cookie tendre.',8000,null),
    ('americaine',700,'Pâtisseries','Donut glacé','Beignet moelleux, glaçage sucré.',10000,null),
    ('americaine',700,'Pâtisseries','Cheesecake','Part de cheesecake, coulis de fruits rouges.',20000,null),
    ('americaine',800,'Menus et formules','Menu burger','Un burger, frites et une boisson.',60000,null),
    ('americaine',800,'Menus et formules','Menu poulet','Tenders ou poulet frit, frites et une boisson.',55000,null),
    ('americaine',800,'Menus et formules','Menu enfant','Mini burger ou nuggets, frites, jus.',35000,null),
    ('americaine',930,'Boissons lactées','Milkshake fraise','Glace fraise mixée au lait.',20000,null),
    ('americaine',940,'Sodas et rafraîchissements','Limonade glacée','Citron pressé, glace pilée.',10000,null),
    -- ===== FRANÇAISE
    ('francaise',101,'Entrées chaudes','Soupe à l''oignon gratinée','Soupe d''oignons, croûtons gratinés.',18000,null),
    ('francaise',101,'Entrées chaudes','Croque-monsieur','Pain de mie, jambon de dinde, fromage fondu.',24000,null),
    ('francaise',101,'Entrées chaudes','Quiche au poulet','Part de quiche au poulet et aux poireaux.',20000,null),
    ('francaise',101,'Entrées chaudes','Œuf cocotte','Œuf cuit à la crème, pain grillé.',16000,null),
    ('francaise',201,'Entrées froides','Salade verte','Salade, vinaigrette à la moutarde.',10000,null),
    ('francaise',201,'Entrées froides','Salade niçoise','Thon, œuf, tomates, olives, haricots verts.',28000,null),
    ('francaise',201,'Entrées froides','Salade de chèvre chaud','Toasts de chèvre, salade, noix, miel.',30000,null),
    ('francaise',201,'Entrées froides','Salade de crudités','Tomates, concombre, carottes râpées.',12000,null),
    ('francaise',301,'Plats du jour','Poulet rôti et pommes de terre','Poulet rôti, jus et pommes de terre sautées.',45000,null),
    ('francaise',301,'Plats du jour','Steak frites','Steak de bœuf grillé, frites.',55000,null),
    ('francaise',301,'Plats du jour','Blanquette de volaille','Volaille mijotée, sauce crémeuse, riz.',48000,null),
    ('francaise',301,'Plats du jour','Pavé de saumon grillé','Saumon grillé, légumes de saison.',65000,null),
    ('francaise',302,'Sandwichs et croques','Sandwich jambon de dinde beurre','Baguette, jambon de dinde, beurre.',20000,null),
    ('francaise',302,'Sandwichs et croques','Sandwich poulet crudités','Baguette, poulet, salade, tomate.',24000,null),
    ('francaise',302,'Sandwichs et croques','Croque-madame','Croque-monsieur et œuf au plat.',28000,null),
    ('francaise',302,'Sandwichs et croques','Panini poulet fromage','Panini grillé, poulet et fromage fondu.',26000,null),
    ('francaise',303,'Quiches et salades repas','Quiche lorraine de volaille','Part de quiche, lardons de volaille.',22000,null),
    ('francaise',303,'Quiches et salades repas','Quiche aux légumes','Part de quiche aux légumes.',22000,null),
    ('francaise',303,'Quiches et salades repas','Tarte salée au thon','Tarte au thon, tomate, moutarde.',22000,null),
    ('francaise',304,'Crêpes salées','Crêpe complète','Jambon de dinde, fromage, œuf.',26000,null),
    ('francaise',304,'Crêpes salées','Crêpe au poulet','Poulet, champignons, crème.',28000,null),
    ('francaise',304,'Crêpes salées','Galette au fromage','Galette de sarrasin au fromage fondu.',22000,null),
    ('francaise',400,'Accompagnements','Pommes de terre sautées','Pommes de terre dorées.',14000,null),
    ('francaise',400,'Accompagnements','Haricots verts','Haricots verts au beurre.',12000,null),
    ('francaise',400,'Accompagnements','Frites','Frites croustillantes.',15000,null),
    ('francaise',500,'En-cas','Baguette beurre et confiture','Demi-baguette, beurre, confiture.',8000,null),
    ('francaise',500,'En-cas','Petit pain au chocolat chaud','Petit pain fourré au chocolat.',8000,null),
    ('francaise',500,'En-cas','Pain au lait','Petit pain moelleux.',6000,null),
    ('francaise',600,'Desserts','Crêpe sucre citron','Crêpe fine, sucre et citron.',12000,null),
    ('francaise',600,'Desserts','Crêpe au chocolat','Crêpe, sauce chocolat.',16000,null),
    ('francaise',600,'Desserts','Mousse au chocolat','Mousse au chocolat noir.',14000,null),
    ('francaise',600,'Desserts','Crème caramel','Flan au caramel.',12000,null),
    ('francaise',700,'Pâtisseries','Croissant','Croissant pur beurre.',8000,null),
    ('francaise',700,'Pâtisseries','Pain au chocolat','Viennoiserie fourrée au chocolat.',8000,null),
    ('francaise',700,'Pâtisseries','Éclair au chocolat','Éclair à la crème pâtissière.',14000,null),
    ('francaise',700,'Pâtisseries','Tarte aux pommes','Part de tarte aux pommes.',14000,null),
    ('francaise',700,'Pâtisseries','Brioche','Brioche moelleuse.',8000,null),
    ('francaise',800,'Menus et formules','Formule petit-déjeuner','Boisson chaude, viennoiserie, jus.',25000,null),
    ('francaise',800,'Menus et formules','Formule déjeuner','Plat du jour, dessert, boisson.',60000,null),
    ('francaise',800,'Menus et formules','Formule goûter','Crêpe ou gaufre et boisson chaude.',22000,null),
    ('francaise',910,'Boissons chaudes','Café crème','Café et lait chaud.',10000,null),
    ('francaise',910,'Boissons chaudes','Chocolat viennois','Chocolat chaud, crème fouettée.',14000,null),
    ('francaise',920,'Jus et smoothies','Citron pressé','Citron pressé, eau et sucre à part.',9000,null),
    -- ===== MEXICAINE
    ('mexicaine',101,'Entrées chaudes','Quesadilla au fromage','Galette de blé grillée, fromage fondu.',24000,null),
    ('mexicaine',101,'Entrées chaudes','Nachos au fromage','Chips de maïs, fromage fondu, jalapeños.',22000,null),
    ('mexicaine',101,'Entrées chaudes','Soupe de tortilla au poulet','Soupe de tomate, poulet, tortilla croustillante.',18000,null),
    ('mexicaine',101,'Entrées chaudes','Chimichangas au poulet (2)','Deux rouleaux frits au poulet et au fromage.',28000,null),
    ('mexicaine',201,'Entrées froides','Guacamole et chips','Avocat écrasé, citron vert, coriandre.',20000,null),
    ('mexicaine',201,'Entrées froides','Pico de gallo','Tomate, oignon, piment, coriandre.',12000,null),
    ('mexicaine',201,'Entrées froides','Salade mexicaine','Maïs, haricots rouges, tomate, avocat.',22000,null),
    ('mexicaine',301,'Tacos','Tacos au poulet (3)','Trois tortillas de maïs, poulet, oignon, coriandre.',36000,null),
    ('mexicaine',301,'Tacos','Tacos au bœuf (3)','Trois tortillas, bœuf haché épicé, fromage.',38000,null),
    ('mexicaine',301,'Tacos','Tacos aux crevettes (3)','Trois tortillas, crevettes, chou, sauce.',48000,null),
    ('mexicaine',301,'Tacos','Tacos végétariens (3)','Haricots, maïs, avocat, fromage.',30000,null),
    ('mexicaine',302,'Burritos et bowls','Burrito au poulet','Tortilla de blé, poulet, riz, haricots, fromage.',40000,null),
    ('mexicaine',302,'Burritos et bowls','Burrito au bœuf','Tortilla de blé, bœuf, riz, haricots.',42000,null),
    ('mexicaine',302,'Burritos et bowls','Bowl mexicain au poulet','Riz, haricots, poulet, maïs, guacamole.',42000,null),
    ('mexicaine',302,'Burritos et bowls','Burrito végétarien','Tortilla, haricots, riz, légumes grillés.',34000,null),
    ('mexicaine',303,'Quesadillas et fajitas','Quesadilla au poulet','Galette grillée, poulet, fromage, poivrons.',34000,null),
    ('mexicaine',303,'Quesadillas et fajitas','Fajitas de poulet','Poulet, poivrons et oignons sur plaque chaude.',48000,null),
    ('mexicaine',303,'Quesadillas et fajitas','Fajitas de bœuf','Bœuf, poivrons et oignons, tortillas.',52000,null),
    ('mexicaine',304,'Plats mexicains','Enchiladas au poulet','Tortillas roulées, poulet, sauce tomate, fromage.',45000,null),
    ('mexicaine',304,'Plats mexicains','Chili con carne','Bœuf haché, haricots rouges, riz.',42000,null),
    ('mexicaine',304,'Plats mexicains','Riz mexicain','Riz à la tomate et aux épices.',14000,null),
    ('mexicaine',400,'Accompagnements','Riz à la coriandre','Riz parfumé à la coriandre.',12000,null),
    ('mexicaine',400,'Accompagnements','Haricots rouges','Haricots rouges mijotés.',10000,null),
    ('mexicaine',400,'Accompagnements','Chips de maïs','Panier de chips de maïs.',10000,null),
    ('mexicaine',500,'En-cas','Élote (maïs grillé)','Épi de maïs grillé, fromage, citron vert.',12000,null),
    ('mexicaine',500,'En-cas','Taquitos de poulet (4)','Quatre rouleaux frits croustillants.',20000,null),
    ('mexicaine',500,'En-cas','Empanadas au bœuf (2)','Deux chaussons au bœuf épicé.',18000,null),
    ('mexicaine',600,'Desserts','Flan au caramel','Flan maison, caramel.',14000,null),
    ('mexicaine',600,'Desserts','Riz au lait cannelle','Riz au lait, cannelle.',12000,null),
    ('mexicaine',600,'Desserts','Banane frite à la cannelle','Banane frite, sucre cannelle.',12000,null),
    ('mexicaine',700,'Pâtisseries','Churros (6)','Six churros saupoudrés de sucre, sauce chocolat.',16000,null),
    ('mexicaine',700,'Pâtisseries','Gâteau aux trois laits','Part de gâteau imbibé de lait.',16000,null),
    ('mexicaine',800,'Menus et formules','Menu tacos','Trois tacos, riz et une boisson.',48000,null),
    ('mexicaine',800,'Menus et formules','Menu burrito','Un burrito, chips et une boisson.',50000,null),
    ('mexicaine',800,'Menus et formules','Plateau fiesta (4 personnes)','Tacos, quesadillas, nachos et boissons.',190000,null),
    ('mexicaine',920,'Jus et smoothies','Agua de jamaica','Infusion d''hibiscus glacée, citron vert.',10000,null),
    ('mexicaine',930,'Boissons lactées','Horchata','Boisson de riz à la cannelle.',10000,null),
    -- ===== GRECQUE
    ('grecque',101,'Entrées chaudes','Spanakopita (3)','Trois feuilletés aux épinards et à la feta.',20000,null),
    ('grecque',101,'Entrées chaudes','Keftédès (6)','Six boulettes de bœuf aux herbes, sauce yaourt.',24000,null),
    ('grecque',101,'Entrées chaudes','Saganaki','Fromage grec poêlé, citron.',24000,null),
    ('grecque',101,'Entrées chaudes','Soupe de lentilles grecque','Lentilles, tomate, vinaigre et origan.',16000,null),
    ('grecque',201,'Entrées froides','Salade grecque (Horiatiki)','Tomate, concombre, olives, feta, origan.',24000,null),
    ('grecque',201,'Entrées froides','Tzatziki','Yaourt, concombre, ail et menthe.',14000,null),
    ('grecque',201,'Entrées froides','Houmous grec','Pois chiches, tahini, huile d''olive.',16000,null),
    ('grecque',201,'Entrées froides','Feuilles de vigne farcies (6)','Six dolmadès au riz et aux herbes.',20000,null),
    ('grecque',301,'Souvlaki et gyros','Souvlaki de poulet','Brochettes de poulet, pita, tzatziki, frites.',42000,null),
    ('grecque',301,'Souvlaki et gyros','Souvlaki d''agneau','Brochettes d''agneau, pita, tzatziki.',52000,null),
    ('grecque',301,'Souvlaki et gyros','Gyros de poulet en pita','Poulet à la broche, tomate, oignon, tzatziki.',34000,null),
    ('grecque',301,'Souvlaki et gyros','Gyros d''agneau en pita','Agneau à la broche, tomate, oignon, tzatziki.',38000,null),
    ('grecque',302,'Grillades grecques','Côtelettes d''agneau grillées','Côtelettes d''agneau, citron et origan.',75000,null),
    ('grecque',302,'Grillades grecques','Bifteki farci à la feta','Steak haché grillé farci à la feta.',48000,null),
    ('grecque',302,'Grillades grecques','Poulet grillé au citron','Demi-poulet grillé, pommes de terre au citron.',50000,null),
    ('grecque',302,'Grillades grecques','Assiette mixte grecque','Souvlaki, bifteki et poulet, pita, salade.',85000,null),
    ('grecque',303,'Plats mijotés et four','Moussaka à l''agneau','Aubergines, pommes de terre, agneau haché, béchamel.',52000,null),
    ('grecque',303,'Plats mijotés et four','Pastitsio','Gratin de pâtes, bœuf haché, béchamel.',46000,null),
    ('grecque',303,'Plats mijotés et four','Légumes farcis (Yemista)','Tomates et poivrons farcis au riz.',38000,null),
    ('grecque',303,'Plats mijotés et four','Agneau au four et pommes de terre','Agneau rôti au citron et à l''origan.',68000,null),
    ('grecque',304,'Poissons et calamars','Dorade grillée à la grecque','Dorade grillée, huile d''olive et citron.',72000,null),
    ('grecque',304,'Poissons et calamars','Calamars frits','Anneaux de calamars frits, citron.',48000,null),
    ('grecque',304,'Poissons et calamars','Crevettes saganaki','Crevettes, tomate et feta gratinée.',60000,null),
    ('grecque',400,'Accompagnements','Pommes de terre au citron','Pommes de terre rôties au citron.',14000,null),
    ('grecque',400,'Accompagnements','Riz aux herbes','Riz parfumé aux herbes.',12000,null),
    ('grecque',400,'Accompagnements','Pain pita (2)','Deux pains pita chauds.',6000,null),
    ('grecque',500,'En-cas','Pita au gyros de poulet','Petit pita garni, à emporter.',20000,null),
    ('grecque',500,'En-cas','Tyropita (2)','Deux petits feuilletés au fromage.',14000,null),
    ('grecque',500,'En-cas','Olives marinées','Petite coupe d''olives.',8000,null),
    ('grecque',600,'Desserts','Yaourt grec au miel et aux noix','Yaourt épais, miel, noix.',14000,null),
    ('grecque',600,'Desserts','Loukoumades (8)','Huit beignets au miel et à la cannelle.',16000,null),
    ('grecque',600,'Desserts','Riz au lait grec','Riz au lait à la cannelle.',12000,null),
    ('grecque',700,'Pâtisseries','Baklava grec (3)','Trois baklavas au miel et aux noix.',18000,null),
    ('grecque',700,'Pâtisseries','Galaktoboureko','Feuilleté à la crème de semoule, sirop.',16000,null),
    ('grecque',700,'Pâtisseries','Koulourakia (6)','Six biscuits au beurre en forme de tresse.',10000,null),
    ('grecque',800,'Menus et formules','Menu souvlaki','Un souvlaki, frites et une boisson.',50000,null),
    ('grecque',800,'Menus et formules','Menu gyros','Un gyros, frites et une boisson.',45000,null),
    ('grecque',800,'Menus et formules','Plateau grec à partager (4 personnes)','Grillades, mezzés, pita et boissons.',210000,null),
    ('grecque',910,'Boissons chaudes','Thé grec de montagne','Infusion de plantes de montagne.',7000,null),
    ('grecque',940,'Sodas et rafraîchissements','Frappé grec','Café glacé mousseux.',14000,null),
    -- ===== MAROCAINE
    ('marocaine',101,'Entrées chaudes','Harira','Soupe de tomate, lentilles, pois chiches et coriandre.',16000,null),
    ('marocaine',101,'Entrées chaudes','Briouates au poulet (4)','Quatre feuilletés frits au poulet épicé.',22000,null),
    ('marocaine',101,'Entrées chaudes','Briouates au fromage (4)','Quatre feuilletés frits au fromage.',20000,null),
    ('marocaine',101,'Entrées chaudes','Bissara','Soupe de fèves à l''huile d''olive et au cumin.',14000,null),
    ('marocaine',201,'Entrées froides','Zaalouk','Aubergines cuites aux tomates et au cumin.',16000,null),
    ('marocaine',201,'Entrées froides','Salade marocaine','Tomate, concombre, oignon, coriandre.',12000,null),
    ('marocaine',201,'Entrées froides','Taktouka','Poivrons et tomates grillés, ail.',16000,null),
    ('marocaine',201,'Entrées froides','Carottes à la chermoula','Carottes cuites, chermoula, cumin.',14000,null),
    ('marocaine',301,'Tajines','Tajine de poulet aux olives et citron confit','Poulet mijoté, olives vertes, citron confit.',52000,null),
    ('marocaine',301,'Tajines','Tajine d''agneau aux pruneaux','Agneau mijoté, pruneaux, amandes, miel.',65000,null),
    ('marocaine',301,'Tajines','Tajine de bœuf aux légumes','Bœuf mijoté, carottes, pommes de terre, courgettes.',56000,null),
    ('marocaine',301,'Tajines','Tajine de kefta aux œufs','Boulettes de bœuf, sauce tomate, œufs.',44000,null),
    ('marocaine',301,'Tajines','Tajine de poisson','Poisson, tomate, poivrons, chermoula.',60000,null),
    ('marocaine',302,'Couscous','Couscous royal','Semoule, agneau, poulet, merguez de bœuf, légumes.',70000,null),
    ('marocaine',302,'Couscous','Couscous aux sept légumes','Semoule, légumes, pois chiches, bouillon.',46000,null),
    ('marocaine',302,'Couscous','Couscous au poulet','Semoule, poulet, légumes, bouillon.',52000,null),
    ('marocaine',302,'Couscous','Couscous à l''agneau','Semoule, agneau tendre, légumes.',62000,null),
    ('marocaine',303,'Grillades marocaines','Brochettes de kefta (3)','Trois brochettes de bœuf haché aux herbes.',40000,null),
    ('marocaine',303,'Grillades marocaines','Brochettes de poulet (3)','Trois brochettes de poulet marinées.',38000,null),
    ('marocaine',303,'Grillades marocaines','Côtelettes d''agneau','Côtelettes grillées, cumin, citron.',72000,null),
    ('marocaine',304,'Plats traditionnels','Pastilla au poulet','Feuilleté au poulet, amandes et cannelle.',50000,null),
    ('marocaine',304,'Plats traditionnels','Rfissa','Poulet, lentilles, fenugrec, msemen.',55000,null),
    ('marocaine',304,'Plats traditionnels','Tanjia d''agneau','Agneau confit longuement, citron confit.',68000,null),
    ('marocaine',400,'Accompagnements','Semoule aux raisins','Semoule douce aux raisins secs.',12000,null),
    ('marocaine',400,'Accompagnements','Pain marocain (khobz)','Pain rond maison.',5000,null),
    ('marocaine',400,'Accompagnements','Olives et citron confit','Petite assiette d''olives.',8000,null),
    ('marocaine',500,'En-cas','Msemen au miel','Galette feuilletée au miel.',10000,null),
    ('marocaine',500,'En-cas','Batbout farci au poulet','Petit pain farci au poulet.',18000,null),
    ('marocaine',500,'En-cas','Bricks aux œufs (2)','Deux feuilletés à l''œuf.',16000,null),
    ('marocaine',600,'Desserts','Salade d''oranges à la cannelle','Oranges, cannelle, eau de fleur d''oranger.',12000,null),
    ('marocaine',600,'Desserts','Pastilla au lait','Feuilleté à la crème, amandes.',16000,null),
    ('marocaine',600,'Desserts','Dattes fourrées aux amandes','Dattes et pâte d''amande.',14000,null),
    ('marocaine',700,'Pâtisseries','Cornes de gazelle (4)','Quatre biscuits à la pâte d''amande.',14000,null),
    ('marocaine',700,'Pâtisseries','Chebakia (4)','Quatre pâtisseries frites au miel et au sésame.',12000,null),
    ('marocaine',700,'Pâtisseries','Baklawa marocaine (3)','Trois baklawas aux amandes.',16000,null),
    ('marocaine',800,'Menus et formules','Menu tajine','Un tajine, semoule, dessert et boisson.',68000,null),
    ('marocaine',800,'Menus et formules','Menu couscous','Un couscous, un dessert et une boisson.',70000,null),
    ('marocaine',800,'Menus et formules','Plateau marocain (4 personnes)','Couscous, tajine, brochettes et boissons.',230000,null),
    ('marocaine',910,'Boissons chaudes','Thé à la menthe marocain','Thé vert, menthe fraîche, sucre.',7000,null),
    ('marocaine',910,'Boissons chaudes','Café aux épices','Café parfumé aux épices.',8000,null),
    ('marocaine',920,'Jus et smoothies','Jus d''orange pressé à la cannelle','Orange pressée, cannelle.',10000,null),
    -- ===== THAÏLANDAISE
    ('thailandaise',101,'Entrées chaudes','Soupe Tom Yum aux crevettes','Soupe piquante-acide, citronnelle, crevettes.',24000,null),
    ('thailandaise',101,'Entrées chaudes','Soupe Tom Kha au poulet','Soupe de lait de coco, galanga, poulet.',22000,null),
    ('thailandaise',101,'Entrées chaudes','Satay de poulet (4)','Quatre brochettes, sauce aux cacahuètes.',22000,null),
    ('thailandaise',101,'Entrées chaudes','Rouleaux de printemps frits (4)','Quatre rouleaux croustillants, sauce douce.',18000,null),
    ('thailandaise',201,'Entrées froides','Salade de papaye verte (Som Tam)','Papaye verte, tomate, cacahuètes, piment.',20000,null),
    ('thailandaise',201,'Entrées froides','Salade de poulet (Larb)','Poulet haché, menthe, citron vert, riz grillé.',24000,null),
    ('thailandaise',201,'Entrées froides','Rouleaux frais aux crevettes (3)','Trois rouleaux de riz, crevettes, herbes.',20000,null),
    ('thailandaise',201,'Entrées froides','Salade de vermicelles aux crevettes','Vermicelles, crevettes, citron vert, piment.',24000,null),
    ('thailandaise',301,'Currys thaïs','Curry vert au poulet','Poulet, lait de coco, aubergines, basilic thaï.',46000,null),
    ('thailandaise',301,'Currys thaïs','Curry rouge au bœuf','Bœuf, lait de coco, poivrons, piment rouge.',50000,null),
    ('thailandaise',301,'Currys thaïs','Curry Massaman au poulet','Poulet, pommes de terre, cacahuètes, lait de coco.',48000,null),
    ('thailandaise',301,'Currys thaïs','Curry Panang aux crevettes','Crevettes, sauce Panang crémeuse.',58000,null),
    ('thailandaise',302,'Pad et nouilles','Pad thaï au poulet','Nouilles de riz, poulet, œuf, cacahuètes, citron vert.',42000,null),
    ('thailandaise',302,'Pad et nouilles','Pad thaï aux crevettes','Nouilles de riz, crevettes, germes de soja.',50000,null),
    ('thailandaise',302,'Pad et nouilles','Pad see ew au bœuf','Larges nouilles sautées, bœuf, brocoli.',46000,null),
    ('thailandaise',302,'Pad et nouilles','Nouilles aux légumes','Nouilles sautées aux légumes et au tofu.',38000,null),
    ('thailandaise',303,'Riz thaï','Riz sauté à l''ananas','Riz sauté, ananas, poulet, noix de cajou.',40000,null),
    ('thailandaise',303,'Riz thaï','Riz sauté aux crevettes','Riz sauté, crevettes, œuf, ciboule.',46000,null),
    ('thailandaise',303,'Riz thaï','Riz sauté au basilic et poulet','Riz, poulet, basilic thaï, piment.',40000,null),
    ('thailandaise',304,'Woks et grillades','Poulet au basilic thaï (Pad kra pao)','Poulet sauté, basilic, piment, œuf au plat.',44000,null),
    ('thailandaise',304,'Woks et grillades','Bœuf sauté aux poivrons','Bœuf, poivrons et oignons, sauce huître.',50000,null),
    ('thailandaise',304,'Woks et grillades','Poisson frit sauce piquante','Filet de poisson croustillant, sauce thaï.',58000,null),
    ('thailandaise',400,'Accompagnements','Riz jasmin','Riz parfumé vapeur.',8000,null),
    ('thailandaise',400,'Accompagnements','Riz gluant','Riz gluant vapeur.',10000,null),
    ('thailandaise',400,'Accompagnements','Légumes sautés à l''ail','Légumes de saison sautés.',14000,null),
    ('thailandaise',500,'En-cas','Galettes de poisson thaï (4)','Quatre galettes de poisson épicées.',20000,null),
    ('thailandaise',500,'En-cas','Brochette de poulet satay','Une brochette, sauce cacahuète.',8000,null),
    ('thailandaise',500,'En-cas','Beignets de maïs (4)','Quatre beignets de maïs croustillants.',14000,null),
    ('thailandaise',600,'Desserts','Riz gluant à la mangue','Riz gluant, lait de coco, mangue.',20000,null),
    ('thailandaise',600,'Desserts','Perles de tapioca au coco','Tapioca, lait de coco, fruits.',14000,null),
    ('thailandaise',600,'Desserts','Banane au lait de coco','Banane mijotée dans du lait de coco.',14000,null),
    ('thailandaise',700,'Pâtisseries','Beignets de banane (4)','Quatre beignets de banane croustillants.',12000,null),
    ('thailandaise',700,'Pâtisseries','Kanom krok (6)','Six petites crêpes au coco.',12000,null),
    ('thailandaise',700,'Pâtisseries','Flan à la noix de coco','Part de flan à la noix de coco.',14000,null),
    ('thailandaise',800,'Menus et formules','Menu pad thaï','Un pad thaï, un rouleau et une boisson.',55000,null),
    ('thailandaise',800,'Menus et formules','Menu curry','Un curry, riz jasmin et une boisson.',55000,null),
    ('thailandaise',800,'Menus et formules','Plateau thaï à partager (2 personnes)','Deux plats, riz, entrées et boissons.',125000,null),
    ('thailandaise',940,'Sodas et rafraîchissements','Thé glacé thaï','Thé noir, lait et sucre, glaçons.',12000,null),
    ('thailandaise',940,'Sodas et rafraîchissements','Limonade à la citronnelle','Citron, citronnelle, eau pétillante.',10000,null),
    ('thailandaise',920,'Jus et smoothies','Eau de coco','Eau de coco fraîche.',10000,null),
    -- ===== ANTILLAISE (créole)
    ('antillaise',101,'Entrées chaudes','Accras de morue (6)','Six beignets de morue, piment antillais.',16000,null),
    ('antillaise',101,'Entrées chaudes','Boudin de poisson créole','Boudin de poisson épicé, sauce chien.',20000,null),
    ('antillaise',101,'Entrées chaudes','Bouillon de poisson créole','Bouillon de poisson aux légumes-racines.',18000,null),
    ('antillaise',101,'Entrées chaudes','Pâtés créoles au poulet (3)','Trois chaussons feuilletés au poulet épicé.',18000,null),
    ('antillaise',201,'Entrées froides','Féroce d''avocat','Avocat écrasé, morue, piment, farine de manioc.',20000,null),
    ('antillaise',201,'Entrées froides','Salade de christophine','Christophine, ciboulette, citron vert.',14000,null),
    ('antillaise',201,'Entrées froides','Salade de crudités créole','Tomate, concombre, avocat, vinaigrette citron vert.',14000,null),
    ('antillaise',301,'Colombo','Colombo de poulet','Poulet mijoté, poudre de colombo, légumes.',46000,null),
    ('antillaise',301,'Colombo','Colombo de cabri','Chèvre mijotée, colombo, pommes de terre.',60000,null),
    ('antillaise',301,'Colombo','Colombo de légumes','Christophine, aubergine, banane verte, colombo.',34000,null),
    ('antillaise',301,'Colombo','Colombo de crevettes','Crevettes, lait de coco, colombo.',56000,null),
    ('antillaise',302,'Poissons créoles','Court-bouillon de poisson','Poisson mijoté, tomates, piment, épices.',58000,null),
    ('antillaise',302,'Poissons créoles','Poisson grillé sauce chien','Poisson grillé, sauce citron, ail et piment.',62000,null),
    ('antillaise',302,'Poissons créoles','Crevettes sautées sauce créole','Crevettes sautées, tomate, piment et thym.',60000,null),
    ('antillaise',302,'Poissons créoles','Brochette de poisson et légumes','Poisson mariné aux épices créoles.',52000,null),
    ('antillaise',303,'Viandes créoles','Poulet boucané','Poulet fumé au bois, sauce créole.',50000,null),
    ('antillaise',303,'Viandes créoles','Poulet rôti épicé (Jerk)','Poulet mariné aux épices, rôti.',48000,null),
    ('antillaise',303,'Viandes créoles','Ragoût de bœuf créole','Bœuf mijoté, thym, piment, légumes.',54000,null),
    ('antillaise',303,'Viandes créoles','Cabri en sauce','Chèvre en sauce brune épicée.',60000,null),
    ('antillaise',304,'Plats complets créoles','Riz créole au poulet','Riz, poulet, poivrons, tomate et épices.',42000,null),
    ('antillaise',304,'Plats complets créoles','Riz et pois rouges au poulet','Riz, pois rouges, poulet grillé.',44000,null),
    ('antillaise',304,'Plats complets créoles','Plat complet de légumes-racines','Igname, patate douce, banane verte et sauce.',34000,null),
    ('antillaise',400,'Accompagnements','Riz et pois rouges','Riz parfumé aux pois rouges.',12000,null),
    ('antillaise',400,'Accompagnements','Bananes plantains frites','Plantains mûrs frits.',12000,null),
    ('antillaise',400,'Accompagnements','Gratin de christophine','Christophine gratinée.',14000,null),
    ('antillaise',400,'Accompagnements','Frites de patate douce','Patates douces frites.',14000,null),
    ('antillaise',500,'En-cas','Bokit au poulet','Pain frit garni de poulet, salade, sauce.',22000,null),
    ('antillaise',500,'En-cas','Accras de légumes (6)','Six beignets de légumes.',12000,null),
    ('antillaise',500,'En-cas','Chips de banane verte','Fines tranches de banane verte frites.',7000,null),
    ('antillaise',600,'Desserts','Flan coco','Flan à la noix de coco.',14000,null),
    ('antillaise',600,'Desserts','Blanc-manger coco','Crème de coco et vanille.',14000,null),
    ('antillaise',600,'Desserts','Salade de fruits exotiques','Mangue, ananas, papaye, goyave.',14000,null),
    ('antillaise',600,'Desserts','Banane flambée','Banane flambée, sucre roux.',14000,null),
    ('antillaise',700,'Pâtisseries','Gâteau coco','Part de gâteau à la noix de coco.',10000,null),
    ('antillaise',700,'Pâtisseries','Tourment d''amour','Tartelette à la confiture de coco.',12000,null),
    ('antillaise',700,'Pâtisseries','Gâteau patate douce','Part de gâteau à la patate douce.',10000,null),
    ('antillaise',800,'Menus et formules','Menu colombo','Un colombo, riz et une boisson.',55000,null),
    ('antillaise',800,'Menus et formules','Menu bokit','Un bokit, frites et une boisson.',40000,null),
    ('antillaise',800,'Menus et formules','Plateau créole (4 personnes)','Colombo, poulet boucané, riz et boissons.',220000,null),
    ('antillaise',920,'Jus et smoothies','Jus de goyave','Goyave fraîche pressée.',9000,null),
    ('antillaise',920,'Jus et smoothies','Jus de fruit de la passion','Fruit de la passion, sucre de canne.',10000,null),
    ('antillaise',920,'Jus et smoothies','Jus de canne','Canne à sucre pressée.',9000,null),
    ('antillaise',940,'Sodas et rafraîchissements','Punch sans alcool','Jus de fruits tropicaux, citron vert, sirop de canne.',12000,null),
    -- ===== ROUMAINE (européenne)
    ('roumaine',101,'Entrées chaudes','Ciorbă de perișoare','Soupe aigre aux boulettes de bœuf et au riz.',18000,null),
    ('roumaine',101,'Entrées chaudes','Soupe de légumes aux herbes','Soupe de légumes frais, aneth.',14000,null),
    ('roumaine',101,'Entrées chaudes','Papanași salés au fromage (3)','Trois beignets au fromage frais.',18000,null),
    ('roumaine',101,'Entrées chaudes','Bâtonnets de fromage frit','Fromage pané et frit, confiture d''airelles.',20000,null),
    ('roumaine',201,'Entrées froides','Salade d''aubergine (Salată de vinete)','Aubergine grillée, oignon, huile.',16000,null),
    ('roumaine',201,'Entrées froides','Zacuscă et pain','Tartinade d''aubergine et de poivron.',14000,null),
    ('roumaine',201,'Entrées froides','Salade de betteraves','Betteraves, ail, huile.',12000,null),
    ('roumaine',201,'Entrées froides','Salade de bœuf','Bœuf, légumes, mayonnaise.',24000,null),
    ('roumaine',301,'Plats traditionnels roumains','Sarmale','Feuilles de chou farcies au bœuf et au riz.',42000,null),
    ('roumaine',301,'Plats traditionnels roumains','Mămăligă au fromage et crème','Polenta, fromage frais, crème aigre.',30000,null),
    ('roumaine',301,'Plats traditionnels roumains','Sarmale de feuilles de vigne','Feuilles de vigne farcies, crème aigre.',42000,null),
    ('roumaine',301,'Plats traditionnels roumains','Tochitură de poulet','Poulet mijoté, polenta, œuf.',46000,null),
    ('roumaine',302,'Grillades roumaines','Mici (mititei) (5)','Cinq rouleaux de viande hachée grillés, moutarde.',42000,null),
    ('roumaine',302,'Grillades roumaines','Brochettes de poulet','Brochettes de poulet, légumes grillés.',40000,null),
    ('roumaine',302,'Grillades roumaines','Côtelettes d''agneau','Côtelettes d''agneau grillées.',70000,null),
    ('roumaine',302,'Grillades roumaines','Poulet à la roumaine','Poulet rôti, ail et herbes.',46000,null),
    ('roumaine',303,'Soupes repas','Ciorbă de pui','Soupe aigre au poulet et aux légumes.',24000,null),
    ('roumaine',303,'Soupes repas','Ciorbă de burtă','Soupe aigre de tripes à la crème.',26000,null),
    ('roumaine',303,'Soupes repas','Soupe de haricots et fumé','Soupe de haricots blancs.',22000,null),
    ('roumaine',304,'Plats mijotés','Goulash roumain','Bœuf mijoté au paprika, pommes de terre.',46000,null),
    ('roumaine',304,'Plats mijotés','Chiftele sauce tomate','Boulettes de viande, sauce tomate, purée.',38000,null),
    ('roumaine',304,'Plats mijotés','Ghiveci de légumes','Ragoût de légumes au four.',30000,null),
    ('roumaine',400,'Accompagnements','Purée de pommes de terre','Purée maison.',12000,null),
    ('roumaine',400,'Accompagnements','Polenta (mămăligă)','Polenta chaude.',10000,null),
    ('roumaine',400,'Accompagnements','Pain de maïs','Pain rustique de maïs.',8000,null),
    ('roumaine',500,'En-cas','Plăcintă au fromage','Chausson au fromage frais.',12000,null),
    ('roumaine',500,'En-cas','Covrigi (3)','Trois petits pains en anneau.',8000,null),
    ('roumaine',500,'En-cas','Gogoși (4)','Quatre beignets salés à emporter.',10000,null),
    ('roumaine',600,'Desserts','Papanași','Beignets de fromage, crème aigre, confiture.',24000,null),
    ('roumaine',600,'Desserts','Crêpes à la confiture (3)','Trois crêpes fines, confiture.',14000,null),
    ('roumaine',600,'Desserts','Crème de semoule','Semoule au lait et aux fruits.',12000,null),
    ('roumaine',700,'Pâtisseries','Cozonac','Brioche aux noix et au cacao.',14000,null),
    ('roumaine',700,'Pâtisseries','Gâteau Joffre','Gâteau à la crème et au chocolat.',16000,null),
    ('roumaine',700,'Pâtisseries','Gogoși sucrés (4)','Quatre beignets sucrés.',10000,null),
    ('roumaine',800,'Menus et formules','Menu du jour roumain','Soupe, plat du jour et boisson.',52000,null),
    ('roumaine',800,'Menus et formules','Menu mici','Cinq mici, frites, moutarde et boisson.',50000,null),
    ('roumaine',800,'Menus et formules','Plateau roumain (4 personnes)','Sarmale, mici, polenta et boissons.',200000,null),
    ('roumaine',920,'Jus et smoothies','Compote de fruits','Boisson de fruits cuits, sucrée.',9000,null),
    ('roumaine',940,'Sodas et rafraîchissements','Limonade roumaine à la menthe','Citron, menthe, eau pétillante.',9000,null);

  create temp table t_plats on commit drop as
  with rc as (
    select r.id as resto_id, r.i, r.region, r.groupe, r.restr, r.alcool, k.cuisine, (k.rk - 1)::int as rang_cuisine, cardinality(r.cuisines) as nb_cuisines
    from t_resto r cross join lateral unnest(r.cuisines) with ordinality as k(cuisine, rk)),
  pool as (
    select distinct on (rc.resto_id, c.nom)
           rc.resto_id, rc.i, rc.region, rc.nb_cuisines, rc.rang_cuisine,
           c.pos + (case when c.pos between 300 and 399 then rc.rang_cuisine * 10 else 0 end) as pos,
           c.section, c.nom, c.description, c.prix, c.reg
    from rc join t_catalogue c on (c.cuisine = rc.cuisine or c.cuisine = '*' or (c.cuisine = '*a' and rc.alcool)) and (c.reg is null or c.reg = rc.groupe)
    where rc.restr is null or c.pos < 300 or c.pos >= 400 or c.section = any(rc.restr)
    order by rc.resto_id, c.nom, rc.rang_cuisine),
  ranked as (
    select pool.*, row_number() over (partition by resto_id, section order by random()) as rang_section, random() as alea
    from pool),
  classe as (
    -- Les plats régionaux et un article au moins par rubrique d'abord, puis le reste au hasard jusqu'à la taille du menu.
    select ranked.*, row_number() over (partition by resto_id
             order by (reg is null and rang_section > 1), ((pos between 300 and 399) and rang_cuisine > 0)::int, alea) as rang
    from ranked)
  select gen_random_uuid() as id, resto_id, i, pos, section, nom, description,
         greatest(1000, (round(prix * (0.85 + ((i * 37) % 36) / 100.0) * (case when region = 'Conakry' then 1.0 else 0.92 end) * (0.95 + random() * 0.10) / 500.0) * 500))::int as prix
  -- Règle de taille : de 30 à 45 articles par menu (un menu plus long fatigue le choix), un peu plus pour les restaurants à plusieurs cuisines.
  from classe where rang <= least(45, 30 + (i * 5) % 11 + 4 * (nb_cuisines - 1));

  insert into public.menu_sections (restaurant_id, nom, position)
  select resto_id, section, row_number() over (partition by resto_id order by minpos, section)
  from (select resto_id, section, min(pos) as minpos from t_plats group by resto_id, section) s;

  insert into public.menu_items (id, restaurant_id, nom, description, prix, disponible, disponibilite_confirmee_le, section_id, cree_le)
  select p.id, p.resto_id, p.nom, p.description, p.prix,
         (random() > 0.04), now() - (random() * interval '40 minutes'),
         (select s.id from public.menu_sections s where s.restaurant_id = p.resto_id and s.nom = p.section),
         now() - interval '30 days'
  from t_plats p;

  -- Options (suppléments) sur environ trois articles sur quatre des articles concernés. Les rubriques variant selon la cuisine,
  -- le type d'article se reconnaît à son nom ou à sa rubrique.
  insert into public.menu_item_options (menu_item_id, nom, prix)
  select p.id, o.nom, o.prix
  from t_plats p join (values
    ('burger', 'Fromage supplémentaire', 5000), ('burger', 'Bacon de bœuf', 8000), ('burger', 'Menu frites et boisson', 18000),
    ('pizza', 'Taille familiale', 30000), ('pizza', 'Fromage double', 10000),
    ('sauce', 'Portion de viande en plus', 12000), ('sauce', 'Œuf dur', 3000),
    ('grill', 'Portion de frites', 15000), ('grill', 'Piment maison', 2000),
    ('brochette', 'Brochettes supplémentaires (2)', 15000),
    ('sandwich', 'Fromage', 5000), ('sandwich', 'Frites', 15000),
    ('curry', 'Naan supplémentaire', 8000), ('curry', 'Riz basmati', 12000),
    ('nouilles', 'Œuf au plat', 4000), ('nouilles', 'Sauce pimentée', 2000),
    ('shake', 'Chantilly', 3000),
    ('formule', 'Boisson en plus', 8000)
  ) o (type, nom, prix)
    on o.type = (case
      when p.section = 'Menus et formules' then 'formule'
      when p.section in ('Currys', 'Biryanis et riz') then 'curry'
      when p.section in ('Riz sauté et nouilles', 'Ramen et plats chauds') then 'nouilles'
      when p.section = 'Boissons lactées' and p.nom ~* '^milkshake' then 'shake'
      when p.nom ~* '^(burger|cheeseburger|mini burgers)' then 'burger'
      when p.nom ~* '^(pizza|calzone)' then 'pizza'
      when p.nom ~* '^brochettes' then 'brochette'
      when p.nom ~* '^(sandwich|shawarma|döner|tacos|wrap|panini|club sandwich|hot-dog|burrito|croque)' then 'sandwich'
      when p.section = 'Riz et sauces' then 'sauce'
      when p.section in ('Grillades et brochettes', 'Poissons et fruits de mer', 'Grillades et suya', 'Grillades et plateaux', 'Grillades turques') then 'grill'
      else null end)
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
