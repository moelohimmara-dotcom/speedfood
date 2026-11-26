# Essai de bout en bout sur émulateur, 18 novembre 2026

Essai de l'application cliente sur un émulateur Android 17 (x86_64), en visiteur sans compte, avec des revues statiques (design, routes) et un essai de robustesse (grandes polices, hors ligne, cycle de vie). Aucune commande n'a été envoyée.

## Défauts trouvés et corrigés (tous couverts par des tests)

- Le clavier recouvrait le formulaire « Valider ma commande » (fenêtre `Modal` non redimensionnée) : `src/connexion/useClavierFormulaire.ts`, appliqué à la commande, à la demande de référencement et à l'espace client.
- Quatre routes restaurateur (historique, activité, document, état de publication) étaient appelées sur l'API qui ne les porte pas : `src/connexion/origines-restaurateur.ts`, avec un test qui compare chaque chemin de l'appli aux routes de l'hôte visé.
- Au premier lancement, panier et catalogue déclaraient une erreur alors que le serveur répondait : les bases SQLite sont ouvertes en file (`src/stockage/file-ouverture.ts`), le cache du catalogue est facultatif, la restauration du panier réessaie en silence.
- Confirmation « Vider le panier » hors écran, retour Android qui quittait l'appli depuis les onglets, bannière hors ligne invisible en bas de liste, contours de champs à 1,33:1 (WCAG 1.4.11), libellés d'onglets coupés à 200 %, cibles tactiles sous 48 dp, mot de passe sans bouton Afficher.
- Textes : apostrophes droites, tirets longs, « sélection » pour « panier », jargon, dates avec secondes.

## Restent à décider (produit)

Accueil encombré avant le premier restaurant, écran « Qui êtes-vous ? » et bouton « Équipe Speedfood » visibles de tous, mode de paiement non dit sur l'écran de commande, statut « à confirmer » de plats non reconfirmés depuis plus de 14 jours, divulgation de la position du livreur (exigence Play Store), restaurant fermé encore commandable.

## Non mesuré

Démarrage à froid (6 à 11 s sur émulateur), fluidité et rotation : à confirmer sur un téléphone réel.
