# Lot 2 Expo — panier et favoris conservés localement

Périmètre autorisé : poursuite de la refonte Android/iOS, architecture Expo + SQLite/Drizzle déjà validée. Premier lot de persistance, sans API métier, compte, paiement, jeton ni commande réelle.

## Résultat attendu

Le panier et les favoris survivent au redémarrage. SQLite stocke un instantané versionné contenant seulement identifiants de restaurant/plat, quantités entières et favoris ; les prix sont recalculés depuis le catalogue de démonstration. La simulation de suivi reste temporaire et clairement fictive.

Aucune écriture de l’état vide avant lecture du stockage. Une erreur de lecture ne réinitialise pas les données silencieusement. Une version future est refusée sans modification. Les écritures locales sont sérialisées et une erreur est visible ; aucune réussite de sauvegarde annoncée avant confirmation. La personne peut réessayer une sauvegarde et effacer explicitement les données de démonstration depuis Compte. Aucun effacement automatique à l’ouverture.

## Technologies et données

Expo SQLite compatible SDK 57 et Drizzle stable 0.45.4. Schéma TypeScript Drizzle, initialisation SQLite locale versionnée, aucune migration Supabase. Avant création/évolution, lecture de user_version et table_info. Pas de service externe ni de coût. Même moteur dans l’aperçu web si ses prérequis WASM/COOP/COEP sont satisfaits ; support web Expo SQLite annoncé alpha, pas preuve native.

## Vérifications

Tests rouges puis verts : codec strict, données corrompues/futures, ordonnancement, interdiction de sauver avant chargement, récupération après erreur. Tests sur une vraie base SQLite locale pour initialisation et persistance après réouverture. Mutations puis restauration. Types, exports Hermes Android/iOS/web ; vérification du rechargement dans l’aperçu et des messages Compte. Les essais sur téléphones restent distincts.

## Retour arrière

Revenir au code en mémoire du lot 1 laisse le fichier SQLite de démonstration intact et inutilisé ; pas de suppression ni de modification de production. Ne pas réutiliser ce fichier pour des données réelles. Fichiers : apps/mobile/src/stockage/**, état Application, composants de statut, Compte, configuration Metro, dépendances et docs.

Réalisation : point d’extension asynchrone Drizzle relié aux instructions préparées Expo SQLite, entièrement local sur les trois plateformes. Le pilote synchrone a échoué dans l’aperçu intégré (SharedArrayBuffer indisponible) ; aucun repli silencieux. Résultats : docs/CONTROLE-EXPO-STOCKAGE-2026-11-01.md.
