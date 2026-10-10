# Feuille de route — audit et continuité Speedfood

**État au 10 octobre 2026 : audit ciblé terminé; aucune modification de code métier, de base ou de configuration distante.** Les trois rapports et captures sont des artefacts locaux non commités.

## Priorité immédiate — avant tout pilote

1. **Décider du jeton de suivi dans les journaux Worker.** La procédure §9 documente une conservation de 7 jours et une acceptation du risque, car le jeton est dans le chemin `/suivi/<jeton>`. Confirmer si cette acceptation demeure; si non, autoriser un changement contrôlé qui le masque/retire des journaux. Aucun réglage Cloudflare n’a été lu via API ni modifié.
2. **Trier les 11 vulnérabilités élevées npm.** Relancer `npm audit` avec ventilation paquet/CVE sur la tête GitHub courante. Évaluer impact production, versions de correction et scripts d’installation bloqués. Ne pas lancer `npm audit fix` sans revue.
3. **Choisir une stratégie préproduction.** Le dossier décrit un seul Worker et une seule base Supabase. Créer un environnement distinct demanderait accord explicite et ressources; sinon, faire valider une procédure compensatoire et ses limites.
4. **Effectuer une revue indépendante de sécurité** des correctifs historiques avec vrais JWT de test, en lecture seule pour cet audit; prioriser isolation inter-tenant, `support`, MFA, RLS et journalisation.
5. **Valider les sauvegardes et la procédure d’incident** sur une cible Supabase jetable autorisée; compléter contact technique, copie hors machine chiffrée et vérification du bucket médias.

## Vérifications produit et exploitation

1. Obtenir des sessions déjà existantes de test pour `super_admin`, `operations`, `content_editor` et `support`; faire ouvrir les sessions par la propriétaire dans le navigateur partagé. Ne transmettre aucun mot de passe ou jeton dans le chat et ne créer aucun compte pour l’audit.
2. Sur chaque rôle, vérifier nav, URLs directes, Server Actions/API et refus croisés; contrôler que les coordonnées support restent masquées et que toute révélation exige motif et audit. Le code est cohérent, mais ce contrôle en session n’a pas été fait.
3. Tester un parcours de commande en environnement explicitement autorisé : panier, prix modifié, options, répétition/idempotence, proposition révisée, refus/expiration et transitions. Aucune commande réelle n’a été créée pendant cet audit.
4. Faire tester horaires affichés et bascules `ouvert`/`accepte_commandes` par un restaurateur; ces deux statuts ne sont pas calculés automatiquement depuis le texte des horaires.
5. Compléter la PWA : décider et tester le shell hors ligne; mettre en cache uniquement les ressources statiques autorisées; démontrer que sessions, commandes, suivi et PII sont absents du cache. Le service worker courant ne met rien en cache.
6. Refaire le contrôle visuel/accessibilité sur téléphone physique, clavier, lecteur d’écran, zoom et états d’erreur; les mesures de cette passe couvrent le catalogue public uniquement.
7. Réexaminer les données de démonstration et l’équipement des restaurants après connexion à une session autorisée. Les nombres consignés dans les brouillons antérieurs n’ont pas été revalidés ici.

## Continuité Git et changements

- Synchroniser et examiner la tête `origin/master` avant de proposer du code : GitHub est à `05de7a8`, le checkout local reste à `494398e`. Le commit distant consulté corrige le type `LayoutProps` dans `src/app/layout.tsx`.
- Préserver les rapports et captures non suivis déjà présents. Aucun `fetch`, branche, commit, push, migration, action Supabase/Cloudflare ou déploiement n’a été effectué.
- Les modifications locales sûres peuvent être proposées après décision produit et vérification complète; branche et commits minimaux uniquement après validation explicite. Aucun déploiement sans feu vert explicite distinct.

## Décisions attendues

- Le risque des jetons de suivi dans les journaux reste-t-il accepté, ou faut-il préparer un correctif?
- Préproduction dédiée ou procédure compensatoire validée?
- Qui ouvre les sessions de test préexistantes des quatre rôles et quand?
- MFA obligatoire pour le super-admin avant pilote? rotation/révocation des jetons signalés exposés dans `docs/REPRISE-SESSION.md`?
- Canal d’alerte restaurant, nettoyage des données de démonstration, validation de confidentialité/juridique et essai mobile physique?

## Vérifications impossibles dans cette passe

- Sessions authentifiées `super_admin`, `operations`, `content_editor`, `support` et contrôle effectif des accès en base.
- État courant des paramètres, secrets et journaux du compte Cloudflare; journaux non ouverts car aucun accès API n’a été vérifié.
- Lecture directe des tables privées Supabase, configuration RLS avec vrais JWT, rotation de secrets, restauration sur projet Supabase réel et concurrency test sur deux sessions.
- Test de commande/proposition réelle, test téléphone, cache hors ligne, lecteur d’écran, procédure d’incident et revue indépendante.
- L’export du navigateur intégré ajoute une marge vide; les captures archivées restent des preuves visuelles d’orientation, et les mesures de taille proviennent d’évaluations Playwright. Les PNG sont dans [audit-captures](audit-captures).
