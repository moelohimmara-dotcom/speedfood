# Speedfood — MVP

Code de production du portail Speedfood (Conakry). Le cadrage produit et le prototype de démonstration vivent séparément, dans `Jarvis/speedfood/` — voir `CLAUDE.md` pour la liste des documents à lire avant toute tâche.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les vraies valeurs, jamais commitées
npm run dev
```

Ouvrir http://localhost:3000.

## Scripts

- `npm run dev` : serveur de développement
- `npm run build` : build de production
- `npm run lint` : ESLint
- `npm run typecheck` : vérification TypeScript sans émission

## Où en est le projet

Bloc 1 (socle) en place : projet Next.js App Router + TypeScript, contrats partagés (`src/lib/contracts/`), pages placeholder pour les trois surfaces (`/` catalogue public, `/restaurant` console, `/system` CMS). Aucune base de données branchée : c'est l'objet du bloc 2, à valider avant de continuer.

Voir `Jarvis/speedfood/PLAN-EXECUTION.md` pour le détail des blocs suivants.
