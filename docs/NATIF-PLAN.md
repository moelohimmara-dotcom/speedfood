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
| N1 Client : découvrir | Recherche, fiche restaurant, menu, disponibilité horodatée, favoris (connexion Supabase) | fait (commit 04ca884) : recherche, fiche, menu, disponibilité ; favoris reportés |
| N2 Client : commander | `/api/v1/commandes` (prix recalculés), panier, suivi, historique, adresses, « commander à nouveau » | N2a fait et déployé (APK 2.1.0) ; N2b fait en local (non déployé) : livraison par quartier avec adresse et frais calculés par le serveur (`/api/v1/livraison/estimation`), historique du compte avec jeton de suivi (`GET /api/v1/commandes`), « commander à nouveau » d’après le menu du jour. Reste : position GPS comme destination, adresses enregistrées, favoris |
| N3 Restaurateur | Commandes en direct, accepter / refuser / proposer, menu, disponibilités, alerte sonore | N3a fait en local (non déployé) : console native réduite (commandes à traiter / en cours / historique, accepter, refuser, prête, remise, annuler avec confirmation, proposition de changement, interrupteurs ouvert et prend des commandes, sonnerie à chaque nouvelle commande et rappel toutes les 30 s application ouverte, écran gardé allumé) ; routes `/api/v1/restaurant/*`. Reste N3b : disponibilité des plats et menu, confirmation du paiement, documents, alerte application fermée (N5) |
| N4 Livreur | Missions, statuts, position GPS (premier plan puis arrière-plan avec consentement) | N4a fait et déployé (APK 2.3.0), N4b fait en local (non déployé) : suivi en arrière-plan avec consentement ; N4a : troisième piste « Je suis livreur » dans la même application ; en ligne / hors ligne, offre avec décompte, accepter / refuser, étapes de la course, remise avec le code à 4 chiffres, livraison impossible, position GPS toutes les 8 s et écran allumé tant que l’application est ouverte ; routes `/api/v1/livreur/*`. Reste N4b : position en arrière-plan (service au premier plan, consentement), appel et itinéraire vers le client, gains du jour, notation du client |
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
- **Site non installable** : le manifeste, le bloc d'installation de la console restaurateur et le mode « application web » iOS sont retirés. Le service worker reste (hors connexion, réessais 503, push de la console). Le push web sur iPhone disparaît jusqu'à l'application iPhone (APNs, lot N5).

