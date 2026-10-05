# Lot « Menu du jour » (5 octobre 2026)

Deux écrans de l'espace restaurateur, sans changement de base de données ni service externe.

## 1. Ouvrir ma journée (`/restaurant/ouverture`)

Le matin, une ligne par plat avec deux gros boutons : **Oui** ou **Épuisé** (48 px, aucun champ à taper). Raccourcis « Tout est
disponible » et « Tout est épuisé », compteur en direct, un seul bouton « Ouvrir ma journée » qui envoie tous les choix en une
requête (`ouvrirJourneeAction`).

- Un « Oui » met `disponible = true` et remet l'heure de confirmation à maintenant (c'est la promesse de fraîcheur de Speedfood :
  « confirmé il y a 12 min » côté client). Un « Épuisé » retire le plat de la vente.
- Le restaurant vient de la session, jamais du formulaire ; seuls les plats non archivés du restaurant sont touchés ; les champs
  `plat_<uuid>` sont validés et bornés à 500 (`src/lib/menu/ouverture.ts`, testé).
- Les plats sont regroupés par section du menu. Sans JavaScript, le formulaire fonctionne quand même (boutons radio natifs).
- Accès : carte « Ma journée » sur l'accueil, bouton sur la page « Mon menu ».

## 2. Menu du jour (`/restaurant/menu-du-jour`)

Une image 1080 × 1920 (format statut WhatsApp) dessinée dans le navigateur (canvas), sans serveur d'images.

- Seuls les plats **disponibles et confirmés dans le délai de fraîcheur** sont proposés ; 6 plats au plus, au choix.
- L'image porte : le logo (si disponible), la couleur d'accent du restaurant, le nom, la date, les plats avec leur prix
  (prix promo et « au lieu de »), l'heure de confirmation, « Les plats peuvent s'épuiser dans la journée », « Commandez sur
  Speedfood » et le nom d'hôte du site. Elle ne promet jamais un stock.
- Boutons : **Partager mon menu** (feuille de partage du téléphone, avec le texte), **Enregistrer l'image**, **Copier le texte**.
  Sans partage de fichiers (ordinateur), l'image est enregistrée avec une indication pour la publier en statut.
- Le texte accompagnant l'image contient le lien complet du restaurant (`/restaurants/<id>`).

## Choix assumés

- Pas de « plat du jour » à part : le menu du jour est l'ensemble des plats confirmés ce jour-là (moins de concepts, pas de
  migration). Un plat « à la une » pourrait venir plus tard.
- Pas de rappel automatique chaque matin : il demanderait une notification planifiée (autre lot).
- L'adresse complète n'est pas dessinée dans l'image (illisible sur un statut) : elle figure dans le texte joint.

## Vérifié

- 17 tests purs (`scripts/tests/menujour.test.mts`) : lecture du formulaire, sélection des plats frais, promo, formats, texte.
- Parcours réel en local avec un restaurateur de test sur un écran de 390 px : choix, écriture en base, redirection, image
  1080 × 1920 peinte, export PNG, téléchargement nommé `menu-du-jour-AAAA-MM-JJ.png`, sélection modifiable. Défaut trouvé et
  corrigé : la barre de validation recouvrait la navigation du bas sur téléphone.
- **Non vérifié** : le partage réel vers WhatsApp depuis un téléphone (feuille de partage native), l'export avec le logo d'un
  restaurant réel (si le navigateur refuse d'exporter un logo venant d'un autre domaine, l'image est refaite sans le logo).
