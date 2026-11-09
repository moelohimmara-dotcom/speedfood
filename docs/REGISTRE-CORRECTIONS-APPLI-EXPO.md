# Corrections et suites — 8 novembre 2026

Référence du code : `57f80f1`. [Passation](PASSATION-CHANTIER-SPEEDFOOD-APP.md) · [reprise](REPRISE-EQUIPE-DEV.md). Les anciens plans gardent la chronologie ; les résultats finaux ci-dessous remplacent leurs mentions « à terminer ».

## Corrections terminées dans le code

| Référence | Problème et correction | Preuve / limite |
|---|---|---|
| F3 / `b76afa0` | Un clic « Nouvelle commande » avec le compte déjà ouvert n’ouvrait pas l’espace restaurateur. Intention consommée une fois, protégée pendant les opérations. | Tests, 5 mutations ; notification TEST SF-AA5TT reçue puis ouverture native et retour sans boucle. Pas de preuve de démarrage à froid. |
| F3 / `b76afa0` | Plusieurs contextes pouvaient demander l’autorisation simultanément. Promesse partagée. | Tests de concurrence ; premier dialogue/refus non rejoués sur l’émulateur déjà autorisé. |
| Cycle / `22766ce` | Renouveler la session pouvait perdre le rattachement des notifications. Génération stable au renouvellement et fermeture définitive à la déconnexion. | Tests contrôlés ; déconnexion réelle refusée par Malika, donc non essayée. |
| Cycle / `22766ce` | Un retrait tardif pouvait atteindre la nouvelle session ; double déconnexion et ancienne réponse pouvaient effacer B. Invalidation synchrone et file ordonnée. | Tests et mutations ; limite serveur I2 ci-dessous. |
| Cycle / `22766ce` | Un nouveau jeton reçu pendant l’envoi pouvait disparaître. Mise en attente du nouveau, dédoublonnage de l’identique. | Tests avec promesses contrôlées, aucune valeur réelle dans les preuves. |
| Cycle / `22766ce` | Un ancien contexte pouvait demander une permission après fermeture. Participants actifs vérifiés avant les effets. | Tests ; le marqueur local peut néanmoins indiquer une tentative sans dialogue visible si la fermeture intervient pendant son écriture. |
| G1 / `57f80f1` | Absence de fiche livreur Expo. Nouvelle route personnelle, projection stricte et écran de lecture. | 661 tests API et 544 mobile au total ; banc Android factice, pas RLS réelle. |
| G1 / `57f80f1` | Risque de fuite A→B et de réponse tardive. Filtre utilisateur explicite, contrôleur par génération et invalidation à la fermeture. | Tests, 12 mutations ; course A/B observée sur banc natif. |
| G1 / `57f80f1` | Banc bloqué par deux copies de React. Résolution React commune au seul banc. | Trois tests dont repli divergent volontaire ; démarrage natif réussi. |
| Documentation / présent lot | README catalogue seul, cartes sans Expo, états intermédiaires et recommandations anciennes contradictoires. | Nouveau point d’entrée, guides et avertissements datés ; aucun comportement produit modifié. |

Les lots commande A–D5 ont ajouté progressivement contrat/API, création, historique, suivi, règlement, commandes restaurateur, service, menu/photos et livraison. Leur détail d’acceptation est dans le [plan commande](plans/2026-11-02-commande-expo.md). Ne pas présenter une ancienne preuve web comme une preuve Android/iOS actuelle.

## Travaux encore ouverts

| Priorité | Travail | Critère de fermeture |
|---|---|---|
| P1 | I2 : cohérence serveur du rattachement d’appareil après enregistrement/retrait incertain | **Correctif écrit le 8 novembre 2026** (retrait daté par session, décision pure partagée, migration en fichier, 7 tests de protocole ; suites du dépôt vertes, rejeu 120/120) — voir PROTOCOLE-I2-RETRAIT-SESSION.md. **Fermé le 8 novembre 2026** : migration appliquée et table auditée, API f8ddc3bb et site f7ac08ca déployés, déconnexion réelle autorisée puis reconnexion de Malika — retrait appliqué (appareils 2 vers 1, trace écrite) puis trace consommée par la nouvelle session (retraits 1 vers 0). La réémission tardive d'une session morte reste couverte par les tests de protocole (elle exigerait le jeton de la session morte). Un AbortController seul ne suffit pas : c'est le serveur qui ordonne. |
| P1 | Mise en service G1 | Comparer version déployée au code complet, préparer retour arrière, feu vert distinct, puis compte livreur/RLS réels autorisés. |
| P1 | Notification client « prête » sur téléphone physique | Observation réelle de réception et ouverture, avec accord pour chaque transition métier nécessaire. L’émulateur ou une compilation ne ferme pas cette case. |
| P1 | Compléter la parité avant remplacement Kotlin | Tableau fonctionnel client/restaurateur/livreur/équipe et paiement ; essais Android/iOS, signature et mise à jour conservant les données. |
| P1 | Paiement Chap Chap Pay exclusif | Vérifier l’intégration et ses prérequis actuels ; décider les remboursements et le traitement historique avant de retirer les espèces restantes. Aucun paiement réel implicite. |
| P2 | Notifications : premier dialogue/refus, démarrage à froid et déconnexion réelle | Scénarios dédiés, appareils de test ; préserver la session actuelle tant que Malika refuse sa fermeture. |
| P2 | G2+ livreur | Plan distinct : disponibilité/offres, courses/position, dossier/frais/historique, notifications. Ne pas réutiliser silencieusement les lectures historiques à effets de bord. |
| P2 | Espace équipe Expo, inscription/OAuth et diffusion iPhone | Définir la parité et les canaux autorisés ; une archive simulateur ne s’installe pas sur un iPhone physique. |
| P2 | Limitation par requête et autres anciens chantiers | Recontrôler le câblage réel et décider avec Malika ; ne pas confondre présence d’une fonction et protection active. |

## Incidents et résultats honnêtes

Le premier lancement parallèle des tests API du 8 novembre a produit 660 succès et une annulation par délai, code 1. La suite identique relancée seule a donné 661/661, zéro annulation, code 0. La charge est une explication probable, pas une mesure. Le diagnostic natif du banc a aussi affiché « Cannot connect to Expo CLI » ; bundle et parcours locaux ont fonctionné. Cela n’est pas une validation release.

La commande TEST SF-AA5TT a été créée puis annulée sous deux autorisations distinctes. La confirmation d’annulation est celle de l’interface après actualisation ; pas de contrôle SQL indépendant. Ne pas la recréer. Les anciens doublons SF-WMQXU/SF-SC78P documentent un échec d’idempotence historique, pas une preuve du correctif actuel ni une permission de les supprimer.

## Décisions réservées à Malika

Retirer le prompt de l’historique ; fusionner dans master ; nettoyer les restes de paiement en espèces. Les discussions générales ne valent pas autorisation d’une opération précise. Les frais Apple/Google, comptes, services et production demandent également leur feu vert distinct.
