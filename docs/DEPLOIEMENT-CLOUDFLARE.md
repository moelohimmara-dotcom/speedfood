# Déploiement sur Cloudflare Workers (OpenNext)

**Statut : configuration prête et testée en local, jamais déployée en ligne.**
Aucun compte Cloudflare Workers n'a été créé ni utilisé pour ce dépôt — voir la
règle « pas de nouveau service externe sans consigne explicite » de `CLAUDE.md`.

## Pourquoi ce choix

Ce dépôt (le vrai système Next.js/Supabase) est distinct du prototype de
démonstration déjà en ligne sur `https://speedfood.pages.dev/prototype/#/`
(routage par hash, pas de backend réel — ce n'est pas ce dépôt). Ce dépôt n'a
**aucun remote Git** et n'était déployé nulle part avant cette configuration.

Next.js ne tourne pas nativement sur Cloudflare Pages. Deux adaptateurs
existent : `@cloudflare/next-on-pages` (plus ancien, support partiel des
Server Actions) et `@opennextjs/cloudflare` (Cloudflare Workers, support
complet de l'App Router et des Server Actions). Ce projet utilise énormément
de Server Actions (`"use server"`) et du rendu dynamique par requête (sessions
Supabase) — **`@opennextjs/cloudflare` a été choisi**, confirmé par Malika.

## Fichiers ajoutés

- `open-next.config.ts` : cache d'incrémental en lecture seule sur les assets
  statiques (`static-assets-incremental-cache`), **pas** de bucket R2. L'app
  est presque entièrement dynamique (`ƒ` dans la sortie de `next build`), donc
  la revalidation ISR n'est pas nécessaire pour l'instant. Créer un bucket R2
  ou KV serait une nouvelle ressource cloud potentiellement payante — à ne
  faire qu'avec une consigne explicite si un futur bloc en a besoin.
- `wrangler.jsonc` : nom du worker `speedfood`, `compatibility_date` à la date
  de cette configuration. Pas de binding `images` (aucun usage de
  `next/image` dans le code, seulement une référence dans un commentaire de
  `src/proxy.ts`).
- `.dev.vars.example` : équivalent de `.env.example` pour `wrangler dev` —
  wrangler ne lit **pas** `.env.local`, les variables doivent être dupliquées
  dans `.dev.vars` (jamais committé).
- `next.config.ts` : appel à `initOpenNextCloudflareForDev()` pour que les
  bindings Cloudflare soient disponibles pendant `next dev` aussi.
- Scripts `package.json` : `cf:build`, `cf:preview` (build + `wrangler dev`
  local), `cf:deploy` (build + déploiement réel — **jamais lancé depuis ce
  dépôt**, engagerait potentiellement un compte/coût Cloudflare).

## Vérifié en local (27/09/2026)

```bash
npm run cf:build   # build Next.js + adaptation OpenNext, succès
cp .env.local .dev.vars   # dupliquer les variables (jamais committé)
npx wrangler dev --port 8788
```

- Catalogue public (`/`) : lecture Supabase réelle fonctionnelle depuis le
  Worker.
- `/restaurants/[id]` : fiche publique fonctionnelle.
- `/restaurant` sans session : redirection vers `/connexion?suite=...` — le
  `proxy.ts` fonctionne sous Workers malgré l'avertissement de build
  `Node.js middleware support is experimental in cloudflare, and not
  officially maintained by OpenNext maintainers` (à surveiller si des bugs
  d'authentification apparaissent uniquement en environnement Cloudflare et
  pas en local `next dev`).

`.dev.vars` a été supprimé après ce test (ne doit jamais rester sur disque
avec de vraies clés au-delà d'une session de test).

## Ce qu'il reste à faire avant un vrai déploiement

1. Créer le compte/projet Cloudflare Workers (nouvelle ressource — demande
   confirmation explicite de Malika avant `npm run cf:deploy` ou
   `wrangler login`).
2. Configurer les vraies variables d'environnement côté Cloudflare (secrets
   Workers, jamais dans `wrangler.jsonc` qui est committé) :
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `COMMANDE_JETON_SECRET`,
   `COMMANDE_PROPOSITION_DELAI_MINUTES`.
3. Décider d'un nom de domaine/sous-domaine distinct du prototype existant
   (`speedfood.pages.dev/prototype/#/`) pour éviter toute confusion entre les
   deux environnements.
4. Revoir `docs/STATUT-PROJET.md` §"Ce qui n'est pas testé" : aucun test n'a
   encore tourné en environnement Cloudflare réel (seulement `wrangler dev`
   local), et le comportement du `proxy.ts` en edge runtime réel (pas
   seulement simulé localement par Miniflare) reste à confirmer.
