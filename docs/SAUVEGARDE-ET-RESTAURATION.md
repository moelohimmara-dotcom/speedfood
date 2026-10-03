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
| Structure de la base (tables, règles d'accès, fonctions) | **Oui** | Les 25 fichiers de `supabase/migrations/` la reconstruisent (versionnés ; **rejeu complet vérifié le 3 octobre 2026**, voir §5) |
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

## 4. Export régulier (offre gratuite) : outil fourni, décision du 3 octobre 2026

Décision de Malika : **exports réguliers** (pas de passage à l'offre Pro pour l'instant). L'outil est dans le dépôt et ne
demande **aucun mot de passe de base** : il lit la clé de service déjà présente dans `.env.local` de la machine.

```bash
npm run export:donnees
```

Il écrit dans `C:\Users\<profil>\speedfood-exports\AAAA-MM-JJ-HH-MM\` (hors du dépôt Git) :
- `tables/*.json` : les 19 tables du schéma public (la liste est lue sur la base, rien à maintenir) ;
- `comptes.json` : identifiants, emails, dates, fournisseur de connexion, **sans mots de passe** (l'API n'en donne pas) ;
- `stockage/` : tous les fichiers du bucket `medias` (photos, logos, bannières) ;
- `manifeste.json` : lignes par table, empreinte SHA-256 de chaque fichier, migrations connues.

Il ne fait que lire, n'affiche que des compteurs, et garde les **4 derniers exports** (supprime les plus anciens).
Les fichiers contiennent des téléphones et des adresses : dossier sur un **disque chiffré** (BitLocker), jamais dans Git, jamais
envoyé par messagerie. Rythme : hebdomadaire avant le pilote, quotidien pendant.

**Limites à connaître** : l'export ne contient pas les mots de passe (après une restauration, les personnes réinitialisent le
leur) ; il ne remplace pas une sauvegarde au niveau du serveur de base (offre Pro) : entre deux exports, on peut perdre
jusqu'à une journée ou une semaine de données.

## 5. Procédure de restauration et test (à exécuter une fois avant le pilote)

Une sauvegarde qu'on n'a jamais restaurée n'est pas une preuve. Test proposé, **sans toucher à la production** :

1. **Rejeu des migrations sur une base vide : FAIT le 3 octobre 2026**, avec PGlite (PostgreSQL en mémoire, sans Docker) via `supabase/rejeu/` : les 26 fichiers se rejouent sans erreur et le schéma obtenu est **identique à celui de la production** (19 tables, 134 colonnes, 66 contraintes, 45 index, 54 policies RLS, 8 triggers, 12 fonctions ; hachages égaux). Limites : moteur PostgreSQL 18 contre 17 en production, éléments Supabase remplacés par des bouchons, droits (`GRANT`/`REVOKE`), données et stockage non comparés (voir `supabase/rejeu/README.md`). À refaire après chaque migration.
2. **Restauration des données : FAIT le 3 octobre 2026** avec `npm run export:verifier` : un vrai export (19 tables, 12 comptes, 1 fichier) est rechargé dans une base jetable reconstruite par les 32 migrations ; les empreintes de tous les fichiers sont vérifiées, le nombre de lignes de chacune des 19 tables est identique au manifeste, et aucun lien ne pointe dans le vide (lignes sans commande, commandes sans restaurant, plats sans restaurant, propositions sans commande : 0). Le test a révélé qu'il faut vider les lignes de départ créées par les migrations avant de charger l'export ; c'est intégré à l'outil. **Limite** : moteur PostgreSQL 18 jetable, pas un vrai projet Supabase ; à refaire dans une préproduction si elle existe un jour.
3. **Consigner** la date, la durée, les écarts, et qui a fait le test, dans `STATUT-PROJET.md`.

Pour une vraie panne de production : restaurer dans un **nouveau projet Supabase** (jamais par-dessus l'ancien), rejouer les migrations, importer l'export, recréer le bucket `medias` et recharger les photos, mettre à jour les variables du Worker (`NEXT_PUBLIC_SUPABASE_URL`, clé anon publique, puis `wrangler secret put` pour la clé service-role et `COMMANDE_JETON_SECRET`), puis déployer.

**Point d'attention :** le projet actuel reste référencé dans `wrangler.jsonc` ; un changement de projet change les clés, les URL et invalide les sessions existantes (les restaurateurs devront se reconnecter).

## 6. À propos de la préproduction

J'avais indiqué qu'un second environnement « demande un second projet et un coût ». À nuancer : d'après mes connaissances (non vérifiées dans la documentation consultée), l'offre gratuite de Supabase permet **deux projets actifs** et un Worker supplémentaire est gratuit sur Cloudflare. Une préproduction pourrait donc ne rien coûter, mais elle exige de créer un compte/projet : **elle ne sera créée qu'avec ton accord explicite** (règle du dépôt). Elle servirait aussi à réaliser le test de restauration du §5.
