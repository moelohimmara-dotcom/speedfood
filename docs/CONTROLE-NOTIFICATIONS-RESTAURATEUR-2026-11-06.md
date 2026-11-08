> **Lecture actuelle — 8 novembre 2026.** Rapport historique du lot nommé. Les corrections ultérieures de génération, renouvellement et file de session sont consolidées dans le [registre](REGISTRE-CORRECTIONS-APPLI-EXPO.md). Pour le dernier code, ses preuves et les limites serveur I2, lire la [passation](PASSATION-CHANTIER-SPEEDFOOD-APP.md). Les états intermédiaires ci-dessous ne remplacent pas les résultats finaux.

# Contrôle notifications restaurateur Expo — 6 novembre 2026

## Résultat et périmètre

Parcours principal F3 **vérifié sur l’émulateur Android speedfood_pixel** : création d’une commande TEST autorisée, réception de « Nouvelle commande », appui avec application en arrière-plan et session déjà active → Espace restaurateur barbie food. Retour à Mon compte sans réouverture en boucle. Aucun déploiement de production, secret, relais ou signature de production modifié. Kotlin reste distribué.

## Code et méthode

- F1-F2 existaient dans 362d8c7. La passation disait à tort non committés : contradiction signalée.
- Lecture séparée par Sonnet et Opus via Claude Code installé, sans outil d’accès aux secrets. Les deux détectent B1 (ouverture seulement à froid) et B2 (demandes d’autorisation concurrentes).
- Même Sonnet repris par messages : tests rouges seulement, constat personnel du contrôleur (10 échecs / 11 tests), puis correctifs. Module pur ouverture-espace.ts, branchement React sur nouvelle demande et rôle connu, respect de restaurateurOccupe ; promesse partagée entre les déclencheurs client et restaurateur.
- Opus indépendant : prêt pour essai F3 uniquement. Réserve sur le verrou levée après examen du nettoyage déjà présent dans RestaurateurReel ; pas de correction superflue par le contrôleur.
- Malika confirme le choix C : demande système une seule fois après reconnaissance du rôle restaurateur, y compris réouverture. Commentaires et spec alignés explicitement.
- Commit de code : b76afa03f234530a3c800f1a61cfa71a7571c973. Comparaison sources mobiles/partagées entre ce commit et HEAD après les seules mises à jour documentaires : code 0, aucun écart.

## Contrôles relancés personnellement

Après correction et restauration des mutations : npm run typecheck, test:api (646/646), test:unit, test:cloisonnement (489 contrôles), build:api (1254 Kio) ; dans apps/mobile, npm test (500/500) et tsc --noEmit. Tous codes 0.

Cinq mutations via scripts/muter-notifications-f3.mjs, chacune code 1 : partage retiré, demande non consommée, rôle inconnu mal traité, garde occupé retirée, armement débranché. Restauration octet pour octet en finally puis ciblé code 0. Les tests de câblage lisent du source : ils ne remplacent pas l’essai natif ci-dessous.

## Paquet réellement testé

- GitHub Contrôles n°83 : succès.
- Android Expo n°28 : succès, run 42152464889, commit b76afa0, branche de travail. Archive speedfood-expo-debug-apk : 92 814 562 octets, SHA-256 3c8c3cc410f0c5ceafbb6f9df0a68475d4c5136b1ee44f31a89b5b197ba27c98, contrôlé avant extraction.
- APK release de contrôle : 73 131 994 octets ; com.speedfood.clientdemo, code 1, version 0.1.0. Signature vérifiée puis comparée à l’APK auparavant installée : identique. Firebase, projet et expéditeur attendus vérifiés dans les ressources compilées, sans affichage de clé. Le premier contrôle sans --values ne montrait pas la valeur de projet ; reprise avec les valeurs détaillées, contrôle code 0. Aucun fichier de clé privée, configuration secrète ou coffre de session lu par l’agent.
- Installation adb install -r : Success, code 0. Pas de désinstallation ni de remise à zéro. Connexion, rôle restaurateur et panier conservés. Trois canaux présents : suivi_commande, alerte_commande, offre_course. POST_NOTIFICATIONS déjà accordée : pas de nouvelle boîte observée.
- iPhone Expo n°25 : succès, run 42152464911, même code ; compilation Release, lancement dans le simulateur et capture. Ceci ne prouve ni notifications APNs, ni installation sur téléphone physique depuis le site.

