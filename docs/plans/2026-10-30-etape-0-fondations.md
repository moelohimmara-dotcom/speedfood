# Étape 0, fondations : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-compétence requise : `subagent-driven-development` (recommandé) ou `executing-plans`. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** organiser le dépôt en `apps/` et `packages/`, déplacer un premier lot de règles pures dans un paquet partagé `@speedfood/shared`, et poser un contrôle automatique à chaque modification, **sans aucun changement visible pour les utilisateurs**.

**Architecture :** espaces de travail npm (aucun outil nouveau). Le site passe de `web/` à `apps/web`. Un paquet `packages/shared` en TypeScript source (jamais compilé) est consommé par le site via `transpilePackages`. Chaque fichier déplacé laisse à son ancienne place un **raccord d'une ligne** (`export * from "@speedfood/shared/…"`) : les 108 fichiers qui importent les contrats, par exemple, n'ont pas à changer. Le lanceur de tests apprend à suivre ces raccords.

**Pile :** npm 11 (espaces de travail), Next.js 16 avec OpenNext Cloudflare, TypeScript 5, Node 22 en contrôle automatique, GitHub Actions.

Design de référence : `docs/specs/2026-10-30-architecture-cible-design.md` (approuvé par Malika le 30 octobre 2026), §9 étape 0.

## Contraintes globales

Copiées du design et de `CLAUDE.md` ; elles s'appliquent à chaque tâche.

- Un seul dépôt TypeScript : `apps/` et `packages/`.
- **Le déploiement en production reste manuel**, avec le feu vert explicite de Malika (D10). Ce plan ne déploie rien sans cette phrase de sa part dans la conversation.
- Aucune dépense, aucun compte ni projet cloud sans consigne explicite de Malika.
- Le pilote ne s'arrête jamais : à l'étape 0, **les utilisateurs ne voient rien**.
- Aucune fonction n'est « livrée » sans essai de bout en bout.
- Aucune donnée sensible (mot de passe, clé, jeton) dans le code, les commits ou les journaux ; `.env.local` n'est jamais commité.
- Montants en GNF : entiers, jamais en flottant.
- Un exit code `0` est exigé pour dire qu'une vérification passe (grep d'échecs insuffisant : le test écrit « ECHEC » sans accent et un plantage n'écrit rien).
- Écrire les fichiers contenant des antislashs avec l'outil d'écriture de fichiers, jamais avec une commande `node -e` ou un heredoc.

## Écarts assumés par rapport au design

1. **`mobile/` reste en place** (il ne devient pas `legacy/` maintenant). Le projet Gradle, la compilation iPhone et les documents s'y réfèrent ; le déplacer n'apporte rien tant que Kotlin n'est pas gelé (D8). Le renommage se fera au gel.
2. **`apps/api`, `apps/mobile`, `packages/api-client` et les types de base de données** ne sont pas créés ici : ils arrivent aux étapes 1 et 2.
3. **Pas de Turborepo ni de pnpm** : les espaces de travail npm suffisent (YAGNI). On pourra en ajouter un si la durée des contrôles l'exige.

## Hors périmètre de l'étape 0

L'API unique, l'application React Native, SQLite, le déplacement des autres règles pures (une quarantaine de fichiers restent dans `apps/web/src/lib`, un lot à la fois plus tard), tout changement de comportement.

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `.github/workflows/controles.yml` | Créer | Types, lint, tests purs et cloisonnement à chaque modification, sans déployer |
| `package.json` (racine) | Créer | Déclare les espaces de travail et trois scripts de confort |
| `package-lock.json` (racine) | Déplacer depuis `web/` | Verrou unique des dépendances |
| `apps/web/**` | Déplacer depuis `web/` | Le site, inchangé |
| `packages/shared/package.json` | Créer | Nom `@speedfood/shared`, motif d'export `./*` → `./src/*.ts` |
| `packages/shared/tsconfig.json` | Créer | Types stricts, **sans** types Node ni DOM : une dépendance cachée ne compile pas |
| `packages/shared/src/**` | Créer (par déplacement) | Les règles pures |
| `apps/web/next.config.ts` | Modifier | `transpilePackages: ["@speedfood/shared"]` |
| `apps/web/scripts/tests/lancer.mjs` | Modifier | Suit les raccords et copie les fichiers du paquet dans le dossier temporaire |
| `apps/web/scripts/tests/paquet-partage.test.mts` | Créer | Garde-fou : pureté du paquet, raccord d'une ligne pour chaque fichier déplacé |
| `apps/web/scripts/deplacer-vers-partage.mjs` | Créer | Outil qui déplace un fichier et laisse son raccord |
| `apps/web/src/lib/<chemin>.ts` (10 fichiers) | Remplacer par un raccord | Voir Tâche 4 |
| `docs/…`, `CLAUDE.md`, `.gitignore`, `.claude/launch.json`, `.github/workflows/ios.yml` | Modifier | Nouveaux chemins |

---

### Tâche 1 : Contrôle automatique sur GitHub (disposition actuelle)

On pose le filet de sécurité **avant** de rien déplacer.

**Fichiers :**
- Créer : `.github/workflows/controles.yml`

**Interfaces :**
- Consomme : les scripts existants de `web/package.json` (`test:unit`, `test:cloisonnement`) et `supabase/rejeu/package.json`.
- Produit : un contrôle GitHub nommé « Contrôles » que les tâches 2 et 3 réutilisent et mettent à jour.

- [ ] **Étape 1 : Écrire le contrôle**

