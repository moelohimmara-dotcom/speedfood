# Refonte React Native client — lot 1, 1er novembre 2026

Statut : changement de priorité et démarrage Android/iOS validés par Malika dans la conversation. Application Expo à côté de Kotlin. Pas de compte Expo/EAS, nouveau cloud, abonnement ou publication.

## Produit et portée

Un parcours client autonome avec catalogue fictif embarqué : découverte/recherche/zone, menu, favoris en mémoire, panier d’un restaurant, simulation de suivi. Android et iOS utilisent les mêmes composants React Native. La version web est un aperçu de contrôle, pas une preuve d’exécution native. Toute donnée commerciale est marquée démonstration. Aucun compte, jeton, paiement, position réelle, notification, API de production ou permission GPS.

Le design conserve les tokens du site et le style Kotlin : crème, encre, rouge foncé pour les boutons lisibles, secondaire #75695F, Bricolage et Manrope locales déjà présentes dans le dépôt. Illustrations vectorielles locales explicitement fictives, pas de photographies attribuées à de vrais plats. Cibles tactiles ≥44, libellés accessibles, zones sûres haut/bas, défilement et textes adaptatifs. Les filtres décrivent les zones du catalogue fictif ; aucune couverture géographique réelle n’est promise.

## Scénarios d’acceptation

1. Chercher poulet trouve les restaurants dont un plat correspond ; une recherche absente montre un état vide permettant de réinitialiser.
2. Choisir une zone filtre le catalogue sans demander de position.
3. Ajouter deux fois un plat regroupe sa quantité et affiche le total entier GNF. Un plat indisponible reste visible et ne s’ajoute pas.
4. Un autre restaurant exige de vider explicitement le panier ; aucun remplacement silencieux.
5. Retirer toutes les lignes restaure le panier vide. Le détail ne mélange jamais deux restaurants.
6. « Simuler le suivi » ne fait aucun appel réseau et ne donne jamais une référence réelle ; le suivi indique simulation et n’avance que sur action volontaire.
7. Favoris et panier sont locaux à la session. Fermer/recharger remet le scénario à zéro. Pas de fausse persistance, pas de file d’envoi ; SQLite sera un lot séparé.
8. Préparer exports Android et iOS, puis distinguer compilation JavaScript, construction native et essai sur appareil. Les trois niveaux ne sont pas équivalents. iOS natif/macOS et appareils restent à vérifier si indisponibles.

## Contrats et sécurité

Les calculs affichés sont une simulation, pas une autorité de prix. L’API recalculera montants et droits lors d’un branchement futur. Les essais d’idempotence ont échoué en production : les commandes réelles restent interdites dans ce lot. Les secrets et jetons ne sont pas nécessaires. L’API reste l’unique destination future des appels métier autorisés, sans client Supabase d’écriture dans le mobile.

Contradiction de l’ancien design du 30 octobre §6 : sa table de file d’envoi inclut annulation/réponse urgente alors que D4 les interdit. D4 prévaut : aucune de ces actions ne sera mise en file. Ce premier lot ne rejoue aucune écriture.

## Livrables et retour arrière

Workspace apps/mobile, verrou npm racine unique, données/domaines séparés des composants et routes. Documentation et décision de priorité conservées. Retirer le workspace et ses nouvelles dépendances pour revenir en arrière ; Kotlin, site, API et production ne sont pas remplacés. Aucun changement d’identifiant ou de signature de l’application installée ; le démonstrateur utilise un identifiant distinct. Parité Kotlin et gel restent des objectifs ultérieurs.
