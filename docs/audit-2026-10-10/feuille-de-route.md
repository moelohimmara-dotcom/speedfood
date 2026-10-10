# Feuille de route — audit et continuité Speedfood

## Priorité immédiate

1. Corriger `LayoutProps` dans `src/app/layout.tsx`, puis relancer typecheck, lint et tests avant tout déploiement.
2. Activer la double authentification du super administrateur.
3. Nettoyer les quatre restaurants de test après confirmation de leur statut.
4. Équiper les restaurants publiés d’un canal d’alerte de commande vérifié.
5. Décider si le risque de jeton de suivi dans les journaux Worker reste accepté; sa suppression requiert un changement Worker et un déploiement distinctement autorisé.

## Audit à achever

- Fournir des comptes existants pour `operations`, `content_editor` et `support`, sans en créer de nouveaux.
- Vérifier les parcours fiche restaurant, panier, commande invitée, suivi par jeton, propositions, horaires et prix avec données de test non persistantes.
- Vérifier les états vide, erreur et chargement en 375 px et 1280 px, puis produire des captures exportables par constat.
- Revalider les dépendances par un audit réseau; ne pas exécuter de correction automatique.

## Gardes-fous maintenus

Aucun changement Supabase ou Cloudflare, aucun compte créé, aucun push de code applicatif, aucun déploiement. Ce commit ne contient que des documents d’audit.