```yaml
name: Contrôles

# Vérifie le site à chaque modification : types, qualité du code, tests purs et tests de cloisonnement des règles de la base.
# Ne déploie JAMAIS rien : la mise en production reste un geste manuel avec le feu vert de Malika.
on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

concurrency:
  group: controles-${{ github.ref }}
  cancel-in-progress: true

jobs:
  site:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: |
            web/package-lock.json
            supabase/rejeu/package-lock.json

      - name: Installer le site
        working-directory: web
        run: npm ci

      - name: Installer l'outil de rejeu des migrations
        working-directory: supabase/rejeu
        run: npm ci

      - name: Types
        working-directory: web
        run: npx tsc --noEmit

      - name: Qualité du code
        working-directory: web
        run: npx eslint

      - name: Tests purs
        working-directory: web
        run: npm run test:unit

      - name: Tests de cloisonnement
        working-directory: web
        run: npm run test:cloisonnement
```

- [ ] **Étape 2 : Enregistrer et lancer**

```bash
cd /c/Users/moelo/dev/speedfood
git add .github/workflows/controles.yml
git commit -m "Contrôle automatique : types, lint, tests purs et cloisonnement à chaque modification

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Étape 3 : Lire le résultat**

L'API de GitHub est limitée à 60 requêtes par heure sans jeton : ouvrir la page de l'essai dans Claude in Chrome (`https://github.com/moelohimmara-dotcom/speedfood/actions`) et lire l'étape en échec avec `get_page_text`.

Résultat attendu : toutes les étapes vertes.

- [ ] **Étape 4 : Si une étape échoue uniquement sur GitHub**

Corriger la **cause**, jamais en retirant l'étape. Deux causes probables et leur remède exact :
- Types Next manquants (`next-env.d.ts` est ignoré par Git) : ajouter, avant « Types », une étape `run: npx next typegen` avec `working-directory: web`.
- Module natif absent sur Linux (verrou produit sous Windows) ou `npm ci` en échec : remplacer `npm ci` par `npm install --no-audit --no-fund` dans l'étape « Installer le site » ; le verrou reste la référence.
- Test dépendant d'un chemin Windows : corriger le test pour qu'il accepte les deux systèmes.

Recommit, repousser, relire. Ne pas passer à la Tâche 2 tant que le contrôle n'est pas vert sur `master`.

---

### Tâche 2 : Espace de travail npm et déplacement `web/` → `apps/web`

