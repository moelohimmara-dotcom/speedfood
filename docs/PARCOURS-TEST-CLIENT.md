# Parcours de test de l'espace client

**But :** vérifier, avec un vrai compte client, tout ce que les tests automatiques ne peuvent pas prouver (pages, parcours, notifications sur un téléphone). Durée : 20 à 30 minutes.

**Règle :** le compte de test est créé **par vous**, pas par un agent (un agent n'a pas le droit de créer un compte ni de saisir un mot de passe). Les données d'essai (restaurant, plats, commandes) sont créées par `scripts/parcours-client-test.mjs`, marquées « test », et s'effacent d'une commande.

## 0. Préparation

1. **Déployer** la version qui contient l'espace client (sans cela, les pages n'existent pas en ligne).
2. **Créer le compte de test** sur `https://speedfood-app.moelohimmara.workers.dev/entrer` (e-mail et mot de passe, ou Google), puis terminer la page « Bienvenue » (pseudo et avatar). Utilisez une adresse e-mail qui vous appartient (par exemple `prenom+speedfood@gmail.com`, qui arrive dans votre boîte habituelle).
3. **Créer les données d'essai** (un agent ou vous) :
   ```
   node scripts/parcours-client-test.mjs creer <e-mail du compte> --public
   ```
   `--public` publie un restaurant « ESSAI Parcours client (ne pas commander) », nécessaire pour les favoris et « Commander à nouveau ». **Tant qu'il est publié, le public peut le voir.** Faites l'étape 9 dès que vous avez fini.

## 1. Mon espace (`/compte`)

- Se connecter, ouvrir **Mon compte**. Attendu : un bloc « Mon espace » avec six entrées : Mes commandes, Mes restaurants favoris, Mes adresses, Mes avis, Mes préférences, Sécurité du compte.
- Le pied de page (colonne Clients) propose **Mon compte, Mes commandes, Mes favoris** ; la colonne Restaurateurs dit « Espace restaurateur ».

## 2. Mes commandes (`/compte/commandes`)

Attendu : trois commandes d'essai, avec la pastille **Test**.
- **En cours** : une commande en livraison, « Acceptée, en préparation », total **18 000 GNF** (3 jus à 5 000 + 3 000 de livraison).
- **Passées** : une « Remise » (payée, Orange Money, il y a 2 jours) et une « Refusée par le restaurant ».
- Bouton **Suivre ma commande** sur la commande en cours → ouvre `/suivi` sur cette commande, sans qu'aucun lien secret n'apparaisse dans la barre d'adresse.
- Bouton **Mon reçu** sur la commande payée → ouvre son reçu.
- Bouton **Voir le détail** sur la commande terminée → suivi, avec l'invitation à noter le restaurant.

## 3. Commander à nouveau

Sur la commande terminée (Riz ×2, Poulet braisé ×1 avec Piment, Poisson grillé ×1), appuyez sur **Commander à nouveau** :
- Attendu : le **panier** s'ouvre avec Riz ×2 et Poulet braisé + Piment ×1, **au prix d'aujourd'hui** (poulet à 30 000 GNF, prix promotionnel), et un bandeau « « Poisson grillé (indisponible) » n'est plus proposé… ».
- Remplir le panier avec un autre restaurant d'abord, puis recommencer : Attendu : la question « Remplacer le panier ? ».

## 4. Favoris

- Ouvrir la fiche du restaurant d'essai : bouton **Ajouter aux favoris** (♡ → ♥). `/compte/favoris` le liste, **Retirer** l'enlève.
- Déconnecté, le même bouton devient « Enregistrer ce restaurant » et mène à la connexion.

## 5. Adresses

- `/compte/adresses` : ajouter « Maison » (la première devient « Par défaut »), puis quatre autres ; la **sixième est refusée**. « Utiliser par défaut » et « Supprimer » (supprimer la défaut en promeut une autre).
- Passer au panier, **Passer la commande**, choisir **Livraison** : une liste « Mes adresses » apparaît et préremplit le champ.

## 6. Préférences

- `/compte/preferences` : choisir **Livraison** comme mode habituel, enregistrer. À la prochaine commande, la livraison est proposée d'abord (un QR de table scanné reste prioritaire).

## 7. Avis

- Sur la commande terminée, laisser un avis depuis le suivi ; `/compte/avis` le montre avec sa date.

## 8. Alertes de suivi (sur un téléphone, idéalement)

1. `/compte/preferences` → **Activer les alertes ici** → autoriser les notifications.
2. Depuis l'ordinateur :
   ```
   node scripts/parcours-client-test.mjs notifier SF-ESSA2 prete
   ```
   Attendu : une notification « Commande prête » sur le téléphone ; un clic ouvre `/compte/commandes`. (Le texte arrive depuis notre serveur ; le signal envoyé à Google ou Apple est vide.)
3. Couper « Me prévenir quand ma commande avance » dans les préférences, rejouer `notifier … acceptee` : **aucune** notification.
4. **Désactiver sur cet appareil** : plus aucune notification.

## 9. Nettoyage (obligatoire)

```
node scripts/parcours-client-test.mjs nettoyer
```
Supprime le restaurant d'essai, son menu, les commandes d'essai, les lignes, les avis et notifications qui s'y rattachent. Vos favoris, adresses et préférences restent (ce sont les vôtres) ; supprimez-les à la main si vous voulez un compte vierge, ou supprimez le compte depuis `/compte`.

## Ce que ce parcours ne couvre pas

Un client dont les commandes ont été passées **sans compte** (rattachement automatique par téléphone vérifié : non fait), et le paiement en ligne (éteint).
