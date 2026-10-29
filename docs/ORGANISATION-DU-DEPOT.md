# Organisation du dépôt : le site (`web/`) et l'application (`mobile/`) (29 octobre 2026)

Le dépôt contient **deux codes distincts**, chacun dans son dossier, plus ce qu'ils partagent.

| Dossier | Contenu | Où l'on travaille |
|---|---|---|
| **`web/`** | Le site et son serveur : Next.js (`src/`), fichiers publics dont l'APK (`public/`), scripts et tests (`scripts/`), `package.json`, configuration Next.js, Cloudflare et OpenNext, Worker (`worker-entree.js`, `worker-smtp.js`), `.env.example` | `cd web` puis `npm run …` |
| **`mobile/`** | L'application Android et iPhone (Kotlin Multiplatform) : `shared/`, `androidApp/`, `iosApp/`, `desktopApp/`, plus **`faux-serveur/`** (serveur factice pour l'émulateur) | `cd mobile` puis `./gradlew …` |
| **`supabase/`** | La base de données, partagée par les deux : migrations, essais de concurrence, rejeu | à la racine |
| **`docs/`**, **`demo/`** | La documentation et le prototype de démonstration | à la racine |
| **`.github/`** | L'intégration continue (compilation iPhone sur macOS) | à la racine |

## Où est passé chaque fichier (avant → après)

| Avant | Après |
|---|---|
| `src/`, `public/`, `scripts/` | `web/src/`, `web/public/`, `web/scripts/` |
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `open-next.config.ts`, `eslint.config.mjs`, `wrangler.jsonc` | dans `web/` |
| `worker-entree.js`, `worker-smtp.js`, `.env.example`, `.dev.vars.example`, `AGENTS.md` | dans `web/` |
| `.env.local`, `node_modules/`, `.next/`, `.open-next/`, `.wrangler/` (non suivis par Git) | dans `web/` |
| `scripts/faux-serveur-*.mjs` | `mobile/faux-serveur/faux-serveur-*.mjs` |
| `RAPPORT-L4-SUPPORT.md` | `docs/RAPPORT-L4-SUPPORT.md` |
| `supabase/`, `docs/`, `demo/`, `mobile/` | inchangés |

**Les documents plus anciens citent les anciens chemins** (`src/…`, `public/…`, `scripts/…`, `node scripts/faux-serveur-application.mjs`). Lisez-les avec cette table : `src/` signifie `web/src/`, et ainsi de suite. Ils ne sont pas tous réécrits, pour ne pas fausser leur historique.

## Commandes : à lancer depuis `web/`

```bash
cd web
npm run dev            # serveur local
npm run typecheck      # types
npm run test:unit      # tests purs
npm run test:cloisonnement
npm run cf:build       # construction Cloudflare, sans déployer
npm run cf:deploy      # construction + déploiement (feu vert explicite de Malika requis)
```

Le faux serveur de l'émulateur se lance depuis la racine du dépôt : `node mobile/faux-serveur/faux-serveur-application.mjs`.

## Ce qui a dû changer dans le code
- Les scripts et tests de `web/` qui lisent `supabase/migrations` ou `mobile/androidApp/build.gradle.kts` remontent d'un niveau (`../supabase`, `../mobile`).
- `supabase/concurrence/simulation-journee.mjs` lit `web/src/…`.
- `.gitignore` : les règles `/node_modules`, `/.next/`, `/.open-next/`, `/.wrangler/` visent `web/`.
- `.claude/launch.json` lance `npm --prefix web run dev`.
- Rien ne change en production : le Worker `speedfood-app` et la base sont les mêmes.

## Vérifié le 29 octobre 2026 (sur la branche de séparation)
`tsc`, `eslint`, `npm run test:unit`, `npm run test:cloisonnement`, `node scripts/verifier-base.mjs` (84 tables lues), `next build` et `npm run cf:build`, tous depuis `web/`, sans erreur. **Aucun déploiement n'a été fait pour cette séparation.**
