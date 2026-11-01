# Essai d'idempotence croisée — préparation du 1er novembre 2026

**Contrôle visuel après l’échec d’idempotence — 1er novembre 2026, capture transmise par Malika à 11 h 37 :** la page client `/compte/commandes` affiche explicitement **TEST** pour **SF-SC78P** (API) et **SF-WMQXU** (site), chacune à 25 000 GNF, en attente du restaurant. Le marquage TEST des deux créations est donc confirmé visuellement ; cette preuve remplace l’incertitude précédente sur SF-SC78P. L’idempotence reste en échec (deux références, deux jetons différents, code 1). Aucun nouveau POST, changement de statut, secret ou relais effectué pendant ce contrôle. Verrou à conserver ; activation de `commandes` toujours bloquée. Suite : diagnostic de la dérivation du jeton et de la configuration des deux Workers sans exposer de secret.


**Étape 9 ÉCHOUÉE le 1er novembre 2026 à 11 h 21 GMT — activation de `commandes` bloquée.** Résultat réel transmis par Malika : site HTTP 201, référence **SF-WMQXU**, durée réseau 850 ms ; API HTTP 201, référence **SF-SC78P**, durée réseau 825 ms ; jetons différents (valeurs jamais affichées), code de sortie **1**. Deux créations signalées, pas un rejeu idempotent. Le verrou local confirme `seconde-creation-auditer` avec ces deux références et reste conservé ; aucune relance, annulation ou modification de secret par l’agent. La première commande a passé le contrôle TEST du lanceur avant le POST API ; le marquage TEST et le statut de la seconde restent à confirmer explicitement (non imprimés dans la sortie reçue). Les durées ne mesurent pas le CPU ; alerte restaurateur non vérifiée. Le code partagé dérive le jeton de `COMMANDE_JETON_SECRET`, sinon `SUPABASE_SERVICE_ROLE_KEY` : divergence de configuration probable, cause de production non prouvée sans audit. Ne pas remplacer le secret du site à l’aveugle : il sert aussi aux clés de table et à la limitation. Prochain pas : audit en lecture des deux commandes et du câblage/configuration, sans lire ni afficher les valeurs secrètes ; toute correction de secret exige un feu vert distinct et reste exécutée par Malika. `commandes` reste exclu du relais selon le dernier réglage rapporté. Cette note remplace les mentions antérieures « essai non réalisé / non confirmé ».


**Statut : feu vert réel reçu de Malika le 1er novembre 2026, exécution et résultat NON CONFIRMÉS.** Autorisation explicite des deux envois de test en production, après présentation du risque de seconde création et des alertes restaurateur. Le lanceur est prêt et le verrou réel est absent avant remise de la commande. Connexion à saisir localement par Malika. Aucun relais, secret ou déploiement modifié par ce lot ; le module `commandes` reste exclu du relais.

## Objectif et préconditions

Prouver, sans lire les secrets, que la même demande envoyée au site puis à l'API retrouve la même commande : site HTTP 201, puis API HTTP 200 avec `idempotent: true`, même référence et même jeton de suivi (comparé en mémoire, jamais affiché).

- Garder `API_RELAIS=public,moi,client,livraison,suivi` : `commandes` doit rester exclu pour que le premier envoi soit traité par le site. Dernier changement appliqué par Malika, sans modification ultérieure par l'agent.
- Utiliser le compte qui a passé SF-G8V6H, et dont `/api/v1/moi` confirme un rôle d'équipe Speedfood. Un compte client ordinaire est refusé avant tout envoi.
- Restaurant fixé : barbie food, `73bd8244-71ed-445c-862b-53b9b07ff207`. Un seul article, `51323984-4262-4116-82f9-06a01fc3f96f`, quantité 1, aucun supplément. Prix courant lu dans le menu, entiers GNF ; le serveur recalcule ensuite le prix.
- Retrait uniquement, nom fictif « ESSAI IDEMPOTENCE - NE PAS PREPARER », téléphone fictif `600000000`, aucune adresse, aucune mémorisation de profil, aucun paiement.
- Le serveur décide du marquage TEST d'après l'identité ; le corps ne contient pas `est_test`. Le rôle est contrôlé avant création, la première commande est relue et doit être TEST avant le second POST ; le rôle est revérifié juste avant ce second POST.

## Outils et portée

