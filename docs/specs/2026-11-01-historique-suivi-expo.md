# Historique et suivi Expo — lecture

Lot autorisé après la connexion personnelle confirmée par Malika. Réutiliser GET /api/v1/commandes et POST /api/v1/suivi (lecture par clé dans le corps). Aucune création, annulation, réponse à proposition ou modification de paiement.

Afficher les 50 dernières commandes au maximum, restaurant, référence, date, statut, mode, total entier GNF et mention TEST. Sélectionner une commande pour consulter son état courant et actualiser manuellement. Indiquer la date de lecture et les limites de ce premier écran de suivi ; aucun résultat ancien présenté comme actualisé après une erreur.

Clés de suivi uniquement en mémoire privée du gestionnaire de session. Pas de clé dans les composants, URL, journaux ou SQLite. Effacer la correspondance lors de connexion, restauration, déconnexion et refus définitif. Refuser une réponse tardive après changement de session. Projections strictes, réponses bornées, pas de relance automatique.

CORS limité à GET commandes et POST suivi exact (lecture), sans cookies ; aucune sous-route d’écriture ouverte. Tests rouge/vert, mutation puis restauration ; types, API et exports mobiles. Vérification personnelle du parcours réel requise avant de le déclarer validé. Retour arrière : retirer ces lectures et leur CORS, conserver connexion et panier. APK de production inchangée.
