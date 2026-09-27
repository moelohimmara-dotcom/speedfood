# Cadrage produit — Speedfood

## Vision

Un portail web PWA qui aide les habitants de Conakry à découvrir les menus et à commander auprès des restaurants. Chaque établissement dispose de sa propre console simple pour gérer son activité; l’équipe Speedfood dispose d’un CMS système pour administrer restaurants, contenus et opérations. Chaque restaurant garde la main sur ses prix, la disponibilité de ses plats et l’acceptation des commandes.

## Utilisateurs

- **Client** : cherche une adresse ou un plat, consulte un menu et envoie une demande de commande.
- **Restaurateur / équipier** : gère uniquement son établissement depuis une console mobile simple.
- **Administrateur système** : gère la plateforme dans un CMS distinct, selon son rôle (opérations, contenu, support, super-admin).

## Tranche MVP proposée

1. Catalogue public, recherche et filtres par catégorie/quartier.
2. Page restaurant avec menu et disponibilité.
3. Panier et commande sans paiement en ligne.
4. Confirmation par le restaurant et état de commande visible au client.
5. Console dédiée à chaque restaurant pour commandes, menu, disponibilité, horaires et profil.
6. CMS système pour comptes/établissements, modération, contenus publics, taxonomie, support et audit avec permissions séparées.
7. PWA installable, shell/page hors connexion et cache limité aux ressources statiques.

Le prototype actuel couvre visuellement et localement les étapes 1 à 4 et une ébauche de la console restaurant. Il ne fournit pas encore de comptes, de persistance partagée, de notification réelle, de PWA installable ni de CMS système.

## Hypothèses à valider avant les intégrations

- Le client peut commander depuis le navigateur sans installer la PWA.
- La PWA n’accepte aucune mutation hors ligne et ne met en cache aucune commande ou donnée personnelle.
- Le restaurant confirme la disponibilité avant que la commande soit considérée comme acceptée.
- Le retrait et la livraison sont choisis par le restaurant; la livraison et ses frais sont confirmés avec lui.
- Le paiement se fait directement avec le restaurant pendant le pilote.
- Le lancement se concentre sur une zone de Conakry et un petit groupe d’établissements.
- Le modèle commercial initial est gratuit ou à faible friction pendant le pilote; un abonnement restaurant sera testé après observation d’un usage réel.

## Règles métier de départ

- Une commande appartient à un restaurant; le panier ne mélange pas plusieurs établissements dans la première version.
- Les états sont : `en_attente`, `acceptee`, `refusee`, `prete`, `terminee`, `annulee`.
- Le prix du plat et son nom sont copiés dans la commande au moment de l’envoi pour préserver le reçu si le menu change ensuite.
- Le client fournit un nom et un numéro de contact; l’adresse n’est requise que si le restaurant confirme un service de livraison.
- Une commande en attente n’est ni un paiement ni une promesse de livraison.
- Chaque compte restaurant ne peut consulter et modifier que son propre établissement et ses commandes.
- Les rôles du CMS système sont distincts des comptes restaurant; les données client sensibles sont masquées par défaut dans l’outil support.

## Étapes de réalisation

1. **Validation terrain** : parler à des restaurateurs et clients de Conakry; vérifier le vocabulaire, les quartiers, les commandes habituelles et les modes de confirmation.
2. **MVP réel** : choisir la pile, ajouter base de données, authentification, rôles, séparation des restaurants et persistance côté serveur.
3. **Notifications** : ajouter d’abord des notifications fiables et peu coûteuses; confirmer le canal utilisé par les restaurants avant de développer une intégration WhatsApp.
4. **Pilote** : intégrer un groupe limité de restaurants, suivre commandes reçues, confirmations, annulations et réutilisation.
5. **Monétisation** : comparer un abonnement avec des frais sur les commandes apportées, puis retenir le modèle que les restaurants acceptent réellement.
6. **Paiements et livraison** : uniquement après validation du parcours local, intégrer un prestataire et définir les responsabilités, remboursements et frais.

## Critères de réussite du pilote

- Un restaurant peut publier et mettre à jour son menu sans aide technique.
- Un client peut envoyer une commande en quelques étapes claires.
- Le restaurant reçoit et traite la commande; le client sait si elle est acceptée ou refusée.
- Les erreurs de prix, de disponibilité et de contact sont observables et corrigibles.
- Les restaurateurs expriment une intention crédible de continuer et de payer pour une valeur démontrée.

## Non-objectifs du premier lancement

- Application mobile native.
- Livraison opérée par la plateforme.
- Paiement encaissé par la plateforme.
- Recommandations algorithmiques complexes.
- Programme de fidélité, coupons avancés ou crédit.

Ces exclusions gardent le premier lancement concentré sur la découverte, la commande et la confirmation.
