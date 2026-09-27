# Speedfood — prototype cliquable

Prototype de validation produit, sans backend. À utiliser pour montrer le concept à des restaurateurs et clients de Conakry avant d'investir dans l'architecture complète décrite dans `PLAN-EXECUTION.md`.

## Ouvrir le prototype

Double-cliquez sur `index.html` pour l'ouvrir dans votre navigateur. Aucune installation n'est nécessaire.

## Ce qui est couvert

- Accueil et recherche, filtres par catégorie, quartier et "ouvert maintenant"
- Restaurants favoris (♥), avec une page dédiée "Vos favoris" accessible depuis l'en-tête
- Fiche restaurant, menu, ajout au panier (un seul restaurant à la fois)
- Coordonnées client, choix retrait ou livraison, adresse conditionnelle
- Résumé puis envoi de la demande de commande
- Page de suivi client avec les statuts : en attente, acceptée, prête, terminée, refusée, et temps de préparation estimé
- "Mes commandes" : historique des commandes passées dans ce navigateur, avec accès rapide au suivi et bouton "Recommander"
- Espace restaurant : tableau de bord (à traiter / en préparation / estimé du jour), commandes en cours séparées de l'historique, actions accepter/refuser/prête/terminée, activation/désactivation des plats, fermeture temporaire du restaurant
- Navigation adaptée mobile (onglets en bas) et barre de panier flottante pendant la commande

## Ce qui n'est pas dans ce prototype

- Aucun compte réel, aucune authentification
- Aucune base de données partagée : chaque navigateur a ses propres données, stockées en local (`localStorage`)
- Pas de paiement, pas de notification réelle (WhatsApp, SMS), pas de calcul de livraison réel
- Pas de gestion des propositions de prix révisées par le restaurant après envoi (fonctionnalité prévue dans `PLAN-EXECUTION.md`, bloc 7, mais volontairement absente de ce prototype pour rester rapide à tester)
- Pas de CMS système (rôles internes Speedfood)

## Réinitialiser les données de démonstration

Ouvrez la console du navigateur (F12) et lancez :

```js
localStorage.clear()
```

Puis rechargez la page.

## Suite logique

Une fois ce prototype testé avec de vrais restaurateurs et clients (retours sur le concept, le vocabulaire, les quartiers, le mode de paiement), passer au `PLAN-EXECUTION.md` pour construire le MVP réel avec base de données, authentification et séparation multi-restaurants.
