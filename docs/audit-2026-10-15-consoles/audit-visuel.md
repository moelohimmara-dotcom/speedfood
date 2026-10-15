# Audit visuel des consoles, 15 octobre 2026

Complète l'audit de code (`README.md` de ce dossier). **Lecture seule** sur la production réelle (`speedfood-app.moelohimmara.workers.dev`), connecté en super admin (compte rattaché aussi au restaurant « barbie food »). Seules des navigations et des défilements ont été faits : aucun bouton d'action n'a été activé, rien n'a été enregistré ni supprimé.

## Méthode et limites

- **Largeurs** : 320 px (petit téléphone, premier relevé), 375 × 812 (téléphone réel) et 1280 × 800 (ordinateur).
- **Relevés automatiques** par script sur **28 pages** (14 `/system`, 9 `/restaurant`, plus sous-pages) : débordement horizontal, cibles tactiles de moins de 40 px (les liens de ligne étendus par `::after` ne sont pas comptés), contraste de texte sur fond uni, images sans `alt`, styles en ligne, hauteur de page.
- **Limites** : le contraste n'est mesuré que sur des fonds unis (dégradés, images et états conditionnels non couverts) ; je n'ai pas testé le clavier ni un lecteur d'écran ; je n'ai pas vu les écrans qui n'apparaissent qu'avec certaines données (fiche restaurant, fiche commande, éditeur de pages à blocs) ni les états d'erreur ; aucune commande en attente n'était à traiter, donc la carte « à traiter » n'a pas été vue. Mon premier relevé (volet de 287 px de haut) activait par erreur la règle « téléphone en paysage » : les constats sur la barre basse viennent du second relevé à 375 × 812.
- Les captures sont dans `captures/` ; celle de la page Commandes du restaurateur n'est pas conservée (elle affichait le numéro d'un client).

## Ce qui va bien (mesuré)

- **Aucun débordement horizontal** sur les 28 pages à 320 px.
- **Aucun contraste de texte insuffisant détecté** par le script sur fonds unis.
- **Console restaurateur : aucune cible de moins de 40 px** sur ses 9 pages mesurées, la meilleure des deux consoles ; **barre basse fixée en bas** sur téléphone réel (66 px, 4 entrées), masquée sur ordinateur où la barre latérale prend le relais.
- Interrupteur « Visible » de la Géographie correct (corrigé hier), groupe « Points centraux à compléter » replié (une ligne au lieu de 46).
- Aucune image sans `alt`.

## Constats

### Graves

**VIS-1. La Taxonomie est inutilisable et dangereuse** (`/system/catalogue/taxonomie`).
- La liste « Quartiers » affiche **943 boutons dont 471 « Supprimer »**, parmi lesquels **304 quartiers techniques « Centre de … »** (les quartiers génériques qui représentent les communes hors Conakry). Page de **31 000 px** de haut sur ordinateur, **37 600 px** sur téléphone, avec **1 435 styles en ligne**.
- Risque **vérifié dans le code** : `supprimerElementTaxonomieAction` (`src/lib/system-admin/taxonomie.ts:148-165`) fait un `delete` définitif et ne le refuse que si un restaurant utilise le quartier. Un quartier technique sans restaurant se supprime donc sans obstacle : la commune perd sa représentation (plus de restaurant possible dans cette commune) et, par les suppressions en cascade de la base (`zone_alertes.neighborhood_id`, `restaurant_zones_desservies.neighborhood_id`), les inscrits à la liste d'attente et les zones de livraison rattachés à ce quartier sont **effacés**. L'écran ne devrait pas les montrer (la Géographie les masque déjà).
- Correction : filtrer `generique = false` comme la Géographie, ajouter recherche et pagination, ou retirer les quartiers de la Taxonomie au profit de la Géographie.

**VIS-2. Le rappel de double authentification mange l'écran du téléphone.** Hauteur mesurée : **125 px à 375 px de large**, **65 px sur ordinateur**. Avec l'en-tête (65 px), le titre de la page commence à **222 px sur 812** : plus d'un quart de l'écran avant tout contenu, sur **chaque page des deux consoles** tant qu'il n'est pas masqué. La documentation promet « une ligne, deux sur téléphone » (audit du 4 octobre, Y4) : ce n'est plus le cas. Voir `captures/01-bandeau-2fa-telephone.jpg`.

**VIS-3. Boutons coupés dans les listes de la Taxonomie** (320 et 375 px) : « Modifier » et « Supprimer » sont plus larges que la carte, « Supprimer » touche ou dépasse le bord droit. Le défaut est local à la carte (pas de défilement horizontal de la page, donc non détecté par le relevé de débordement). Voir `captures/02` et `captures/03`.

### Moyens

