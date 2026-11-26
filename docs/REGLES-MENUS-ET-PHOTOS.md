# Règles des menus, des catégories et des photos (24 novembre 2026)

Ces règles s'appliquent aux restaurants réels comme à la démonstration. Elles sont écrites dans le code (`apps/web/src/lib/menu/affichage.ts`, `apps/web/src/lib/menu/photos.ts`, générateur `supabase/demo/charger-demonstration.sql`) et vérifiées par des tests (`menu-regles.test.mts`, `demonstration-base.mjs`).

**Sources.** Pages publiques et guides des plateformes (Uber Eats, DoorDash, Deliveroo, ChowNow, StoreKit). Plusieurs chiffres viennent de blogs de vendeurs et ne sont pas vérifiés de façon indépendante : ils servent de repères, pas de dogmes. À confirmer sur les données réelles de Speedfood une fois les premières commandes passées.

## 1. Classer un restaurant

| Cas | Catégorie | Pourquoi |
|---|---|---|
| Une seule cuisine | La catégorie de cette cuisine (Italien et pizzas, Indien, Maghrébin, Méditerranéen, Antillais et créole, Européen, Mexicain, Français, Asiatique, Libanais et oriental, Africain, Riz & sauces…) | Comme sur les places de marché, une cuisine = un filtre |
| Plusieurs cuisines différentes (mixte, international) | **Cuisine du monde** | Jamais la catégorie de la première cuisine : un restaurant qui sert de l'indien, du chinois et de l'italien n'est pas « Indien » |
| Guinéen + autre cuisine africaine | **Africain** | Toutes les cuisines sont africaines |
| Maison de grillades | Grillades | Menu limité aux grillades et poissons |
| Café-boulangerie du matin | Petit-déjeuner | Menu limité aux sandwichs, quiches et crêpes salées |
| Bistrot français | Français | |

La catégorie vient des plats réellement servis, jamais du nom du restaurant. Si une catégorie n'existe pas encore en base, on retombe sur la plus proche des quatre catégories d'origine (Riz & sauces, Grillades, Fast-food, Petit-déjeuner), sans casser le chargement.

Les profils de la démonstration sont tirés au sort avec des poids différents à Conakry et dans les régions (plus de guinéen et d'africain hors Conakry), pour que la démonstration montre toute la variété sans qu'aucune cuisine ne domine.

## 2. Construire un menu

- **Taille :** de 30 à 45 articles pour un restaurant, un peu plus s'il propose plusieurs cuisines (jamais plus de 45 dans la démonstration). Un menu plus long fatigue le choix : StoreKit conseille « 20 articles excellents plutôt que 50 moyens », ChowNow parle de « fatigue de décision ».
- **Rubriques :** de 6 à 20, des noms courts (1 à 4 mots), jamais de rubrique vide, et toujours le même ordre : entrées chaudes, entrées froides, plats principaux (rubriques propres à la cuisine, comme « Pizzas » ou « Currys »), accompagnements, en-cas, desserts, pâtisseries, menus et formules, puis les boissons (chaudes, jus et smoothies, lactées, sodas, eaux). Les meilleures ventes ne sont pas enterrées au milieu : les premiers et derniers articles d'une liste sont les plus regardés.
- **Porc et marques :** aucun porc dans le catalogue de démonstration, aucune marque commerciale dans un nom d'article (voir la section 8 pour l'alcool, classé à part).
- **Suppléments :** peu et utiles (fromage, frites, boisson). Les longues listes d'options ralentissent la commande et augmentent les erreurs.
- **Noms :** aucune marque commerciale dans le nom d'un article.

## 3. Afficher un long menu (téléphone d'abord)

| Règle | Seuil | Effet |
|---|---|---|
| Barre de rubriques | 5 rubriques ou plus | Barre qui défile en ligne, collée en haut, avec le nombre d'articles par rubrique |
| Recherche dans le menu | 20 articles ou plus | Champ de recherche, sans accent ni majuscule, tous les mots doivent correspondre |
| Rubrique longue | plus de 8 articles | Les 6 premiers, puis « Voir les N autres » (seulement quand tout le menu est affiché) |
| Recherche en cours | | Aucune rubrique repliée : rien n'est caché |
| Sans JavaScript | | Menu entier affiché, dans l'ordre du restaurateur |

