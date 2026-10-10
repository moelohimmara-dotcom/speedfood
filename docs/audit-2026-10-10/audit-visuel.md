# Audit visuel — Speedfood

**État : partiel, production revue le 10 octobre 2026.** Checkout : `origin/master` au commit `494398ecc0551fad9b8da26d70c4b8760a07e80c`.

## Méthode et preuves

Deux captures ont été produites dans Chromium sur `/restaurants` : mobile (viewport demandé 375 × 812 px, zone de contenu 360 px) et bureau (1280 × 800 px, zone de contenu 1265 px). Dans les deux cas, la largeur de défilement égale la largeur de contenu et aucune erreur ni avertissement JavaScript n’a été relevé. L’outil rend les captures dans la trace de la session, sans export PNG disponible dans le dépôt.

## Majeur — Fraîcheur insuffisante des plats mis en avant

- **Écran / rôle / viewport :** `/restaurants`, visiteur, 375 px et 1280 px.
- **Constat :** les 12 plats visibles de « Plats à découvrir » portent « À confirmer », alors que la page annonce un restaurant ouvert aux commandes.
- **Règle :** la spécification pilote exige une disponibilité horodatée et visible lorsqu’elle devient périmée.
- **Impact :** la mise en avant de plats non reconfirmés peut créer une attente erronée de disponibilité.
- **Correction proposée :** afficher l’heure/date de dernière confirmation sur chaque plat et privilégier les disponibilités fraîches dans le carrousel.

## Mineur — Navigation de bureau sous la cible tactile

- **Écran / rôle / viewport :** `/restaurants`, visiteur, 1280 px.
- **Constat :** les six liens principaux de navigation mesurent 40 px de haut.
- **Règle :** DESIGN-SYSTEM.md fixe une cible tactile minimale de 44 px.
- **Correction proposée :** définir une hauteur minimale de 44 px sans réduire le focus visible.

## Non vérifié

Comparaison locale/production, mesure WCAG AA complète, parcours fiche/panier/commande/suivi, états d’erreur et de chargement, et rôles `operations`, `content_editor` et `support`.
