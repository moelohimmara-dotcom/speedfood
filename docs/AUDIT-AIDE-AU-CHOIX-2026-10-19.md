# Audit de la page « Aide-moi à choisir » (/aide-au-choix)

Fait le 19 octobre 2026 sur la production (version `3af206c3`), en mobile (358 px) avec de vraies interactions, des captures d'écran et des appels réels de la recherche ; aucune erreur dans la console du navigateur. Restaurant de test : « barbie food » (seul publié, sans coordonnées propres, quartier Kaporo Centre).

## Ce qui fonctionne
- Recherche par **quartier** et par **commune** : résultat correct (barbie food, gamme Économique, « 2 plats dans votre budget, dès 25 000 GNF »).
- Calcul des groupes : « Dans votre budget » à partir de 25 000 GNF ; « Un peu au-dessus de votre budget » avec l'écart chiffré (« 5 000 GNF de plus » à 20 000 ; « 1 000 GNF de plus » à 24 000) ; « Aucune proposition » en dessous, avec le bon message (« dépassent ce budget »).
- Contrôles du budget : minimum 5 000 GNF (bouton désactivé et message), maximum 1 000 000, lettres et signes ignorés. Message d'échec du GPS clair. Temps de réponse de la recherche : 0,7 à 1,4 s (plus de 3 s à froid).

## Défauts et améliorations, par priorité
**P1 : dysfonctionnements**
1. **« Ma position » ne propose jamais un restaurant sans coordonnées propres.** Même à 1 km du quartier de barbie food, le résultat est « Aucun restaurant ouvert dans un rayon de 5 km ». Cause : `distanceAuClient` (`aide-choix-service.ts`) n'utilise que les coordonnées du restaurant ; aucun repli sur le centre du quartier (9,60976 ; −13,64236) ni de la commune. Probablement le cas de la plupart des restaurants du pilote.
2. **Mauvais message avec le filtre de cuisine.** « Fast-food » à 30 000 GNF affiche « Aucun restaurant n'est publié pour le moment », alors qu'un restaurant est publié (d'une autre cuisine). Le diagnostic est compté après le filtre. Attendu : « Aucun restaurant de cette cuisine dans cette zone ».
3. **Résultats périmés.** Changer le budget, le lieu ou la cuisine laisse les anciens résultats affichés ; pendant la recherche (jusqu'à plusieurs secondes à froid) seul le texte du bouton change. Un utilisateur peut lire une proposition qui ne correspond plus à ses critères.

**P2 : confort**
4. **Champ « montant »** : le vider affiche « 0 » (impossible de le laisser vide) ; le message « Le budget minimum… » clignote pendant la frappe ; pas de séparateur de milliers (le titre dit « 30 000 », le champ « 30000 ») ; saisie plafonnée en silence à 1 000 000 alors que le curseur s'arrête à 300 000 (il reste à 300 000 avec « 1 000 000 » affiché).
5. **Résultats hors de vue sur téléphone** : pas de défilement ni de focus vers les propositions après la recherche, et aucun rappel des critères (« Pour 30 000 GNF à Kaporo Centre »). La page n'a pas d'adresse partageable (critères perdus au rechargement).

**P3 : accessibilité et finition**
6. Choix de la position codé en `role="radio"` sans navigation aux flèches ni tabulation tournante ; curseur sans `aria-valuetext` (un lecteur d'écran dit « 30000 » sans unité) ; bouton désactivé rose très pâle, texte peu lisible ; « L'oublier » petit.
7. Cartes de résultats pauvres : pas de distance (en mode zone), d'horaires ni d'heure de fermeture, de photo, de note ; « Dans votre zone » vague ; « Du moins cher au plus huppé » répété même pour une seule proposition ; seul « Voir le menu » (pas de « Commander »).
8. Si le GPS est refusé, le message invite à choisir un quartier ou une commune mais ne propose aucun bouton pour y basculer, et ne distingue pas refus, délai dépassé ou indisponibilité.
9. Mise en page : formulaire long sur mobile avec un grand vide sous le bouton avant le pied de page ; rail du curseur noir épais.
