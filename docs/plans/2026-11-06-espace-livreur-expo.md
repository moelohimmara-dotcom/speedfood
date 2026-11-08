# Espace livreur Expo — plan du 6 novembre 2026

## État et objectif
**G1 codé, relu et vérifié localement le 8 novembre ; aucun déploiement autorisé par ce plan.** Branche etape-adr021-deblocage-commandes, base 22766ce. Premier résultat local obtenu : le compte livreur consulte sa propre fiche sur Android et iOS, sans modifier une course ni envoyer de position.

## Constats vérifiés dans le code
- Le site expose livreur/etat, en-ligne, position, offre, course et gains. Le client Kotlin possède aussi file, historique et dossier ; le ViewModel gère position, arrière-plan et poste fixe. La parité ne se limite donc pas à accepter une offre.
- Au cadrage, l’API Hono ne montait aucune route /api/v1/livreur ; G1 monte désormais /fiche dans le code local uniquement ; le rôle livreur est déjà retourné par /moi et lu par Expo. Ce rôle côté écran n’est pas une autorisation serveur.
- **Piège : GET /api/v1/livreur/etat appelle lireEtatLivreur → traiterOffres.** Cela expire des offres, relance la répartition, rafraîchit les positions simulées et avance la simulation. NE PAS appeler cette route réelle comme un essai en lecture seule. Aucune invocation réelle dans ce cadrage.
- livreurDuCompte lit la fiche avec un client serveur privilégié. Pour le nouveau premier lot, privilégier un client lié au porteur, RLS appliquée, et un filtre explicite utilisateur_id égal au compte vérifié. Un compte équipe peut lire plus par RLS : ce filtre reste impératif.
- Contraintes lues : 20261017190000_livraison_dispatch.sql (utilisateur_id unique, statut hors_ligne/disponible/en_course, véhicule moto/velo/voiture/pied, policy livreur_lit_sa_fiche) ; 20261017220000_livreurs_cycle_dossiers.sql (cycle cree/invite/candidat/actif/suspendu/archive). Les migrations ultérieures et les relations doivent être relues avant implémentation.

## G1 — fiche seule, vérifié localement
### G1a : contrat et API, code local seulement
- Ajouter GET /api/v1/livreur/fiche → {ok:true, fiche:null | {nom, statut, vehicule, cycle, motifCycle, restaurantNom}}. Aucun identifiant livreur/compte fourni par le client ne choisit la ressource.
- Authentification STRICTE du porteur, puis plafond livreur par compte (reprendre la règle métier existante), sélection explicite des champs avec RLS et filtre du compte. Réponse sans cache, sans clé, position, téléphone, pièce d’identité, invitation ou donnée client.
- Compte valide sans fiche : fiche:null ; erreur de base : erreur serveur visible, jamais interprétée comme absence de fiche. Aucun import/appel de traiterOffres, repartir, simulation ou service d’action. Aucun SQL/migration/changement RLS dans ce lot.
- Fichiers prévus : packages/shared/src/contracts/livreur-fiche.ts et raccord export du site si nécessaire ; apps/api/src/routes/livreur.ts, apps/api/src/livreur/fiche.ts, types.ts, app.ts, worker.ts, doublures et tests API. Garder la logique hors route ; ne pas copier de règles de course.
- Aucun relais site ajouté ni activé. Nouveau contrat écrit explicitement ici ; la route existante du site et Kotlin conservent leur comportement. Pas de repli Expo vers une autre origine.

### G1b : écran Expo en lecture
- Fichiers prévus : apps/mobile/src/connexion/{livreur.ts,LivreurReel.tsx,client.ts,session.ts,CompteReel.tsx}, tests dédiés. Réutiliser les composants/tokens et la fenêtre existante ; aucune nouvelle navigation globale.
- Entrée Espace livreur selon le rôle reconnu ; le serveur revérifie toujours. Fiche avec nom, véhicule, état et cycle ; état absent, suspendu/archivé et erreurs compréhensibles. Actualisation MANUELLE, pas de boucle. Aucun bouton fictif de disponibilité, course ou géolocalisation.
- Une ancienne lecture ne doit pas afficher les données du compte précédent. Retour au compte, expiration de session et absence d’accès testés. Pas de frais assimilés à une paie ; pas de cash.
- La route ne sera pas disponible en production avant déploiement sur feu vert distinct. Ne pas publier cet écran comme fonction réelle disponible avant ce raccord. Pour l’essai natif, prévoir un banc local à identités factices, explicitement séparé du fonctionnement normal ; son mécanisme doit être relu avant usage. Ne pas déconnecter le compte réel actuellement conservé par Malika.

