# Plan d'incident — Speedfood

**Version :** 0.2, 17 octobre 2026 (0.1 : 3 octobre 2026)  
**Statut :** plan écrit, **jamais exercé volontairement** ; il a servi une première fois en situation réelle le 15 octobre 2026 (erreurs 503/500 de Cloudflare, voir §7), sans que tous ses gestes aient été joués. Les gestes ci-dessous sont des commandes ou des chemins réels du projet. Un exercice à blanc reste une des portes avant pilote.
**Complète** la section 6 de `PROCEDURE-SECURITE.md`, qui donne la méthode générale.

## 1. Qui prévenir (à compléter par Malika)

Ces informations ne peuvent pas être inventées. **Tant que ce tableau n'est pas rempli, la porte « contact technique opérationnel » reste non franchie.**

| Rôle | Nom | Téléphone / canal | Joignable quand |
|---|---|---|---|
| Propriétaire produit (décide) | Malika | À COMPLÉTER | À COMPLÉTER |
| Responsable technique | À COMPLÉTER | À COMPLÉTER | À COMPLÉTER |
| Remplaçant si injoignable | À COMPLÉTER | À COMPLÉTER | À COMPLÉTER |
| Conseil juridique (notification en Guinée) | À COMPLÉTER | À COMPLÉTER | À COMPLÉTER |

