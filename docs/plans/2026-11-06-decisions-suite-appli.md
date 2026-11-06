# Décisions de suite du chantier appli — 6 novembre 2026

## Accord et ordre

Malika répond « Oui et ok pour tout cela » après validation de la reprise notifications restaurateur et rappel des trois sujets : prompt dans l’historique, fusion, restes d’espèces. Accord général consigné. Priorité : finir le correctif et l’essai F3 commencés. Aucun changement de ces trois sujets pendant la compilation du paquet F3. Les contraintes de la consigne restent : travailler et pousser uniquement etape-adr021-deblocage-commandes, ne pas toucher master ; donc une fusion effective dans master n’est pas exécutée en déduisant une exception silencieuse.

## 1. Prompt personnel dans l’historique

Constaté en lecture : docs/PROMPT-CODEX-CHEF-DE-PROJET.md a été ajouté par 744ec55 ; seule la branche locale de travail le contient parmi les branches locales examinées. Le fichier est absent de l’arbre origin/master au contrôle (référence locale distante : 63a95b8). Ne pas en publier le contenu dans un rapport.

Retirer le fichier par un nouveau commit ne suffit pas à le retirer de l’historique. Une réécriture ciblée de la branche modifierait les identifiants des commits descendants et demanderait une mise à jour forcée contrôlée de cette seule branche. Avant cela : vérifier les références distantes réelles, sauvegarder les commits dans une archive locale hors dépôt, préparer la réécriture dans une copie isolée, comparer tous les fichiers autres que ce chemin, et vérifier l’absence du chemin dans chaque commit réécrit. Ne supprimer aucune branche distante. Ne pas réécrire master ou les tags. Les références et caches GitHub peuvent conserver d’anciens objets : ne pas promettre un effacement absolu du site sans contrôle complémentaire. Aucune de ces opérations n’est réalisée par ce plan.

## 2. Fusion

Au contrôle local : origin/master est ancêtre de la branche (0 commit exclusif côté master, 79 côté branche après b76afa0). Ce comptage est un instantané, pas une revue des 79 commits. Préparer une revue complète, examiner les contrôles GitHub, les migrations et les garde-fous avant de proposer la fusion exacte. Les défauts I1/I2 des notifications et les essais natifs non réalisés doivent être visibles dans la proposition. Pas de modification/push de master pendant ce lot. Pas de déploiement ou allumage du relais commandes implicite dans une fusion.

## 3. Restes des espèces

Décision produit : aucun nouveau règlement en espèces ; cible Chap Chap Pay. Garder la lecture des opérations historiques ; ne pas effacer ni transformer silencieusement les lignes de paiement existantes. Les modes code marchand restent provisoirement autorisés suivant l’arbitrage du 3 novembre jusqu’à l’ouverture de Chap Chap Pay.

Constats source (pas une revue exhaustive) :
- packages/shared/src/paiement/regles.ts et apps/mobile/src/connexion/reglement.ts gardent les types/libellés historiques ; optionsProposables et la préparation mobile refusent déjà les espèces. Ne pas supprimer ces types sans étudier la compatibilité des anciennes commandes.
- apps/web/src/lib/table/regles.ts propose encore especes dans MODES_REGLEMENT : parcours table/ardoise à examiner avec ses services et vues.
- apps/web/src/lib/paiement/en-ligne/remboursement-manuel.ts autorise encore les remboursements en espèces (dernier recours) ; appeler cela une simple suppression de libellé serait faux. Il faut une règle serveur et un parcours de remboursement réellement disponible.
- Revoir aussi paiement/en-ligne/service.ts, paiement/affichage-suivi.ts, app/system/paiements/ActionsPaiement.tsx et app/restaurant/(console)/commandes/CommandeCarte.tsx ; leur mention d’espèces peut être historique ou active.
- Les contraintes SQL et anciens clients Kotlin restent à vérifier. Aucune migration implicite ; toute migration doit lire les contraintes, être versionnée, puis recevoir les contrôles de sécurité requis.

Préparer un petit lot TDD avec Sonnet, Opus indépendant, mutations et contrôles prescrits. Ne pas rendre Chap Chap Pay disponible par un simple texte ou masquer un échec d’intégration. Aucun nouveau compte, coût ou secret n’est autorisé implicitement.

## Retour arrière

Ce document est une préparation en lecture. Aucun fichier personnel retiré, aucune histoire réécrite, aucune fusion, aucune règle de paiement ni donnée de production modifiée.
