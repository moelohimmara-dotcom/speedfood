# Lot 2 — stockage local Expo

Objectif : retrouver panier et favoris après fermeture, avec erreurs honnêtes. Spécification : docs/specs/2026-11-01-refonte-expo-client-lot2.md.

1. Lire les compétences saas-project-builder et les documentations versionnées Expo SQLite/Drizzle.
2. Tests en échec sur codec et cycle lecture/écriture ; schéma et initialisation sur SQLite locale.
3. Implémenter dépôt SQLite/Drizzle et file de sauvegarde locale (pas une file de commandes).
4. Brancher hydratation, statut et réessai/effacement explicites dans l’interface.
5. Mutations, tests, types, exports Android/iOS/web et essai interactif après rechargement.
6. Relecture spécification/qualité, documentation et commit etape-*. Aucun déploiement.

Exécution locale terminée : 14 tests, types de tous les workspaces et trois exports à code 0 ; trois mutations détectées. Persistance/rechargement et remise à zéro vérifiés sur aperçu web. Essais natifs sur appareils à réaliser séparément. Voir docs/CONTROLE-EXPO-STOCKAGE-2026-11-01.md.
