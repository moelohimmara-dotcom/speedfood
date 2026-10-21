# Application native Speedfood (Kotlin Multiplatform)

Décision : ADR-019 (21 octobre 2026). Code : `mobile/`. Ce document est le plan d'exécution et l'état réel ; il se met à jour à chaque lot.

## Choix techniques (versions vérifiées le 21/10/2026 sur le modèle officiel JetBrains `Kotlin/KMP-App-Template`)
- Kotlin 2.4.10, Compose Multiplatform 1.11.1, Android Gradle Plugin 9.1.1, Gradle 9.6.1, Ktor 3.5.1 (réseau), Koin 4.2.2 (injection), Coil 3.5.0 (images), navigation Compose.
- Modules : `shared` (interface, données, logique : Android + iOS + bureau de développement), `androidApp` (coque Android), `iosApp` (coque iOS, Xcode), `desktopApp` (aperçu de l'interface sur ordinateur, pour travailler sans émulateur).
- Identité visuelle : jetons de `docs/cadrage/DESIGN-SYSTEM.md` portés dans `shared/.../design/` (couleurs, typographie, formes). Pas d'autre palette.

## Ce qui ne peut pas se faire sans Malika
| Besoin | Pourquoi | Coût |
|---|---|---|
| Compte Google Play Console | Publier sur le Play Store (sinon APK téléchargé, avertissement « source inconnue ») | ~25 USD, unique |
| Compte Apple Developer | Installer sur iPhone (TestFlight) et publier sur l'App Store | ~99 USD / an |
| Mac ou exécuteur macOS | Compiler iOS (Xcode n'existe pas sous Windows) | GitHub Actions macOS : gratuit (dépôt public) |
| Projet Firebase | Alertes natives Android (FCM) | gratuit |
| Clé d'envoi APNs | Alertes natives iPhone | incluse dans le compte Apple |

## Lots
| Lot | Contenu | État |
|---|---|---|
| N0 Fondations | Projet, design, coque, lecture réelle de la liste des restaurants, APK de débogage, aperçu bureau, tests | voir « État » |
| N1 Client : découvrir | Recherche, fiche restaurant, menu, disponibilité horodatée, favoris (connexion Supabase) | à faire |
| N2 Client : commander | `/api/v1/commandes` (prix recalculés), panier, suivi, historique, adresses, « commander à nouveau » | à faire |
| N3 Restaurateur | Commandes en direct, accepter / refuser / proposer, menu, disponibilités, alerte sonore | à faire |
| N4 Livreur | Missions, statuts, position GPS (premier plan puis arrière-plan avec consentement) | à faire |
| N5 Alertes natives | FCM (Android), APNs (iOS), liens profonds | à faire, exige Firebase / Apple |
| N6 Publication | Signature, Play Store, TestFlight, App Store, mise à jour par-dessus l'APK actuel | à faire, exige les comptes |

**Priorités après ADR-020 (revente, proposition) :** l'application cliente (N1, N2) et l'application livreur (N4) passent avant la console restaurateur (N3, réduite à un compagnon optionnel). Voir `docs/cadrage/VISION-REVENTE.md`.

Règle : un lot n'est « livré » qu'après essai de bout en bout sur un appareil réel ; avant, il est « compilé et testé ».

## État
Voir la fin de ce fichier, mise à jour au fil des lots.
