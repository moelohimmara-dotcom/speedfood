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

## Reprise Codex — 15 novembre 2026 : clavier livreur M4

Correction locale sur `lot2-restaurateur` : le code de remise et la raison d’échec sont reliés au défilement vers le champ actif, avec nouvelle mesure après changement de taille du contenu (ouverture du clavier Android). Le mécanisme réutilise `cibleDefilement` et la marge existante ; un conteneur adapté au clavier est ajouté pour iOS. Une mesure tardive ne défile pas vers un champ qui a perdu le focus.

Vérifications : test de câblage ajouté avant correction, constaté en échec puis suite mobile complète 784/784 ; TypeScript mobile code 0 ; diff sans erreur d’espacement. Ce test vérifie le branchement du code, pas la visibilité réelle à l’écran. Essai émulateur/téléphone encore requis : course vers le client, ouvrir le code puis la raison d’échec, vérifier champ et boutons accessibles sans envoyer d’action. M4 reste à confirmer sur appareil. Aucun envoi métier ni publication effectué.
Export Android Expo/Hermes terminé à code 0. Cet export ne constitue pas une compilation APK ni un essai natif.

## 15 novembre 2026 — contrôle natif M4 et suites livreur sur banc local

APK debug de contrôle déjà disponible installée par `adb install -r` (aucun effacement), puis Metro sur `controle-livreur` et serveur local 8797. Émulateur `speedfood-essai`, x86_64. Vrai composant `LivreurReel` modifié, contrôleur et parseurs du produit, données exclusivement factices en mémoire. Chargement initial lent ; attendre la fin du bundle avant de conclure à une panne. Variables EXPO_NO_DOTENV et EXPO_NO_TELEMETRY activées.

Résultats observés :
- M4 : clavier numérique ouvert, code de remise et bouton « Livrée » visibles après défilement automatique. Passage au champ multiligne de raison : clavier texte, raison, « Confirmer l’échec » et « Annuler » visibles. Correctif confirmé sur ce banc Android ; iOS et téléphone physique non essayés.
- Échec avec raison : saisie fictive, un seul clic de confirmation ; journal `A:course:echec`, raison présente, livraison `echec`, écran revenu à Disponible sans carte client. Aucun doublon, violations vides.
- Course remplacée : changement du monde factice après lecture, action depuis la course périmée ; message « La course a changé, relisez. », nouvelle référence SF-TEST-0002 affichée, ancienne course annulée et nouvelle assignée, aucune transition ajoutée au journal.
- Livraison propre : « Je pars chez le client » proposé directement, puis course `vers_client` avec client et formulaire du code. Pas de remise finale exercée dans ce scénario.
- Réponse lente A puis choix B : écran final Livreur témoin B / Restaurant témoin B / SF-TEST-B001, aucune carte client A. Le chevauchement exact des réponses n’a pas été instrumenté ; la concurrence reste aussi couverte par les tests contrôlés.

Suite M5 partielle : le transport du banc écrasait le signal AbortSignal du vrai client. Deux tests rouges avant correction, verts ensuite : propagation d’une annulation en cours et refus avant fetch si déjà annulée. Le plafond local de 6 s reste conservé, l’écouteur est retiré après fetch. Cette correction ne prouve pas le délai réel de 20 s ni l’annulation pendant lecture du corps ; M5 reste ouvert pour ces scénarios et la redirection HTTP réelle.

Banc et Metro de contrôle arrêtés après essais ; relance de Metro normal pour le retour au produit. Aucune écriture métier réelle, aucun paiement, aucun déploiement. Les résultats du banc ne changent pas les lignes de la matrice en « Reprise », qui exigent des essais contre les vrais contrats et, pour le livreur, un téléphone réel.

### Suite M5 — vrais délais et redirections du client (15 novembre)

