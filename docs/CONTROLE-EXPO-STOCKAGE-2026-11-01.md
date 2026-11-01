# Contrôle Expo — stockage local — 1er novembre 2026

## Résultat

Lot 2 : panier et favoris conservés dans SQLite, via Drizzle. Catalogue fictif embarqué ; seuls les identifiants et quantités sont stockés, aucun prix, jeton, compte ou commande. Le suivi simulé reste temporaire. Aucune route métier ni configuration de production modifiée.

## Preuves

- Tests ajoutés d’abord : code 1 (modules de stockage absents).
- Suite mobile finale : 14/14, code 0. Codec versionné, données invalides/futures, attente de lecture, erreurs et sauvegardes lentes ordonnées. SQLite réel Node : contraintes, schéma inconnu préservé, fichier fermé puis rouvert ; requêtes du dépôt Drizzle réellement exécutées.
- Trois mutations : refus de version future retiré, sauvegarde avant lecture autorisée, sérialisation retirée. Chaque mutation rend le code 1 ; restauration puis 14/14, code 0.
- `npm run typecheck` à la racine : API, mobile, web, shared, code 0.
- `npm run export:all --workspace @speedfood/mobile` : code 0. Hermes Android 3,3 MB, iOS 3 MB ; web 1,5 MB et worker SQLite 139 KB. Valeurs arrondies du compilateur, pas tailles de téléchargement installées. Ni APK ni IPA.
- Parcours web interactif : favori La Marmite et deux portions à 70 000 GNF retrouvés après rechargement complet. Annuler l’effacement conserve le panier. Confirmer notre remise à zéro fictive puis recharger laisse panier et favoris vides. Nouveau panier d’une portion enregistré ; contrôle à 390 × 844 sans débordement horizontal global. Capture hors dépôt : C:\Users\moelo\dev\speedfood-expo-stockage-panier.png.

## Défaut rencontré et correction

La première version employait le pilote synchrone Drizzle Expo. L’aperçu intégré ne fournissait pas SharedArrayBuffer à ces appels, malgré les en-têtes COOP/COEP de Metro : restauration refusée sans effacement. Remplacement par le point d’extension asynchrone `drizzle-orm/sqlite-proxy`, relié uniquement aux appels locaux Expo SQLite `prepareAsync` / `executeAsync` / `executeForRawResultAsync`, avec finalisation dans `finally`. Le nom du module n’implique aucun proxy réseau : aucune requête HTTP n’est effectuée. Le même chemin asynchrone est utilisé sur Android/iOS/web. Aucun correctif de node_modules, aucun repli localStorage.

Références techniques consultées : [Expo SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [point d’extension Drizzle](https://orm.drizzle.team/docs/connect-drizzle-proxy), signatures du pilote stable installé 0.45.4. Skill appliqué : saas-project-builder (tranche fonctionnelle avec données et erreurs), design existant conservé.

## Limites et retour arrière

Essais sur téléphone Android et iPhone NON réalisés. La persistance native, les fermetures forcées et la suspension par le système restent à vérifier sur appareils ; la réussite Hermes ne les prouve pas. Expo SQLite web est annoncé alpha ; l’aperçu n’est pas une livraison mobile native. L’erreur de restauration a été constatée dans l’interface ; l’erreur d’écriture et sa récupération sont testées au niveau session, pas provoquées dans l’interface. Si des données sont incompatibles, l’ouverture reste bloquée avec un message et un bouton Réessayer ; aucune réparation ni suppression automatique. Ce fichier démo ne doit pas devenir une base de données réelle.

Retour arrière : rétablir le code du lot 1 pour le stockage/état/composants/Compte/Favoris et retirer les dépendances ajoutées. Le fichier SQLite local reste intact et inutilisé. Aucune migration Supabase ni opération de production à annuler. Blocages API historiques inchangés, Kotlin conservé. Aucun déploiement ni push.
