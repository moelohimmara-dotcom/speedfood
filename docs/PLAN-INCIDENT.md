# Plan d'incident — Speedfood

**Version :** 0.1 — 3 octobre 2026  
**Statut :** plan écrit, **jamais exercé**. Les gestes ci-dessous sont des commandes ou des chemins réels du projet, mais aucun n'a été joué en situation d'incident (sauf mention contraire). Un exercice à blanc est une des portes de `PROCEDURE-SECURITE.md` §7.  
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

**Où regarder.** Journal d'audit : `/system/audit`. Journaux Supabase : tableau de bord → Logs. Journaux du Worker : **aucune observabilité n'est activée dans `wrangler.jsonc` ; les journaux d'exécution du Worker ne sont donc pas conservés.** Pendant un incident, on ne pourrait pas reconstituer ce qu'a vu le Worker. Mesure recommandée (gratuite à faible volume, demande un déploiement donc ton accord) : ajouter `"observability": { "enabled": true }` à `wrangler.jsonc`, sans jamais journaliser de téléphone, d'adresse ni de jeton (le code actuel n'en écrit aucun).

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
| Un déploiement récent est en cause | `npx wrangler rollback` revient à la version précédente du Worker. | **Non testé** ; à essayer sur la préproduction |
| Il faut tout couper | Tableau de bord Cloudflare → Workers → `speedfood-app` → Settings → désactiver la route `workers.dev` (le site renvoie alors une erreur au lieu de rester ouvert). **Ne pas supprimer le Worker.** Réactiver pour remettre en service. | Chemin indicatif, **non testé** |
| La base est corrompue ou supprimée | Voir `SAUVEGARDE-ET-RESTAURATION.md` §5. **Aujourd'hui, aucune sauvegarde n'existe.** | Bloquant avant pilote |

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
