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

### Lot N0 : compilé et testé (21 octobre 2026)
- **Fait et vérifié :** `gradlew :androidApp:assembleDebug` réussit (APK de débogage, 16 Mo) ; `gradlew :shared:jvmTest` : 15 tests verts (règles de disponibilité, lecture de la liste publique avec faux réseau, rendu hors écran des trois écrans en PNG dans `mobile/shared/build/captures/`).
- **Contenu :** écran « Qui êtes-vous ? » (client / restaurateur), liste des restaurants lue en direct sous RLS (hors données de démonstration, bornée à 100), états Ouvert / Commandes en pause / Fermé avec « statut à confirmer » sans confirmation récente, thème du design système, pictogrammes dessinés.
- **Non vérifié :** lancement sur un téléphone ou un émulateur (aucun disponible sur ce poste) ; lecture réelle de la base depuis l'application (testée seulement avec un faux réseau) ; toute la partie iOS (la coque est écrite d'après le modèle officiel, jamais compilée : exige macOS).
- **Outils :** JDK 17 **64 bits** dans `C:\Users\moelo\.speedfood-tools\` (la JDK de Bubblewrap est en 32 bits et ne peut pas lancer Gradle) ; SDK Android dans `C:\Users\moelo\.bubblewrap\android_sdk` ; réglages publics dans `mobile/speedfood.properties` (ignoré par Git, modèle `speedfood.properties.example`).
- **Commandes** (bash, depuis `mobile/`, avec `JAVA_HOME` et `ANDROID_HOME` définis) : `./gradlew :androidApp:assembleDebug`, `./gradlew :shared:jvmTest`, `./gradlew :desktopApp:run` (aperçu sur ordinateur).

### Application téléchargeable depuis le site, mode webview supprimé (21 octobre 2026)
- L'ancienne enveloppe « Trusted Web Activity » (APK du 18 octobre) et tout ce qui la soutenait sont supprimés : projet `android/`, route `/api/assetlinks`, réécriture `/.well-known/assetlinks.json`, bouton d'installation du navigateur, étapes « ajouter à l'écran d'accueil » de `/installer`.
- `/installer` propose désormais l'APK **natif** (`public/speedfood.apk`, version 2.0.0, signé avec la clé existante, empreinte publiée). Elle remplace l'ancienne par installation par-dessus (même identifiant, même clé).
- Procédure de reconstruction et de publication : `docs/APPLICATION-ANDROID.md`.
- Limite assumée : la version 2.0.0 ne fait que choisir l'espace et parcourir les restaurants ; commander reste possible sur le site dans le navigateur jusqu'aux lots N1 et N2.
