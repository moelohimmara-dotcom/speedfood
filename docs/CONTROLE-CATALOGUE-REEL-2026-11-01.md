# Catalogue réel Expo/API — contrôle du 1er novembre 2026

## Portée livrée

Lectures publiques paginées des restaurants et menus dans l’API unique. L’entrée Expo affiche ce catalogue réel ; le démonstrateur, son panier et sa base SQLite ne sont pas montés. Aucune donnée fictive de secours. Recherche limitée explicitement aux restaurants chargés, menu, retour, actualisation, chargement, erreur et état vide. Pas de création, paiement ou connexion dans cette tranche. Synchronisation incrémentale et cache SQLite réel restent à implémenter.

La source utilise la clé publique Supabase et la RLS, avec filtres supplémentaires : restaurant publié, non suspendu, `donnees_demo=false`, plats non archivés. Projection explicite sans contact privé. Pagination par identifiant, 50 restaurants / 100 plats par page et curseur suivant. Prix entiers, promotion, règle partagée de fraîcheur et seuil du site. Les anciennes confirmations restent « Disponibilité à confirmer ». Réponses no-store et CORS public limité à ces routes.

## Autorisations et production

Malika autorise le branchement et les déploiements prêts, puis donne un feu vert séparé pour ajouter `NEXT_PUBLIC_SUPABASE_ANON_KEY` au Worker API. Ajout réalisé via connecteur à partir du réglage public déjà utilisé par le site ; type anon contrôlé en mémoire, valeur jamais affichée ni écrite dans un fichier. Aucun secret administrateur, relais, schéma, commande ni compte cloud modifié par ce lot.

Code principal : commit `16bf245`. Première livraison isolée depuis la base historique `30f3ca3`, avec les seuls lecteurs catalogue : ni RPC ni liaison ADR-021 encore non validés à cet instant. SHA-256 du paquet : `892e6beedca756d72f3952caf303ee3715324101f7ad87083c8422dafdf668c8`, 1 199 899 octets, gzip Wrangler 233,76 Kio. Paquet exact démarré sous workerd local : lectures publiques, menu, identité refusée et absence d’écriture contrôlés avec fausse base ; code 0. Assemblage sec Wrangler propre : code 0. Déploiement autorisé : code 0, version API **d1ac641a-d064-48e4-b695-0661dd68c240**.

Pendant l’interruption de cette conversation, la reprise ADR-021 a ensuite déployé le site et l’API (commits b3cd801 / af83611). **État actuel vérifié en métadonnées : API 22542e7e-fdfe-4cd1-beb2-f978f9923aff, 100 %, déployée à 17:47:28 UTC**, avec `SITE_JETONS` et la clé publique toujours présents. Cette version conserve les routes catalogue. Ne pas redéployer l’ancien paquet isolé : il retirerait le câblage ADR-021 ultérieur. Le préparateur historique refuse maintenant de fonctionner sans l’option explicite `--historique-30f3ca3` ; refus attendu code 1, syntaxe vérifiée code 0. Une nouvelle livraison courante doit partir du Worker courant.

## Preuves fonctionnelles

- Rouge initial : routes absentes, suite code 1. Tests source corrigés pour isoler l’adaptateur de lecture des imports Next, puis verts.
- Suite API : **257/257, code 0**. Six nouveaux contrôles de routes/source : curseurs invalides, parent absent, erreurs, projection, filtres, pagination, prix et disponibilité. Ces contrôles simulent HTTP Supabase ; ils ne prétendent pas modifier ou auditer toutes les policies de la base réelle.
- Mobile : **18/18, code 0**, dont transport public sans cookie, réponse invalide, prix fractionnaire, mauvais restaurant, délai borné sans relance automatique. Types de tous les workspaces : code 0. Après correction UI, types et 18 tests mobiles relancés : code 0.
- Cinq mutations pertinentes : filtre de publication inversé, archives non exclues, promotion ignorée, cookies inclus, prix fractionnaire accepté. Chacune fait échouer le test ciblé à code 1 ; sources restaurées, six contrôles catalogue API et 18 mobiles repassés à code 0. Une première tentative de mutation sur les tests source encore mal résolus n’était pas probante et n’est pas comptée.
- Contrôles publics après première livraison : santé 200, catalogue 200 (un restaurant), menu 200 (trois plats), curseur invalide 400, espace privé sans connexion 401 ; code 0. Aucun appel de création.
- Après la livraison ADR-021 ultérieure : le **vrai client TypeScript mobile**, exécuté sans clé ni connexion, lit le restaurant et ses trois plats sur l’API de production ; code 0, à 17:52 UTC. Les montants entiers et le rattachement du menu sont vérifiés.
- Parcours dans l’aperçu web relancé sur **http://localhost:8091/** : restaurant réel affiché, recherche sans résultat puis réinitialisation, ouverture des trois plats et retour aux restaurants. Prix 25 000 / 40 000 / 25 000 GNF et disponibilité à confirmer, selon les anciennes confirmations réellement reçues. Contrôle à 390 × 844 : aucun débordement horizontal global. Le branchement BackHandler a d’abord produit un avertissement web ; la garde Platform.OS le réserve désormais au natif et l’avertissement ne réapparaît pas après rechargement.
- Capture du menu hors dépôt : `C:\Users\moelo\dev\speedfood-catalogue-reel-menu.png`. L’aperçu reste local ; ce n’est pas une publication dans les magasins.
- Après les dernières corrections UI : exports Android/iOS/web à code 0. Hermes Android 3,4 MB, iOS 3 MB, web 1,5 MB et worker SQLite 139 KB (tailles arrondies du compilateur). Actualisation volontaire vérifiée dans l’interface : horodatage passé de 17:56:49 à 17:58:08 UTC.

## Limites, contrôle externe et retour arrière

Les exports Hermes Android/iOS/web sont générés sans fichier de secrets ; ils ne sont ni des APK/IPA signées ni des essais sur téléphones. Retour Android matériel, suspension et iPhone restent NON vérifiés. Le catalogue est réel et public ; cela ne prouve ni le stock actuel ni la capacité opérationnelle d’un établissement. Les commandes réelles restent bloquées par leurs préconditions distinctes (voir passation ADR-021).

Le téléchargement du source complet du Worker a été refusé par la revue automatique, pour risque de lecture de code privé/sensible. Aucun contournement : préparation depuis l’historique local, contrôles de paquet, métadonnées et GET publics. Une vérification de métadonnées a ensuite été interrompue par le quota de revue ; elle a réussi à la reprise, sans téléchargement de source. Aucun blocage de métadonnées restant pour ce contrôle.

Retour arrière fonctionnel : retirer les nouveaux lecteurs et l’entrée Expo réelle depuis le code courant, en conservant les changements ADR-021 ultérieurs, puis tester et livrer ce paquet courant. Revenir aveuglément à l’ancienne version API 8a77448b ou d1ac641a supprimerait aussi des travaux ultérieurs : ce n’est pas un retour arrière isolé du catalogue. Aucun SQL à annuler. Kotlin et le site restent en place ; le fichier SQLite démo n’a pas été effacé ni converti.
