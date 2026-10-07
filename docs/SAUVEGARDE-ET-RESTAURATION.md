# Sauvegarde et restauration — Speedfood

**Version :** 0.2 — 7 octobre 2026 (chiffres remis à jour, voir l'avertissement en tête)  
**État en une phrase :** **la production n'a jamais été exportée, et la restauration n'a jamais été jouée sur un vrai projet Supabase** — elle ne l'a été que sur une base jetable locale, avec un schéma qui n'est plus celui d'aujourd'hui. Ce document dit ce qui est protégé, ce qui ne l'est pas, et la procédure à suivre.

> **Avertissement du 7 octobre 2026.** Ce document se contredisait et datait du 3 octobre : il annonçait « 25 fichiers de migrations » en §2, « 26 fichiers »
> en §5.1 et « 32 migrations » en §5.2, alors que le dépôt en compte **60**. Il annonçait « 19 tables » à trois endroits, alors que le schéma en compte
> **31**. Sa phrase d'état affirmait qu'aucune restauration n'avait jamais été testée, alors que son propre §5 en relate une. Enfin, la vérification de
> restauration qu'il revendique **ne couvre pas le schéma actuel** : elle précède de 34 migrations l'ajout de `acces_paliers`, `fonctionnalites`,
> `contenu_emplacements`, `content_pages_versions`, `documents_commande`, `restaurant_codes_marchand`, `restaurant_identite_documents`, `restaurant_scans` et
> `restaurant_compteurs_documents`. **Le test doit être refait** : c'est la porte 13 de `PROCEDURE-SECURITE.md` §9, partielle pour cette raison.

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
| Structure de la base (tables, règles d'accès, fonctions) | **Oui** | Les 60 fichiers de `supabase/migrations/` la reconstruisent (versionnés ; **rejeu complet vérifié le 3 octobre 2026 sur le schéma de ce jour-là, 25 migrations**, voir §5 — **à refaire, le dépôt en compte 60**) |
| Code de l'application | Oui | Dépôt Git |
| Réglages Worker (variables publiques) | Oui | `wrangler.jsonc` |
| Secrets du Worker (`SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`) | **Non, par conception** | Ils ne sont dans aucun fichier. Ils se régénèrent (voir `PLAN-INCIDENT.md`), mais **personne d'autre que toi n'a leur valeur** : garde-les dans un gestionnaire de mots de passe |
| Données : restaurants, menus, comptes, commandes, audit | **Non — sauf si un export a été lancé** | L'outil existe (`npm run export:donnees`, §4) mais **aucun export de la production n'a été vérifié à ce jour**. Les données actuelles sont presque entièrement de démonstration (20 restaurants dont 12 en `donnees_demo`, 3 commandes) |
| Photos et logos (stockage `medias`) | **Non** | Pas dans les sauvegardes Supabase, même payantes |
| Comptes (emails, mots de passe hachés) | **Non** | Dans `auth.users`, comme les données |

Tant qu'il n'y a que des données fictives, la perte est sans gravité (le catalogue de démonstration se recrée). **Le jour où de vraies données arrivent, ce tableau devient bloquant.**

## 3. Décisions à prendre par Malika

1. **Passer à l'offre Pro** (environ 25 dollars par mois selon la grille consultée) : donne les sauvegardes quotidiennes sur 7 jours, supprime la mise en pause, et ouvre l'assistance Supabase. C'est la mesure la plus simple et la plus protectrice avant un pilote. **Coût : à autoriser explicitement par toi.**
2. **Ou rester gratuit** et accepter : exports manuels réguliers (§4), risque de pause, aucune restauration rapide.
3. **Éviter la pause tout de suite, sans payer :** une visite du tableau de bord Supabase ou quelques requêtes par jour suffisent (« quelques requêtes par jour sur la semaine » selon la documentation). Aucun mécanisme automatique n'existe aujourd'hui ; si le site reste sans visite une semaine, il peut se mettre en pause.

## 4. Export régulier (offre gratuite) : outil fourni, décision du 3 octobre 2026

> **Guide d'exploitation complet, pour une personne ou un agent autonome : `docs/RUNBOOK-EXPORT.md`** (accès, planification, vérification, restauration, dépannage).

Décision de Malika : **exports réguliers** (pas de passage à l'offre Pro pour l'instant). L'outil est dans le dépôt et ne
demande **aucun mot de passe de base** : il lit la clé de service déjà présente dans `.env.local` de la machine.

```bash
npm run export:donnees
```

Il écrit dans `C:\Users\<profil>\speedfood-exports\AAAA-MM-JJ-HH-MM\` (hors du dépôt Git) :
- `tables/*.json` : les tables du schéma public — **31 au 7 octobre 2026** (la liste est lue sur la base à chaque exécution, rien à maintenir, donc ce compte suit
  l'évolution du schéma ; les « 19 tables » des versions précédentes de ce document étaient le compte du 3 octobre) ;
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

1. **Rejeu des migrations sur une base vide : FAIT le 3 octobre 2026, à REFAIRE**, avec PGlite (PostgreSQL en mémoire, sans Docker) via `supabase/rejeu/` : les migrations se rejouent sans erreur et le schéma obtenu est **identique à celui de la production** — **sur le schéma du 3 octobre** (alors 25 migrations, 19 tables, 134 colonnes, 66 contraintes, 45 index, 54 policies RLS, 8 triggers, 12 fonctions ; hachages égaux). **Le dépôt en compte 60 migrations et la production 31 tables : cette vérification ne dit plus rien de l'état actuel.** Le dépôt doit toujours pouvoir reconstruire la base : le rejouer après chaque migration. Limites : moteur PostgreSQL 18 contre 17 en production, éléments Supabase remplacés par des bouchons, droits (`GRANT`/`REVOKE`), données et stockage non comparés (voir `supabase/rejeu/README.md`). Noter que « identique » ne veut pas dire « équivalent en droits » : les politiques de privilèges ne sont pas vérifiées par cet outil.
2. **Restauration des données : FAIT le 3 octobre 2026, À REFAIRE**, avec `npm run export:verifier` : un vrai export était rechargé dans une base jetable reconstruite par les migrations ; les empreintes de tous les fichiers étaient vérifiées, le nombre de lignes de chaque table identique au manifeste, et aucun lien ne pointait dans le vide (lignes sans commande, commandes sans restaurant, plats sans restaurant, propositions sans commande : 0). Le test a révélé qu'il faut vider les lignes de départ créées par les migrations avant de charger l'export ; c'est intégré à l'outil. **Limites** : base jetable locale en PostgreSQL 18, **jamais un vrai projet Supabase** ; et surtout **test réalisé sur le schéma du 3 octobre** — les tables créées depuis (`acces_paliers`, `fonctionnalites`, `contenu_emplacements`, `content_pages_versions`, `documents_commande`, `restaurant_codes_marchand`, `restaurant_identite_documents`, `restaurant_scans`, `restaurant_compteurs_documents`) n'ont jamais été restaurées. À refaire sur un projet jetable avant le pilote.
   - **Préalable ajouté le 7 octobre 2026** : `TABLES_SAUVEGARDE` (`src/lib/system-admin/sauvegarde.ts`), utilisée avant toute réinitialisation, ne listait que 20 tables et en omettait **six qui disparaissent en cascade** — dont `documents_commande` (reçus et factures émis) et `restaurant_identite_documents` (raison sociale, NIF, RCCM). La liste passe à 26 tables. **Ce chemin de code n'a jamais été exécuté** : il faudra le prouver avec un export et une restauration.
3. **Consigner** la date, la durée, les écarts, et qui a fait le test, dans `STATUT-PROJET.md`.

Pour une vraie panne de production : restaurer dans un **nouveau projet Supabase** (jamais par-dessus l'ancien), rejouer les migrations, importer l'export, recréer le bucket `medias` et recharger les photos, mettre à jour les variables du Worker (`NEXT_PUBLIC_SUPABASE_URL`, clé anon publique, puis `wrangler secret put` pour la clé service-role et `COMMANDE_JETON_SECRET`), puis déployer.

**Point d'attention :** le projet actuel reste référencé dans `wrangler.jsonc` ; un changement de projet change les clés, les URL et invalide les sessions existantes (les restaurateurs devront se reconnecter).

## 6. À propos de la préproduction

J'avais indiqué qu'un second environnement « demande un second projet et un coût ». À nuancer : d'après mes connaissances (non vérifiées dans la documentation consultée), l'offre gratuite de Supabase permet **deux projets actifs** et un Worker supplémentaire est gratuit sur Cloudflare. Une préproduction pourrait donc ne rien coûter, mais elle exige de créer un compte/projet : **elle ne sera créée qu'avec ton accord explicite** (règle du dépôt). Elle servirait aussi à réaliser le test de restauration du §5.