Contrôle du vrai `creerAuth` hors transport du banc : minuterie simulée, signal non annulé à 19 999 ms puis annulé à 20 000 ms, erreur `incertain`, un seul appel. Le test HTTP avec serveur local et vraies réponses 301/302/303/307/308 a révélé un défaut produit : `fetch` suivait la redirection et pouvait présenter la réponse de destination comme un succès. Test rouge constaté avant modification. Correction : `redirect: error` dans le chemin commun des écritures livreur (disponibilité, offre, course). Test vert ensuite pour les cinq codes, offre et course : dix requêtes d’entrée, zéro appel de destination, résultat incertain. Aucun nouveau contrat serveur.

Vérifications finales : 788/788 tests mobiles, TypeScript mobile code 0. M5 est couvert sur ces deux points au niveau client Node ; le comportement réseau natif Android et le délai pendant lecture du corps restent à contrôler. Le plafond de 6 s du transport du banc continue d’empêcher un essai natif fidèle de 20 s.

Limite native confirmée par lecture des dépendances installées : `react-native/Libraries/Network/fetch.js` utilise `whatwg-fetch`, dont le chemin XHR ne traite pas l’option redirect. La modification du client protège donc les environnements Fetch qui prennent cette option en charge ; elle ne garantit pas le refus des redirections Android. Expo possède un transport natif qui implémente cette option ; son adoption ciblée et son essai natif restent à faire avant de fermer M5.

Retour au produit vérifié le 15 novembre : catalogue normal puis « Compte connecté » observés, session conservée. D5 : ouverture réelle de la file, réponse « Aucune autre course en file », pas d’erreur. D6 : chargement manuel réussi, une course TEST SF-H56DT affichée à 0 GNF, sans erreur. D7 : aujourd’hui 0 course / 0 GNF, sept jours 1 course / 0 GNF, dernière course TEST correspondante. Les lignes D5/D6/D7 de la matrice sont actualisées sans passage en Reprise (téléphone réel, file non vide et pagination non essayés). Le livreur est resté hors ligne ; aucun bouton de disponibilité ni de transition réelle actionné.

## 15 novembre 2026 — redirections des écritures livreur, preuve native Android

Adaptateur `http-natif.ts` : `expo/fetch` explicitement choisi pour les requêtes `redirect: error`, via la fonction pure `creerTransportHttp`. Les autres requêtes conservent leur transport. Branché dans la session produit `gestion.ts` et dans le banc livreur ; aucune solution de repli ni relance après erreur. Pas de nouvelle dépendance.

Correction du diagnostic précédent : la lecture du seul `react-native/Libraries/Network/fetch.js` ne décrivait pas le fetch effectif d’Expo 57. `expo/src/winter/runtime.native.ts` installe déjà Expo Fetch par défaut, sauf EXPO_PUBLIC_USE_RN_FETCH. Le premier témoin avec le fetch global bloquait déjà la redirection. L’adaptateur rend désormais ce choix explicite pour les écritures protégées, même si le runtime utilise XHR. Le contre-essai utilise explicitement l’export fetch de `whatwg-fetch`.

Banc reproductible : `apps/mobile/controle-redirections/README.md`. Vrai `creerAuth`, même adaptateur que le produit, APK debug existante `com.speedfood.clientdemo`, émulateur `speedfood-essai` x86_64. Deux serveurs locaux 8798/8799, données et porteur factices ; aucun coffre ni appel de production.

Résultats natifs observés :
- Témoin XHR : une réponse 307 suivie, une entrée et un POST de destination ; le serveur confirme la présence d’une autorisation factice, sans en exposer la valeur.
- Adaptateur Expo : disponibilité, offre et course, chacune pour 301/302/303/307/308, vers même origine puis autre origine locale : 30/30 erreurs `incertain`, aucune relance et aucun appel de destination.
- Témoins positifs : 3/3 réponses HTTP 200 acceptées. Compteurs finaux : exactement 33 entrées, 0 destination. Un simple échec de chargement du module ne pouvait donc pas faire passer le contrôle.
- Incidents du banc résolus : deux copies React au premier lancement (configuration Metro du banc livreur reprise), démarrage lent avec alerte de non-réponse, puis écran et essais fonctionnels. Aucun effacement des données.