**Fichiers :**
- Créer : `package.json` (racine)
- Déplacer : `web/` → `apps/web/` ; `apps/web/package-lock.json` → `package-lock.json`
- Modifier : `apps/web/package.json`, `apps/web/scripts/**` (chemins), `supabase/concurrence/simulation-journee.mjs`, `.gitignore`, `.claude/launch.json`, `.github/workflows/ios.yml`, `.github/workflows/controles.yml`, documents (`CLAUDE.md` et `docs/*.md` listés à l'étape 9)

**Interfaces :**
- Consomme : le contrôle de la Tâche 1.
- Produit : le site vit dans `apps/web` ; commandes `npm run …` depuis `apps/web` ou, pour `typecheck`, `test:unit` et `test:cloisonnement`, depuis la racine ; le verrou est à la racine.

- [ ] **Étape 1 : Créer la branche et relever les versions de référence**

```bash
cd /c/Users/moelo/dev/speedfood
git checkout -b etape-0-fondations
export SCRATCH="/c/Users/moelo/AppData/Local/Temp/claude/C--Users-moelo-dev-speedfood/f41c099b-85fd-4585-94ea-4363c023c417/scratchpad"
cd web
npm ls --depth=0 --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(Object.entries(j.dependencies).map(([n,v])=>n+'@'+v.version).sort().join('\n'))})" > "$SCRATCH/avant.txt"
wc -l "$SCRATCH/avant.txt"
```

Résultat attendu : un nombre de lignes égal au nombre de dépendances directes (dépendances et devDependencies réunies, environ 21).

- [ ] **Étape 2 : Déplacer le site et son verrou**

`git mv` d'un dossier renomme aussi les fichiers non suivis qu'il contient (`.env.local`, `node_modules`, `.next`, `.open-next`, `.wrangler`) : rien à recopier à la main.

```bash
cd /c/Users/moelo/dev/speedfood
mkdir apps
git mv web apps/web
git mv apps/web/package-lock.json package-lock.json
ls -a apps/web | head -30
test -f apps/web/.env.local && echo ".env.local présent"
```

Résultat attendu : `apps/web` contient `src`, `scripts`, `public`, `wrangler.jsonc`, `.env.local`, etc.

- [ ] **Étape 3 : Créer le `package.json` de la racine** (outil d'écriture de fichiers)

```json
{
  "name": "speedfood",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test:unit": "npm run test:unit --workspace @speedfood/web",
    "test:cloisonnement": "npm run test:cloisonnement --workspace @speedfood/web"
  }
}
```

- [ ] **Étape 4 : Renommer le paquet du site**

Dans `apps/web/package.json`, remplacer `"name": "speedfood"` par `"name": "@speedfood/web"`. Vérifier qu'il n'y a pas d'autre occurrence à changer :

```bash
cd /c/Users/moelo/dev/speedfood
grep -n '"name"' apps/web/package.json
```

Résultat attendu : une seule ligne, `"name": "@speedfood/web"`.

- [ ] **Étape 5 : Corriger les chemins qui remontent à la racine du dépôt**

Le site est un niveau plus bas : chaque `..` vers `supabase` ou `mobile` en gagne un.

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
sed -i 's#(racine, "\.\.", "supabase"#(racine, "..", "..", "supabase"#g' scripts/export/exporter.mjs scripts/export/verifier-restauration.mjs scripts/tests/cloisonnement.mjs scripts/tests/design.test.mts scripts/tests/paiement-en-ligne.test.mts scripts/tests/verifierbase.test.mts scripts/verifier-base.mjs
sed -i 's#"\.\./\.\./\.\./supabase/migrations"#"../../../../supabase/migrations"#' scripts/base/test-reinitialisation.mjs
sed -i 's#join(racine, "\.\./supabase/#join(racine, "../../supabase/#g; s#lire(`\.\./supabase/#lire(`../../supabase/#g' scripts/tests/accueil.test.mts
sed -i 's#(racine, "\.\./mobile/androidApp#(racine, "../../mobile/androidApp#' scripts/tests/version-app.test.mts
sed -i 's#"node \.\./supabase/concurrence/#"node ../../supabase/concurrence/#' package.json
sed -i 's#path.join(RACINE, "web", "src", "lib"#path.join(RACINE, "apps", "web", "src", "lib"#' ../../supabase/concurrence/simulation-journee.mjs
echo "== restes d'anciens chemins (attendu : aucune ligne)"
grep -rnE '"\.\./supabase|"\.\./mobile|\(racine, "\.\.", "supabase"|"\.\./\.\./\.\./supabase' scripts package.json | grep -v node_modules
```

Résultat attendu : le dernier `grep` n'affiche rien. Si une ligne s'affiche, la corriger de la même manière.

- [ ] **Étape 6 : Mettre à jour la configuration autour**

```bash
cd /c/Users/moelo/dev/speedfood
sed -i 's#^/web/#/apps/web/#; s#^web/scripts/#apps/web/scripts/#' .gitignore
printf '\n# Dépendances de l espace de travail (racine)\n/node_modules\n' >> .gitignore
sed -i 's#"web"#"apps/web"#' .claude/launch.json
sed -i 's#web/wrangler\.jsonc#apps/web/wrangler.jsonc#g' .github/workflows/ios.yml
grep -n "web" .gitignore .claude/launch.json | head -12
grep -c "apps/web/wrangler.jsonc" .github/workflows/ios.yml
```

Résultat attendu : `.gitignore` ne contient plus de `/web/` ; `launch.json` contient `"apps/web"` deux fois ; `ios.yml` : au moins 2 occurrences.

Réécrire `.github/workflows/controles.yml` (outil d'écriture de fichiers) pour l'espace de travail :

```yaml
name: Contrôles

# Vérifie le site à chaque modification : types, qualité du code, tests purs et tests de cloisonnement des règles de la base.
# Ne déploie JAMAIS rien : la mise en production reste un geste manuel avec le feu vert de Malika.
on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

concurrency:
  group: controles-${{ github.ref }}
  cancel-in-progress: true

jobs:
  site:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: |
            package-lock.json
            supabase/rejeu/package-lock.json

      - name: Installer les paquets (site et paquets partagés)
        run: npm ci

      - name: Installer l'outil de rejeu des migrations
        working-directory: supabase/rejeu
        run: npm ci

      - name: Types
        run: npm run typecheck

      - name: Qualité du code
        working-directory: apps/web
        run: npx eslint

      - name: Tests purs
        run: npm run test:unit

      - name: Tests de cloisonnement
        run: npm run test:cloisonnement
```

(Si la Tâche 1 a imposé `npm install --no-audit --no-fund` au lieu de `npm ci`, garder la même substitution ici.)

- [ ] **Étape 7 : Réinstaller depuis la racine et comparer les versions**

```bash
cd /c/Users/moelo/dev/speedfood
rm -rf apps/web/node_modules
npm install --no-audit --no-fund
cd apps/web
npm ls --depth=0 --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(Object.entries(j.dependencies).map(([n,v])=>n+'@'+v.version).sort().join('\n'))})" > "$SCRATCH/apres.txt"
diff "$SCRATCH/avant.txt" "$SCRATCH/apres.txt" && echo "versions identiques"
```

Résultat attendu : `versions identiques`. Si `diff` affiche des lignes, **arrêter** : une dépendance a changé de version pendant la réinstallation. Revenir au verrou d'origine (`git checkout -- package-lock.json` après avoir remis le fichier avec `git mv`, puis `npm ci` depuis la racine) et traiter l'écart avant de continuer.

- [ ] **Étape 8 : Vérifier que tout marche à la nouvelle adresse**

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
npx tsc --noEmit; echo "tsc=$?"
npm run test:unit > "$SCRATCH/unit.log" 2>&1; echo "unit=$?"
npm run test:cloisonnement > "$SCRATCH/clois.log" 2>&1; echo "cloisonnement=$?"
node scripts/verifier-base.mjs 2>&1 | tail -1
npm run cf:build > "$SCRATCH/cfbuild.log" 2>&1; echo "cf:build=$?"
```

