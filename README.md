# Speedfood — MVP

Portail web de découverte et de commande auprès de restaurants, pour un pilote à
Conakry (Guinée). Ce dépôt est le **code de production**, distinct du prototype
de démonstration utilisé pour la validation terrain.

## Lire avant de coder

1. `docs/STATUT-PROJET.md` — où en est le projet, ce qui est vérifié, ce qui reste à faire
2. `docs/cadrage/TDR.md` — ce que le produit doit faire, et ne pas faire
3. `docs/cadrage/ADR.md` — pourquoi la pile technique est ce qu'elle est
4. `docs/cadrage/PLAN-EXECUTION.md` — comment le travail est découpé en blocs
5. `CLAUDE.md` — règles de sécurité non négociables pour toute contribution

## Pile technique

- [Next.js](https://nextjs.org) 16, App Router, TypeScript
- [Supabase](https://supabase.com) : Postgres, Auth, Row Level Security
- Aucun framework CSS : tokens de design maison dans `src/app/globals.css` et
  `src/app/components.css` (voir `docs/cadrage/DESIGN-SYSTEM.md`)

## Démarrer en local

```bash
npm install
cp .env.example .env.local
```

Renseigner dans `.env.local` :

- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` : valeurs
  publiques du projet Supabase (demander l'accès au projet `ggldjdizqrtpetdiohxy`,
  ou créer son propre projet Supabase pour développer en isolation — dans ce cas,
  appliquer les migrations, voir plus bas)
- `SUPABASE_SERVICE_ROLE_KEY` : uniquement nécessaire pour les routes serveur qui
  contournent la RLS (bloc 7+). Ne jamais la commiter, ne jamais la préfixer
  `NEXT_PUBLIC_`.

```bash
npm run dev
```

Ouvrir http://localhost:3000.

## Appliquer les migrations sur un nouveau projet Supabase

Les fichiers `supabase/migrations/*.sql` sont numérotés et doivent être appliqués
dans l'ordre. Avec la [CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) :

```bash
supabase login
supabase link --project-ref <votre-project-ref>
supabase db push
```

Puis, en développement uniquement (jamais contre un environnement pilote) :

```bash
# Depuis l'éditeur SQL du dashboard Supabase, ou psql :
# coller le contenu de supabase/seed.sql
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript sans émission |

Avant tout commit : `npm run typecheck && npm run lint`, les deux doivent passer
sans erreur.

## Structure du dépôt

```
docs/
  cadrage/            # copie du cadrage produit (source : Jarvis/speedfood, voir docs/cadrage/README.md)
  STATUT-PROJET.md     # où en est le projet, pour une reprise par quelqu'un d'autre
  MODELE-DONNEES.md    # schéma de données, policies RLS, ce qui est vérifié
src/
  app/                # routes Next.js (App Router)
  components/ui/       # composants partagés (bouton, champ, carte, badge, alerte)
  lib/
    contracts/         # types TypeScript partagés (Restaurant, Commande, statuts...)
    db/                 # clients Supabase (public, serveur SSR, admin service-role)
    auth/               # Server Actions d'authentification
  proxy.ts             # rafraîchit la session, protège /restaurant/* (pas middleware.ts, déprécié en Next 16)
supabase/
  migrations/          # schéma versionné, appliqué dans l'ordre chronologique du nom de fichier
  seed.sql             # données de développement explicitement fictives
```

## Sécurité — à ne jamais oublier

- Toute donnée envoyée par le navigateur (prix, identifiant de restaurant, total)
  n'est jamais une source d'autorité. Le serveur ou une policy RLS recalcule et
  vérifie toujours.
- Après une migration qui touche RLS ou une fonction `SECURITY DEFINER`, lancer
  l'audit de sécurité Supabase (`get_advisors`, ou l'équivalent dans le dashboard)
  avant de continuer. Ça a trouvé de vrais problèmes deux fois déjà — voir
  l'historique Git.
- `.env.local` n'est jamais commité (déjà dans `.gitignore`, vérifier avant de
  forcer un ajout).