Accès nécessaires pendant un incident (à vérifier **maintenant** que plus d'une personne les a, sinon un seul oubli de mot de passe bloque tout) : compte Supabase, compte Cloudflare, dépôt GitHub, gestionnaire de mots de passe contenant les secrets du Worker.

## 2. Reconnaître un incident

Signaux à traiter comme un incident potentiel :
- une personne dit voir la commande, le téléphone ou l'adresse d'un autre client ou restaurant ;
- une commande, un prix ou un statut que personne n'a saisi ;
- une action sensible absente de la normalité dans **`/system/audit`** (changement de rôle, suspension, révélation de coordonnées) ;
- un pic de commandes ou de refus « Trop de demandes » (table `rate_limits`) ;
- un compte du personnel utilisé alors que la personne dit ne pas l'avoir fait ;
- un secret ou une clé collé quelque part où il ne devait pas (conversation, capture d'écran, dépôt).

**Où regarder.** Journal d'audit : `/system/audit`. Journaux Supabase : tableau de bord → Logs. **Journaux du Worker : ils sont ACTIFS** (voir la correction du 7 octobre 2026 plus bas). Regarder dans Cloudflare → Workers & Pages → `speedfood-app` → Observability → Logs, ou en direct avec `npx wrangler tail speedfood-app`. Rétention 7 jours, échantillonnage 100 %, ingestion arrêtée au plafond de l'offre gratuite sans facturation possible.

> **⚠️ Ces journaux contiennent des jetons d'accès clients. À traiter comme des données sensibles.**
> `wrangler.jsonc` active `redact_query_string`, qui ne couvre **que la chaîne de requête, pas le chemin**. Or le jeton de suivi de commande est **dans le chemin** (`/suivi/<jeton>`) et c'est la **seule clé d'accès à la commande** : statut, paiement et reçu numérique. Conséquence directe : **toute personne ayant accès au compte Cloudflare peut lire les commandes en cours des clients pendant 7 jours.** Ne pas copier ni extraire ces journaux dans un ticket, un message ou un export ; ne pas les transmettre. Le code applicatif n'écrit lui-même ni téléphone ni adresse.
>
> Risque **accepté par écrit par la propriétaire le 7 octobre 2026**, en échange de la visibilité sur les erreurs en production. Corriger : `docs/cadrage/PROCEDURE-SECURITE.md` §9.

**Correction du 7 octobre 2026.** Ce paragraphe affirmait « aucune observabilité n'est activée dans `wrangler.jsonc` ; les journaux d'exécution du Worker ne sont donc pas conservés », et recommandait d'ajouter `"observability": { "enabled": true }`. C'était faux : l'observabilité est active depuis le **6 octobre 2026** (`wrangler.jsonc`, `observability.enabled = true`, `logs.persist = true`). L'affirmation a été retirée parce qu'un document de contrôle qui nie l'existence d'un risque est plus dangereuse qu'un document muet — elle empêchait de poser la bonne question.

**Outils de diagnostic en lecture seule** (ne changent rien en production) :
- `npx wrangler deployments list` : quelles versions du Worker ont été déployées, et à quelle heure (UTC). Premier réflexe : une panne commence-t-elle juste après un déploiement ?
- `npx wrangler tail speedfood-app --format json` : les requêtes en direct, avec le résultat (`ok`, dépassement de ressources…) et le temps de calcul. Ne pas coller ce flux dans une conversation : il contient des chemins de suivi de commande.
- Cloudflare, Workers & Pages, `speedfood-app`, Metrics, Errors, « Invocation Statuses » : les dépassements de calcul (`Exceeded CPU`) ou de mémoire (`Exceeded Memory`).
- Une page publique anonyme (`/`, `/restaurants`) et une page protégée (`/restaurant`, redirige vers la connexion) répondent-elles ? Si les fichiers statiques passent et les pages dynamiques non, c'est le Worker, pas le réseau.

## 3. Les premières 15 minutes

1. **Noter** l'heure, ce qui a été vu, par qui, l'URL concernée. Ne rien supprimer. Ne pas publier les détails.
2. **Prévenir** le propriétaire et le responsable technique (§1).
3. **Limiter l'impact** avec le geste le moins destructeur qui suffit (§4), en commençant par le haut de la liste.
4. **Préserver** les journaux et l'état de la base : pas de suppression « pour nettoyer », pas de restauration par-dessus.
5. **Ne pas affirmer** qu'aucune donnée n'a été touchée avant d'avoir vérifié.

## 4. Gestes d'urgence, du moins au plus radical

| Besoin | Geste | État |
|---|---|---|
| Un restaurant précis pose problème | Dans le CMS : le **suspendre** (il disparaît du catalogue). Ou, pour couvrir les prises de commande seulement, le fermer (`ouvert = false`). | Fonction existante, vérifiée aux blocs 8b |
| Un compte du personnel est compromis | Retirer son rôle : `delete from system_admin_memberships where utilisateur_id = '<id>';` puis **couper ses sessions** : `delete from auth.sessions where user_id = '<id>';` (la table `auth.sessions` existe). Changer ensuite son mot de passe depuis le tableau de bord Supabase. | Table et colonnes vérifiées ; **geste non joué** |
| Un restaurateur compromis | Mêmes étapes de session ; retirer sa ligne dans `restaurant_memberships` si nécessaire | Non joué |
| Un secret du Worker a fuité | Régénérer la clé à la source (Supabase → Settings → clés d'API ; l'intitulé exact peut varier) puis `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` et redéployer. Pour `COMMANDE_JETON_SECRET` : `npx wrangler secret put COMMANDE_JETON_SECRET`. Les liens de suivi **déjà émis restent valides** (le jeton est stocké dans la base) ; seule la re-soumission d'une même commande produirait un autre jeton. | Noms de secrets vérifiés (`wrangler secret list`) ; **rotation non jouée** |
| Un déploiement récent est en cause | `npx wrangler rollback <identifiant de version>` revient à une version précédente du Worker (identifiants récents en §8 ; la liste complète : `npx wrangler deployments list`). Les pages dynamiques se remettent alors à l'ancienne version, la base ne change pas : une migration appliquée n'est pas défaite par un retour arrière. | **Non testé** ; à essayer sur la préproduction, jamais « pour voir » sur la production |
| Il faut tout couper | Tableau de bord Cloudflare → Workers → `speedfood-app` → Settings → désactiver la route `workers.dev` (le site renvoie alors une erreur au lieu de rester ouvert). **Ne pas supprimer le Worker.** Réactiver pour remettre en service. | Chemin indicatif, **non testé** |
| La base est corrompue ou supprimée | Restaurer depuis le dernier export vérifié, **dans un nouveau projet Supabase, jamais par-dessus la production** : `docs/RUNBOOK-EXPORT.md` §8 et `SAUVEGARDE-ET-RESTAURATION.md` §5. Export hebdomadaire (dimanche 20 h) ; **dernier export vérifié restaurable le 17 octobre 2026** (`npm run export:verifier` : « RESTAURATION VÉRIFIÉE »). Perte possible : jusqu'à une semaine de données. | Restauration prouvée sur une base jetable ; **jamais jouée sur un vrai projet Supabase** |

Il n'existe **pas** d'interrupteur global « mode maintenance » dans l'application. Un paramètre global lu au démarrage de chaque action publique (par exemple dans `parametres_application`) est une amélioration simple à faire avant le pilote ; en attendre l'incident serait trop tard.

## 5. Évaluer, informer, corriger

1. **Évaluer** quelles données et quelles personnes sont touchées : lister les commandes et comptes concernés à partir de la base et des journaux, séparer ce qui est **établi** de ce qui est **inconnu**.
2. **Informer** : les personnes touchées et les autorités selon les obligations en Guinée. **La détermination de ces obligations revient au conseil juridique** (§1), pas à un agent ni à ce document.
3. **Corriger** la cause, la faire **relire par une personne ou un agent différent de l'auteur**, tester sur la préproduction quand elle existera, puis remettre en service avec l'accord explicite de Malika.
4. **Consigner** un compte rendu : chronologie, cause, données touchées, mesures, ce qui change dans la procédure. L'ajouter à `docs/STATUT-PROJET.md`.

## 6. Exercice à blanc avant le pilote

À faire une fois, sur la préproduction ou avec des données fictives :
1. Retirer le rôle et les sessions d'un compte de test, vérifier qu'il est bien déconnecté.
2. Faire une rotation de `COMMANDE_JETON_SECRET` sur la préproduction.
3. Jouer `wrangler rollback` après un déploiement de test.
4. Mesurer le temps entre « signalement » et « fonction coupée ».
Consigner les écarts et corriger ce document.

## 7. Retour d'expérience : erreurs 503/500 du 15 octobre 2026 (Cloudflare 1102)

**Ce qui s'est passé.** Vers 14 h 13 UTC, des pages dynamiques ont répondu 503 (« Worker exceeded resource limits », code 1102), puis 500 à corps vide, pendant quelques minutes : l'accueil public,
`/system`, `/restaurant` et une fiche de restaurant ; les fichiers statiques passaient. Quelques minutes plus tard tout répondait de nouveau, sans qu'aucune action de retour arrière ait été faite.
La version déployée (`c8abceee`, 14 h 00) avait fonctionné juste après sa mise en ligne.

**Ce qui l'a révélée.** Aucune surveillance : elle a été vue par hasard pendant un test de la page Géographie (606 Ko, 158 formulaires). La même page, allégée ensuite (261 Ko), n'a plus provoqué d'erreur dans les essais suivants.

**Cause : non établie.** Hypothèses non vérifiées : page trop lourde sur un serveur « froid », plan Cloudflare à limite de calcul basse (10 ms par requête sur l'offre gratuite ; les pages consomment 12 à 880 ms), incident de plateforme.
À vérifier par la propriétaire dans Cloudflare : le plan utilisé, et les « Invocation Statuses » vers 14 h UTC le 15 octobre.

**Ce qui a bien marché.** Lecture seule d'abord (`deployments list`, `tail`), aucun retour arrière précipité, comparaison d'une requête en direct et d'une navigation, consignation de l'heure et des symptômes.

**Ce qui a manqué (à corriger).**
1. Une **détection automatique** : sans surveillance, une panne n'est connue que si quelqu'un la rencontre.
2. Les **contacts** du §1, toujours à compléter.
3. L'**heure de début exacte** : noter l'heure UTC dès le premier signalement.
4. Un **interrupteur de maintenance** pour afficher un message clair au lieu d'une page d'erreur Cloudflare (amélioration simple, voir §4).

## 8. Versions du Worker déployées récemment (pour un retour arrière)

Heures en UTC. L'identifiant complet se lit avec `npx wrangler deployments list`.

| Version | Date | Contenu principal |
|---|---|---|
| `7a7abebd-91d6-4800-b90f-b236ce431ffb` | 16 oct. 07 h 55 | Géographie : import CSV (aperçu toujours visible, confirmation effacée) |
| `e7320934-4f36-4a56-98ec-24fc0d9a8d82` | 16 oct. 08 h 47 | Module de gestion du panier |
| `14cbd40b-6a56-46fe-81b8-6f797850652a` | 16 oct. 09 h 11 | Manifeste de l'application installable |
| `c2416b8a-9ed4-4deb-a5b9-f7f8c2704d19` | 16 oct. 09 h 47 | Hub « Mon restaurant » |
| `53b368e1-6035-4f6e-97ab-97393bf1580a` | 17 oct. 12 h 10 | Correctif de la fiche restaurant et de la file « À traiter » |
| `0ef48465-1028-49ec-a780-3f71924d81f1` | 17 oct. 12 h 32 | Refonte du bloc « Décision » |
| `e19ecff0-9281-485f-bfcd-9b93263fcb99` | 17 oct. 13 h 04 | Page Taxonomie et onglets |
| `ff565497-79b5-4b72-9b37-e54dddcc6e97` | 17 oct. 15 h 10 | Mot de passe de 12 caractères, questions de sécurité facultatives (son retour arrière ne défait pas la migration `questions_securite`, sans effet sans le code) |
| `c9e616f2-698f-4963-921a-d7128d94e59f` | 17 oct. 16 h | Accueil : ligne d'assistance WhatsApp |
| `a014e31d-6d56-4d3a-adab-de7c3df0319f` | 17 oct. 16 h 30 | Bouton de pause des animations retiré du pied de page |
| `c5f66a5d-1475-4384-8beb-a7f0eb763adc` | 17 oct. 21 h | Livraison phases 1a, 1b et 2 (frais, livreurs, répartition, console livreur, carte) ; calcul des frais **éteint** ; migrations `livraison_socle` et `livraison_dispatch` déjà appliquées |
| `8894eb68-1ccb-422e-bcdf-fa08dd8f1547` | 17 oct. 21 h 30 | Option « livreur Speedfood » ouverte aux restaurateurs |
| `ecacb692-b73c-4483-a9f8-97ace99742ee` | 17 oct. 22 h | Refonte des pages Livreurs et Livraisons, une seule entrée de menu active |
| `9642a39e-4633-4c28-a5c9-5e07604aba59` | 17 oct. 23 h | Fiches livreurs : cycle de vie, création individuelle et groupée, liens d'activation, approbation. **Dépend de la migration `livreurs_cycle_dossiers`** : un retour arrière du code est sans risque, un retour arrière de la migration ne l'est pas |
| `5ec2143f-bc2e-4081-be4a-9eeca8328ec6` | 18 oct. 0 h | Consultation et suppression du dossier d'un livreur par le super administrateur |
| `ab0ebcbd-eb61-43b9-b36b-be6b54bb87e2` | 18 oct. | Notation (avis, réponses, modération) et classement du catalogue par note, prix et fréquentation ; migration `20261018010000` appliquée |
| `7c95084c-4870-4716-8e28-38c0ed651fcd` | 18 oct. | Le livreur note le client depuis sa console |
| `f5b75dcd-1cc5-47d0-9d51-28f2201fbb65` | 18 oct. | Assistant « Aide-moi à choisir » (budget, position, gamme de prix), positionnement restaurateur, console admin ; migration `20261018120000` appliquée |
| `10160902-386e-48be-9864-c451b546c90a` | 18 oct. | Commande sur place S1 : ardoise de table, comptoir et numéro d'appel, convive sans compte par restaurant, Salle ; migration `20261018180000` appliquée (version en production) |

Un retour arrière ne défait pas une migration de base : avant de revenir à une version antérieure à une migration, vérifier que l'ancien code sait lire le schéma actuel.

## 9. Compte verrouillé par les questions de sécurité

Si le super administrateur a oublié ses réponses **et** perdu ses codes de secours, personne ne peut le débloquer depuis la console : le retrait se fait en base (requête SQL dans `docs/QUESTIONS-SECURITE.md`, éditeur SQL de Supabase), par une personne ayant cet accès, après vérification de son identité. Noter l'heure UTC, la personne qui a agi et le motif. D'où l'importance d'une deuxième personne ayant accès à Supabase (§1).
