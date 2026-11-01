# Lot panier réel Expo

Objectif : préparer une sélection locale depuis le catalogue réel, sans création de commande.

Fichiers : domaine et hook du panier dans apps/mobile/src/catalogue, vue modale, stockage Drizzle/SQLite réel et migration locale dans apps/mobile/src/stockage, intégration CatalogueReel, tests mobile et documentation.

Cycle réalisé : spécification, test rouge du domaine, implémentation, test vert, quatre mutations détectées, restauration, vérification du stockage réel et du parcours web, relecture de la portée et de la qualité, commit. Types, 24 tests et exports à code 0. Aucun déploiement requis.

Retour arrière et limites détaillés : docs/CONTROLE-PANIER-REEL-2026-11-01.md. Le fichier local est conservé, catalogue et ADR-021 restent en place.
