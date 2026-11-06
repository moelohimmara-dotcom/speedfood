# Notifications : cycle de session — 6 novembre 2026

## Objectif
Fermer I1 (plusieurs enregistrements identiques par session) et I2 (enregistrement en vol dépassant le retrait à la déconnexion), sans modifier le serveur ni les permissions métier acceptées (choix C).

## Portée et méthode
- Sonnet : tests qui échouent, puis correction ciblée et mutations. Même agent pour les corrections.
- Opus : relecture indépendante, spécification puis sécurité/concurrence.
- Fichiers envisagés : apps/mobile/src/notifications/{service,enregistrement,cablage}.ts, éventuellement connexion/session.ts si la protection ne peut être garantie au niveau du service ; tests dédiés et script de mutation.
- Accepter un seul enregistrement pour une session et un jeton inchangés. Une nouvelle session ou un vrai renouvellement constitue un nouveau déclencheur ; aucun réessai automatique après résultat incertain.
- Une déconnexion ferme les nouveaux déclencheurs et ordonne le retrait après l’enregistrement engagé. Une ancienne continuation ne doit pas agir pour une session suivante. Les échecs réseau restent explicites dans les limites ; ne pas promettre une annulation serveur via AbortController.
- Vérifications par le contrôleur : typecheck, test:api, test:unit, test:cloisonnement, build:api à la racine ; npm test et tsc --noEmit mobiles ; mutations détectées puis restauration exacte.
- Contrôle natif sur émulateur avant verdict livré. Préférer un serveur local et des identités factices pour les courses réseau ; pas d’écriture sur barbie food sans nouveau oui distinct. Aucun déploiement de production dans ce lot.

## Acceptation
Tests déterministes des répétitions séquentielles/concurrentes, renouvellement pendant un envoi, déconnexion pendant lecture ou POST, nouvelle session pendant anciennes continuations, erreur/délai sans répétition. Pas de secret dans les rapports.

## Retour arrière
Commit inverse ciblé sur la branche etape-adr021-deblocage-commandes ; ne pas réécrire l’historique. Ancien APK de contrôle conservé. Aucun relais, secret ou réglage de production à restaurer.

## Journal
- Début : HEAD 60bb9ce, seuls fichiers .tmp-* personnels non suivis. SF-AA5TT déjà annulée sur oui distinct ; ne pas la rejouer.

- Sonnet indisponible : limite hebdomadaire annoncée par le CLI, retour le 8 novembre à 19 h (Africa/Conakry). Aucun test/source modifié par lui. Malika autorise explicitement un sous-agent GPT en remplacement exceptionnel ; même agent pour les corrections. Opus indépendant encore en cours.

- Rouge relancé par le contrôleur : nouveau test notifications-cycle-session, code 1. Sept échecs comportementaux sur neuf cas selon le rapport de l’implémenteur, défauts constatés dans le journal local cycle-rouge.log.
- Opus indépendant confirme I1/I2 ; audit lecture seule, aucun test revendiqué. Impératifs : génération stable au refresh, fermeture avant attente de l’accès, garde finale après lecture native, réservation de l’essai même incertain, renouvellement conservé, retrait ordonné/borné et partagé, aucune continuation tardive vers la session suivante.
- Serveur relu : retrait limité au compte ET au jeton ; upsert sur le jeton réattribue son propriétaire. Aucun changement serveur.
- Limite : après timeout/abort, un POST déjà parti peut encore être appliqué après le retrait. Le lot garantit les gardes et l’ordre d’émission client, pas l’ordre d’application serveur. Ce résidu reste ouvert avant remplacement ; aucune acceptation implicite du risque de production.
- Baseline contrôleur : typecheck, unitaires, cloisonnement et build API code 0. Test API d’abord code 1 dans le bac à sable (EACCES sur 127.0.0.1), même suite relancée sur l’hôte : 646/646, code 0. Ce refus local n’est pas un défaut métier.

- Opus : audit initial terminé, puis relecture du correctif refusée pour la même limite hebdomadaire (8 novembre, 19 h). Exception de méthode signalée à Malika : second sous-agent GPT indépendant pour relecture finale, exigences Opus conservées. Ne pas attribuer cette relecture finale à Opus.

- Correctif : cycle/génération locale stable au renouvellement du porteur, réservation avant fetch, file des opérations appareil, fermeture synchrone avant accès, retrait partagé/borné, garde finale et permissions attachées aux participants actifs. Même génération fermée ne peut plus être rouverte ; dernier delta relu indépendamment.
- Contrôleur : suites racine prescrites toutes code 0 (API 646, cloisonnement 489, build 1254 Kio) ; dernier delta : typecheck racine, mobile 527/527, tsc mobile code 0. Neuf mutations nouvelles + cinq F3 détectées code 1 chacune, restauration exacte et ciblés finaux code 0.
- Malika demande de conserver la session actuelle : aucune déconnexion réelle. Test de courses injectées distinct du smoke natif. APK debug installée sans effacement, raccord Metro IPv4 local ; preuve native finale à consigner dans le rapport du lot.

- Essai Android local terminé : correctif chargé via Metro IPv4 dans APK debug, catalogue réel, compte connecté conservé, espace restaurateur chargé, retour au compte. Aucune commande/état de restaurant touché. La déconnexion réelle est NON vérifiée à la demande explicite de Malika. Rapport complet : docs/CONTROLE-NOTIFICATIONS-CYCLE-SESSION-2026-11-06.md.
- Résultat : code client contrôlé, pas de verdict production ni de clôture totale I2. Déconnexion réelle, paquet release du correctif, iPhone et appareils physiques restent à vérifier. Aucun déploiement, secret, relais commandes, master ou historique modifié.
