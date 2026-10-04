# Illustrations vectorielles et réinitialisation de l'application

Décidé avec Malika le 4 octobre 2026. Ordre de réalisation : 1) illustrations, 2) réinitialisation, 3) site public (direction B « Marché »).

## 1. Illustrations vectorielles modifiables

**But.** Donner un visuel à chaque plat, à chaque restaurant et à chaque logo de démonstration, sans photo, de façon entièrement modifiable depuis la console admin, et préparer la matière du site public.

**Principe.** Aucun SVG brut n'est stocké ni téléversé (le téléversement refuse déjà le SVG : risque de code malveillant). Une illustration est un petit objet de paramètres, dessiné par un composant de l'application à partir d'un catalogue fermé de motifs.

- Colonne `illustration jsonb` (nullable) sur `restaurants` (deux clés : `logo`, `couverture`) et sur `menu_items`.
- Forme d'un élément : `{ motif, fond, forme, accent, texte?, genere }`. `motif` appartient à une liste blanche (riz gras, sauce feuille, poisson braisé, brochettes, poulet, burger, frites, sandwich, shawarma, pizza, café, croissant, thé, jus, pâtisserie, alloco, boisson, monogramme…). Les trois couleurs sont des codes hexadécimaux validés. `texte` : 3 caractères au plus (initiales). `genere` vaut vrai pour les éléments produits automatiquement.
- Une contrainte de base et une validation serveur identiques refusent toute valeur hors liste.
- **Priorité d'affichage** : photo téléversée, sinon illustration, sinon rien. Une vraie photo remplace toujours l'illustration.
- **Composant** `Illustration` (serveur, SVG pur, sans script) : nom accessible fourni par le plat ou le restaurant, jamais de HTML injecté.
- **Console admin** : sur la fiche restaurant et sur chaque plat, un éditeur (choix du motif, trois couleurs, initiales, aperçu en direct, bouton « Revenir à l'illustration automatique », bouton « Supprimer »). Les éléments `genere` portent la pastille « Illustration de démonstration ».
- **Sous-agent graphiste** : il dessine le catalogue de motifs (un composant par motif, palette Speedfood) et un jeu de logos fictifs (monogrammes, assiettes, enseignes). Je relis chaque motif avant de le brancher. Un script rattache les motifs aux restaurants et plats marqués `donnees_demo`, par famille et par mots du nom.
- **Espace restaurateur** : hors de ce lot, traité avec le chantier de l'espace restaurateur.

**Tests.** Validation (valeurs hors liste refusées), rendu de chaque motif, priorité photo, absence totale de SVG brut en entrée, contraste des couleurs par défaut.

## 2. Réinitialisation de toute l'application

**But.** Remettre l'application à l'état neuf, en un seul coup, pour enregistrer de vraies données de production.

**Conservé** : comptes super administrateur (et leurs rôles), paramètres de l'application, quartiers, catégories de plats, journal d'audit (qui reçoit en plus l'événement de réinitialisation).

**Supprimé** : restaurants, menus, sections, suppléments, commandes et tout ce qui s'y rattache (lignes, options, événements de statut, propositions), mises en avant, abonnements aux alertes, profils clients, pages d'aide et bannières, compteurs de limitation, tous les comptes sauf les super administrateurs, tous les fichiers du stockage `medias`.

**Protections** (fonction toujours disponible, choix de Malika, donc protections maximales) :
1. Visible et exécutable par le seul rôle `super_admin`, contrôlé dans la page, dans l'action serveur et dans la fonction de base (`SECURITY DEFINER`).
2. Double authentification obligatoire (niveau AAL2) ; sans elle, la page n'offre qu'un lien pour l'activer.
3. Étape 1 : simulation en lecture seule qui affiche le nombre exact d'éléments supprimés par catégorie.
4. Étape 2 : saisie de la phrase exacte « REINITIALISER SPEEDFOOD », d'un motif écrit (10 caractères au moins) et case « j'ai compris que c'est irréversible ». Un jeton à usage unique valable 5 minutes lie l'étape 1 à l'étape 3.
5. Étape 3 : sauvegarde automatique avant tout effacement (tables en JSON et copie des fichiers dans un bucket privé `sauvegardes`, sans aucune règle d'accès hors clé de service). Si la sauvegarde échoue, rien n'est supprimé.
6. Suppression des données en une seule transaction (tout ou rien), puis suppression des fichiers du stockage, puis événement d'audit `application.reinitialisation` avec le motif et le nombre d'éléments supprimés.
7. Limite : une réinitialisation par heure au plus.

**Risque résiduel assumé** : sans verrou de mise en production, un compte super administrateur compromis pourrait tout effacer ; la double authentification obligatoire, la sauvegarde préalable et le journal limitent le dommage. Option de durcissement ultérieure : verrou irréversible.

**Tests.** Rejeu sur base de test avec données d'exemple : simulation exacte, exclusion des conservés, transaction qui échoue au milieu (aucune suppression partielle), refus pour chaque autre rôle et sans double authentification, jeton expiré ou réutilisé, échec de sauvegarde. **Aucun effacement réel en production par l'assistant** : seule la simulation y est exécutée ; l'exécution réelle est faite par Malika.

## 3. Site public (direction B)

Spécifié séparément après les deux premiers lots, avec les illustrations comme matière visuelle. Contraintes déjà arrêtées : pas de faux chiffres, charte mise à jour avant tout changement, tunnel de commande et comptes clients intacts, nouvelles routes `/comment-ca-marche` et `/quartiers/[quartier]`.