**Cas limites déjà gérés :** menu vide ou sans rubrique (aucune aide affichée, aucune erreur), rubrique vide (masquée), rubrique d'un seul article, nom très long (retour à la ligne, aucun débordement horizontal), recherche sans résultat (message clair), article indisponible (reste visible, marqué), article sans photo (voir plus bas).

## 4. Photographier un plat

Repères communs aux plateformes (certains chiffres varient selon la source et la région) :

- **Un seul plat par photo,** centré, entièrement visible (80 % au moins), fond simple, lumière naturelle près d'une fenêtre, sans texte, bordure, main ni personne, sans marque visible.
- **Montrer ce que le client reçoit,** à la vraie portion : pas une version idéalisée ou générique.
- **Format :** paysage 4:3, 1200 × 900 px au minimum (DoorDash demande 1400 × 800 au plus), JPEG ou PNG de l'original, moins de 8 Mo ; pour les articles empilés (burgers, gâteaux, boissons) un angle de 45 degrés ; une image d'en-tête qui montre plusieurs plats pour le restaurant. Speedfood sert chaque photo en 4:3, 900 px, compressée (moins de 150 Ko).
- **Pas d'image trouvée sur un moteur de recherche** : droits clairs seulement.
- Les menus avec photos vendent plus (DoorDash avance jusqu'à 44 % de ventes en plus, chiffre non vérifié) ; avoir des photos sur une partie seulement des articles suffit déjà à aider.

## 5. Attribuer les photos (même photo pour plusieurs articles ?)

1. **Exactitude :** une photo n'est donnée qu'à un article du même type de plat. **Pas de photo vaut mieux qu'une photo qui ne correspond pas.** Un article sans photo valable affiche une illustration neutre.
2. **Unicité :** une même photo n'apparaît **jamais deux fois dans un même menu** (règle de DoorDash). Si un menu compte plus d'articles d'un type que de photos de ce type, les derniers restent sans photo.
3. **Variété :** deux restaurants qui servent le même plat ne montrent pas forcément la même photo (point de départ propre à chaque restaurant).
4. **Source, par ordre de priorité :** (a) la photo du restaurant, authentique ; (b) les banques libres de droits (Wikimedia Commons avec crédit, Pexels sans crédit obligatoire) ; (c) en dernier recours l'image générée par IA.
5. **Formules, menus et plateaux :** jamais la photo d'un seul plat. Ils reçoivent une photo de formule (plusieurs éléments, propre à leur cuisine : mezzé, grillades, thali, sushis, burger, petit-déjeuner…), de type `formule-…`. À l'inverse un plat ne reçoit jamais une photo de formule. Une formule ambiguë (« Plateau à partager ») n'a pas de photo plutôt qu'une photo fausse.
6. **Couverture :** les articles placés en premier (entrées, plats) choisissent d'abord, les boissons et pâtisseries ensuite.

### Photos de banque et images IA : attention

- **Uber Eats, DoorDash et Deliveroo exigent des photos authentiques du plat vendu :** DoorDash refuse les images génériques, illustrations et clip-art ; Deliveroo n'autorise pas les images générées par IA ; Uber Eats refuse les images de stock trouvées sur le web.
- **Conséquence pour Speedfood :** les photos de banque et les images IA sont une solution de **démonstration**. Pour de vrais restaurants, **la photo du restaurant passe toujours avant**, et une image IA ou de banque est retirée dès que le restaurant envoie la sienne.
- Une image IA est signalée « Image illustrative » (fiche et page de crédits). Une photo Wikimedia sous licence CC BY ou CC BY-SA est créditée (auteur, licence, lien) sur une page de crédits publique ; la photo modifiée reste sous la même licence pour le CC BY-SA.
- Conditions d'usage commercial du modèle IA utilisé : **à vérifier avant tout usage en production** (non lues à ce jour).

## 6. Contrôler chaque image avant de la retenir

Plusieurs sources se complètent : photo du restaurant, banques libres (Pexels, Wikimedia), image IA pour les plats sans photo. Aucune image n'entre dans la bibliothèque (`bibliotheque-photos.ts`) sans ces trois contrôles :

1. **Contrôle automatique** (`node scripts/controle-photos.mjs <dossier>`) : vrai PNG ou JPEG, format 4:3, 1200 × 900 minimum, moins de 8 Mo, aucun doublon exact, fichier décrit dans le manifeste, aucun fichier sans description.
2. **Contrôle visuel en grand format** (planche de contrôle, pas la vignette de 256 px qui cache le texte et les marques) : le bon plat, un seul plat (ou plusieurs éléments pour une formule), aucun texte, logo, marque, main ni personne, rien de coupé, rien de dégoûtant ou d'irréaliste. Une image douteuse est refaite ou écartée.
3. **Manifeste** (`manifeste.json`) : pour chaque image, le type de plat, la source, le modèle et la consigne (IA) ou l'auteur, la licence et la page (banque), la date, la mention « image illustrative » pour l'IA, le verdict visuel et sa note. Le contrôle automatique refuse tout verdict autre que « valide ».

## 7. Contrôles automatiques

- Démonstration (`npm run test:demonstration`, 49 contrôles) : 10 rubriques de base dans chaque menu, rubriques toutes issues du catalogue, ordre constant, aucune marque ni porc ni alcool, tailles de menu, variété des profils, couverture des cuisines, **règle de catégorie vérifiée sur chacun des 60 restaurants**.
- Règles de menu et de photos (`menu-regles.test.mts`) : seuils d'affichage, recherche, repli, unicité des photos, exactitude, variété, priorité des sources, formules, cas limites.

## 8. Boissons avec et sans alcool, classées à part

**Deux familles, jamais mélangées**, chacune avec son titre de groupe dans le menu (`src/lib/menu/boissons.ts`, `MenuFiltre`) :

| Famille | Rubriques | Dans le menu |
|---|---|---|
| **Boissons sans alcool** | Boissons chaudes, Jus et smoothies, Boissons lactées, Sodas et rafraîchissements, Boissons énergisantes, Mocktails, Eaux | Titre « Boissons sans alcool » avant la première |
| **Boissons avec alcool** | Bières, Vins, Cocktails, Spiritueux et digestifs | Titre « Boissons avec alcool », pastille 18+, avertissement « Réservé aux personnes majeures. L'abus d'alcool est dangereux pour la santé » |

- **Qui en sert :** pas tous les restaurants. Jamais une maison de grillades ni un café du matin ; rare chez les restaurants guinéens ou africains (environ 8 %) ; plus fréquent chez les restaurants du monde (55 % à Conakry, 25 % dans les régions). Un restaurant qui en sert propose les 4 rubriques, pas une seule.
- **Rien d'alcoolisé hors des rubriques « avec alcool »** et ces rubriques ne contiennent que de l'alcool. Une bière sans alcool ou un mocktail (« Mojito sans alcool ») est classé avec les boissons sans alcool.
- **Sans marque :** « Boisson énergisante 25 cl », « Soda cola », « Whisky (4 cl) », jamais le nom d'une marque. Les cocktails portent le nom de leur recette (Mojito, Piña colada).
- **Photos :** un cocktail, un vin ou une bière ont chacun leur type de photo ; aucun n'est affiché sans photo contrôlée du bon type (voir sections 5 et 6).
- **À décider avant une vraie mise en ligne :** la vente d'alcool par livraison est réglementée. Avant d'ouvrir ces rubriques à de vrais restaurants, il faut : une case « sert de l'alcool » activée par Speedfood après vérification de l'autorisation du restaurant, une confirmation de majorité du client à la commande, et une vérification de l'âge à la livraison. Sans ces trois garde-fous, ces rubriques restent réservées à la démonstration.

## 9. Brancher les photos sur la démonstration (procédure en trois temps)

La bibliothèque (types de plat vers fichiers) n'apparaît à l'écran qu'une fois les fichiers hébergés et `menu_items.photo_url` renseigné. Le plan est calculé par `src/lib/menu/plan-photos-demo.ts` (fonction pure, testée) et appliqué par `apps/web/scripts/demo/photos-demonstration.mjs`. Chaque étape est séparée et rien n'est écrit sans option explicite :

| Étape | Commande (depuis `apps/web`, avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans l'environnement) | Effet |
|---|---|---|
| 1. Plan | `node scripts/demo/photos-demonstration.mjs --racine-images <dossier>` | Lit le lot (`demo_lot`), calcule quelle photo va sur quel plat, écrit `plan.json` et `credits.json`. **Ne modifie rien.** |
| 2. Envoi | `… --envoyer` | Envoie les fichiers dans le bucket `medias` sous `demo/photos/…`. Écrit dans le stockage. |
| 3. Écriture | `… --appliquer` | Renseigne `photo_url` des seuls plats qui n'en ont pas (jamais d'écrasement d'une photo propre au restaurant). |
| Retour arrière | `… --retirer` | Remet à vide les `photo_url` du lot qui pointent vers `demo/photos/`. |

- **Ordre obligatoire :** envoi avant écriture, sinon les plats pointent vers des fichiers absents.
- **Crédits :** `credits.json` liste les photos utilisées avec auteur, licence et lien. Celles sous CC BY ou CC BY-SA (`obligatoire: true`) doivent figurer sur une page de crédits publique **avant** toute mise en ligne.
- **Images IA :** les plats concernés sont listés dans `platsIllustratifs` ; le mot « image illustrative » doit s'afficher sur leur fiche.
- **Suppression de la démo :** `fn_demo_supprimer` retire les restaurants et plats du lot ; les fichiers de `demo/photos/` restent dans le bucket et se vident à part.

## 10. Mention « Image illustrative » (survol, désactivable depuis la console)

- **Quoi :** une image générée par ordinateur porte un petit repère « i » discret (55 % d'opacité) qui se déplie en « Image illustrative » au survol de l'image ou au focus clavier (`MentionIllustrative`, CSS dans `marche.css`). Elle apparaît sur les fiches de plats (`VignettePlat`) et dans « Plats à découvrir » (page `/restaurants`). Une photo de banque ou propre au restaurant n'en porte jamais.
- **Reconnaissance :** par l'adresse. Le plan de rattachement range les images IA sous `demo/photos/ia/` (`cheminStockage`), et `estImageIllustrative` ne regarde que cela. Aucune colonne en base n'est nécessaire.
- **Console :** interrupteur `mention_image_illustrative` (écran « Mises à jour », réservé au super administrateur), actif par défaut ; coupé, la mention disparaît et les images restent. Il faut d'abord appliquer la migration `20261125090000_mention_image_illustrative.sql` pour que la ligne existe ; tant qu'elle n'existe pas, la mention est active (état inconnu = actif).
- **Restant :** sur téléphone, le survol n'existe pas : le repère « i » reste visible et se déplie au toucher (focus). Les cartes de restaurants et l'accueil n'affichent pas de photos de plats, donc rien à y marquer.

## 11. Application mobile : photos, mention et recherche d'articles (25/11/2026)

- **Ce que l'API envoie déjà :** `photoUrl` de chaque plat (`GET /api/v1/catalogue/restaurants/{id}/menu`). Depuis le 25/11 elle montre aussi les restaurants de démonstration (le filtre `donnees_demo` est retiré, comme sur le site).
- **Mention « Image illustrative » :** le menu porte `imageIllustrative: true` sur les plats à image IA, **seulement si** l'interrupteur `mention_image_illustrative` de la console est allumé (lu avec un cache de 60 s). L'appli affiche un petit « i » dans l'angle de la vignette ; un appui ouvre « Image illustrative : elle ne montre pas le plat réellement servi ». Interrupteur coupé : plus aucun champ, plus de repère, sans nouvel APK.
- **Recherche d'articles :** route publique `GET /api/v1/catalogue/articles` (index compact de TOUS les articles publiés : restaurants listés une fois, photos relatives à `baseImages`, cache serveur 2 min). L'appli relit l'index au plus toutes les 30 minutes, le garde 7 jours pour le hors ligne, et cherche **sur le téléphone** avec le moteur partagé `packages/shared/src/menu/recherche-articles.ts` (le même que le site) : ordre libre des mots, mots collés, milieu de mot, mots clés de la description, équivalents de langue (pollo, chicken), fautes, lettres manquantes (« pzza »), mots composés, familles de plats. Niveaux : « Plats trouvés », « Plats proches de votre recherche », « Plats similaires ».
- **Limite connue :** l'index tient dans environ 500 Ko (2 300 articles) ; au-delà d'environ 15 000 articles il faudra passer la recherche dans la base (extensions `pg_trgm` et `unaccent`, non installées aujourd'hui) pour ne pas alourdir le téléphone.
- **Crédits :** lien « Crédits photos » dans Paramètres et dans Aide (page `/credits-photos` du site).
- **Code partagé :** `types-plats`, `recherche-plats`, `recherche-articles` et `image-illustrative` vivent dans `packages/shared/src/menu/` ; le site garde des raccords d'une ligne (test `paquet-partage`).

## 12. Horaires, disponibilité et Cote Speedfood (26/11/2026)

- **Horaires lisibles :** `packages/shared/src/horaires/horaires.ts` comprend le texte déjà saisi par les restaurateurs (« Tous les jours, 11h-23h », « Lundi au samedi, 11h-15h et 18h-23h », « Jeudi au dimanche, 18h-01h ») et dit « Ouvert jusqu'à 23h », « Ferme bientôt (22h) », « Ouvre à 18h », « Ouvre demain à 11h ». Heure de Conakry = UTC. Texte non compris : rien n'est deviné. **L'interrupteur « Ouvert » du restaurateur l'emporte toujours** : jamais « ouvert jusqu'à » pour un restaurant fermé, jamais « ouvre à » pour un restaurant qui s'est déclaré ouvert.
- **Démonstration vivante :** 10 horaires différents ; ouvert selon l'heure ; une maison sur 17 fermée exceptionnellement ; une sur 9 en pause « cuisine débordée » (change chaque heure) ; taux de rupture de 2 à 25 % selon la maison ; une maison sur 11 « négligente » qui ne reconfirme pas ses plats (« à confirmer »). Le renouvellement toutes les 5 minutes (`lib/demonstration/horaires.ts`, `rafraichir.ts`) applique les mêmes règles, avec un aléa stable tiré de l'identifiant.
- **Cote Speedfood (`packages/shared/src/notation/cotation.ts`) :** la note que le client voit. Trois choix propres : cote **lissée** (moyenne tirée vers 4,2 avec le poids de 8 avis : 5,0 sur 1 avis donne 4,3, jamais devant 4,8 sur 300) ; **fiabilité** dite en clair (« Nouveau » sous 5 avis, nombre d'avis en « 200+ », « 500+ ») ; **badges** « Très apprécié » (4,6 et plus, 30 avis au moins), « Valeur sûre » (4,3 et plus, 100 avis au moins), « Nouveau », et « Menu frais » (90 % des plats confirmés récemment : la promesse de fraîcheur de la marque). Sans avis : aucune cote. La moyenne brute reste dans `note`. Le score qualité mensuel (côté restaurateur) est inchangé.
- **Avis de démonstration :** qualité propre à chaque restaurant (notes moyennes de 3 à 4,7), étiquettes (« Plat chaud », « Plat froid »…) cohérentes avec la note. Allergènes fictifs : cinq maisons sur six déclarent leurs plats (déduits du nom et de la description avec les mêmes mots que le moteur), une sur six ne déclare rien.
