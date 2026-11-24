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
- **Halal :** ni porc ni alcool dans le catalogue de démonstration.
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
5. **Formules, menus et plateaux :** jamais la photo d'un seul plat.
6. **Couverture :** les articles placés en premier (entrées, plats) choisissent d'abord, les boissons et pâtisseries ensuite.

### Photos de banque et images IA : attention

- **Uber Eats, DoorDash et Deliveroo exigent des photos authentiques du plat vendu :** DoorDash refuse les images génériques, illustrations et clip-art ; Deliveroo n'autorise pas les images générées par IA ; Uber Eats refuse les images de stock trouvées sur le web.
- **Conséquence pour Speedfood :** les photos de banque et les images IA sont une solution de **démonstration**. Pour de vrais restaurants, **la photo du restaurant passe toujours avant**, et une image IA ou de banque est retirée dès que le restaurant envoie la sienne.
- Une image IA est signalée « Image illustrative » (fiche et page de crédits). Une photo Wikimedia sous licence CC BY ou CC BY-SA est créditée (auteur, licence, lien) sur une page de crédits publique ; la photo modifiée reste sous la même licence pour le CC BY-SA.
- Conditions d'usage commercial du modèle IA utilisé : **à vérifier avant tout usage en production** (non lues à ce jour).

## 6. Contrôles automatiques

- Démonstration (`npm run test:demonstration`, 49 contrôles) : 10 rubriques de base dans chaque menu, rubriques toutes issues du catalogue, ordre constant, aucune marque ni porc ni alcool, tailles de menu, variété des profils, couverture des cuisines, **règle de catégorie vérifiée sur chacun des 60 restaurants**.
- Règles de menu et de photos (`menu-regles.test.mts`) : seuils d'affichage, recherche, repli, unicité des photos, exactitude, variété, priorité des sources, formules, cas limites.
