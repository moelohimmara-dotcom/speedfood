# Sauvegarde et restauration — Speedfood

**Version :** 0.1 — 3 octobre 2026  
**État en une phrase :** **aucune sauvegarde de la base n'existe aujourd'hui et aucune restauration n'a jamais été testée.** Ce document dit ce qui est protégé, ce qui ne l'est pas, et la procédure à suivre.

## 1. Ce que dit la documentation officielle (consultée le 3 octobre 2026)

Ton organisation Supabase est sur l'offre **gratuite** (`free`, vérifié par l'API de gestion). D'après la documentation Supabase :
- Les **sauvegardes quotidiennes automatiques existent seulement à partir de l'offre Pro** (7 jours conservés). Sur l'offre gratuite, **les sauvegardes ne sont pas disponibles au téléchargement**, et Supabase recommande d'exporter régulièrement ses données soi-même avec `supabase db dump` et de les garder hors de Supabase.
- Une **restauration à un instant précis** (PITR) est un module payant en plus de l'offre Pro (de l'ordre de 100 dollars par mois pour 7 jours).
- Les **sauvegardes ne contiennent pas les fichiers** du stockage (photos, logos, bannières) : seulement leurs références.
- Un projet de l'offre gratuite est **mis en pause après une semaine de faible activité** (restaurable pendant 90 jours depuis le tableau de bord). Un site en pause ne répond plus.
- Supprimer un projet efface définitivement ses données **et** ses sauvegardes.

## 2. Ce qui est déjà récupérable, ce qui ne l'est pas

| Élément | Récupérable aujourd'hui ? | Comment |
|---|---|---|
| Structure de la base (tables, règles d'accès, fonctions) | **Oui** | Les 25 fichiers de `supabase/migrations/` la reconstruisent (versionnés le 3 octobre ; **rejeu complet jamais testé**, voir §5) |
| Code de l'application | Oui | Dépôt Git |
| Réglages Worker (variables publiques) | Oui | `wrangler.jsonc` |
| Secrets du Worker (`SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`) | **Non, par conception** | Ils ne sont dans aucun fichier. Ils se régénèrent (voir `PLAN-INCIDENT.md`), mais **personne d'autre que toi n'a leur valeur** : garde-les dans un gestionnaire de mots de passe |
| Données : restaurants, menus, comptes, commandes, audit | **Non** | Aucune sauvegarde. Aujourd'hui ce sont presque uniquement des données de démonstration |
| Photos et logos (stockage `medias`) | **Non** | Pas dans les sauvegardes Supabase, même payantes |
| Comptes (emails, mots de passe hachés) | **Non** | Dans `auth.users`, comme les données |

Tant qu'il n'y a que des données fictives, la perte est sans gravité (le catalogue de démonstration se recrée). **Le jour où de vraies données arrivent, ce tableau devient bloquant.**

## 3. Décisions à prendre par Malika

1. **Passer à l'offre Pro** (environ 25 dollars par mois selon la grille consultée) : donne les sauvegardes quotidiennes sur 7 jours, supprime la mise en pause, et ouvre l'assistance Supabase. C'est la mesure la plus simple et la plus protectrice avant un pilote. **Coût : à autoriser explicitement par toi.**
2. **Ou rester gratuit** et accepter : exports manuels réguliers (§4), risque de pause, aucune restauration rapide.
3. **Éviter la pause tout de suite, sans payer :** une visite du tableau de bord Supabase ou quelques requêtes par jour suffisent (« quelques requêtes par jour sur la semaine » selon la documentation). Aucun mécanisme automatique n'existe aujourd'hui ; si le site reste sans visite une semaine, il peut se mettre en pause.

## 4. Procédure d'export manuel (offre gratuite)

À faire par **toi** (ou une personne de confiance) car elle demande le mot de passe de la base, que je ne dois jamais recevoir. Prérequis : le CLI Supabase (déjà installé sur ta machine) et ton mot de passe de base (tableau de bord → Settings → Database).

```bash
# Données seules (ce qui n'est pas reconstructible depuis le dépôt)
supabase db dump --data-only --linked -f sauvegarde-donnees-AAAA-MM-JJ.sql
```

- Rythme proposé : **hebdomadaire** avant le pilote, **quotidien** pendant le pilote.
- Stockage : sur un disque ou un cloud **chiffré, hors de Supabase et hors du dépôt Git** (le fichier contient des données personnelles : ne jamais le commiter ni l'envoyer par messagerie).
- Photos : télécharger le contenu du bucket `medias` depuis le tableau de bord (ou conserver les originaux chez les restaurants).
- Conserver les 4 dernières sauvegardes, supprimer les plus anciennes (cohérent avec la durée de conservation de `CONSERVATION-ET-CONFIDENTIALITE.md`).

## 5. Procédure de restauration et test (à exécuter une fois avant le pilote)

Une sauvegarde qu'on n'a jamais restaurée n'est pas une preuve. Test proposé, **sans toucher à la production** :

1. **Rejeu des migrations sur une base vide** : base PostgreSQL jetable en local (Docker), puis application des 25 fichiers de `supabase/migrations/` dans l'ordre. Doit se terminer sans erreur et produire les mêmes tables, policies et fonctions que la production (comparer les listes). *Docker Desktop doit être lancé ; je peux préparer et exécuter ce test sur ta demande. Les migrations utilisent des éléments propres à Supabase (rôles `anon`/`authenticated`, schémas `auth` et `storage`) : la base de test doit les fournir.*
2. **Restauration des données** : appliquer ensuite un export de données (§4) sur cette base de test, puis vérifier le nombre de lignes par table et une commande de bout en bout.
3. **Consigner** la date, la durée, les écarts, et qui a fait le test, dans `STATUT-PROJET.md`.

Pour une vraie panne de production : restaurer dans un **nouveau projet Supabase** (jamais par-dessus l'ancien), rejouer les migrations, importer l'export, recréer le bucket `medias` et recharger les photos, mettre à jour les variables du Worker (`NEXT_PUBLIC_SUPABASE_URL`, clé anon publique, puis `wrangler secret put` pour la clé service-role et `COMMANDE_JETON_SECRET`), puis déployer.

**Point d'attention :** le projet actuel reste référencé dans `wrangler.jsonc` ; un changement de projet change les clés, les URL et invalide les sessions existantes (les restaurateurs devront se reconnecter).

## 6. À propos de la préproduction

J'avais indiqué qu'un second environnement « demande un second projet et un coût ». À nuancer : d'après mes connaissances (non vérifiées dans la documentation consultée), l'offre gratuite de Supabase permet **deux projets actifs** et un Worker supplémentaire est gratuit sur Cloudflare. Une préproduction pourrait donc ne rien coûter, mais elle exige de créer un compte/projet : **elle ne sera créée qu'avec ton accord explicite** (règle du dépôt). Elle servirait aussi à réaliser le test de restauration du §5.