Résultat attendu : `tsc=0`, `unit=0`, `cloisonnement=0`, « Base vérifiée : les 84 tables attendues sont présentes. », `cf:build=0`. Si un code est différent de 0, lire le journal correspondant dans `$SCRATCH`, corriger la cause (le plus souvent un chemin oublié à l'étape 5), recommencer cette étape.

- [ ] **Étape 9 : Mettre à jour les documents**

```bash
cd /c/Users/moelo/dev/speedfood
sed -i 's#`web/#`apps/web/#g' CLAUDE.md README.md docs/ORGANISATION-DU-DEPOT.md docs/REPRISE-SESSION.md docs/APPLICATION-ANDROID.md docs/PASSATION.md docs/REDIS-UPSTASH.md docs/STATUT-PROJET.md docs/NATIF-PLAN.md
sed -i 's#^@web/AGENTS\.md#@apps/web/AGENTS.md#' CLAUDE.md
echo "== restes (à examiner une par une)"
grep -nE '(^|[^s/])web/' CLAUDE.md docs/ORGANISATION-DU-DEPOT.md | grep -v "apps/web" | head
```

Dans `CLAUDE.md` et `docs/ORGANISATION-DU-DEPOT.md`, remplacer à la main, avec l'outil d'édition, les phrases qui décrivent l'organisation (« web/ et mobile/ ») par « `apps/web` (le site) et `mobile/` (l'application) », et ajouter la ligne : « Les commandes `npm run …` se lancent depuis `apps/web` ; `npm install` se lance **à la racine** (espaces de travail). » Lancer ensuite `grep -n "web/" CLAUDE.md` : chaque occurrence restante doit être soit `apps/web/`, soit une mention historique volontaire.

- [ ] **Étape 10 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git add -A
git status --short | grep -v '^R ' | head -20
git commit -m "Espace de travail npm : le site passe de web/ à apps/web, verrou à la racine, chemins et contrôle automatique mis à jour

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Résultat attendu : le `grep -v` n'affiche que des fichiers modifiés ou ajoutés connus (`package.json`, `.gitignore`, documents, scripts, workflows), jamais de dossier `node_modules`, `.env.local` ni `.next`.

---

### Tâche 3 : Le paquet partagé, le lanceur de tests et le premier fichier (`contracts/statuts`)

On prouve le mécanisme complet avec **un seul** fichier avant de déplacer les autres.

**Fichiers :**
- Créer : `packages/shared/package.json`, `packages/shared/tsconfig.json`, `apps/web/scripts/tests/paquet-partage.test.mts`
- Déplacer : `apps/web/src/lib/contracts/statuts.ts` → `packages/shared/src/contracts/statuts.ts` (raccord laissé en place)
- Modifier : `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/scripts/tests/lancer.mjs`

**Interfaces :**
- Consomme : l'espace de travail de la Tâche 2.
- Produit : l'import `@speedfood/shared/<chemin sans .ts>` résout vers `packages/shared/src/<chemin>.ts` (type-check, compilation Next et tests purs) ; le garde-fou `paquet-partage.test.mts` contrôle automatiquement chaque fichier que la Tâche 4 déplacera.

- [ ] **Étape 1 : Écrire le test qui échoue**

Créer `apps/web/scripts/tests/paquet-partage.test.mts` (outil d'écriture de fichiers) :

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { transitionAutorisee } from "../../src/lib/contracts/statuts";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

const racine = process.env.SPEEDFOOD_RACINE ?? process.cwd();
const partage = join(racine, "..", "..", "packages", "shared", "src");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier)
    .flatMap((nom) => {
      const chemin = join(dossier, nom);
      return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
    })
    .filter((f) => f.endsWith(".ts"));
}

const liste = existsSync(partage) ? fichiers(partage).map((f) => relative(partage, f).split("\\").join("/")) : [];
verifier("le paquet partagé contient au moins un fichier", liste.length > 0, true);

// Un fichier du paquet doit rester pur : aucune dépendance au site, à Next, à Supabase, à React, à Node ni à l'environnement.
const INTERDITS: [RegExp, string][] = [
  [/from\s+"@\//, "alias @/ du site"],
  [/server-only/, "server-only"],
  [/from\s+"next/, "next"],
  [/from\s+"@supabase/, "@supabase"],
  [/from\s+"react/, "react"],
  [/from\s+"node:/, "node:"],
  [/process\.env/, "process.env"],
  [/"use (client|server)"/, "directive use client ou use server"],
  [/@speedfood\/shared/, "auto-référence au paquet"],
];

for (const fichier of liste) {
  const texte = readFileSync(join(partage, fichier), "utf8");
  const trouves = INTERDITS.filter(([motif]) => motif.test(texte)).map(([, nom]) => nom);
  verifier(`pur : ${fichier}`, trouves, []);

  // L'ancien emplacement, dans le site, ne contient plus qu'un raccord d'une ligne.
  const raccord = join(racine, "src", "lib", fichier);
  const attendu = `export * from "@speedfood/shared/${fichier.replace(/\.ts$/, "")}";`;
  verifier(`raccord d'une ligne : src/lib/${fichier}`, existsSync(raccord) ? readFileSync(raccord, "utf8").trim() : "(absent)", attendu);
}

const manifeste = JSON.parse(readFileSync(join(partage, "..", "package.json"), "utf8")) as { name: string; exports: unknown };
verifier("nom du paquet", manifeste.name, "@speedfood/shared");
verifier("exports du paquet : un motif pour tous les fichiers source", manifeste.exports, { "./*": "./src/*.ts" });
verifier("règle partagée atteignable par l'ancien chemin du site", transitionAutorisee("en_attente", "annulee"), true);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\npaquet partagé : tous les contrôles passent");
```

- [ ] **Étape 2 : Enregistrer le test dans le lanceur**

Dans `apps/web/scripts/tests/lancer.mjs`, ajouter après la ligne `copier("scripts/tests/annulation-client.test.mts");` :

```js
copier("scripts/tests/paquet-partage.test.mts");
```

et ajouter `"paquet-partage"` dans la liste des noms de la boucle finale, juste après `"annulation-client"`.

- [ ] **Étape 3 : Lancer pour constater l'échec**

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
npm run test:unit > "$SCRATCH/unit.log" 2>&1; echo "unit=$?"
grep -E "paquet-partage|paquet partagé|ECHEC|Error" "$SCRATCH/unit.log" | head
```

