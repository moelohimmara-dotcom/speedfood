# Lot 1 Expo client — plan

Priorité validée par Malika : l’interface React Native Android/iOS commence en parallèle de l’API, dont les blocages restent ouverts. Spécification : docs/specs/2026-11-01-refonte-expo-client-lot1.md.

1. Inventorier Kotlin, tokens et architecture.
2. Socle Expo Router dans apps/mobile, modèle officiel SDK 57 (version conseillée par la documentation Expo pendant la transition SDK 58 pour Expo Go). Pas d’EAS.
3. Tests rouges de recherche/panier → domaine → tests verts → mutations.
4. Composants natifs et parcours fictif, polices locales, aucun réseau métier.
5. Types, tests, exports Android/iOS/web ; essai interactif et inspection à largeur téléphone. Ne pas appeler export une compilation APK/IPA.
6. Relecture spécification puis qualité, documentation, commit etape-*. Retour arrière : retirer le nouveau workspace sans toucher à Kotlin ou à la production.

Fichiers : apps/mobile/**, package-lock.json, documentation de reprise/ADR. Les modifications dans l’API en attente restent sur la branche parente ; aucun déploiement dans ce lot.

## Résultat du premier lot

Socle et six écrans implémentés localement, parcours fictif contrôlé dans le navigateur intégré. Détails, codes de sortie, mutations, limites natives et retour arrière : docs/CONTROLE-EXPO-CLIENT-2026-11-01.md. Aucun déploiement. La priorité a été enregistrée dans ADR-022.

Exports finaux après ajustements d’accessibilité : Android/iOS/web, code 0. Build API de régression : code 0. Aperçu laissé sur localhost:8090, capture locale enregistrée. Essais natifs sur appareils toujours non réalisés.
