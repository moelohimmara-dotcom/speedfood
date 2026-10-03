# Export des données et restauration : guide d'exploitation

**Pour qui :** une personne ou un agent qui doit lancer, vérifier, planifier ou restaurer un export des données de
production **sans avoir besoin de la personne qui l'a mis en place**.
**Version :** 1.0, 3 octobre 2026. Complète `SAUVEGARDE-ET-RESTAURATION.md` (le pourquoi) : ce document est le comment.

## 1. En deux minutes

- La base de production (Supabase, offre gratuite) **n'a aucune sauvegarde automatique**. Cet export est donc la **seule**
  copie des données en dehors de Supabase.
- Une tâche planifiée Windows l'exécute **chaque dimanche à 20 h** sur le PC de Malika, si le PC est allumé (sinon, au
  prochain démarrage de session).
- Pour l'exécuter à la main : `npm run export:donnees` dans le dossier du dépôt. Pour prouver qu'un export est
  restaurable : `npm run export:verifier`.
- Résultat : un dossier daté dans `C:\Users\<profil>\speedfood-exports\`, **hors du dépôt Git**. Les 4 derniers sont
  gardés, les plus anciens sont supprimés automatiquement.

## 2. Ce que contient un export

| Fichier ou dossier | Contenu | Remarque |
|---|---|---|
| `tables/<table>.json` | Toutes les tables du schéma public (restaurants, menus, commandes, propositions, audit, réglages…) | La liste des tables est lue sur la base à chaque export : rien à maintenir à la main |
| `comptes.json` | Identifiant, email, dates, fournisseur de connexion de chaque compte | **Sans mots de passe** : l'API ne les donne pas. Après une restauration, chacun réinitialise le sien |
| `stockage/` | Tous les fichiers du bucket `medias` (photos, logos, bannières) | Absents des sauvegardes Supabase même payantes |
| `manifeste.json` | Date, nombre de lignes par table, empreinte SHA-256 de chaque fichier, liste des migrations | Sert à la vérification |

**Ce que l'export ne contient pas :** les secrets du Worker (clé de service, clé des jetons, secret Turnstile) ; la structure
de la base (elle se reconstruit par les migrations du dépôt, `supabase/migrations/`) ; l'historique de connexion.

## 3. Accès nécessaires (et où les trouver)

| Il faut | Où c'est | À ne jamais faire |
|---|---|---|
| Le dépôt Git `speedfood` sur la machine | Dossier de travail de Malika | |
| Node.js (version 20 ou plus ; la 24 est utilisée) | `node -v` | |
| `npm install` fait une fois dans le dépôt | | |
| Un fichier `.env.local` à la racine du dépôt contenant `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` | La clé de service se trouve dans le tableau de bord Supabase, projet `ggldjdizqrtpetdiohxy`, Paramètres, API, « service_role » | **Ne jamais** coller cette clé dans une conversation, un ticket, un message ou un commit. Elle donne accès à toutes les données |
| Pour la vérification : `cd supabase/rejeu && npm install` une fois | | |

L'outil **ne demande jamais de mot de passe de base de données** et **n'écrit jamais** dans la base : il ne fait que lire.

**Si la clé de service a été exposée ou doit changer :** la régénérer dans Supabase, mettre à jour `.env.local` et le secret
du Worker (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, à faire par le propriétaire du compte Cloudflare).

## 4. Lancer un export à la main

```bash
cd C:\Users\moelo\dev\speedfood
npm run export:donnees
```

Sortie normale : une ligne par table avec son nombre de lignes, le nombre de comptes, le nombre de fichiers du stockage, puis
« Export terminé : <dossier> ». **Aucune donnée personnelle n'est affichée**, seulement des compteurs. L'outil s'arrête avec
un message clair s'il manque une variable ou si une lecture échoue (aucun export partiel n'est considéré comme valide : un
export sans la ligne « Export terminé » doit être refait).

Options : `--sortie=<dossier>` pour écrire ailleurs (par exemple un disque externe chiffré).

## 5. Vérifier qu'un export est restaurable

```bash
npm run export:verifier
```

Sans argument, vérifie l'export le plus récent ; avec un chemin, celui-ci. L'outil :
1. recalcule l'empreinte de chaque fichier et la compare au manifeste ;
2. reconstruit une base jetable en mémoire (PGlite, sans Docker, sans compte, sans coût) avec toutes les migrations ;
3. y recharge l'export, compare le nombre de lignes de chaque table et vérifie que rien ne pointe dans le vide.

Il doit se terminer par **« RESTAURATION VÉRIFIÉE »**. Tout autre résultat signifie que l'export n'est pas fiable : relancer
l'export, et si cela se reproduit, alerter Malika. **À faire au moins une fois par mois, et après toute migration.**

## 6. La tâche planifiée

| | |
|---|---|
| Nom | `Speedfood - export hebdomadaire` (Planificateur de tâches Windows) |
| Quand | Chaque dimanche à 20 h ; rattrapage au démarrage suivant si le PC était éteint |
| Qui | Le compte Windows de Malika, uniquement quand la session est ouverte (aucun mot de passe stocké) |
| Quoi | `scripts/export/lancer-export.cmd`, qui lance l'export et ajoute le résultat à `speedfood-exports\journal-export.log` |

Commandes PowerShell utiles :

```powershell
Get-ScheduledTaskInfo -TaskName "Speedfood - export hebdomadaire"    # dernière et prochaine exécution, code de résultat (0 = succès)
Start-ScheduledTask   -TaskName "Speedfood - export hebdomadaire"    # lancer maintenant
Disable-ScheduledTask -TaskName "Speedfood - export hebdomadaire"    # suspendre
Enable-ScheduledTask  -TaskName "Speedfood - export hebdomadaire"    # reprendre
Get-Content "$env:USERPROFILE\speedfood-exports\journal-export.log" -Tail 30   # derniers résultats
```

**Changer le rythme** (par exemple quotidien pendant le pilote) : ouvrir le Planificateur de tâches Windows, bibliothèque,
tâche `Speedfood - export hebdomadaire`, onglet Déclencheurs, modifier. Ou recréer la tâche avec
`New-ScheduledTaskTrigger -Daily -At 20:00` à la place de `-Weekly -DaysOfWeek Sunday`.

**Machine différente ou nouvelle :** refaire les prérequis du §3, puis recréer la tâche :

```powershell
$action  = New-ScheduledTaskAction -Execute "<chemin du dépôt>\scripts\export\lancer-export.cmd"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 20:00
$params  = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "Speedfood - export hebdomadaire" -Action $action -Trigger $trigger -Settings $params
```

**Surveillance :** un export réussi laisse `code de sortie : 0` dans le journal et un nouveau dossier daté. **Si le dernier
dossier date de plus de 8 jours, il y a un problème** : vérifier que le PC a été allumé, regarder le journal, lancer à la main.

## 7. Bonnes pratiques (obligatoires : ces fichiers contiennent des téléphones et des adresses)

1. **Disque chiffré.** Le dossier `speedfood-exports` doit être sur un disque chiffré (BitLocker sous Windows). Vérifier :
   Paramètres, Confidentialité et sécurité, Chiffrement de l'appareil.
2. **Jamais dans Git, jamais par messagerie ou courriel, jamais dans une conversation avec un agent.** Un agent doit
   travailler avec les compteurs du journal et du manifeste, pas avec le contenu des fichiers.
3. **Pas dans un dossier synchronisé automatiquement** (OneDrive, Drive, Dropbox) sauf s'il est chiffré. Le dossier par défaut
   est dans le profil Windows ; vérifier que la sauvegarde OneDrive des dossiers du profil ne l'inclut pas.
4. **Une copie hors de la machine** est recommandée (disque externe chiffré), au moins une fois par mois : un PC volé ou en
   panne emporterait sinon les exports avec lui.
5. **Respecter la durée de conservation** (`CONSERVATION-ET-CONFIDENTIALITE.md`). Un export garde des coordonnées que la base a
   anonymisées depuis : la rotation à 4 exports limite ce risque (environ un mois en rythme hebdomadaire). **Ne jamais
   augmenter ce nombre sans décision de Malika.** Si une personne demande l'effacement de ses données, les exports existants
   ne l'ont pas encore effacée : voir §3 de `CONSERVATION-ET-CONFIDENTIALITE.md`.
6. **Tester la restauration** (§5) au moins une fois par mois.
7. **Ne jamais modifier l'outil pour qu'il écrive dans la base** ou affiche des lignes de données. Il est volontairement en
   lecture seule et muet sur le contenu.

## 8. Restaurer pour de vrai (panne ou perte de données)

Principe : **ne jamais restaurer par-dessus la base de production existante**. Toujours dans un **nouveau projet Supabase**.

1. Vérifier l'export choisi avec `npm run export:verifier`.
2. Créer un nouveau projet Supabase (décision et accord de Malika : crée un projet cloud). Noter son URL et ses clés.
3. Rejouer les migrations du dépôt dans l'ordre (`supabase/migrations/*.sql`) sur ce projet.
4. Charger les `tables/*.json` : même mécanisme que dans `scripts/export/verifier-restauration.mjs` (supprimer d'abord les
   lignes de départ créées par les migrations, charger avec `jsonb_populate_recordset`, désactiver les clés étrangères pendant
   le chargement avec `set session_replication_role = replica`, puis les réactiver).
5. Recréer les comptes à partir de `comptes.json` (identifiants et emails identiques pour que les liens avec les restaurants et
   les rôles tiennent) ; **les personnes devront réinitialiser leur mot de passe**.
6. Recréer le bucket `medias` (public, voir la migration `bucket_medias`) et recharger les fichiers de `stockage/` aux mêmes
   chemins, car les URL des images sont enregistrées dans les tables.
7. Mettre à jour `wrangler.jsonc` (URL et clé anon publiques), poser les secrets (`SUPABASE_SERVICE_ROLE_KEY`,
   `COMMANDE_JETON_SECRET`, `TURNSTILE_SECRET_KEY`) avec `npx wrangler secret put`, puis déployer.
8. Contrôler : catalogue public, une connexion restaurateur, une connexion administrateur, une commande de test (à supprimer).
9. Consigner l'incident et la restauration dans `STATUT-PROJET.md` et `PLAN-INCIDENT.md`.

**Limites connues :** les mots de passe ne sont pas restaurés ; les données créées entre le dernier export et la panne sont
perdues (jusqu'à une semaine avec le rythme actuel) ; les jetons de suivi des commandes restent valables seulement si
`COMMANDE_JETON_SECRET` est conservé (sinon ils sont recalculés différemment pour les nouvelles commandes, les anciens restent
enregistrés tels quels dans `orders.jeton_suivi`).

## 9. Dépannage

| Symptôme | Cause probable | Remède |
|---|---|---|
| « NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies » | `.env.local` absent ou incomplet | Le créer à la racine du dépôt (§3) |
| « Lecture du schéma impossible (HTTP 401) » | Clé de service fausse ou régénérée | Copier la clé actuelle depuis Supabase |
| « Échec de lecture de la table … » | Réseau, projet en pause (offre gratuite après 7 jours d'inactivité), ou table renommée | Rouvrir le projet dans le tableau de bord Supabase, relancer |
| `npm` ou `npx` « l'exécution de scripts est désactivée » (PowerShell) | Politique d'exécution de PowerShell | Utiliser `npm.cmd` / `npx.cmd`, ou un terminal Invite de commandes ou Git Bash |
| La tâche planifiée ne produit rien | PC éteint ou session fermée à l'heure prévue | Regarder `Get-ScheduledTaskInfo`, relancer à la main, vérifier le rattrapage |
| `export:verifier` : « PGlite absent » | Dépendance de vérification non installée | `cd supabase/rejeu && npm install` |
| `export:verifier` : échec d'une empreinte | Fichier modifié ou corrompu après l'export | Ne pas utiliser cet export, en refaire un |
| `export:verifier` : nombre de lignes différent | Export interrompu ou outil modifié | Refaire l'export ; si cela persiste, alerter Malika |

## 10. Pour modifier l'outil

Fichiers : `scripts/export/exporter.mjs`, `scripts/export/verifier-restauration.mjs`, `scripts/export/lancer-export.cmd`. Garder :
lecture seule, aucune donnée affichée, rotation à 4 exports, écriture hors du dépôt. Après modification : faire un export,
puis `npm run export:verifier`, puis consigner le résultat dans `STATUT-PROJET.md`.
