# Passage du client Expo au réel

## Demande et état constaté

Le 1er novembre 2026, Malika demande de passer l’application Android/iOS en mode réel et production. Cela autorise le travail de branchement et de préparation. La règle de session reste : Malika effectue les déploiements, un feu vert par action ; aucun compte, coût, secret ou publication implicite. Ne pas confondre cette demande avec une réussite des contrôles.

Constats de code au démarrage de ce lot :

- `apps/mobile/src/donnees/demo.ts` alimente encore les écrans. Le panier SQLite ne connaît que ces identifiants fictifs. Le suivi avance manuellement ; aucune commande ne part. Retirer les mentions Démo ne rendrait aucun de ces parcours réel.
- `apps/api/src/app.ts` expose identité, client, estimation, suivi et commandes ; aucune route de catalogue restaurants/menus n’y est montée. Les lectures Supabase de Kotlin ne constituent pas ce module de l’API unique (architecture cible §5).
- ADR-021 est préparé localement. La passation rapporte le démarrage OpenNext complet en échec et l’idempotence croisée en échec. Il n’existe pas de preuve nouvelle annulant ces résultats. Ne pas relancer l’essai ni retirer son verrou.
- `apps/mobile/app.json` utilise encore `com.speedfood.clientdemo` pour Android/iOS, version 0.1.0, sans chaîne de livraison native configurée. Les exports Hermes ne remplacent ni signature ni installation ni vérification sur appareils.

Ces constats portent sur le dépôt. Aucun audit Cloudflare supplémentaire ni modification de production n’a été effectué pendant ce lot.

## Ordre d’exécution

1. **Catalogue réel en lecture.** Écrire la spécification du contrat catalogue de l’API unique prévu par l’architecture : autorité de publication/disponibilité côté serveur, projections publiques explicites, pagination/curseurs et suppressions, cache et invalidation cohérents. Réutiliser les règles existantes du site et les contraintes/RLS ; ne pas exposer les contacts ou données de gestion. Tester les refus et les états vide/erreur. Puis connecter découverte et menus Expo à ce contrat, sans catalogue fictif de secours. Un échec affiche une erreur ou une copie locale datée, jamais un restaurant inventé. Préparer le paquet API ; déploiement distinct par Malika avant essai public réel.
2. **Panier/favoris réels.** Séparer le stockage réel du fichier SQLite démo : ne jamais convertir automatiquement les identifiants fictifs. Le catalogue serveur fournit disponibilité et prix affichés ; l’envoi reste soumis au recalcul serveur. Contrôler restauration, changement de prix, plat supprimé et restaurant dépublié. Aucune donnée personnelle dans ce cache public.
3. **Identité et lectures privées.** Implémenter les parcours de connexion existants via les contrats autorisés, stockage protégé des sessions distinct de SQLite public, déconnexion et purge des données privées. Tester deux comptes et les refus croisés. Aucun secret saisi par l’agent ni jeton en URL/journal. Historique et suivi réels en lecture avant les écritures.
4. **Lever le blocage de création.** Reprendre le plan ADR-021 existant : démarrage du paquet OpenNext complet, revue du branchement RPC et déploiements préparés séparément. Toute configuration ou mise en ligne exécutée par Malika. Avant activation des créations : essai TEST borné explicitement autorisé, idempotence croisée prouvée, alertes reçues et coût CPU contrôlé. L’ancien essai échoué ne doit pas être rejoué automatiquement.
5. **Commande et suivi réels.** Brancher l’envoi une fois la porte précédente validée. Interdire le rejeu automatique des écritures ; traiter la réponse perdue sans deuxième création. Vérifier les prix serveur, annulation et propositions autorisées. Remplacer le suivi manuel, sans jamais annoncer une réussite non confirmée. Paiement absent : ne pas afficher un faux paiement ni imposer un nouveau prestataire ; garder uniquement le mode déjà accepté et réellement disponible.
6. **Validation Android/iOS et livraison.** Installation puis parcours complets sur appareils : reprise après fermeture forcée, réseau coupé, connexion/déconnexion, création TEST, suivi et notifications effectivement configurées. Vérifier la parité client Kotlin demandée par l’architecture avant remplacement. Préparer les identifiants, versions et signatures de mise à jour sans lire les clés ; Malika saisit et configure les accès nécessaires. Le compte Apple et les magasins sont reportés dans l’architecture actuelle : leur activation et leurs coûts restent une décision explicite. Préparer les paquets signés et la fiche de livraison avant toute publication.

Chaque étape comprend test rouge, code, test vert, mutation, restauration, revue et commit sur `etape-*`. Tests et résultats sont consignés dans les trois documents de reprise. Pas d’activation globale `API_RELAIS=tout`.

## Premier lot à réaliser

Spécification puis implémentation du catalogue réel de l’API unique et branchement Expo en lecture. Son contrat et son plan de déploiement doivent être concrets avant toute demande de mise en ligne. Ce plan ne prétend pas que ce lot est déjà implémenté.

## Retour arrière

Conserver Kotlin et le site actuellement en service. Le démonstrateur et sa base locale restent séparés des données réelles ; ne pas les effacer ni les convertir pour masquer le changement. Chaque branchement mobile doit pouvoir être retiré sans changement destructif en base. Tout retour de configuration de production reste une action distincte de Malika. Aucun déploiement, secret, appel de création ou publication effectué à l’écriture de ce plan.
