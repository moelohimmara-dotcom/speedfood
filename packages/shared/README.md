# @speedfood/shared

Règles **pures** de Speedfood : statuts de commande, formats, estimation de préparation, disponibilité, contrats de données. Partagées entre le site (`apps/web`), la future API (`apps/api`) et la future application (`apps/mobile`). Voir `docs/specs/2026-10-30-architecture-cible-design.md`.

## Règle d'or

Un fichier de ce paquet ne dépend de **rien d'autre** que d'autres fichiers du paquet. Le test `apps/web/scripts/tests/paquet-partage.test.mts` le vérifie à chaque `npm run test:unit` : il refuse, quel que soit le type de guillemets (simples ou doubles) :

- l'alias `@/` du site ;
- `server-only`, `next`, `@supabase`, `react` ;
- `node:` et les modules Node sans préfixe (`fs`, `path`, `crypto`, `url`, `http`, etc.) ;
- l'import dynamique `import(…)`, `require(…)` et l'import à effet de bord (`import "x";`) ;
- `process.env` ;
- les directives `"use client"` et `"use server"` ;
- l'auto-référence `@speedfood/shared` (un fichier du paquet utilise des imports relatifs).

L'outil de déplacement applique exactement la même liste. De plus, `tsconfig.json` du paquet retire les types Node et DOM (`types: []`, `lib: ["esnext"]`) pour qu'une dépendance cachée ne compile pas.

## Utiliser une règle

```ts
import { transitionAutorisee } from "@speedfood/shared/contracts/statuts";
```

Le motif `./*` → `./src/*.ts` fait de chaque fichier source un point d'entrée. Les anciens chemins du site (`@/lib/contracts/statuts`) continuent de marcher : ce sont des **raccords d'une ligne** vers le paquet (le test vérifie que chaque fichier du paquet a son raccord à l'ancienne place, sous `apps/web/src/lib/`).

## Déplacer une règle de plus

Depuis `apps/web`, dépendances d'abord :

```bash
node scripts/deplacer-vers-partage.mjs commande/mode --essai   # montre ce qui serait fait
node scripts/deplacer-vers-partage.mjs commande/mode           # déplace avec git mv et laisse le raccord
```

L'outil refuse un fichier impur ou dont une dépendance n'est pas déjà dans le paquet. Ensuite : `npm run typecheck` (racine), `npm run test:unit`, `npx next build`.

## Contenu actuel

13 fichiers : `contracts/{statuts,erreurs,menu,restaurant,commande,index}`, `paiement/regles`, `commande/{estimation,mode,telephone}`, `disponibilite/etat`, `application/version`, `api/v1-regles`.

## Hors du paquet

`mobile/` (application Kotlin) n'a pas été déplacé : il reste en place jusqu'au gel de Kotlin. L'ancien dossier `web/` peut subsister, vide, sur le disque (un verrou externe empêche sa suppression) : à supprimer à la main quand l'application qui le tient sera fermée.