**VIS-4. Géographie (mon écran d'hier) : cibles trop petites et page lourde.** Sur ordinateur : **152 formulaires**, **616 cibles de moins de 40 px**. Les principaux : la case de sélection (22 px) et le lien « Voir comme un visiteur » (21 px de haut) répétés sur chaque ligne, plus les liens des pastilles du panneau Qualité (21 px). Hauteur de page : 4 200 px (ordinateur), 8 300 px (téléphone). Les panneaux « Région de Conakry » et « Préfectures » affichent le **même nom et le même point** (Conakry est à la fois région et préfecture) : information en double. Voir `captures/04`.

**VIS-5. Navigation latérale sous la taille de confort.** Boutons de famille de **28 px** de haut, liens de **38 px**, au lieu des 44 px du design système (confirme A-04 de l'audit de code, mesuré sur ordinateur).

**VIS-6. Journal d'audit : 71 lignes sans pagination, identifiants illisibles.** Libellés de cible du type « Restaurant 73bd8244 » et « Page d'aide 53f71135 » (fragment d'identifiant au lieu d'un nom), **61 liens de 21 px** sur téléphone, 77 styles en ligne. Page de 15 900 px sur téléphone.

**VIS-7. Support commandes : liens de restaurant de 21 px** dans les cartes (7 liens), non étendus à la carte.

**VIS-8. Design : 35 cibles de moins de 40 px** (onglets de groupe à 25 px, champs à 34 à 38 px).

**VIS-9. Sous-navigation en onglets** : sur 320 px, les six onglets du Catalogue occupent **trois rangées** de boutons à bordure épaisse (environ 120 px) avant le contenu, alors que le menu latéral/tiroir offre les mêmes entrées. Voir `captures/06`.

### Mineurs

- **Tableau de bord** : sur téléphone, les raccourcis (« Valider un restaurant », « Commandes du jour »…) sont des boutons-pastilles empilés pleine largeur qui précèdent les données ; 53 styles en ligne.
- **Styles en ligne** : Taxonomie 1 435, Journal 77, Commandes du restaurateur 68, Tableau de bord 53, Comptes 34, Menu du restaurateur 26, Profil 23 (valeurs mesurées dans le DOM, répétées par ligne).
- **Hauteurs de page** à 320 px : Taxonomie 37 600, Journal 15 900, Textes 9 700, Géographie 8 300, Mises à jour 7 500.

## Corrections à l'audit de code

- **Barre basse du restaurateur** : conforme sur téléphone réel. Elle devient statique sur un écran de moins de 520 px de haut (règle « téléphone en paysage », voulue).
- **« Cadre épais autour des cartes sur téléphone »** (conflit `console-b.css` / `admin.css`) : **non confirmé**, je n'ai pas vu les tableaux en cartes de près ; à vérifier.
- **`.dj-modifie` mangue sur crème** : état conditionnel non vu à l'écran ; le constat de code (1,5:1) reste valable mais non confirmé visuellement.

## Relevé par page (320 px de large)

| Page | Cibles | < 40 px | Hauteur (px) | Styles en ligne |
|---|---|---|---|---|
| /system | 62 | 0 | 6 204 | 53 |
| /system/catalogue/restaurants | 38 | 0 | 4 756 | 3 |
| /system/catalogue/taxonomie | 966 | 0 | 37 639 | 1 435 |
| /system/catalogue/geographie | 1 863 | 434 | 8 321 | 1 |
| /system/catalogue/couverture | 10 | 0 | 4 067 | 1 |
| /system/catalogue/liste-attente | 12 | 0 | 1 685 | 1 |
| /system/catalogue/mises-en-avant | 13 | 0 | 1 161 | 5 |
| /system/contenu/pages | 13 | 0 | 1 700 | 2 |
| /system/contenu/bannieres | 17 | 0 | 1 472 | 5 |
| /system/contenu/medias | 8 | 0 | 790 | 3 |
| /system/contenu/textes | 65 | 0 | 9 697 | 1 |
| /system/commandes | 31 | 7 | 2 890 | 1 |
| /system/acces/comptes | 22 | 0 | 1 655 | 34 |
| /system/acces/roles | 11 | 0 | 1 259 | 10 |
| /system/acces/paliers | 14 | 0 | 3 192 | 5 |
| /system/parametres | 26 | 0 | 4 166 | 5 |
| /system/design | 58 | 35 | 2 248 | 2 |
| /system/mises-a-jour | 16 | 0 | 7 464 | 2 |
| /system/audit | 68 | 61 | 15 901 | 77 |
| /system/parametres/reinitialisation | 6 | 0 | 1 023 | 3 |
| /restaurant | 25 | 0 | 3 654 | 17 |
| /restaurant/commandes | 26 | 0 | 2 255 | 68 |
| /restaurant/menu | 79 | 0 | 4 678 | 26 |
| /restaurant/profil | 61 | 0 | 5 938 | 23 |
| /restaurant/ouverture | 17 | 0 | 1 111 | 4 |
| /restaurant/menu-du-jour | 9 | 0 | 769 | 5 |
| /restaurant/tables | 10 | 0 | 939 | 6 |
| /restaurant/affiche | 10 | 0 | 1 653 | 9 |
| /restaurant/documents | 14 | 0 | 1 685 | 4 |

Aucune de ces pages ne déborde horizontalement ni n'a de contraste de texte insuffisant sur fond uni.

## Conséquences pour la phase 0

À ajouter aux correctifs de fiabilité de l'audit de code : **VIS-1** (Taxonomie : masquer les quartiers génériques, paginer), **VIS-2** (rappel 2FA réduit à une ligne sur téléphone), **VIS-3** (boutons de la Taxonomie), **VIS-4** (cibles de la Géographie : étendre le lien à la ligne, case de sélection de 44 px, fusionner région et préfecture quand elles ont le même nom).