## Essai réel F3 et autorisations

1. Oui distinct de Malika : UNE commande TEST barbie food, un jus d’orange mélangé au bissap, retrait, 25 000 GNF, sans paiement, sans relance automatique.
2. Vérifications en lecture avant envoi : compte connecté, espace barbie food chargé ; le service marque les commandes de ses membres comme TEST. Menu public : prix 25 000 GNF, restaurant ouvert et accepte commandes, disponibilité du plat « à confirmer ». Aucune confirmation de plat modifiée.
3. Formulaire : nom ESSAI F3 NE PAS PREPARER, numéro fictif, récapitulatif et confirmation vérifiés. La saisie Android rapide a tronqué le nom ; corrigée localement, caractère par caractère, avant tout envoi. Aucun échec local pris pour un envoi incertain.
4. Verrou local créé AVANT l’unique appui sur Envoyer : C:/Users/moelo/dev/controle-notifications-f3-20261106/verrou-creation-test-f3.json. Un seul appui ; jamais de relance. L’ancien verrou d’idempotence de novembre n’a pas été touché.
5. Résultat client : **SF-AA5TT · TEST**, barbie food, retrait, 25 000 GNF, 06/11/2026 03:24:05 UTC, « En attente du restaurant ». Pas de paiement.
6. Mon compte déjà ouvert, session active ; app mise en arrière-plan. Tiroir système : **Nouvelle commande**, « Une commande attend votre réponse. Ouvrez Speedfood. », Speedfood Catalogue. Notification réellement vue, pas seulement envoi accepté côté Firebase.
7. Appui sur cette notification : Espace restaurateur ; lecture terminée : barbie food et SF-AA5TT · TEST visibles, bouton Accepter visible mais JAMAIS appuyé. Retour Mon compte, puis nouvelle observation : pas de réouverture en boucle.
8. Oui distinct de Malika reçu pour annuler seulement SF-AA5TT. Confirmation locale contrôlée sur cette référence, puis un seul appui « Oui, annuler la commande » à 03:32 UTC, sans relance. L’application affiche « Commande annulée. », encore présent après actualisation en lecture. Aucune autre commande touchée. Statut en base non relu directement ; preuve retenue : réponse affichée par le parcours restaurateur. Verrou local d’annulation conservé.

L’essai Android a été contrôlé par le SDK (UiAutomator et captures) prévu dans la passation après constat d’un décalage de coordonnées du contrôleur Windows. Aucune session, jeton de suivi, jeton FCM ou mot de passe extrait. Aucune autre commande ni statut touché. Pas de lecture SQL indépendante : les preuves métier sont les écrans client/restaurateur alimentés par la vraie API. La colonne derniere_reussite_le n’a pas été lue dans cette reprise.

## Preuves locales, hors dépôt

Dossier C:/Users/moelo/dev/controle-notifications-f3-20261106 : apres-envoi.png, notification-restaurateur.png, ouverture-restaurateur.png, archive et APK de contrôle. Ces fichiers ne sont pas ajoutés à Git (les vues restaurateur peuvent contenir des données personnelles). Journaux de suites : C:/Users/moelo/dev/reprise-f3-final-*.log. Préserver les fichiers .tmp-* préexistants de Malika, non suivis.

## Limites et reste avant remplacement

- Non prouvés par ce seul TEST : appui restaurateur à froid après arrêt du processus, première demande/refus système avec données neuves, changement de compte, retrait à la déconnexion et réseau coupé, second appareil, téléphone Android physique, iPhone physique.
- I1 hérité : plusieurs enregistrements par session restent possibles, malgré réduction des appels concurrents. I2 hérité : un enregistrement en vol peut dépasser le retrait à la déconnexion. À traiter et tester avant remplacement de production ; le correctif B1/B2 ne les ferme pas.
- Autres cas E3 et paiement Chap Chap Pay, livreur/équipe, identité/signature de production restent des travaux distincts. Aucune règle d’espèces changée ici. Pas de fusion dans master ni réécriture d’historique.

## Retour arrière

Code : revenir aux fichiers de 362d8c7 sur la branche de travail, sans réécrire l’histoire. Paquet de contrôle précédent conservé localement ; pas de réinstallation ni de rétrogradation automatique. La commande TEST n’est pas effacée ; tout changement de son statut exige son accord distinct. Aucun retour arrière de production nécessaire dans ce lot.