### Accueil animé et visite guidée (21 octobre 2026, non déployé)
- **Ouverture :** au lancement, le logo s'anime (≈ 2,8 s) : les ailes se déploient, le burger se pose avec un léger écrasement, la vapeur monte en ondulant, puis « SPEEDFOOD » apparaît lettre par lettre avec sa signature. Un toucher passe directement à la suite. Le logo est redessiné en vectoriel (le fichier du logo est une image sans transparence, impossible à animer par parties) ; la teinte bordeaux et l'ocre sont relevées sur le logo officiel.
- **Visite guidée :** 5 pages glissantes (restaurants, disponibilité horodatée, retrait ou livraison, suivi, trois espaces), chacune avec un dessin animé à son arrivée et un mouvement continu ; points de progression animés ; « Passer » à tout moment. Proposée seulement au premier lancement (clé `visite_vue` du stockage local) ; « Revoir la visite guidée » en bas de l'écran d'accueil. Les textes ne promettent que ce qui existe (pas de notifications, aucun paiement dans l'application).
- **Android :** fond crème dès la première image (thème `Theme.Speedfood`), écran de lancement du système en crème sur Android 12 et plus : pas d'éclair blanc avant l'animation.
- **Vérifié :** captures image par image de l'ouverture (4 instants) et de la visite ; 78 tests natifs ; non vu sur un téléphone (la fluidité réelle reste à constater).

### Lot N4b : suivi du livreur en arrière-plan (21 octobre 2026, non déployé)
- **Principe :** un service Android au premier plan (`SuiviLivreurService`, type « position ») lit le GPS, envoie la position toutes les 8 s et relit l'état toutes les 5 s, application ouverte ou non, **tant que le livreur est en ligne ou en course**. Il s'arrête seul quand le livreur est hors ligne, déconnecté, ou que sa fiche n'est plus active. Une notification permanente (« suivi livreur actif ») est visible pendant ce temps : c'est obligatoire sous Android et c'est aussi la transparence due au livreur.
- **Alerte de course :** à chaque nouvelle offre, une notification sonore « Nouvelle course · restaurant · gain » s'affiche, avec le délai de réponse ; l'ouvrir ramène dans l'application. Ce n'est pas encore une notification poussée (FCM, lot N5) : elle dépend du sondage du service, donc d'un téléphone qui garde le service actif.
- **Consentement :** à la première mise en ligne, une fenêtre explique le suivi (ce qui est suivi, pourquoi, la notification, l'arrêt hors ligne) et laisse le choix : « Autoriser le suivi » ou « Seulement application ouverte » (comportement du lot N4a). Le choix est gardé (`livreur_suivi_arriere_plan`) et modifiable depuis l'espace livreur. Aucune permission « position en arrière-plan » n'est demandée : le service démarre application ouverte, ce qui évite la procédure de validation Google correspondante.
- **Détails :** processeur gardé éveillé (12 h au plus) pendant le suivi ; démarrage refusé par le système si l'application n'est plus visible (sans conséquence : relancé à l'ouverture suivante) ; la logique d'un tour est dans `SuiviLivreur` (partagée, testée : 5 tests) ; l'écran ne mesure ni n'envoie plus la position quand le service s'en charge.
- **Reste à faire / limites :** icônes de notification du système (à remplacer par des icônes Speedfood) ; certains fabricants (Xiaomi, Huawei, Tecno, Infinix…) tuent les services malgré tout : demander au livreur de désactiver l'optimisation de batterie pour Speedfood, à vérifier sur les téléphones réellement utilisés à Conakry ; non vu sur un téléphone.

### Lot N3a : console restaurateur (21 octobre 2026, non déployé)
- **Même règles que le site, jamais plus faibles :** les routes `/api/v1/restaurant/*` utilisent un client Supabase **lié au jeton du membre** (`src/lib/db/jeton.ts`) : la RLS décide de ce qui est lu et écrit, sans clé de service, comme pour la console web. Le restaurant est celui de l'appartenance du compte (`restaurant_memberships`), jamais un identifiant envoyé par l'application. Les règles métier (machine à états, proposition en cours) sont dans `src/lib/commande/service-restaurant.ts`, **partagé** avec les actions serveur de la console web (qui l'appellent désormais).
- **Barrières conservées :** un compte avec double authentification confirmée doit présenter un jeton `aal2`, et un compte avec questions de sécurité à confirmer doit d'abord les confirmer. L'application n'a pas encore ces écrans : ces comptes sont renvoyés vers la console du site avec un message clair (voir `v1-restaurant.ts`). Plafond de 600 requêtes par compte et par 5 minutes.
- **Confidentialité :** le jeton du reçu n'est jamais envoyé à l'application ; les coordonnées du client le sont (nécessaires pour appeler et livrer).
- **Alerte :** sonnerie de notification du téléphone à chaque NOUVELLE commande à traiter (la première lecture ne sonne pas), rappel toutes les 30 s tant qu'il en reste ; écran gardé allumé pendant que la console est ouverte. **Application fermée : aucune alerte avant le lot N5 (notifications poussées)** : à dire clairement aux restaurateurs.
- **Vérifié :** 87 tests natifs (dont 6 sur le rangement par urgence, les actions possibles, la proposition, la lecture du serveur et les refus) ; routes refusent l'absence de jeton et un faux jeton. **Non vérifié :** une vraie commande traitée de bout en bout avec un compte restaurateur ; le téléphone.
- L'ancien écran « Espace restaurateur bientôt disponible » est supprimé : le renvoi vers la demande de référencement du site est dans l'état « non connecté » de la console.
