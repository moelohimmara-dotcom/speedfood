# Restructuration proposée — Landing page Speedfood

**Statut :** proposition de structure et de hiérarchie  
**Objectif :** présenter Speedfood comme un service destiné aux restaurants de toutes les localités de Guinée, aider le visiteur à choisir sa zone et l'orienter vers des restaurants réellement disponibles.

## Parcours recherché

La page répond dans cet ordre aux questions du visiteur :

1. Qu'est-ce que Speedfood ?
2. Où puis-je chercher ?
3. Quels restaurants et plats sont disponibles dans cette zone ?
4. Comment commander, suivre et recevoir ma commande ?
5. Comment un restaurant peut-il rejoindre Speedfood ?

La promesse est nationale ; les résultats, la disponibilité et les conditions de livraison sont contextualisés par localité et par restaurant.

## Ordre recommandé des sections

### 1. En-tête

**Contenu :** logo, Restaurants, Explorer les localités, Comment ça marche, Restaurateurs, Aide, Connexion et Panier.

**Rôle :** donner accès aux deux publics principaux — clients et restaurateurs — sans faire de « Quartiers » l'unique point d'entrée géographique.

### 2. Hero avec recherche de localité

**Titre :** Les restaurants de votre localité, sur Speedfood.  
**Texte :** Trouvez des restaurants et des plats disponibles partout en Guinée. Choisissez votre zone pour découvrir les options qui s'y trouvent.  
**Contrôle central :** champ de recherche d'une localité.  
**Action principale :** Voir les restaurants.  
**Action facultative :** Utiliser ma position.

**Éléments de confiance sous le champ :** zone sélectionnée, possibilité de la modifier, mention de couverture pilote si nécessaire.

**À éviter :** un hero centré uniquement sur « commande de quartier à Conakry » si l'ambition et la taxonomie géographique sont nationales.

### 3. Catégories et plats disponibles

**Titre :** Qu'avez-vous envie de manger ?  
**Contenu :** catégories et plats provenant de la zone sélectionnée, avec prix, restaurant, localité et heure de confirmation ou mention « disponibilité à confirmer ».

**Rôle :** permettre une découverte rapide sans déconnecter les plats de leur zone réelle.

### 4. Restaurants de la zone

**Titre dynamique :** Restaurants disponibles à [localité].  
**Contenu :** cartes de restaurants avec statut, localité, plats, prix et modalités de service connues.  
**Action :** Voir tous les restaurants de cette zone.

**État vide :** expliquer qu'aucun restaurant n'est référencé dans la zone pour le moment et permettre de choisir une localité voisine.

### 5. Explorer les localités

**Titre :** Choisissez une localité.  
**Contenu :** navigation ou recherche géographique hiérarchique : région, préfecture, commune/ville, sous-préfecture, district, quartier/secteur, selon les données disponibles.

**Rôle :** rendre le produit pertinent pour une personne qui souhaite chercher ailleurs que dans sa position actuelle, ou qui ne souhaite pas partager sa position.

**À distinguer dans l'interface :**

- où le restaurant se trouve ;
- où il livre ;
- s'il propose le retrait.

### 6. Comment ça marche

**Titre :** De la recherche à la commande.  
**Étapes :** choisir une zone, consulter les menus, envoyer une commande, suivre les mises à jour et organiser retrait ou livraison avec le restaurant.

**Rôle :** expliquer les responsabilités de Speedfood et du restaurant sans promettre une livraison ou une confirmation automatique si elles ne sont pas garanties.

### 7. Suivi et paiement

**Titre :** Suivez les mises à jour du restaurant.  
**Contenu :** aperçu du statut de commande et mention claire du paiement direct auprès du restaurant.

**Rôle :** lever les incertitudes sur l'après-commande. Employer une formulation conditionnelle au rythme de mise à jour réel, plutôt que « toujours » ou « en direct » si le statut est actualisé manuellement.

### 8. Bloc restaurateurs

**Titre :** Présentez votre restaurant sur Speedfood.  
**Contenu :** création et vérification de la fiche, saisie de la localité, définition des zones desservies, publication du menu et réception des commandes. Mention de l'encaissement direct si cela correspond au service.

**Action :** Devenir partenaire.

### 9. FAQ ou accès à l'aide

Mettre en avant les questions qui peuvent empêcher une commande :

- Speedfood est-il disponible dans ma localité ?
- Comment savoir si le restaurant livre à mon adresse ?
- Puis-je retirer ma commande ?
- Comment le paiement se passe-t-il ?
- Que signifie l'heure de confirmation d'un plat ?

Les réponses doivent suivre la couverture et les règles réellement en vigueur.

### 10. Pied de page

**Contenu :** résumé exact du service, lien d'aide, restaurants, exploration des localités, espace restaurateurs, confidentialité et informations sur la phase pilote si elle s'applique.

## Adaptation géographique des composants

### Recherche

- Autoriser la recherche par les niveaux géographiques réellement enregistrés.
- Afficher clairement la localité choisie et offrir un moyen simple de la changer.
- La détection de position reste facultative ; la recherche manuelle ne doit pas être cachée derrière cette option.

### Carte restaurant

Présenter la localisation au niveau de précision connu. Ne pas inventer quartier, adresse, distance ou coordonnées.

### Livraison et retrait

Traiter la localisation du restaurant et son périmètre de livraison comme deux informations distinctes. Les frais et délais ne s'affichent que lorsqu'ils sont fournis et fiables.

### Fraîcheur des informations

Séparer les statuts du restaurant, l'acceptation des commandes et la disponibilité du plat. Montrer l'heure de confirmation ; si l'information est trop ancienne ou absente, demander confirmation plutôt que garantir la disponibilité.

## Priorités de restructuration

1. Remplacer la formulation qui fait du quartier l'unique échelle par une promesse de recherche par localité.
2. Installer le choix de zone dans le premier écran.
3. Contextualiser les catégories, plats et restaurants par la zone sélectionnée.
4. Distinguer présence d'un restaurant, zones de livraison et retrait.
5. Revoir les promesses de disponibilité et de suivi pour les aligner sur la fraîcheur réelle des données.
6. Garder une mention visible de la phase pilote si la couverture actuelle est plus limitée que l'ambition nationale.

## Critères d'acceptation éditoriaux

- Le premier écran permet de comprendre la portée nationale du produit et de choisir une localité.
- La personne peut chercher manuellement sans autoriser la géolocalisation.
- Les résultats affichent la zone de recherche et la localisation des restaurants.
- La page ne confond jamais localité du restaurant et zone de livraison.
- Aucun délai, frais, disponibilité ou couverture n'est présenté sans donnée correspondante.
- Une absence de résultats propose une action utile pour changer de zone.
- Le texte de suivi décrit les mises à jour réellement fournies par le restaurant.
- Si le service est encore en pilote, sa couverture active est indiquée sans présenter l'ambition nationale comme une disponibilité déjà acquise.
