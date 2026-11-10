# Passation du chantier appli Speedfood — état au 8 novembre 2026, complété le 10 novembre (G3)

## 1. Lire ceci en premier

Ce document est le point d’entrée pour reprendre sans l’auteur ni les conversations. État du code vérifié : **57f80f1** sur **etape-adr021-deblocage-commandes**. Le présent lot ne change que la documentation. Les dates des anciens plans restent celles de leurs observations ; elles ne constituent pas des autorisations nouvelles.

**En trois phrases.** L’appli Expo sait consulter le catalogue réel, gérer son panier, commander avec un compte existant, suivre les commandes et ouvrir l’espace restaurateur. Les notifications client/restaurateur et la fiche livreur G1 ont du code testé ; G1 est validé sur banc Android local et compilé en CI, mais sa route n’est pas mise en service par ce chantier. Kotlin reste l’appli distribuée ; la prochaine équipe doit préparer la mise en service contrôlée de G1 avant les offres/courses/position, puis terminer la parité et les paiements avant remplacement.

> **Complément du 10 novembre 2026 (lots G3, code local, NON déployé).** La branche est à **5e7dca8** (poussée). Elle contient, au-delà de 57f80f1 : **G3a** (API : `GET /etat` étendu avec `course`, `POST /api/v1/livreur/offre`, `POST /api/v1/livreur/course`, commit 9007db3), **G3b** (écran Expo : offre, course, code de remise, échec avec raison) et **G3c** (banc local factice `apps/mobile/controle-livreur/`, commit 8bf19d4), plus le correctif 5e7dca8. Détail, arbitrages et journal : [plan G3](plans/2026-11-09-espace-livreur-g3-offres-et-courses.md). Points à retenir :
> - **Rien de G3 n'est déployé.** Ordre obligatoire : feu vert distinct de Malika → déployer l'API G3a → sonde 401 sans jeton → vérifier que `/etat` contient `course` → seulement ensuite un APK G3b. Contre l'API G2 actuelle, l'appli G3b refuserait la réponse (pas de `course`) et l'espace livreur tomberait en erreur.
> - **Écart accepté par Malika (9 nov.) :** aucune policy RLS ne laisse le livreur lire `orders` ; la référence, le nom, le téléphone et l'adresse du client sont lus avec la clé de service par un port lié à « ma course », seulement après récupération de la commande. Cela ne vaut pas feu vert de déploiement. Alternative propre reportée : fonction `SECURITY DEFINER` par migration.
> - **Essai natif du 10 novembre (émulateur, banc factice) :** défaut réel trouvé (boutons grisés en permanence après chaque lecture, invisible aux 598 tests), corrigé en 5e7dca8 ; parcours rejoué : accepter, étapes, client visible seulement « vers le client », faux code refusé puis bon code, réponse incertaine verrouillée puis relue. Non rejoués à l'émulateur : échec avec raison, course changée, mode propre, réponse lente. Mineurs ouverts : M4 (le clavier cache le champ du code), M1, M5–M8.
> - **Contrôles du 10 novembre :** mobile 600/600, `tsc` 0, typecheck 0, `test:api` 724/724 (0), `build:api` 0 (Worker 1 308 553 octets, plafond 1 400 000), banc `parcours-g3.mjs` 11 parcours, mutations G3 32/32. **`test:unit` est rouge** sur `design.test.mts` (variables CSS `neutre-*`, `duration-editoriale`) à cause de la refonte du site public du 9 nov. : hors lots G3, à traiter par qui a fait la refonte.
> - **Essai G2 réel (9 nov., commit 287ff8e) :** la fiche « Livreur de test Malika » existe et Malika s'est connectée elle-même : l'ancienne phrase « aucun compte livreur réel » du tableau §3 est dépassée.
> - **Décisions en attente de Malika :** ~~fichier `docs/PROMPT-CODEX-CHEF-DE-PROJET.md`~~ (**P2 choisi le 10 novembre : retiré du dernier état, resté dans l'historique**), fusion dans `master` (F1 avance rapide / F2 PR / F3 non), nettoyage des espèces D1–D3 ; voir [décisions](plans/2026-11-09-decisions-fusion-master-et-prompt.md) et [inventaire espèces](plans/2026-11-09-inventaire-restes-especes.md) (0 ligne en base). Ordre recommandé : P2, puis F1, puis N1.

| Pour trouver… | Document |
|---|---|
| Règles impératives | [CLAUDE.md](../CLAUDE.md), [AGENTS du site](../apps/web/AGENTS.md) |
| Modules, flux et contrats ajoutés | [Architecture Expo/API](ARCHITECTURE-APPLI-EXPO.md) |
| Corrections effectuées et défauts ouverts | [Registre des corrections](REGISTRE-CORRECTIONS-APPLI-EXPO.md) |
| Commandes, banc, déploiement, backlog et prompt de reprise | [Reprise de l’équipe](REPRISE-EQUIPE-DEV.md) |
| Mise en service API/ADR-021 | [API unique](API-UNIQUE.md), [passation refonte](PASSATION-REFONTE.md), [feux verts ADR-021](FEUX-VERTS-ADR021-COMMANDES.md) |
| Plans métier détaillés | [Commande et restaurateur A–D5](plans/2026-11-02-commande-expo.md), [notifications E1–E3](plans/2026-11-04-notifications-push-client-expo.md), [restaurateur F1–F3](plans/2026-11-05-notifications-restaurateur-expo.md), [cycle de session](plans/2026-11-06-notifications-cycle-session.md), [livreur G1 et suite](plans/2026-11-06-espace-livreur-expo.md) |

Les plans/rapports plus anciens sont des preuves datées. En cas de contradiction : constater le code, annoncer l’écart, corriger l’état courant sans transformer une hypothèse en fait. Les mémoires locales d’un agent ne sont pas nécessaires à cette passation.

## 2. Propriétaire, décisions et limites d’autorisation

Malika est la propriétaire du produit. Français, phrases courtes, une action à la fois ; questions oui/non avec recommandation. Pour ses commandes, utiliser un bloc bash contenant de la syntaxe **cmd Windows** (`cd /d`, `&&`).

- Branche de travail uniquement ; ne pas toucher/pousser master. Aucun force-push, retrait d’historique ou suppression de branche distante implicite.
- Aucun déploiement, secret modifié, relais allumé, compte/service externe ou coût nouveau sans feu vert explicite pour l’action exacte. Les commandes de déploiement dans les documents sont des procédures, jamais des ordres de les exécuter.
- Chaque écriture réelle chez **barbie food** exige son propre oui. Les essais utilisent est_test ; ne pas rejouer un ancien essai ou effacer ses verrous.
- **Conserver la session réelle de l’émulateur.** Malika a refusé la déconnexion pour les contrôles du 8 novembre. Aucun pm clear, wipe, désinstallation ou lecture directe du coffre.
- Ne jamais lire/afficher .env*, .dev.vars, google-services.json, clé privée, fichier de signature ou mots de passe. Aucun jeton réel dans URL, argument, code, journal, capture de rapport ou commit. Les identités du banc sont explicitement factices.
- Seule Malika clique « Ajouter un secret » sur GitHub et « Conserver » sur un téléchargement Chrome. Ne pas contourner une protection de l’environnement.
- Ajouter les fichiers à Git **un par un**, jamais git add -A : des fichiers .tmp-* personnels non suivis sont présents. Ne pas les supprimer. Chaque commit se termine par le trailer demandé : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Méthode de code :** plan court, tests rouges, même implémenteur pour les corrections, vert, mutations détectées/restaurées, relecture indépendante spécification puis qualité, contrôles relancés par le responsable, essai natif avant verdict fonctionnel, docs et commit/push ciblés. Sonnet implémente et Opus relit selon la consigne normale. Des exceptions GPT ont été autorisées explicitement pour le cycle de notifications et pour G1 ; ne pas les généraliser au prochain lot. L’attribution réelle de ces travaux est consignée dans les rapports, indépendamment du trailer de commit imposé.

**Produit : pas de cash, cible Chap Chap Pay.** Les déclarations par code marchand Orange Money/MTN restent provisoires selon l’arbitrage déjà consigné ; ce ne sont pas des paiements Chap Chap Pay. La lecture des espèces historiques doit rester compatible.

**Décisions à préparer séparément avec Malika :** retrait du prompt personnel de l’historique (fichier ajouté par 744ec55), fusion dans master, nettoyage des usages actifs d’espèces. Accord général du 6 novembre consigné dans [le plan de décisions](plans/2026-11-06-decisions-suite-appli.md), mais ni réécriture, fusion ni nettoyage global exécutés. Toute opération exacte reste à présenter avec son périmètre et son retour arrière.

## 3. Dépôt, production et distribution : ne pas les confondre

| Élément | État au contrôle documentaire du 8 novembre |
|---|---|
| Site Next.js | apps/web, Worker speedfood-app. Dernière mise en service rapportée : 5 novembre. Version Cloudflare actuelle **non relue** pendant ce lot documentaire. |
| API Hono | apps/api, Worker speedfood-api. Dernière version rapportée le 5 novembre : 45cfd8bc-dc2e-4e02-9862-bcf0e1d12852. Ne pas assimiler son contenu à HEAD sans comparaison. |
| Relais du site | **commandes doit rester exclu**. Dernier réglage rapporté : public,moi,client,livraison,suivi. La valeur live n’a pas été relue ; cela ne signifie PAS que tous les relais sont absents/non. API_RELAIS=tout interdit ; API_RELAIS=non est le retour arrière global, uniquement sur accord. |
| Création directe par l’API | ADR-021 : garde CREATION_COMMANDE_API et liaison SITE_JETONS ; le code refuse si la garde n’est pas ouverte. Essais directs rapportés en novembre, garde live non relue ici. Le relais commandes éteint n’empêche pas Expo d’appeler l’API directement. |
| Appli distribuée Android | Source de version dans le dépôt : Kotlin com.speedfood.app, 2.47.0/code 51. Binaire public/téléchargement live non recontrôlé ici. Aucun remplacement effectué par ces lots. |
| Appli Expo de contrôle | apps/mobile, com.speedfood.clientdemo, 0.1.0 ; Android et iOS configurés. Ce n’est pas l’identité de remplacement de Kotlin. |
| G1 fiche livreur | GET /api/v1/livreur/fiche. **Correction du 9 novembre : la route est EN LIGNE** (sonde sans jeton = 401, pas 404). Voir l'encadré ci-dessous. Vraie base/RLS et compte livreur réel restent à vérifier : aucun essai avec un vrai compte livreur. |
| iPhone depuis le site | Objectif produit, pas une diffusion validée. CI simulateur sans signature ≠ IPA installable sur téléphone, compte Apple ou parcours de distribution acquis. |

> **Constat du 9 novembre 2026 (lecture seule, aucun déploiement par cette vérification).** `wrangler deployments list` (API) montre trois déploiements récents : 8 nov. 20:38 UTC, 8 nov. 23:11 UTC et **9 nov. 14:29 UTC**. Sondes sans jeton : `GET /api/v1/livreur/fiche` = 401 et `GET /api/v1/livreur/etat` = 401 (G1 et G2 existent donc en ligne ; le commit G2 e996900 date du 9 nov. 13:40 UTC) ; `GET /api/v1/version` = 200. La migration `20261108220000_appareils_push_retraits` (protocole I2) est présente dans la base et dans le dépôt. **Non prouvé :** que le code en ligne soit identique à HEAD (wrangler ne donne pas le commit) ; version actuelle du site (le commit b6548b4, refonte du site public du 9 nov., ne concerne pas G1) ; tout essai avec un vrai compte livreur. Les lignes « non déployé » de cette passation sont dépassées sur G1/G2.

Aucun nouveau secret ni migration SQL dans les correctifs F3/cycle/G1 des 6–8 novembre. La branche contient toutefois des travaux antérieurs : **un déploiement de HEAD embarque tout le paquet**, pas seulement G1. Auditer les différences et migrations depuis le code réellement déployé avant toute proposition de déploiement.

Historique ADR-021 : l’alerte réelle et un essai de création directe ont été prouvés, mais la mesure CPU isolée et la décision de rester sur le gratuit ont laissé le relais commandes en attente. Lire le journal de [FEUX-VERTS-ADR021-COMMANDES](FEUX-VERTS-ADR021-COMMANDES.md), pas seulement son en-tête initial « rien exécuté ». Ne pas déduire un seuil de visiteurs ou un coût actuel d’un ancien essai.

## 4. Fonctionnalités et niveau de preuve

| Domaine | Code présent | Preuve et limite |
|---|---|---|
| Catalogue/panier | Catalogue réel API, pagination/recherche limitée aux données chargées ; panier SQLite distinct du démonstrateur, prix relus | Contrôles web puis natifs rapportés. Pas de restaurant fictif de repli. |
| Connexion/commande A–B | Compte existant, retrait/livraison, estimation, clé idempotente, état incertain | Essais TEST réels dans le plan du 2 novembre. Aucun envoi automatique en arrière-plan. |
| Historique/suivi/paiement C | 50 commandes max, suivi détaillé, annulation avant réponse, déclaration code marchand après acceptation | Plan/rapports ; Chap Chap Pay non finalisé. Les jetons restent dans la session, pas dans les composants. |
| Restaurateur D1–D5 | Commandes, paiement déclaré, révision de prix, service/menu/photos, livraison propre et code de remise | Essais natifs réels consignés ; limites et mineurs dans le plan du 2 novembre. Ne pas déclarer tous les cas RLS/CPU/physiques couverts. |
| Notifications client E1–E3 | Appareils, permission, FCM natif, suivi au clic | Acceptée/prête/terminée vues sur émulateur ; vraie déconnexion, refus, deuxième appareil et téléphones restent des contrôles distincts. |
| Restaurateur F1–F3 | Canaux, permission choix C après rôle, clic Nouvelle commande vers espace restaurateur | SF-AA5TT TEST créée une fois, notification reçue, clic à chaud depuis arrière-plan et retour sans boucle ; commande annulée sur oui distinct. Verrous conservés. |
| Cycle de notifications | Réservation par génération/jeton, file des appels, fermeture anticipée et budget de retrait | Tests déterministes + contrôle natif de non-régression. Déconnexion réelle non faite ; résidu serveur après timeout encore ouvert. |
| Livreur G1 | Fiche seule, lecture manuelle, rôle d’affichage et contrôle serveur | Banc natif avec vraie UI/route/service mais DB/identités fictives ; état absent/panne, suspendu/archivé, relation masquée, réponse A tardive après B. Pas d’offre/course/position. |
| Livreur G3 (offres, courses) | `POST /offre`, `POST /course`, écran Expo, banc factice | **Code local seulement**, relu deux fois côté API et une fois côté appli, essai natif sur émulateur le 10 novembre (voir encadré en §1). Jamais essayé contre la vraie API ni la vraie base. |
| Équipe / livreur complet | Non terminés dans Expo | Kotlin conserve des fonctions non portées : parité inachevée, remplacement interdit sur G1 seul. |

La réception Nouvelle commande du 6 novembre et les contrôles G1 du 8 sont deux preuves différentes. Le banc G1 ne passe pas par le client réseau produit contre l’API réelle ; ce client est testé séparément. Un code de sortie 0 sans parcours métier ne suffit pas.

## 5. État vérifié des contrôles

Base fonctionnelle **57f80f1** :

| Contrôle relancé par le responsable | Résultat |
|---|---|
| npm run typecheck | 0 |
| npm run test:api | 661/661, 0 après relance seule |
| npm run test:unit | 0 |
| npm run test:cloisonnement | 489 contrôles, 0 |
| npm run build:api | 0 ; 1 287 370 octets, plafond du dépôt 1 400 000 |
| npm test dans apps/mobile | 544/544, 0 |
| npx tsc --noEmit dans apps/mobile | 0 |
| Mutations G1 | 12 détectées, sources restaurées exactement, ciblé final 0 |

Premier lancement API sous charge parallèle : test RPC local annulé par délai, code 1. Même suite relancée seule sans modifier le délai : 661 succès, zéro annulation. Ne pas masquer cet incident ; ne pas augmenter le délai pour obtenir artificiellement le vert. Un EACCES 127.0.0.1 du bac à sable est une autre limite déjà rencontrée : l’exécution hôte autorisée a permis les serveurs de tests locaux.

**CI G1 vérifiée par le connecteur GitHub le 8 novembre**, SHA 57f80f16b5160a2b1d16dd3a553be48a70b52fa2 :
- [Contrôles n°88](https://github.com/moelohimmara-dotcom/speedfood/actions/runs/42436056269) : succès.
- [Android n°30](https://github.com/moelohimmara-dotcom/speedfood/actions/runs/42436056259) : tests, génération, APK debug/release arm64/x86_64, manifeste/empreinte et artefact : succès.
- [iPhone n°27](https://github.com/moelohimmara-dotcom/speedfood/actions/runs/42436056298) : tests, Release simulateur sans signature, lancement/capture : succès. Capture non inspectée visuellement dans ce contrôle documentaire.

Archives présentes au contrôle, pas téléchargées ni SHA recalculées ici : Android artefact 13600472111 (92 822 295 octets), iPhone 13600071233 (15 760 666 octets). Expiration annoncée au 15 novembre ; les recréer depuis le bon commit si expirées. Le succès de l’étape Firebase conditionnelle ne prouve pas à lui seul sa configuration dans l’APK.

APK native porteuse du banc : debug n°28 historique ; JavaScript G1 servi par Metro. Paquets G1 n°30/n°27 compilés ensuite : **pas installés sur téléphone réel par ce contrôle**. Même version 0.1.0 ne prouve pas même contenu. Rapports : [G1](CONTROLE-FICHE-LIVREUR-EXPO-2026-11-07.md), [cycle](CONTROLE-NOTIFICATIONS-CYCLE-SESSION-2026-11-06.md), [F3](CONTROLE-NOTIFICATIONS-RESTAURATEUR-2026-11-06.md).

## 6. Corrections importantes et risques résiduels

Le [registre des corrections](REGISTRE-CORRECTIONS-APPLI-EXPO.md) donne le code, les tests et les commits. Points à ne pas rouvrir par erreur :
- Le clic restaurateur quand Mon compte est déjà ouvert a été corrigé et testé pour le parcours F3 ; ce n’est plus une décision produit en attente pour ce cas.
- Le vrai renouvellement FCM pendant un envoi n’est plus volontairement perdu ; doublons et anciennes continuations sont protégés dans le client actuel.
- **I2 n’est pas totalement fermé** : timeout/abort ne prouve pas qu’un POST déjà parti ne sera pas appliqué après le retrait côté serveur. Ne pas annoncer « aucune notification après logout » sur ces seuls tests. Retrait raté/hors ligne, application tuée et session expirée restent à traiter/contrôler.
- La demande de permission peut être marquée « tentée » sans boîte affichée si la session ferme pendant le marquage. Choix prudent d’un seul essai, pas preuve d’affichage.
- **GET historique livreur/etat n’est pas une lecture sans effet** : traiterOffres expire/redistribue et avance la simulation. Ne jamais l’appeler en production pour un contrôle prétendument innocent.
- Cas mineurs D4/D5, revalidatePath/CPU des actions, RLS réelle hors propriétaire, frais « à convenir » et message d’erreur ancien : relire les plans, ne pas les marquer corrigés sans nouvelle preuve.

## 7. Suite priorisée et critères de sortie

| Priorité | Travail | Sortie attendue / décision |
|---|---|---|
| P0 | ~~Préparer mise en service G1~~ (déjà en ligne, voir encadré du 9 novembre en §3) → **vérifier G1/G2 en ligne avec un compte livreur autorisé, en lecture seule** | Malika désigne le compte livreur ; ne pas appeler `GET livreur/etat` en production comme contrôle innocent (il fait avancer la répartition, voir §6). Comparer le code en ligne à HEAD (identité exacte non prouvée). |
| P0 | Résidu notifications + vrais appareils | Plan explicite pour le risque serveur après timeout ; déconnexion réelle seulement après nouvel accord de Malika, tests refus/changement de compte/deux appareils, Android physique. |
| P1 | ~~G2 état/offre/disponibilité~~ (G2 en ligne ; G3a/b/c codés le 10 nov., voir §1 : déploiement de l'API puis APK sur feux verts distincts) | Plan et arbitrage explicites des effets de répartition ; pas d’écriture cachée dans un essai de lecture. Préserver les règles Kotlin/serveur. |
| P1 | G3 : mise en service ; G4 position | G3 codé (voir §1) : feu vert, déploiement de l'API, vérifier `course` dans `/etat`, puis APK, puis un essai réel avec la fiche « Livreur de test Malika » (une écriture réelle = un oui distinct). Ensuite G4 : permission/position/arrière-plan avec plan 1c-2 et design validés. |
| P1 | G5 parité livreur et espace équipe | File/historique/frais de course/dossier/aide/notifications ; inventorier l’équipe avant découpage, sans inventer les droits. |
| P1 | Paiement Chap Chap Pay | KYC/accès à revalider avec Malika, spécification des succès/échecs/remboursements ; retirer les usages actifs d’espèces sans casser l’historique. Aucun argent réel ni clé demandée dans le chat. |
| P2 | iPhone et remplacement Android | Choix de distribution iOS/signature/notifications validé ; Android com.speedfood.app, certificat existant et code croissant ; vraie mise à jour sans perte et parité avant remplacement. |
| Séparé | limiteur par requête, Facebook, ancien iOS, master/historique | Examiner dans leurs lots ; décisions/coûts/publications restent à Malika. Ne pas déduire une autorisation du présent inventaire. |

## 8. État local laissé à la prochaine équipe

**Fin de session du 10 novembre :** banc (8797) et son Metro arrêtés, `adb reverse` retiré, Metro normal relancé sur 8081 (non revérifié ensuite), application de l'émulateur arrêtée, session réelle conservée. Pour rejouer le banc G3 : `apps/mobile/controle-livreur/README.md` (serveur factice sur 127.0.0.1:8797, Metro dédié en mode CI avec `--clear`, premier bundle environ 40 s, `adb reverse` 8081 et 8797). Ne jamais lancer le banc sans arrêter d'abord le Metro normal qui tient 8081. Dans l'état précédent :

Au dernier contrôle fonctionnel du 8 novembre : banc 8797 arrêté, son relais ADB retiré ; Metro **normal** sur 8081, application normale affichant Compte connecté, session réelle conservée. Ces processus peuvent avoir changé depuis : inspecter avant d’agir, ne pas réutiliser un PID historique.

Les .tmp-* personnels sont restés non suivis et intacts. Preuves locales hors Git : C:/Users/moelo/dev/controle-livreur-g1-20261108/, controle-notifications-f3-20261106/, controle-notifications-cycle-session-20261106/ ; journaux g1-final-*.log et cycle-final*.log. Elles ne sont pas garanties sur une autre machine : les rapports, tests, commits et liens CI sont le socle portable. Ne pas supprimer les verrous d’essais TEST ; SF-AA5TT a déjà été annulée.

Première action de reprise : suivre [REPRISE-EQUIPE-DEV.md](REPRISE-EQUIPE-DEV.md), constater Git et les contrôles ; aucune connexion réelle ni action de production nécessaire pour relire le code ou rejouer les tests locaux.

## 9. Livraison de la documentation du 8 novembre

Ce lot documente l’état du code 57f80f1 sans modifier le produit : guide technique, registre des corrections, procédure de reprise et prompt de relais. README mobile et points d’entrée anciens sont corrigés ou explicitement marqués comme archives. Vérification locale : 20 documents Markdown, 67 liens locaux existants, contrôle des différences sans erreur ; code de sortie 0. Les suites fonctionnelles ci-dessus sont celles du lot G1, non relancées pour cette modification exclusivement documentaire. Aucun déploiement, secret, relais ou donnée métier modifié.

Rédaction et consolidation par GPT ; relecture documentaire indépendante par un second agent GPT. Le trailer de commit demandé par Malika ne doit pas être pris pour la preuve d’une intervention Sonnet dans ce lot.
