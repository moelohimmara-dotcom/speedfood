# Panier réel Expo — brouillon local

Suite du catalogue réel autorisée par Malika. Un seul restaurant par panier, identifiants UUID et quantités entières ; 50 lignes maximum comme le serveur. Aucune création ni activation de garde, aucun paiement. Le montant reste indicatif et sera recalculé par le serveur au futur envoi. Options/accompagnements ne sont pas sélectionnés dans cette tranche.

Quantité maximale : 30 par ligne, comme le validateur serveur actuel. Résultats et limites observées, dont l’accès web à un seul onglet : docs/CONTROLE-PANIER-REEL-2026-11-01.md.

SQLite réel séparé du fichier de démonstration, instantané versionné contenant seulement restaurantId, platId et quantité. Pas de prix ni coordonnées ni jeton. Lecture avant écriture, sauvegardes ordonnées, erreurs visibles et reprise volontaire, pas d’effacement silencieux. Le catalogue réel doit être relu pour chiffrer un panier restauré ; pas de prix inventé ou conservé comme autorité. Plats absents/épuisés signalés ; disponibilité ancienne « à confirmer ». Changer de restaurant demande une action explicite. Quantité zéro retire la ligne ; vider exige confirmation.

Contrôles : domaine/codec rouges puis verts, mutations, SQLite réel fermé puis rouvert, types et exports Android/iOS/web, parcours d’interface avec l’API réelle sans aucun POST. Appareils natifs distincts. Pas de migration Supabase ni de déploiement API requis. Retour arrière : retirer le panier de l’entrée actuelle, laisser le fichier local intact et inutilisé ; conserver catalogue et ADR-021.