- Module versionné : `apps/api/scripts/essai-idempotence-reel.mjs` ; aucun appel réseau ou fichier écrit à son import, aucun branchement dans le Worker.
- Tests versionnés : `apps/api/tests/essai-idempotence-reel.test.ts`.
- Lanceur local déjà présent sur le poste : `C:\Users\moelo\dev\connexion-verification-suivi-speedfood.ps1`, étendu avec `-Idempotence -AutoriserEcriture`, et `verification-suivi-speedfood.mjs`. Ces deux fichiers restent hors dépôt.
- Connexion saisie localement par Malika, mots de passe masqués. Le lanceur lit la configuration publique de `apps/web/wrangler.jsonc`, jamais `.env*` ou `.dev.vars`. Mot de passe transmis au programme par entrée standard, pas par argument ou fichier. Session temporaire fermée avec `scope=local` à la fin ; aucun secret sauvegardé.
- Verrou local : `C:\Users\moelo\dev\etat-idempotence-speedfood.json`, réservé exclusivement avant le premier POST. Il ne contient que phase, date et références de commande ; aucun jeton, mot de passe, corps ou clé d'idempotence. Une seconde instance ou relance ne peut pas réserver le même essai, même après succès. Aucune suppression automatique du verrou.

## Séquence réelle, seulement après le feu vert distinct

1. Connexion et lectures de contrôle : rôle d'équipe, commande TEST SF-G8V6H du compte, article disponible et prix valides.
2. Préparer en mémoire une clé d'idempotence aléatoire et un seul corps JSON, identique pour les deux envois. Réserver le verrou durable.
3. Un seul `POST /api/v1/commandes` au site ; attendre HTTP 201, `ok: true`, `idempotent: false`, référence et jeton bien formés. Sinon arrêter.
4. Relire la commande via la liste du compte, vérifier TEST et le restaurant, puis revérifier le rôle d'équipe. Sinon arrêter avant le POST API.
5. Un seul `POST /api/v1/commandes` à l'API, corps strictement identique. Attendre HTTP 200, `ok: true`, `idempotent: true`, référence et jeton identiques.
6. Relire la commande TEST et noter le résultat. Ne jamais afficher le jeton, sa valeur dérivée, le corps ou la clé d'idempotence. Seuls statuts HTTP, booléens, références et durées réseau sont rapportés.

**Deux POST au maximum. Aucune relance automatique**, même après délai, panne ou réponse non JSON : l'écriture peut avoir abouti. Le verrou reste présent, et un contrôle manuel est requis avant un autre essai.

**Si l'API répond 201**, une seconde commande peut avoir été créée : le script signale l'échec, rapporte les références non secrètes, tente de vérifier le marquage TEST de la seconde via une lecture et s'arrête. Aucune annulation ni suppression automatique. Le feu vert doit couvrir ce risque de deux commandes d'essai au lieu d'une. Le restaurant peut recevoir une alerte pour chaque création.

## Validation de la préparation

- Nouveaux tests d'abord en échec (module/export absent), puis **14 tests réussis, code 0** : absence d'autorisation, compte non équipe, verrou existant, corps identiques, erreurs du site, marquage TEST, panne après envoi sans retry, jeton différent, seconde création API (alerte conservée même si la lecture suivante échoue), réponse non idempotente, prix non entier, exclusivité du verrou et rejet des champs secrets dans l'état.
- Quatre mutations détectées, chacune à **code 1** : retirer l'autorisation, retirer le contrôle TEST avant l'API, retirer la comparaison du jeton, remplacer la réservation exclusive par un écrasement. Source restauré, puis **14 tests à code 0**.
- Lanceur existant : **11 tests à code 0**. Suite API complète : **238 tests à code 0**. `npm run typecheck` : **code 0**. Syntaxes Node et PowerShell vérifiées, **code 0**. `npm run build:api` : **code 0**, Worker inchangé à 1 165 Kio. Le lancement PowerShell avec `-Idempotence` seul, sans autorisation, a été essayé : refus **code 2** avant toute saisie ou requête, attendu et vérifié.
- Relecture de spécification : méthode, ordre site → API, corps identique, identité réelle, marquage serveur TEST et sorties attendues conformes à la Tâche 12, étape 9. Relecture de qualité : hôtes fixes, redirections non suivies, délais bornés, verrou durable, sorties sans secrets et arrêt sur résultat incertain. Aucun contrôle d'accès ou service métier modifié.
- Aucun essai réel de cet outil ; le verrou d'exécution réel n'a pas été créé par la préparation. Pas de déploiement nécessaire pour cet outil local.

## Ce que le succès ne prouvera pas

Un rejeu sur l'API n'est pas une création neuve sur l'API. Cet essai ne mesure donc ni son CPU de création, ni `randomInt` sur cette porte, ni la réception de son alerte restaurateur via `waitUntil`. Ces contrôles restent des étapes distinctes avant d'allumer `commandes`. Les durées imprimées sont des durées réseau, pas CPU. Aucune décision de forfait ni dépense incluse.

## Retour arrière et suite

Cet essai ne change ni relais ni schéma. Retirer l'outil local ou revenir sur ce commit documentaire/outillage ne supprime aucune commande déjà créée. Un échec exige un audit des références, jamais une relance ou un nettoyage automatique. L'allumage de `commandes` reste soumis à son propre feu vert, après les autres mesures du plan 1c-1.
