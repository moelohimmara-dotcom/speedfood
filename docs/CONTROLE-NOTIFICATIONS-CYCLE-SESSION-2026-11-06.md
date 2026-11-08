> **Lecture actuelle — 8 novembre 2026.** Rapport historique du lot nommé. Les corrections ultérieures de génération, renouvellement et file de session sont consolidées dans le [registre](REGISTRE-CORRECTIONS-APPLI-EXPO.md). Pour le dernier code, ses preuves et les limites serveur I2, lire la [passation](PASSATION-CHANTIER-SPEEDFOOD-APP.md). Les états intermédiaires ci-dessous ne remplacent pas les résultats finaux.

# Notifications Expo : contrôle du cycle de session — 6 novembre 2026

## Périmètre
**Code local vérifié ; aucune diffusion de production.** Contrôles de concurrence déterministes et non-régression native distincts ; I2 serveur et déconnexion réelle restent ouverts.

Durcissement client I1/I2 après le parcours restaurateur F3. Aucune commande créée ou modifiée dans ce lot. SF-AA5TT a déjà été annulée dans le lot précédent ; ne pas rejouer cet essai.

I1 : au plus un essai d’enregistrement du même jeton pendant la même session, même quand plusieurs contextes le déclenchent. Un résultat refusé ou incertain n’est pas rejoué. Une nouvelle session ou un vrai renouvellement est un nouveau déclencheur.
I2 côté client : fermeture anticipée, garde après toute attente, ordre des appels appareil, budget de déconnexion borné, anciennes continuations invalidées lors du changement de session.

## Méthode et exception
Sonnet a refusé le démarrage (quota hebdomadaire jusqu’au 8 novembre à 19 h, Africa/Conakry). Malika autorise explicitement le remplacement par un sous-agent GPT. Opus a terminé l’audit initial indépendant ; son quota a ensuite bloqué la relecture du correctif. La relecture finale est donc confiée à un second sous-agent GPT indépendant, exception annoncée. Le contrôleur n’écrit pas le correctif : les corrections reviennent au même implémenteur.

Tests nouveaux avant code : sept défauts reproduits sur neuf cas, commande relancée par le contrôleur, code 1. Les valeurs des tests sont exclusivement factices. Journaux locaux hors dépôt : C:/Users/moelo/dev/cycle-*.log.

## Limite réseau qui reste ouverte
Un timeout ou un abort ne garantit pas l’annulation côté serveur. Un enregistrement déjà parti peut être appliqué après le retrait. Le client protège ses départs et leur ordre ; il ne prouve pas l’ordre d’application sur le serveur. Retrait serveur relu : filtré par compte ET jeton. Aucun changement serveur, nouvelle migration ou service dans ce lot. Ce risque n’est pas accepté implicitement pour le remplacement de production.

## Vérifications personnellement relancées
Après correction : npm run typecheck, test:api (646/646), test:unit, test:cloisonnement (489 contrôles), build:api (1254 Kio), npm test dans apps/mobile et npx tsc --noEmit : tous codes 0. Après le dernier delta génération, typecheck racine, test mobile (527/527) et types mobiles relancés : tous codes 0. Journaux cycle-final-*.log et cycle-final2-*.log, hors dépôt.

Le premier lancement API dans le bac à sable échouait par EACCES sur 127.0.0.1. La même suite complète passe sur l’hôte. Ce n’était pas un échec métier.

27 tests comportementaux supplémentaires : déclencheurs concurrents ou répétés, refus/incertain sans répétition, lecture native/accès suspendue, ordre POST-retrait-session suivante, vrai renouvellement en vol, génération stable au renouvellement du porteur, changement de compte, double déconnexion, budget de six secondes, retrait non parti abandonné, dialogue ancien et nouveau participant, génération fermée impossible à rouvrir.

Mutations relancées par le contrôleur : 9 nouvelles protections cassées séparément, chacune code 1, sources restaurées octet pour octet puis ciblé code 0. Les 5 mutations F3 sont également détectées (codes 1), restaurées, ciblé code 0. Un premier essai du script par l’implémenteur avait révélé un test trop faible et un test de délai suspendu : tests renforcés avant ce verdict. Aucun résultat de test suspendu pris pour une preuve de protection.

