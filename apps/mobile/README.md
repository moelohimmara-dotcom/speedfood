# Speedfood — nouveau client React Native

Client Expo Android/iOS : l’entrée actuelle lit le catalogue réel depuis l’API unique, sans création ni paiement. Les anciens parcours fictifs des lots 1/2 restent dans le code pour historique, mais ne sont pas montés. Kotlin reste dans /mobile, inchangé. Aucun compte Expo/EAS ni service cloud utilisé. SDK 57.0.31, React Native 0.86.3, React 19.2.3, Expo Router 57.0.29 ; versions verrouillées dans le package-lock racine. Le SDK 57 est conseillé par la documentation Expo pour Expo Go durant la transition SDK 58 : https://docs.expo.dev/more/create-expo/

## Aperçu local

Depuis la racine, npm run web --workspace @speedfood/mobile. Le serveur écoute seulement localhost. Lectures GET publiques du catalogue de production, sans cookie, clé embarquée, authentification ni paiement. Aucun restaurant fictif de secours ; les erreurs sont visibles. Pour les essais de l’agent, EXPO_NO_DOTENV=1 et EXPO_NO_TELEMETRY=1 sont posés dans le processus ; aucun fichier de secrets n’est nécessaire.

## Vérifications

- npm run typecheck --workspace @speedfood/mobile
- npm test --workspace @speedfood/mobile
- npm run export:all --workspace @speedfood/mobile

export:all produit les paquets JavaScript web et Hermes Android/iOS dans dist/ (ignoré par Git). **Ce ne sont ni une APK ni une IPA.** Aucun compte Apple/Google ni signature n’est configuré. Sur Windows, le simulateur iOS et la construction iOS native ne sont pas disponibles. Les essais sur téléphones restent à organiser.

## Historique des lots 1/2 (démonstrateur non monté)

Découverte/recherche/zone, menu, favoris, panier d’un restaurant, suivi DEMO-001 volontaire. Données embarquées, prix entiers, aucun avis inventé ni délai garanti. Depuis le lot 2, panier et favoris sont conservés dans SQLite local via Drizzle ; les données sont restaurées avant interaction et les échecs restent visibles. Seuls les identifiants et quantités sont enregistrés, les prix sont recalculés depuis le catalogue fictif. Le suivi simulé reste temporaire. La commande réelle n’existe pas ici et ne doit pas être branchée tant que les préconditions API ne sont pas levées. Pas de file d’envoi. Le pilote Drizzle asynchrone appelle Expo SQLite localement, sans HTTP ni repli localStorage. Le support SQLite web est alpha ; Metro ajoute WASM et les en-têtes COOP/COEP. Compte permet une remise à zéro explicite du démonstrateur. La restauration incompatible est refusée sans effacement automatique.

Identifiant du démonstrateur : com.speedfood.clientdemo, distinct de l’application Kotlin installée. Aucun remplacement de clé ou de paquet de production. Bricolage et Manrope proviennent des ressources déjà versionnées de Kotlin ; logo repris du site ; illustrations SVG locales, pas de photos commerciales.

La génération expérimentale typedRoutes a été désactivée après un échec de résolution de expo-router/_ctx-shared depuis @expo/router-server dans le monorepo npm. Ce contournement concerne la génération des routes seulement ; TypeScript strict reste obligatoire et les parcours sont vérifiés dans l’aperçu. Aucun correctif de node_modules.

Spécification et limites : ../../docs/specs/2026-11-01-refonte-expo-client-lot1.md.

Lot 2 : ../../docs/specs/2026-11-01-refonte-expo-client-lot2.md ; preuves et limites : ../../docs/CONTROLE-EXPO-STOCKAGE-2026-11-01.md.

## Catalogue réel actuel

Routes publiques /api/v1/catalogue/restaurants et /api/v1/catalogue/restaurants/UUID/menu. Pagination explicite ; recherche limitée aux restaurants chargés. Menu et disponibilités réels, fraîcheur signalée ; Panier réel local disponible, sans commande : seulement les identifiants et quantités dans une base distincte, prix relus à l’ouverture du panier. Le fichier SQLite démo reste intact et inutilisé par cette entrée. Contrôle complet et versions déployées : ../../docs/CONTROLE-CATALOGUE-REEL-2026-11-01.md. Aperçu de reprise sur http://localhost:8091/ (8090 était occupé).

Panier réel : ../../docs/CONTROLE-PANIER-REEL-2026-11-01.md. Contrôle sur http://127.0.0.1:8091/ en un seul onglet ; le stockage web est propre à chaque origine. Pas de transfert automatique depuis localhost, ni depuis la base démo. Les essais sur Android/iPhone restent à réaliser.