## Tests et preuves de G1
1. Même implémenteur : tests rouges puis code vert ; relecteur indépendant ; corrections renvoyées au même implémenteur.
2. API : porteur absent/invalide ; plafond ; A/B isolés même si compte A a un rôle support ; identifiant injecté ignoré ; sans fiche ; base indisponible ; projection sans champs sensibles ; aucun service d’écriture appelé. Lire les contraintes avant tout changement.
3. Mobile : parseur strict, statut/véhicule/cycle inconnus, panne, absence de fiche, changement de compte pendant lecture, retour sans boucle. Écran ne déclenche ni position, ni action, ni permission de localisation/notification nouvelle.
4. Mutations : supprimer filtre du compte, accepter un champ inconnu, confondre panne et absence, laisser ancienne réponse se réafficher, brancher le service à effets d’écriture. Chaque mutation doit faire échouer un test, restauration exacte en finally, ciblé final vert.
5. Contrôleur relance lui-même typecheck, test:api, test:unit, test:cloisonnement, build:api ; npm test et tsc --noEmit mobiles. Exiger codes 0 et Worker inférieur au plafond existant de 1 400 000 octets. Tests API sur hôte si EACCES réseau local du bac à sable.
6. Essai natif local Android avec données factices avant verdict fonctionnel. CI Android et iOS en complément ; compilation iOS ≠ téléphone physique ni distribution depuis le site. Aucun remplacement Kotlin sur G1 seul.

## Suite, à détailler séparément
- G2 : état/offre et disponibilité. Décider explicitement comment déclencher expiration/répartition sans cacher des écritures dans le test de lecture. Préserver le comportement Kotlin et les machines d’états serveur. Chaque essai réel d’écriture exige son oui distinct.
- G3 : accepter/refuser une offre, étapes de course, remise avec code et échec. Aucun rejeu automatique ; réponse incertaine verrouillée jusqu’à relecture réussie ; confidentialité du client avant récupération.
- G4 : position puis arrière-plan Android/iOS, permissions et arrêt à la déconnexion. Plan 1c-2 écrit, position par vérification locale selon décision existante ; autres opérations strictes. Dépendances natives/design de suivi et essais physiques à valider avant implémentation.
- G5 : file, historique, frais de course, dossier/aide et notifications d’offre ; inventorier la parité Kotlin et fixer les permissions au bon moment avant de coder. Aucun service/coût/compte nouveau implicite.
- G6 : parité, paiement Chap Chap Pay, identité/signature de production et publication. Feux verts distincts toujours nécessaires. Le résidu notifications après timeout reste à traiter avant remplacement.

## Méthode, décision et retour arrière
La méthode de Malika impose Sonnet pour l’implémentation et Opus pour la relecture (PASSATION-CHANTIER-SPEEDFOOD-APP.md §8.2). Les deux ont signalé leur quota jusqu’au 8 novembre à 19 h, heure de Conakry. L’exception GPT précédemment accordée concernait le correctif notifications. **Accord explicite reçu pour G1 : implémenteur GPT et second GPT indépendant.** Même implémenteur repris pour les corrections. Ne pas attribuer leur travail à Sonnet/Opus. Exception limitée à G1, sans déploiement.
Retour arrière G1 : commit inverse ciblé sur la branche de travail, module/relais éteints ; aucun secret ou état de production à restaurer. Ne pas réécrire l’historique.

## Journal
- 6 novembre : cadrage et constats source terminés. CI du correctif 22766ce : Contrôles n°86, Android n°29, iPhone n°26 réussis. Étapes Android debug/release et iPhone Release simulateur/lancement/capture réussies ; aucun téléphone physique ni paquet distribué vérifié par ces statuts.

- 6 novembre, G1 démarré : oui explicite de Malika pour implémenteur GPT + relecteur GPT indépendant, sans déploiement. La consigne de conserver sa session reste applicable. Aucun changement du rôle livreur réel n’est autorisé ni nécessaire.
- Direction UI G1 : même fond crème, rouge d’action, polices et tokens Expo existants ; lecture simple sur mobile, nom puis état/véhicule/cycle, deux actions Retour et Actualiser. Chargement, absence et panne distincts ; aucune fausse promesse de disponibilité ou de course. Libellé neutre si relation restaurant masquée par RLS. Skills design (UI/content) et workers-best-practices appliqués, sans nouveau framework/service ni réglage Wrangler.
- Banc proposé avant code : projet Expo de contrôle séparé hors src/app et hors imports produit, véritable composant avec ports injectés, GestionSession/coffre en mémoire, transport local factice ; aucun import du coffre réel, origine produit inchangée. À relire avant usage.

- 8 novembre : correction React du banc par le même implémenteur, revue indépendante prête pour natif ; contrôleur confirme 12 mutations détectées et restaurées, ciblés verts. Suites prescrites code 0 : API 661/661 (relance seule après délai RPC sous charge parallèle), mobile 544/544, cloisonnement 489, types/unitaires/build ; Worker 1 287 370 octets.
- 8 novembre : essai natif local réussi (fiche active, actualisation, suspendu/archivé, absence/panne, rattachement masqué, retour/réouverture, réponse A lente puis B). Banc arrêté, produit rétabli, Compte connecté réel confirmé ; aucune déconnexion/effacement ou écriture métier. Rapport : docs/CONTROLE-FICHE-LIVREUR-EXPO-2026-11-07.md.
- Suite : contrôler CI du commit G1, puis préparer la mise en service avec comparaison/diff de production et retour arrière, sans déployer sans feu vert distinct. Ne pas ouvrir G2 comme si G1 était déjà disponible en production. RLS réelle/iPhone/téléphones physiques et parité restent à vérifier.
