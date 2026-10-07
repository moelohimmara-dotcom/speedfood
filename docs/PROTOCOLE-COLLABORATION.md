# Protocole de collaboration — Speedfood

**Depuis le 27 septembre 2026**, plusieurs agents travaillent sur ce projet en
parallèle. Ce document fixe les règles communes pour éviter la duplication, la
divergence des sources de vérité et les pertes de travail. À lire avant toute
tâche, en complément de `docs/cadrage/AGENT-INSTRUCTIONS.md`.

## 1. Source de vérité unique

**Ce dépôt (`C:\Users\moelo\dev\speedfood`) est la source unique de vérité** :
code, cadrage (`docs/cadrage/`), statut (`docs/STATUT-PROJET.md`), migrations
(`supabase/migrations/`), documentation de déploiement.

Un ancien dépôt documentaire existe dans le workspace OneDrive
(`...\Jarvis\speedfood\`) : il n'est plus qu'une **archive en lecture seule**
(cadrage périmé + anciennes copies de `landing/` et `prototype/`). Ne jamais y
travailler. Les sources de la démo sont désormais dans `demo/` de ce dépôt
(voir `demo/README.md`).

Correspondance des surfaces déployées :

| Surface | Projet Cloudflare | Source |
|---|---|---|
| Application réelle (MVP) | Worker `speedfood-app` (`speedfood-app.moelohimmara.workers.dev`) | **ce dépôt** |
| Landing + prototype de démonstration | Pages `speedfood` (`speedfood.pages.dev`) | **`demo/` de ce dépôt** |

## 2. Règles de travail parallèle

1. **Avant de commencer** : `git pull` (si un dépôt distant existe) et `git log
   --oneline -10` pour voir ce que les autres ont fait. Relire
   `docs/STATUT-PROJET.md` — il est mis à jour après chaque bloc livré.
2. **Pendant** : ne toucher qu'aux fichiers de son périmètre (voir
   `docs/cadrage/PLAN-EXECUTION.md`). Si un fichier hors périmètre doit changer,
   le signaler dans le compte rendu plutôt que de modifier en silence.
3. **Après** : mettre à jour `docs/STATUT-PROJET.md` (bloc, statut, comment c'est
   vérifié), puis **commit immédiat** avec un message `type: description`
   (convention du projet). Un travail non commité est un travail perdu pour les
   autres — c'est arrivé.
4. **Ne jamais** réécrire l'historique Git, ni modifier un commit déjà poussé par
   un autre.
5. Si un autre agent travaille visiblement sur le même fichier (conflit de
   copie, état incohérent), arrêter et le signaler plutôt qu'écraser.

## 3. Règles de données et migrations

- Toute migration DDL passe par le mécanisme de migration Supabase
  (`apply_migration`), **jamais** `execute_sql` — sinon elle manque à
  `supabase_migrations.schema_migrations` (voir l'écart du 27/09, corrigé).
- Le schéma de production se modifie uniquement par fichier versionné dans
  `supabase/migrations/`, appliqué puis enregistré dans l'historique.
- Aucun secret dans le dépôt : `.env.local`, `.dev.vars` et `wrangler secret`
  uniquement. Les clés visibles dans `wrangler.jsonc` sont publiques par
  conception (clé anon sous RLS).

## 4. Encadrement des pages : trois directives à changer ensemble

Depuis le 7 octobre 2026, pour que l'aperçu vivant de `/system/design`
(palier 4) puisse afficher l'accueil dans un iframe de même origine :

```
X-Frame-Options: SAMEORIGIN      (était DENY)
frame-ancestors 'self'           (était 'none')
frame-src 'self' https://challenges.cloudflare.com   ('self' ajouté)
```

**Les deux directives CSP ne font pas le même travail.** `frame-ancestors`
dit qui peut encadrer cette page ; `frame-src` dit ce que cette page peut
embarquer. Un aperçu de même origine exige **les deux**. Corriger l'une en
laissant l'autre n'a aucun effet — c'est l'erreur commise le 7 octobre, où
`frame-ancestors` a été mise à jour et que l'aperçu est resté vide, le vrai
verrou étant `frame-src`.

**Ce qui reste protégé :** le clickjacking. Un site extérieur ne peut pas
encadrer aucune page de Speedfood — `/system`, `/restaurant` ni le site public.

**Ce qui a changé :** une page du site peut encadrer une autre page du même
site, et le site peut embarquer ses propres pages. Cela suppose déjà une
injection de script sur l'origine (un XSS), plus grave que du clickjacking et
que ces en-têtes n'empêchaient pas davantage auparavant.

**Si l'aperçu devait être abandonné**, remettre `'none'`, `DENY` et retirer
`'self'` de `frame-src` : tout est dans `next.config.ts`, sans autre effet.

## 5. Comptes et tests

- Les comptes de test se créent, se signalent dans `docs/STATUT-PROJET.md`, puis
  se nettoient en base après vérification. Jamais de rôle `super_admin` sur un
  compte de test (règle TDR).
- La vérification d'un bloc n'est valable que si elle est **exécutée** (typecheck,
  lint, build, test navigateur/réel) et documentée avec ses résultats réels — pas
  un « à faire ».

## 6. Déploiement

- Application : `npm.cmd run cf:deploy` (build OpenNext + `wrangler deploy` sur
  `speedfood-app`) — voir `docs/DEPLOIEMENT-CLOUDFLARE.md`.
- Landing/prototype : `wrangler pages deploy dist --project-name speedfood`
  depuis un dossier `dist/` construit à partir de `demo/` (voir `demo/README.md`).
- Tout déploiement est consigné dans `docs/STATUT-PROJET.md`.