Relecture indépendante GPT : aucun blocage pour l’essai natif de contrôle. Petite réserve sur la réouverture d’une génération fermée corrigée par le même implémenteur, test ajouté, delta relu et réserve levée. Limite conservée : fermeture pendant l’écriture du drapeau peut marquer la demande tentée sans afficher la boîte ; le drapeau ne prouve pas un affichage.

## Preuve native et portée

Préparation native : archive Android GitHub n°28 déjà vérifiée lors de F3 ; APK debug extraite, signature publique identique à la release de contrôle. Installation adb -r réussie, code 0, sans effacement de données. Metro local uniquement, EXPO_NO_DOTENV=1, télémétrie désactivée. Cette installation prépare un essai local du JavaScript modifié, elle ne remplace pas l’APK Kotlin distribuée et ne prouve pas un paquet release contenant le nouveau correctif.

## Retour arrière et transmission
Commit inverse ciblé sur la branche etape-adr021-deblocage-commandes. APK release de contrôle précédente conservée hors dépôt. Ne pas supprimer les fichiers .tmp-* personnels non suivis. Aucun master, relais commandes, secret ou réglage de production modifié.


Malika refuse explicitement la déconnexion réelle pour conserver sa session. Aucun clic de déconnexion effectué. Les courses de déconnexion restent donc prouvées par les tests injectés, pas par une déconnexion réelle sur cet émulateur. Le retrait effectif après déconnexion sur appareil reste NON vérifié dans ce lot.


### Résultat de l’essai Android local
- Premier démarrage debug : script introuvable car Metro répondait sur localhost IPv6 mais pas sur 127.0.0.1. Serveur de ce lot identifié et redémarré avec NODE_OPTIONS=--dns-result-order=ipv4first ; santé IPv4 HTTP 200. Aucun code natif généré corrigé à la main, aucune dépendance ajoutée.
- Le lanceur Pixel Launcher affichait une alerte de non-réponse ; « Attendre » n’a pas suffi. Seul ce lanceur a été fermé via son dialogue, pas la session Speedfood.
- Metro a compilé le bundle Android (1818 modules). Le code final, après restauration des mutations, est réellement chargé sur le natif de contrôle.
- Catalogue réel visible, panier conservé ; Mon compte → Compte connecté ; Espace restaurateur → barbie food et liste des commandes lus ; Retour au compte → Compte connecté. Aucun appui de commande, service, menu, paiement ou déconnexion. Message de notifications actives affiché ; ce message exprime la permission, pas un accusé d’enregistrement serveur.
- Captures vérifiées visuellement : C:/Users/moelo/dev/controle-notifications-cycle-session-20261106/restaurateur-local.png et retour-compte-local.png. Hors Git, car elles peuvent montrer des données de compte/commande. Avertissement de diagnostic de la compilation debug présent ; pas de verdict release à partir de cet écran.
- Cet essai prouve le raccord natif et la conservation de session, pas la course de retrait en réseau réel, la réception d’une nouvelle notification avec ce paquet, ni un appareil physique. Aucun nouveau paquet release ni iPhone de ce correctif vérifié pendant ce lot. Les compilations CI du commit seront à contrôler séparément.
- Metro local laissé disponible sur 8081 pour cet APK debug ; arrêter ce processus coupe seulement son aperçu local. L’ancienne APK Kotlin distribuée n’a pas changé.


## Vérification CI après push (6 novembre)
Commit 22766ceb423169e4035c7a6a95f99a4b794d671a, même branche :
- Contrôles n°86 (42217286429) : terminé, succès.
- Android n°29 (42217286360) : tests, génération, compilation debug/release arm64 et x86_64, contrôle manifeste/empreinte et dépôt d’artefact : toutes étapes réussies. Artefact 13502718320, 92 818 839 octets, SHA-256 annoncé par GitHub 3281d9cfe1ee66ace085bada87402e745909a5ae7f805ba598f4dee1c3cbcd99. Archive non téléchargée/recalculée dans cette vérification ; APK n°29 non installée ici.
- iPhone n°26 (42217286420) : tests, génération, Release sans signature, lancement simulateur et capture : toutes étapes réussies. Artefact captures-iphone-expo présent (13503056607). Capture non inspectée visuellement dans cette vérification, aucun iPhone physique ni installation depuis le site prouvés.
Aucun déploiement. La session réelle de l’émulateur reste conservée.