Vérifications : tests de sélection du transport, de conservation des options et d’absence de repli écrits avant adaptation ; première exécution rouge (module absent), puis 791/791 tests mobiles et TypeScript code 0. M5 : volet redirections confirmé sur cet émulateur ; délai natif de 20 s et lecture lente du corps restent distincts et non prouvés par cet essai. Aucun essai iOS, téléphone physique ou nouvel APK autonome ; aucune publication.

Fin de contrôle : les serveurs 8798/8799 et Metro du banc sont arrêtés ; leurs relais ADB sont retirés. Metro normal reste actif sur 8081 pour l’APK debug. Catalogue normal puis « Compte connecté » observés ; session préservée. Aucun effacement, aucune signature, aucun déploiement.

## 15 novembre 2026 — délai global de 20 secondes et lecture lente, preuve Android

Renforcement local du vrai client `ecritureLivreur` : une réponse reçue après annulation est refusée explicitement, après les en-têtes comme après lecture du corps. Le délai de 20 000 ms reste actif pendant toute la lecture ; aucune nouvelle minuterie après réception des en-têtes. Deux tests avec transport volontairement non coopératif (fin tardive malgré signal annulé) écrits d’abord, constatés rouges, puis verts après ces gardes.

Banc `controle-redirections` étendu : serveur local `serveur-delais.mjs` sur 8796, bouton « Vérifier les délais », vrai `creerAuth` avec son délai par défaut, même `fetchHttp` que le produit, vrai `creerControleEtatLivreur`. Session et course factices, aucun coffre ni appel de production. L’action est appliquée en mémoire avant de retarder la réponse, pour vérifier la relecture après résultat incertain.

Résultats sur l’émulateur Android `speedfood-essai`, APK debug existante, secondes réellement écoulées :

| Cas | Mesure Android | Serveur / comportement |
|---|---|---|
| Témoin JSON terminé après 1,5 s | Succès et relecture en 1 719 ms ; en-têtes 171 ms ; pas d’annulation | 1 envoi, fin serveur à 1 510 ms, connexion terminée normalement |
| Aucun en-tête avant 25 s | Signal annulé à 20 023 ms ; appel terminé incertain à 20 035 ms ; aucun en-tête reçu | 1 envoi, fermeture serveur à 19 950 ms depuis réception ; tentative de fin à 25 010 ms sans effet |
| Corps JSON progressif jusqu’à 25 s | En-têtes en 93 ms ; signal annulé à 20 009 ms ; appel terminé incertain à 20 045 ms | Début puis espaces toutes les 4 s, 5 fragments envoyés ; fermeture à 19 981 ms ; tentative de fin à 25 011 ms sans effet |

Pour chacun des deux cas lents : tentative supplémentaire via le vrai contrôleur bloquée (compteur d’envois toujours 1), aucun changement de publication jusqu’à 27 s, résultat toujours incertain, puis relecture manuelle affichant `recuperee` et retirant le verrou. Le transport a réellement fermé la connexion : aucune fin tardive ne pouvait être transmise ; le refus d’une réponse tardive fournie malgré l’annulation est couvert séparément par les tests de non-coopération.

Preuves JSON exportées, rapports natifs et compteurs concordants. Les écarts de quelques dizaines de millisecondes entre client et serveur viennent de points de départ distincts (appel côté Android / réception serveur). Contrôles : 793/793 tests mobiles, TypeScript code 0. Les critères supplémentaires vérifient aussi que l’appel se termine moins de 2,5 s après le signal : écarts observés 12 ms et 36 ms.

M5 : les volets redirections, attente avant en-têtes et lecture lente sont maintenant vérifiés sur cet émulateur. Cela ne vaut ni téléphone physique, ni iOS, ni nouvel APK autonome ou publication.

Fin de l’essai délais : serveur 8796 et Metro du banc arrêtés, relais 8796 retiré. Application normale relancée ; catalogue puis « Compte connecté » observés, session conservée. Metro normal reste actif sur 8081 pour l’APK debug. Aucun effacement, envoi métier réel ni déploiement.
