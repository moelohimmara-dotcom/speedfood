# Organisation du dépôt : le site (`apps/web/`) et l'application (`mobile/`) (29 octobre 2026)

Le dépôt contient **deux codes distincts**, chacun dans son dossier, plus ce qu'ils partagent.

| Dossier | Contenu | Où l'on travaille |
|---|---|---|
| **`apps/web/`** | Le site et son serveur : Next.js (`src/`), fichiers publics dont l'APK (`public/`), scripts et tests (`scripts/`), `package.json`, configuration Next.js, Cloudflare et OpenNext, Worker (`worker-entree.js`, `worker-smtp.js`), `.env.example` | `cd apps/web` puis `npm run …` ; `npm install` à la racine |
| **`mobile/`** | L'application Android et iPhone (Kotlin Multiplatform) : `shared/`, `androidApp/`, `iosApp/`, `desktopApp/`, plus **`faux-serveur/`** (serveur factice pour l'émulateur) | `cd mobile` puis `./gradlew …` |
| **`supabase/`** | La base de données, partagée par les deux : migrations, essais de concurrence, rejeu | à la racine |
| **`docs/`**, **`demo/`** | La documentation et le prototype de démonstration | à la racine |
| **`.github/`** | L'intégration continue (compilation iPhone sur macOS) | à la racine |

## Où est passé chaque fichier (avant → après)

| Avant | Après |
|---|---|
| `src/`, `public/`, `scripts/` | `apps/web/src/`, `apps/web/public/`, `apps/web/scripts/` |
| `package.json` (nommé `@speedfood/web`), `tsconfig.json`, `next.config.ts`, `open-next.config.ts`, `eslint.config.mjs`, `wrangler.jsonc` | dans `apps/web/` |
| `worker-entree.js`, `worker-smtp.js`, `.env.example`, `.dev.vars.example`, `AGENTS.md` | dans `apps/web/` |
| `package-lock.json` | à la racine du dépôt (verrou unique de l'espace de travail npm) |
| `.env.local`, `.next/`, `.open-next/`, `.wrangler/` (non suivis par Git) | dans `apps/web/` |
| `node_modules/` (non suivi par Git) | à la racine (les paquets sont installés par l'espace de travail) |
| `scripts/faux-serveur-*.mjs` | `mobile/faux-serveur/faux-serveur-*.mjs` |
| `RAPPORT-L4-SUPPORT.md` | `docs/RAPPORT-L4-SUPPORT.md` |
| `supabase/`, `docs/`, `demo/`, `mobile/` | inchangés |

**Les documents plus anciens citent les anciens chemins** (`src/…`, `public/…`, `scripts/…`, `node scripts/faux-serveur-application.mjs`). Lisez-les avec cette table : `src/` signifie `apps/web/src/`, et ainsi de suite. Ils ne sont pas tous réécrits, pour ne pas fausser leur historique.

## Commandes : à lancer depuis `apps/web/`

Les commandes `npm run …` se lancent depuis `apps/web` ; `npm install` se lance **à la racine** (espaces de travail). `typecheck`, `test:unit` et `test:cloisonnement` se lancent aussi depuis la racine.

```bash
npm install            # à la racine du dépôt
cd apps/web
npm run dev            # serveur local
npm run typecheck      # types
npm run test:unit      # tests purs
npm run test:cloisonnement
npm run cf:build       # construction Cloudflare, sans déployer
npm run cf:deploy      # construction + déploiement (feu vert explicite de Malika requis)
```

Le faux serveur de l'émulateur se lance depuis la racine du dépôt : `node mobile/faux-serveur/faux-serveur-application.mjs`.

## Ce qui a dû changer dans le code
- Les scripts et tests de `apps/web/` qui lisent `supabase/migrations` ou `mobile/androidApp/build.gradle.kts` remontent de deux niveaux depuis le passage à `apps/web` (`../../supabase`, `../../mobile`) ; avant, un seul (`../supabase`, `../mobile`).
- `supabase/concurrence/simulation-journee.mjs` lit `apps/web/src/…`.
- `.gitignore` : les règles `/apps/web/node_modules`, `/apps/web/.next/`, `/apps/web/.open-next/`, `/apps/web/.wrangler/` visent `apps/web/`, et `/node_modules` vise la racine.
- `.claude/launch.json` lance `npm --prefix apps/web run dev` (avant le 31 octobre 2026 : `--prefix web`).
- Rien ne change en production : le Worker `speedfood-app` et la base sont les mêmes.

## Paquets partagés (étape 0 de la refonte)

Depuis l'étape 0 de la refonte d'architecture (30 octobre 2026), le dépôt est un espace de travail npm : le site est dans `apps/web/`, `npm install` se lance à la racine, et les règles pures partagées vivent dans `packages/shared/` (paquet `@speedfood/shared`, avec des raccords d'une ligne à leur ancienne place dans le site). Détails, règle de pureté et outil de déplacement : `packages/shared/README.md`. Cible d'ensemble : `docs/specs/2026-10-30-architecture-cible-design.md`.

- `mobile/` n'a **pas** été déplacé : il reste en place jusqu'au gel de Kotlin.
- L'ancien dossier `web/` peut subsister, vide, sur le disque : un verrou externe empêche sa suppression. À supprimer à la main quand l'application qui le tient sera fermée (Git ne le suit pas).

## Vérifié le 29 octobre 2026 (sur la branche de séparation)
`tsc`, `eslint`, `npm run test:unit`, `npm run test:cloisonnement`, `node scripts/verifier-base.mjs` (84 tables lues), `next build` et `npm run cf:build`, tous depuis `apps/web/`, sans erreur. **Aucun déploiement n'a été fait pour cette séparation.**
