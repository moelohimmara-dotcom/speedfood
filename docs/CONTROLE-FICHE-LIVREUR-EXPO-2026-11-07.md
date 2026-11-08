# Contrôle G1 : fiche livreur Expo — 7 et 8 novembre 2026

## Périmètre et état
**G1 vérifié localement le 8 novembre, sans déploiement ni verdict production.** G1 ajoute la fiche seule, sans état/offre de course, position, paiement ou modification de restaurant. Base de travail bc5d525, branche etape-adr021-deblocage-commandes.

## Autorisations et méthode
Malika a explicitement autorisé deux sous-agents GPT pour G1 : un implémenteur, un relecteur indépendant, sans déploiement. Même implémenteur pour tous correctifs. La session réelle de l’émulateur doit rester conservée : ni déconnexion, ni effacement des données, ni changement de rôle.
Skills appliqués : design (UI et contenus adaptés aux tokens Expo existants) et workers-best-practices (raccord sans état de requête partagé, même configuration Worker, lecture attendue avant réponse). Pas de dépendance, migration ou service nouveau.

## Rouge initial contrôlé personnellement
API : 10 cas, 9 échecs et 1 succès, code 1. Mobile : 6 cas, 6 échecs, code 1. Des modules étant nouveaux, une partie des échecs est un import/capacité absente, ce qui ne prouve pas une règle métier. Les échecs route 404 contre les réponses attendues et les mutations après vert sont distingués dans le verdict final. Journaux locaux g1-rouge-api.log et g1-rouge-mobile.log, hors dépôt.

## Protections visées
- Authentification stricte du porteur, plafond par compte, client RLS et filtre utilisateur_id explicite ; même un compte support ne choisit pas la fiche B.
- Projection explicite de six champs, sans identifiant de suivi, téléphone, position, invitation ou document. Données invalides/panne ≠ fiche absente.
- Aucun service historique de course importé par le service de fiche. Piège : GET livreur/etat fait avancer des offres et la simulation ; jamais appelé dans ce lot.
- Lecture manuelle, anciennes réponses invalidées après fermeture/changement de compte, retour et nouvelle lecture possibles. Pas de demande de localisation/notification nouvelle.
- Si une relation restaurant est masquée par RLS, texte neutre ; ne pas affirmer groupe Speedfood.

## Banc natif prévu
Projet Expo séparé apps/mobile/controle-livreur, hors graphe normal. Vrais composant, contrôleur, GestionSession, parseur, route Hono et service ; coffre et base factices en mémoire. Port HTTP local séparé, accès factices prédéfinis, refus de toute origine non locale et des redirections. Le vrai client réseau produit est testé séparément ; le banc ne change pas son origine.
L’émulateur était arrêté à la reprise. AVD speedfood_pixel redémarré sans wipe, données conservées ; démarrage terminé, APK com.speedfood.clientdemo toujours présente. Aucun écran de compte réel ni API réelle ouvert pour le banc à ce stade.

## Limites et retour arrière
Route non déployée, aucun relais modifié. Ce lot ne remplace pas Kotlin et ne prouve pas un téléphone iPhone/Android physique. Revenir par commit inverse ciblé, garder le relais éteint, arrêter seulement les processus locaux du banc et relancer le Metro produit ; vérifier la session réelle conservée sans extraire ses identifiants.