Résultat attendu : `unit` différent de 0, avec « le paquet partagé contient au moins un fichier » en échec (le dossier n'existe pas encore).

- [ ] **Étape 4 : Créer le paquet** (outil d'écriture de fichiers pour les deux fichiers)

`packages/shared/package.json` :

```json
{
  "name": "@speedfood/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Règles pures de Speedfood (statuts, prix, disponibilité, formats), partagées entre le site, l'API et l'application. Aucune dépendance au site, à Next, à Supabase, à React ni à Node.",
  "exports": {
    "./*": "./src/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

`packages/shared/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src/**/*.ts"]
}
```

`"types": []` et l'absence de `dom` dans `lib` sont voulus : un fichier qui utiliserait `process`, `console` ou `window` ne compile pas, donc ne peut pas entrer dans le paquet par erreur.

- [ ] **Étape 5 : Déclarer la dépendance et la transpilation côté site**

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.dependencies['@speedfood/shared']='*';p.dependencies=Object.fromEntries(Object.entries(p.dependencies).sort(([a],[b])=>a.localeCompare(b)));fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
grep -n "@speedfood/shared" package.json
```

Résultat attendu : une ligne `"@speedfood/shared": "*"`.

Dans `apps/web/next.config.ts`, avec l'outil d'édition : remplacer

```ts
  poweredByHeader: false,
```

par

```ts
  poweredByHeader: false,
  // Le paquet partagé est livré en TypeScript source (jamais compilé à part) : Next le transpile avec le site.
  transpilePackages: ["@speedfood/shared"],
```

- [ ] **Étape 6 : Apprendre au lanceur de tests à suivre les raccords**

Dans `apps/web/scripts/tests/lancer.mjs`, remplacer la fonction `copier` (de `function copier(rel) {` jusqu'à son `}` fermant) par le bloc suivant, et ajouter juste avant elle les deux constantes :

```js
const racinePartage = join(racine, "..", "..", "packages", "shared", "src");
const dejaCopies = new Set();

function versRelatif(depuis, vers) {
  const r = relative(dirname(depuis), vers).split("\\").join("/");
  return r.startsWith(".") ? r : "./" + r;
}

// Réécrit les imports pour qu'ils tiennent dans le dossier temporaire : suffixe « .ts » exigé par Node, alias « @/ » du site, et paquet partagé
// « @speedfood/shared/<chemin> » (dont le fichier est copié au passage, avec ses propres imports).
function transformer(contenu, dest) {
  return contenu
    .replace(/(from\s+"\.{1,2}\/[^"]+?)(?<!\.ts)"/g, '$1.ts"')
    .replace(/from\s+"(zod\/mini)"/g, (_, nom) => `from "${paquets[nom]}"`)
    // Alias `@/` du projet : réécrit en chemin relatif vers la copie (les imports de types disparaissent de toute façon à l'exécution).
    .replace(/from\s+"@\/([^"]+?)(?<!\.ts)"/g, (_, chemin) => {
      const relatif = relative(dirname(dest), join(tmp, "src")).split("\\").join("/");
      return `from "${relatif.startsWith(".") ? relatif : "./" + relatif}/${chemin}.ts"`;
    })
    .replace(/from\s+"@speedfood\/shared\/([^"]+?)"/g, (_, chemin) => {
      copierPartage(chemin);
      return `from "${versRelatif(dest, join(tmp, "packages", "shared", "src", `${chemin}.ts`))}"`;
    });
}

function copierPartage(chemin) {
  const dest = join(tmp, "packages", "shared", "src", `${chemin}.ts`);
  if (dejaCopies.has(dest)) return;
  dejaCopies.add(dest);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, transformer(readFileSync(join(racinePartage, `${chemin}.ts`), "utf8"), dest));
}

function copier(rel) {
  const dest = join(tmp, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, transformer(readFileSync(join(racine, rel), "utf8"), dest));
}
```

- [ ] **Étape 7 : Déplacer le premier fichier et laisser son raccord**

```bash
cd /c/Users/moelo/dev/speedfood
mkdir -p packages/shared/src/contracts
git mv apps/web/src/lib/contracts/statuts.ts packages/shared/src/contracts/statuts.ts
printf 'export * from "@speedfood/shared/contracts/statuts";\n' > apps/web/src/lib/contracts/statuts.ts
npm install --no-audit --no-fund
ls -l node_modules/@speedfood/
```

Résultat attendu : `node_modules/@speedfood/` contient des liens `shared` et `web` vers `packages/shared` et `apps/web`.

- [ ] **Étape 8 : Vérifier**

```bash
cd /c/Users/moelo/dev/speedfood
npm run typecheck; echo "typecheck=$?"
cd apps/web
npm run test:unit > "$SCRATCH/unit.log" 2>&1; echo "unit=$?"
grep -E "ECHEC|Error" "$SCRATCH/unit.log" | head
grep -E "pur : contracts/statuts|raccord d'une ligne|paquet partagé : tous" "$SCRATCH/unit.log"
npx next build > "$SCRATCH/build.log" 2>&1; echo "next build=$?"
```

Résultat attendu : `typecheck=0`, `unit=0`, trois lignes « OK » du garde-fou plus « paquet partagé : tous les contrôles passent », `next build=0`. Si `next build` échoue sur l'import du paquet, vérifier `transpilePackages` (étape 5) et la présence du lien dans `node_modules/@speedfood`.

- [ ] **Étape 9 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git add -A
git commit -m "Paquet partagé @speedfood/shared : squelette, garde-fou de pureté, lanceur de tests qui suit les raccords, premier fichier déplacé (statuts)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tâche 4 : L'outil de déplacement et les dix autres fichiers du premier lot

**Fichiers :**
- Créer : `apps/web/scripts/deplacer-vers-partage.mjs`
- Déplacer (avec raccord) : `contracts/erreurs`, `contracts/menu`, `contracts/restaurant`, `paiement/regles`, `contracts/commande`, `contracts/index`, `commande/estimation`, `commande/mode`, `commande/telephone`, `disponibilite/etat` (tous sous `apps/web/src/lib/`)

**Interfaces :**
- Consomme : le paquet, le lanceur et le garde-fou de la Tâche 3.
- Produit : l'outil `node scripts/deplacer-vers-partage.mjs <dossier/fichier sans .ts> [--essai]`, réutilisable pour tous les lots suivants ; 11 fichiers en tout dans `packages/shared/src`.

L'ordre des déplacements compte : `contracts/commande` importe `paiement/regles`, `statuts` et `erreurs`, et `commande/estimation` importe `contracts/commande`. L'outil refuse de déplacer un fichier dont une dépendance n'est pas encore dans le paquet.

- [ ] **Étape 1 : Écrire l'outil** (outil d'écriture de fichiers)

`apps/web/scripts/deplacer-vers-partage.mjs` :

```js
// Déplace un fichier de règles pures de apps/web/src/lib/<chemin>.ts vers packages/shared/src/<chemin>.ts et laisse à sa place un raccord d'une ligne.
// Usage : node scripts/deplacer-vers-partage.mjs <dossier/fichier sans .ts> [--essai]
// Refuse un fichier qui n'est pas pur ou dont une dépendance n'est pas encore dans le paquet partagé (déplacer les dépendances d'abord).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racineSite = join(dirname(fileURLToPath(import.meta.url)), "..");
const racineLib = join(racineSite, "src", "lib");
const racinePartage = join(racineSite, "..", "..", "packages", "shared", "src");

const [chemin, option] = process.argv.slice(2);
const essai = option === "--essai";

function echec(message) {
  console.error(`ERREUR : ${message}`);
  process.exit(1);
}

if (!chemin || chemin.startsWith("-") || chemin.endsWith(".ts")) {
  console.error("Usage : node scripts/deplacer-vers-partage.mjs <dossier/fichier sans .ts> [--essai]");
  process.exit(2);
}

const source = join(racineLib, `${chemin}.ts`);
const cible = join(racinePartage, `${chemin}.ts`);
if (!existsSync(source)) echec(`introuvable : ${source}`);
if (existsSync(cible)) echec(`déjà déplacé : ${cible}`);

const INTERDITS = [/server-only/, /from\s+"next/, /from\s+"@supabase/, /from\s+"react/, /from\s+"node:/, /process\.env/, /"use (client|server)"/];
let contenu = readFileSync(source, "utf8");
for (const motif of INTERDITS) {
  if (motif.test(contenu)) echec(`ce fichier n'est pas pur (${motif}) : il ne peut pas aller dans le paquet partagé`);
}

