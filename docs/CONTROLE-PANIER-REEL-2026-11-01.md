# Panier réel Expo — contrôle du 1er novembre 2026

## Résultat

Sélection depuis les menus réels, panier mono-restaurant, quantités (30 maximum par ligne, comme le serveur), retrait et remise à zéro confirmée. Stockage séparé `speedfood-client-reel.db`, table `panier_client`, initialisation SQLite versionnée et Drizzle asynchrone. Seulement UUID/quantités ; aucun prix, nom, contact ou jeton conservé. Le fichier démo n’est pas ouvert par ce panier et n’a pas été effacé.

À l’ouverture du panier, les prix et disponibilités sont relus via GET sur l’API de production. Recherche paginée des plats sélectionnés, borne de sécurité et refus d’un curseur répété. Plat absent/épuisé : total indisponible, sélection conservée. Ancienne confirmation : « à confirmer ». Échec de lecture : pas de faux total confirmé. Les sauvegardes sont ordonnées ; une lecture incompatible ne provoque jamais une sauvegarde vide. Le message distingue restauration, enregistrement et échec ; reprise explicite possible.

Il s’agit d’un **brouillon local**, pas d’une commande. Le sous-total est indicatif, sans options, frais ni validation serveur de commande. Aucun POST métier, aucune activation de garde ou de relais, aucun secret, aucun déploiement, aucune migration Supabase.

## Preuves

- TDD : tests du nouveau domaine d’abord rouges (module absent, code 1), puis verts.
- Suite mobile finale : **24/24, code 0**. Domaine, codec, exclusion des identifiants démo, prix relus, plat absent/épuisé, prix fractionnaire, lecture corrompue sans écriture, échec sans relance, sauvegardes lentes ordonnées. Limites de quantité alignées sur `QUANTITE_MAX_LIGNE=30` et de lignes sur `LIGNES_MAX_COMMANDE=50` du validateur serveur existant.
- SQLite Node réel sur disque : initialisation répétable, contrainte singleton, absence de table démo, refus de sauvegarde avant lecture, fermeture/réouverture avec conservation des deux portions, refus d’une version future sans perte. Les requêtes du dépôt Drizzle sont réellement exécutées sur ce moteur.
- Quatre mutations : suppression du refus de changer de restaurant, total zéro pour un plat absent, sauvegarde avant lecture autorisée, suppression de la file locale ordonnée. Chaque défaut rend le test ciblé en échec code 1 ; restauration puis 24/24 à code 0.
- Types mobile : code 0. Exports Android/iOS/web : code 0 ; Hermes Android 3,4 MB, iOS 3,1 MB, web 1,5 MB (valeurs arrondies). Pas de dépendance nouvelle. API et site non modifiés ; leurs suites n’ont pas été relancées pour ce lot mobile.
- Parcours web avec la vraie API : deux portions de poulet braisé à 40 000 GNF → 80 000 GNF. Sauvegarde confirmée ; rechargement complet → deux portions restaurées, menu relu et même sous-total. Retrait d’une portion → 40 000 GNF. Annuler la remise à zéro conserve cette portion ; confirmer notre panier d’essai vide puis recharger conserve le vide. Nouvelle portion ajoutée pour la capture finale ; disponibilité réellement reçue « à confirmer ».
- Largeur 390 × 844 : pas de débordement horizontal global. Capture hors dépôt : `C:\Users\moelo\dev\speedfood-panier-reel.png`. Aucun restaurant n’a été contacté pour préparer une commande.

## Limites et retour arrière

La limite SQLite web (support alpha Expo) a été constatée : plusieurs onglets de la même origine se disputent le fichier OPFS, avec `Invalid VFS state` / accès déjà occupé. Le refus n’efface rien ; message explicite et bouton de reprise. Le parcours réussi a été vérifié dans un seul onglet à **http://127.0.0.1:8091/**, origine distincte du précédent aperçu localhost. Les données web sont propres à chaque origine : changer localhost en 127.0.0.1 ne transfère pas un panier existant. Aucun onglet utilisateur n’a été fermé pour forcer un accès ; seul l’onglet de contrôle créé dans ce lot a été fermé. Ne pas promettre le partage simultané entre plusieurs onglets.

Android et iPhone : stockage, bouton matériel, suspension, fermeture forcée et appareils réels NON vérifiés. La réussite des exports ne les prouve pas. Les erreurs réseau et le plat retiré sont couverts au niveau transport/domaine, pas provoqués sur le catalogue de production. Aucun cache de catalogue hors ligne n’est ajouté. Le changement de prix est détecté entre deux lectures en mémoire ; les anciens prix ne sont pas stockés et ne sont pas comparables après fermeture.

Retour arrière : retirer l’intégration du panier depuis CatalogueReel et ses nouveaux modules ; conserver le catalogue et ADR-021. Le fichier SQLite réel reste intact et inutilisé. Pas de SQL de production ou de configuration cloud à annuler. Prochaine tranche fonctionnelle : identité client et parcours privés, puis commandes seulement après leurs préconditions distinctes.
