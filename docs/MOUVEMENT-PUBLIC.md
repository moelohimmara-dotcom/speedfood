# Mouvement du site public (direction B, « Marché en photos »)

Lot du 5 octobre 2026. Tout est décoratif, en CSS ou en animation du navigateur, sans bibliothèque, et **coupé par `prefers-reduced-motion: reduce`**.

- **Le plat vole vers le panier** (`src/lib/mouvement/vol.ts`) : à l'ajout, une bille avec la photo du plat file vers la barre de panier (ou la colonne de panier sur grand écran) qui rebondit à l'arrivée.
- **Barre de panier** : elle monte depuis le bas au premier ajout ; le total et le badge de la navigation basse rebondissent à chaque changement.
- **Entrée de page** : fondu court avec légère montée à chaque changement de page.
- **Cascade des plats** : au chargement, au changement de section et de tri du menu (`MenuFiltre`).
- **Cartes de restaurants et titres de section** : apparition au défilement (`Revelation`) ; le carrousel « Plats du moment » s'aligne au défilement et ses cartes arrivent l'une après l'autre.
- **Retour au toucher** : les boutons, cartes, pastilles et la barre de panier s'enfoncent légèrement ; au survol (souris) les cartes se soulèvent.
- **Chargement** : cartes squelettes qui respirent (`/restaurants`).

Mesure : avec un processeur ralenti 4 fois (téléphone d'entrée de gamme simulé), 4 images sur 100 dépassent 50 ms pendant l'ajout. À valider sur un vrai téléphone.
Non fait : transitions de page croisées (View Transitions), frise animée du suivi de commande.