function versRelatif(depuis, vers) {
  const r = relative(dirname(depuis), vers).split("\\").join("/");
  return r.startsWith(".") ? r : "./" + r;
}

// 1. « @/lib/<x> » devient un import relatif, à condition que <x> soit déjà dans le paquet.
contenu = contenu.replace(/from\s+"@\/lib\/([^"]+)"/g, (_, x) => {
  if (!existsSync(join(racinePartage, `${x}.ts`))) echec(`dépendance pas encore dans le paquet : @/lib/${x} (déplacez-la d'abord)`);
  return `from "${versRelatif(cible, join(racinePartage, x))}"`;
});
if (/from\s+"@\//.test(contenu)) echec("import « @/ » en dehors de lib : non déplaçable");

// 2. Un import relatif (« ./x », « ../y ») doit viser un fichier qui existe aussi dans le paquet, au même emplacement relatif à src/lib.
for (const [, specifieur] of contenu.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
  const versLib = relative(racineLib, resolve(dirname(source), specifieur)).split("\\").join("/");
  if (!existsSync(join(racinePartage, `${versLib}.ts`)) && !existsSync(join(racinePartage, `${versLib}/index.ts`))) {
    echec(`import relatif « ${specifieur} » : ${versLib}.ts n'est pas dans le paquet (déplacez-le d'abord)`);
  }
}

console.log(`${essai ? "[essai] " : ""}${relative(process.cwd(), source)} -> ${relative(process.cwd(), cible)}`);
if (essai) process.exit(0);

mkdirSync(dirname(cible), { recursive: true });
execFileSync("git", ["mv", source, cible], { stdio: "inherit" });
writeFileSync(cible, contenu);
writeFileSync(source, `export * from "@speedfood/shared/${chemin}";\n`);
```

- [ ] **Étape 2 : Essai à blanc**

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
node scripts/deplacer-vers-partage.mjs contracts/erreurs --essai; echo "code=$?"
node scripts/deplacer-vers-partage.mjs contracts/commande --essai; echo "code=$?"
```

Résultat attendu : le premier affiche `[essai] src/lib/contracts/erreurs.ts -> …/packages/shared/src/contracts/erreurs.ts` et `code=0` ; le second affiche `ERREUR : dépendance pas encore dans le paquet : @/lib/paiement/regles (déplacez-la d'abord)` et `code=1`, ce qui prouve que l'outil protège l'ordre des déplacements.

- [ ] **Étape 3 : Déplacer les dix fichiers, dans l'ordre des dépendances**

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
for f in contracts/erreurs contracts/menu contracts/restaurant paiement/regles contracts/commande contracts/index commande/estimation commande/mode commande/telephone disponibilite/etat; do
  node scripts/deplacer-vers-partage.mjs "$f" || { echo "ARRÊT sur $f"; break; }
done
git status --short | head -30
```

Résultat attendu : dix lignes `src/lib/… -> …/packages/shared/src/…`, aucune ligne « ARRÊT ». Si l'outil s'arrête sur un fichier, **ne pas forcer** : lire le message, déplacer d'abord la dépendance manquante si elle est pure, sinon retirer ce fichier du lot et le noter dans la section « Reste à déplacer » de la Tâche 6.

- [ ] **Étape 4 : Vérifier**

```bash
cd /c/Users/moelo/dev/speedfood
npm run typecheck; echo "typecheck=$?"
cd apps/web
npx eslint 2>&1 | tail -4
npm run test:unit > "$SCRATCH/unit.log" 2>&1; echo "unit=$?"
grep -E "ECHEC|Error|SyntaxError" "$SCRATCH/unit.log" | head
grep -cE "^OK +(pur|raccord d'une ligne)" "$SCRATCH/unit.log"
npm run test:cloisonnement > "$SCRATCH/clois.log" 2>&1; echo "cloisonnement=$?"
npx next build > "$SCRATCH/build.log" 2>&1; echo "next build=$?"
```

Résultat attendu : `typecheck=0`, aucune erreur ESLint (le seul avertissement connu, `_versement` dans `finances/route.ts`, est ancien), `unit=0`, aucune ligne d'échec, **22** lignes `OK` de pureté et de raccord (11 fichiers × 2), `cloisonnement=0`, `next build=0`.

Si `tsc` signale une erreur de type après les déplacements, c'est presque toujours un `export *` qui masque un nom en double entre deux modules : corriger dans le raccord concerné en réexportant explicitement les noms nécessaires, puis recommencer l'étape.

Retour arrière si rien ne s'arrange : `git reset --hard HEAD` (le commit de la Tâche 3 est la dernière base saine).

- [ ] **Étape 5 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git add -A
git commit -m "Paquet partagé : outil de déplacement et premier lot de règles pures (contrats, paiement, estimation, mode, téléphone, disponibilité), raccords d'une ligne

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tâche 5 : Documentation et mémoire

**Fichiers :**
- Créer : `packages/shared/README.md`
- Modifier : `docs/ORGANISATION-DU-DEPOT.md`, `docs/STATUT-PROJET.md`
- Mémoire : `C:\Users\moelo\.claude\projects\C--Users-moelo-dev-speedfood\memory\redis-upstash-et-refonte-architecture.md`

**Interfaces :**
- Consomme : tout ce qui précède.
- Produit : la documentation qui permet à une session future de reprendre sans historique.

- [ ] **Étape 1 : Écrire le README du paquet** (outil d'écriture de fichiers)

`packages/shared/README.md` :

```markdown
# @speedfood/shared

Règles **pures** de Speedfood : statuts de commande, formats, estimation de préparation, disponibilité, contrats de données. Partagées entre le site (`apps/web`), la future API (`apps/api`) et la future application (`apps/mobile`). Voir `docs/specs/2026-10-30-architecture-cible-design.md`.

## Règle d'or

Un fichier de ce paquet ne dépend de **rien d'autre** que d'autres fichiers du paquet : ni de l'alias `@/` du site, ni de Next, de Supabase, de React, de Node (`node:`), ni de `process.env`. Le test `apps/web/scripts/tests/paquet-partage.test.mts` le vérifie à chaque `npm run test:unit`, et `tsconfig.json` retire les types Node et DOM pour qu'une dépendance cachée ne compile pas.

## Utiliser une règle

```ts
import { transitionAutorisee } from "@speedfood/shared/contracts/statuts";
```

Le motif `./*` → `./src/*.ts` fait de chaque fichier source un point d'entrée. Les anciens chemins du site (`@/lib/contracts/statuts`) continuent de marcher : ce sont des **raccords d'une ligne** vers le paquet.

## Déplacer une règle de plus

Depuis `apps/web`, dépendances d'abord :

```bash
node scripts/deplacer-vers-partage.mjs commande/mode --essai   # montre ce qui serait fait
node scripts/deplacer-vers-partage.mjs commande/mode           # déplace avec git mv et laisse le raccord
```

L'outil refuse un fichier impur ou dont une dépendance n'est pas déjà dans le paquet. Ensuite : `npm run typecheck` (racine), `npm run test:unit`, `npx next build`.

## Contenu actuel

`contracts/{statuts,erreurs,menu,restaurant,commande,index}`, `paiement/regles`, `commande/{estimation,mode,telephone}`, `disponibilite/etat`.
```

- [ ] **Étape 2 : Mettre à jour les documents**

Dans `docs/ORGANISATION-DU-DEPOT.md`, avec l'outil d'édition, ajouter une section « Paquets partagés (étape 0 de la refonte) » qui renvoie à `packages/shared/README.md` et au design `docs/specs/2026-10-30-architecture-cible-design.md`, et signale : site dans `apps/web`, `npm install` à la racine, `mobile/` inchangé.

Dans `docs/STATUT-PROJET.md`, ajouter à la fin :

```markdown

## Refonte d'architecture, étape 0 (fondations) : fait (30 octobre 2026), NON déployé

Plan : `docs/plans/2026-10-30-etape-0-fondations.md`. **Fait (testé en local, rien en production)** : espace de travail npm, site déplacé de `web/` à `apps/web`, verrou à la racine, contrôle automatique GitHub (`.github/workflows/controles.yml`), paquet `packages/shared` avec 11 fichiers de règles pures (raccords d'une ligne à leur ancienne place), garde-fou de pureté dans les tests, outil `apps/web/scripts/deplacer-vers-partage.mjs`. **Reste** : déployer avec le feu vert de Malika (aucun changement visible attendu) ; déplacer les autres règles pures par lots ; étape 1 (API unique).
```

- [ ] **Étape 3 : Mettre à jour la mémoire de projet**

Dans `redis-upstash-et-refonte-architecture.md`, après le paragraphe « Refonte d'architecture… », ajouter : « **Étape 0 faite le 30 oct. 2026** (non déployée) : site dans `apps/web`, `npm install` à la racine, paquet `@speedfood/shared` (11 fichiers purs) avec raccords d'une ligne, contrôle automatique GitHub. Plan : `docs/plans/2026-10-30-etape-0-fondations.md`. Prochaine étape : 1 (API unique Hono, Worker `speedfood-api`). `mobile/` reste en place jusqu'au gel de Kotlin. »

- [ ] **Étape 4 : Enregistrer**

```bash
cd /c/Users/moelo/dev/speedfood
git add -A
git commit -m "Documenter l'étape 0 : README du paquet partagé, organisation du dépôt, statut du projet

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Tâche 6 : Porte de sortie et mise en production (avec le feu vert de Malika)

**Interfaces :**
- Consomme : les branches et commits des tâches 1 à 5.
- Produit : `master` à jour, contrôle GitHub vert, et, **si Malika le demande explicitement**, le site déployé à l'identique pour les utilisateurs.

- [ ] **Étape 1 : Vérification complète sur la branche**

```bash
cd /c/Users/moelo/dev/speedfood
npm run typecheck; echo "typecheck=$?"
cd apps/web
npm run test:unit > "$SCRATCH/unit.log" 2>&1; echo "unit=$?"
npm run test:cloisonnement > "$SCRATCH/clois.log" 2>&1; echo "cloisonnement=$?"
npm run cf:build > "$SCRATCH/cfbuild.log" 2>&1; echo "cf:build=$?"
cd ../..
git status -sb | head -3
```

Résultat attendu : quatre codes à `0`, arbre propre.

- [ ] **Étape 2 : Fusionner dans `master` et pousser**

```bash
cd /c/Users/moelo/dev/speedfood
git checkout master
git merge --ff-only etape-0-fondations
git push
git branch -d etape-0-fondations
```

Résultat attendu : fusion « Fast-forward », push accepté.

- [ ] **Étape 3 : Lire le contrôle GitHub**

Ouvrir `https://github.com/moelohimmara-dotcom/speedfood/actions` dans Claude in Chrome et lire le dernier essai « Contrôles » avec `get_page_text`.

Résultat attendu : vert, avec les cinq étapes (installation, types, qualité, tests purs, cloisonnement). S'il est rouge, corriger la cause (voir Tâche 1, étape 4) avant tout déploiement.

- [ ] **Étape 4 : Se préparer au retour en arrière avant de déployer**

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
npx wrangler deployments list 2>&1 | grep -E "Version\(s\)" | head -1
curl -s https://speedfood-app.moelohimmara.workers.dev/api/v1/version | head -c 60; echo
```

Noter l'identifiant de version actuellement à 100 % : c'est la cible d'un éventuel retour arrière (`npx wrangler versions deploy <identifiant>@100% -y`).

- [ ] **Étape 5 : Déployer, uniquement après le feu vert de Malika**

**Ne pas exécuter sans qu'elle ait écrit dans la conversation une phrase explicite du type « oui, déploie l'étape 0 ».** Si le garde-fou de production refuse une première formulation, redemander la phrase précise ; ne jamais contourner.

```bash
cd /c/Users/moelo/dev/speedfood/apps/web
npm run cf:deploy
```

- [ ] **Étape 6 : Vérifier que rien n'a changé pour les utilisateurs**

```bash
B=https://speedfood-app.moelohimmara.workers.dev
for p in / /restaurants /installer; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' $B$p)"; done
curl -s $B/api/v1/version | head -c 60; echo
echo "annuler : $(curl -s -X POST -H 'content-type: application/json' -d '{}' $B/api/v1/suivi/annuler | head -c 90)"
echo "candidature sans session : $(curl -s -o /dev/null -w '%{http_code}' $B/api/v1/candidature)"
cd /c/Users/moelo/dev/speedfood/apps/web
npx wrangler secret list 2>&1 | grep -cE 'UPSTASH|GOOGLE_SMTP|EQUIPE_ALERTE|PAIEMENT_ENTRETIEN'
```

Résultat attendu, identique à avant le déploiement : `/`, `/restaurants`, `/installer` à 200 ; version 2.47.0 (code 51) ; l'annulation répond « Lien de suivi invalide » ; `/api/v1/candidature` à 401 ; six secrets listés (UPSTASH ×2, GOOGLE_SMTP ×2, EQUIPE_ALERTE, PAIEMENT_ENTRETIEN). Au moindre écart : retour arrière immédiat avec l'identifiant noté à l'étape 4, puis enquête.

---

## Auto-contrôle du plan

**Couverture du design (§9, étape 0)** : « dépôt organisé en `apps` et `packages` » → Tâches 2 et 3 ; « règles pures du site déplacées dans les paquets partagés » → Tâches 3 et 4 (premier lot de 11 fichiers, le reste par lots ultérieurs, noté en « Hors périmètre ») ; « contrôle automatique à chaque modification » → Tâche 1 (mise à jour Tâche 2) ; « ce que voient les utilisateurs : rien » → Tâche 6 étapes 4 à 6. Les écarts avec le design (`mobile/` en place, pas de `packages/api-client` ni `apps/api` à cette étape) sont listés et justifiés.

**Cohérence des noms** : paquet `@speedfood/shared` ; motif d'export `./*` → `./src/*.ts` ; outil `deplacer-vers-partage.mjs` ; garde-fou `paquet-partage.test.mts` ; variable `$SCRATCH` définie à la Tâche 2 étape 1 et réutilisée ensuite ; ordre des déplacements identique à la Tâche 3 (statuts) puis Tâche 4.

**Risques connus et conduite à tenir** : réinstallation qui changerait une version (comparaison avant/après, arrêt si écart) ; modules natifs absents sur Linux (substitution de `npm ci`) ; `export *` qui masque un nom en double (réexportation explicite) ; OpenNext en espace de travail (vérifié par `cf:build` aux Tâches 2 et 6, retour arrière prévu).