## Reprise et contrôles du 8 novembre
Le banc a échoué au démarrage à cause de copies distinctes de React (application et renderer). Correction par le même implémenteur : résolution locale unique de react et react/*, sans toucher Metro produit, versions ni verrou. Trois tests de configuration, dont un repli divergent volontaire même en CI dédupliquée ; relecture indépendante du delta sans blocage.

Contrôleur : 12 mutations exécutées personnellement, chacune détectée code 1 ; restauration exacte, 31 tests ciblés finaux code 0. Journaux hors dépôt : g1-final-mutations-20261108.log.

Suites relancées personnellement après restauration : typecheck racine, test:unit, test:cloisonnement (489 contrôles), build:api, npm test mobile (544/544), npx tsc --noEmit mobile : codes 0. Paquet API : 1 287 370 octets, sous le plafond du dépôt de 1 400 000.
Premier lancement parallèle API : 660 succès, un test RPC local annulé par délai (code 1). Même suite complète relancée seule, sans modifier test/délai : 661/661, zéro annulation, code 0. La charge parallèle est une explication probable, pas une mesure CPU. Logs g1-final-test-api-20261108.log et g1-final-test-api-seriel-20261108.log.

Le serveur local est prêt sur 8797 et Metro de contrôle sur 8081, lecture .env désactivée, IPv4. Aucun autre serveur ou compte créé. Nouvel essai natif après correction React encore à terminer ; ne pas confondre ces codes 0 avec une preuve de fonctionnement en production.


## Résultat natif du 8 novembre — confirmé par le contrôleur
Banc identifié par le bandeau CONTRÔLE LOCAL — DONNÉES FACTICES. Le vrai composant, contrôleur et GestionSession exécutent la lecture via le vrai service et la vraie route Hono, sur une base factice volontairement permissive (B avant A). Le client réseau produit est testé séparément, pas présenté comme exercé contre la production par ce banc.

- Fiche A active : nom, cycle actif, hors ligne et moto visibles. Une actualisation manuelle ajoute exactement une lecture au compteur local.
- Suspendu : motif Dossier à vérifier affiché ; archivé : Fiche archivée.
- Absence : message Aucune fiche livreur, distinct de la panne (message d’erreur et action d’actualisation, sans faux résultat vide).
- Relation restaurant masquée : Rattachement non renseigné, aucune fausse affirmation groupe Speedfood.
- Retour : Fiche fermée, réouverture et nouvelle lecture A réussies.
- Course de lectures : A en attente observée sur capture ; action Compte B après 2,203 s, avant la réponse A différée de 2,5 s. Compteurs locaux A puis B ; après arrivée de la réponse tardive, B reste seule affichée. Preuve structurée course-lectures.json et captures avant/après. Les courses de concurrence sont aussi couvertes par les tests à promesses contrôlées, sans dépendre de ce délai natif.
- Un avertissement Cannot connect to Expo CLI apparaît dans le diagnostic de développement. Le bundle et les lectures HTTP locales fonctionnent, parcours ci-dessus confirmés ; ne pas présenter cette session debug comme un paquet release. Le premier dump UiAutomator pendant chargement n’avait pas d’état idle ; reprise une fois stabilisé, sans confondre l’échec de capture avec un échec du produit.

Captures contrôlées visuellement et journaux hors Git : C:/Users/moelo/dev/controle-livreur-g1-20261108/. Script de pilotage local : C:/Users/moelo/dev/g1-controle-natif-20261108.py. Aucune donnée réelle copiée dans le banc. Les captures de retour au compte réel restent hors dépôt.

## Retour au produit confirmé
Seuls les processus de contrôle des ports 8081/8797, reconnus par leur commande, ont été arrêtés ; relais adb 8797 retiré. Metro normal rétabli sur 8081, processus APK relancé sans désinstallation ni effacement. Écran normal Mon compte → Compte connecté confirmé ; session réelle conservée, sans lecture directe du coffre ni saisie d’identifiants. Aucun appel à livreur/etat, aucune modification de course/restaurant, aucun déploiement, secret ou relais de production modifié.

## Limites avant mise en service
La nouvelle route GET /api/v1/livreur/fiche n’est pas déployée. RLS et base réelles à vérifier sur un compte livreur lors d’une mise en service autorisée ; pas de modification de rôle ou de compte dans ce lot. Téléphones physiques, iPhone et paquet release contenant G1 NON vérifiés par ce banc. Les compilations GitHub du commit G1 seront à contrôler après push ; ne pas réutiliser les résultats Android n°29/iPhone n°26 du correctif précédent comme preuve G1.
La fiche seule ne couvre pas offres, disponibilité, course, position, frais/historique/dossier, notifications livreur, paiement ou parité Kotlin. Pas de remplacement de l’ancienne APK. Prochain travail : contrôler la CI G1 et préparer la mise en service de cette route, sans déployer sans feu vert distinct.
