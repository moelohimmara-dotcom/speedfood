# Vérification du lot Expo client — 1er novembre 2026

## Réalisé en local

Workspace apps/mobile initialisé depuis le modèle officiel Expo SDK 57. Catalogue fictif embarqué et contrôles sans API de production. Android/iOS partagent le code React Native ; aperçu web également construit. Branche etape-refonte-expo-client-20261101, fondée sur la branche de préparation API ; aucun push, déploiement, secret, migration, compte externe ni publication.

Les polices, logo et couleurs reprennent le dépôt. Les nouveaux SVG représentent des illustrations, pas des photos de plats réels. SQLite, compte connecté, notifications, paiements et commandes réelles ne sont pas implémentés. Kotlin n’est ni remplacé ni gelé.

## Tests et preuves

- Tests rouges avant implémentation du domaine (module absent, code 1).
- Cinq tests du domaine à code 0 : recherche, panier par restaurant, quantités, prix entiers, indisponibilité et données de démonstration.
- Trois mutations détectées à code 1 : suppression de la multiplication par quantité, suppression du refus inter-restaurant, suppression du refus d’indisponibilité. Sources restaurées, cinq tests à code 0.
- Types de tous les workspaces : code 0 après installation ; types mobile à code 0 après les corrections finales de son état et de son interface.
- Régression API : 251/251, code 0 ; build API après installation des dépendances : code 0, 1 167 Kio. Régression tests unitaires site : code 0. Le garde-fou des 70 lectures non bornées reste conforme aux 63 justifications existantes.
- Premier export complet Android/iOS/web : code 0 après exécution hors bac à sable, qui refusait à Hermes l’écriture de fichiers temporaires. Paquets Hermes générés : iOS environ 2,6 Mo, Android environ 2,9 Mo ; web environ 1,2 Mo. Export final après corrections d’accessibilité : **code 0**, trois paquets reconstruits (web 1,2 Mo, iOS Hermes 2,6 Mo, Android Hermes 2,9 Mo).
- Pas d’APK ni IPA construite, pas de téléphone ou simulateur natif testé. Aucun SDK Android/adb trouvé au chemin habituel sur ce poste ; macOS n’est pas disponible ici. Ne pas annoncer une application native livrée sur cette seule base.

## Parcours interactif vérifié

Contrôles dans le navigateur intégré, aperçu React Native Web sur localhost:8090 ; pas sur un téléphone natif.

1. Recherche « poulet » : deux restaurants correspondants.
2. Recherche introuvable : état vide et réinitialisation disponibles.
3. Zone Nongo : une adresse fictive, sans GPS.
4. Favori ajouté puis retrouvé dans son écran dédié.
5. Plat indisponible : bouton désactivé.
6. Deux ajouts du riz à 35 000 GNF : une ligne, deux portions, 70 000 GNF.
7. Tentative d’ajout depuis un autre restaurant : refus explicite et panier d’origine conservé à 70 000 GNF.
8. Retrait d’une portion : total recalculé à 35 000 GNF.
9. Simulation : suivi DEMO-001, montant conservé et panier vidé ; aucun appel métier dans le code du démonstrateur.
10. Trois étapes manuelles du suivi, puis disparition du bouton d’avance.
11. Panier vide affiché après simulation.
12. Compte sans formulaire d’identifiants ; suivi fictif retrouvable.
13. Contrôle de l’aperçu à 375, 390, 768 et 1280 px : aucun débordement horizontal global. État actif des onglets explicitement annoncé sur le web ; état natif conservé via accessibilityState. Les tests de lecteur d’écran et de taille de texte sur appareils restent à faire.

Capture de l’accueil conservée localement : C:/Users/moelo/dev/speedfood-expo-client-accueil.png. Il s’agit d’un aperçu web à 390 × 844, pas d’une capture iPhone.

## Limites techniques relevées

La génération expérimentale des chemins typés échouait : expo-router/_ctx-shared non résolu depuis le module @expo/router-server hoisté. typedRoutes est désactivé pour ce lot, sans modification de node_modules ; le contrôle TypeScript strict des écrans reste actif. L’aperçu reste utilisable après cette correction.

Le serveur lancé dans le bac à sable n’était pas accessible au navigateur : un serveur localhost hors bac à sable a été lancé en mode hors ligne. La première navigation a attendu la compilation froide Metro ; la seconde a affiché l’application. Les attributs d’accessibilité natifs des SVG provoquaient des avertissements DOM : remplacés par un attribut décoratif adapté et vérifiés visuellement. L’accès aux favoris a été contrôlé après fermeture complète de la modale de zone.

Le verrou npm racine a été mis à jour, sans second package-lock dans l’application. Onze versions transitoires existantes ont changé (correctifs Babel et données de compatibilité navigateur), avec réorganisation des dépendances. React et Next existants n’ont pas changé de version. Les tests de régression ci-dessus couvrent ce lot ; cf:build du site n’a pas été relancé car l’agent ne lit pas .env.local. Aucun code web/API de production n’est modifié par ce lot.

## Relecture et prochaine étape

Spécification : un seul restaurant, montants entiers fictifs, aucune fausse commande, aucun compte requis, aucune promesse de disponibilité réelle ou de couverture nationale. Qualité : domaine séparé de l’état, des données et de la présentation ; tokens réutilisés ; polices et illustrations locales ; zones sûres haut/bas ; cibles tactiles au moins 44 px ; composants accessibles.

Faire relire l’aperçu par Malika, puis organiser les essais Android et iOS sur appareils avant le prochain lot. SQLite et les lectures API seront intégrés progressivement avec leurs contrats et tests, sans lever les blocages sur les créations réelles. L’idempotence et l’erreur de démarrage OpenNext restent des travaux API distincts, non résolus par cette refonte.

Retour arrière : retirer apps/mobile et les nouvelles dépendances via un commit de retour ; conserver Kotlin, la base, le site et l’API actuels. Les données fictives en mémoire peuvent disparaître sans opération sur une base.
