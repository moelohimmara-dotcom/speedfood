# Déploiement sur Cloudflare Workers (OpenNext)

**Statut : déployé en ligne le 27 septembre 2026.**
Worker `speedfood-app` sur le compte Cloudflare `Moelohimmara@gmail.com` (id
`71e00d35a00589b9497b6f65022c02a4`) :

**URL de production : https://speedfood-app.moelohimmara.workers.dev**

## À ne pas confondre avec le prototype existant

Un projet Cloudflare **Pages** distinct, nommé `speedfood`
(`speedfood.pages.dev`), existait déjà avant tout ce travail : c'est la
landing page marketing + le prototype cliquable de démonstration (statique,
`"uses_functions": false`, déployé en `ad_hoc` via `wrangler` depuis le
dossier de travail personnel de Malika, pas depuis ce dépôt). Confirmé par
lecture directe de l'API Cloudflare (`/accounts/{id}/pages/projects` et
`/accounts/{id}/workers/scripts`) : aucun Worker nommé `speedfood` n'existait
avant ce déploiement.

**Le vrai système (ce dépôt) tourne sur le Worker `speedfood-app`, séparé du
projet Pages `speedfood`.** Les deux coexistent sur le même compte sans
conflit (noms différents, URLs différentes).

## Pourquoi ce choix d'adaptateur

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
- `wrangler.jsonc` : nom du worker `speedfood-app` (délibérément différent du
  projet Pages `speedfood` existant). Contient les variables **publiques**
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clé anon,
  soumise aux policies RLS, sans risque à committer ; `COMMANDE_PROPOSITION_DELAI_MINUTES`).
  Pas de binding `images` (aucun usage de `next/image` dans le code).
- `.dev.vars.example` : équivalent de `.env.example` pour `wrangler dev` —
  wrangler ne lit **pas** `.env.local`, les variables doivent être dupliquées
  dans `.dev.vars` (jamais committé).
- `next.config.ts` : appel à `initOpenNextCloudflareForDev()` pour que les
  bindings Cloudflare soient disponibles pendant `next dev` aussi.
- Scripts `package.json` : `cf:build`, `cf:preview` (build + `wrangler dev`
  local), `cf:deploy` (build + déploiement réel).

## Secrets Cloudflare (jamais dans un fichier committé)

Configurés directement sur le Worker via `wrangler secret put` (visibles
seulement en tant que noms dans le dashboard Cloudflare, jamais leur valeur) :

- `SUPABASE_SERVICE_ROLE_KEY` — copiée depuis `.env.local`.
- `COMMANDE_JETON_SECRET` — **valeur générée spécifiquement pour la
  production** (32 octets aléatoires, `crypto.randomBytes` en base64url),
  distincte de la clé service-role, en défense de profondeur (si l'une fuit,
  l'autre reste intacte). Ne correspond à aucune valeur présente dans
  `.env.local` ou ailleurs dans ce dépôt.

Pour changer un secret plus tard :
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name speedfood-app
npx wrangler secret put COMMANDE_JETON_SECRET --name speedfood-app
```
(nécessite d'être authentifié : `CLOUDFLARE_API_TOKEN` en variable d'env, ou
`wrangler login`.)

**Changer `COMMANDE_JETON_SECRET` invalide tous les jetons de suivi déjà
émis** (`/suivi/[jeton]` renverra 404 pour les commandes existantes) — à ne
faire qu'en connaissance de cause, jamais en routine.

## Vérifié après déploiement réel (27/09/2026)

- Catalogue public (`/`) : lecture Supabase réelle fonctionnelle depuis le
  Worker en production.
- `/restaurant` sans session : redirection vers `/connexion?suite=...` — le
  `proxy.ts` fonctionne en edge runtime réel malgré l'avertissement de build
  `Node.js middleware support is experimental in cloudflare, and not
  officially maintained by OpenNext maintainers` (à surveiller si des bugs
  d'authentification apparaissent uniquement en production et pas en local).

## Comment redéployer après un changement de code

```bash
npm run cf:build
npx wrangler deploy   # nécessite CLOUDFLARE_API_TOKEN ou wrangler login
```

## Ce qu'il reste à faire

1. Domaine personnalisé (`speedfood-app.moelohimmara.workers.dev` est fonctionnel mais
   générique) — à décider avec Malika, potentiellement un sous-domaine dédié
   distinct de `speedfood.pages.dev` pour éviter toute confusion avec le
   prototype.
2. Aucun test de charge ni de bout en bout automatisé en environnement
   Cloudflare réel — seule la navigation manuelle a été vérifiée.
3. Revoir périodiquement `get_advisors` côté Supabase : le déploiement
   Cloudflare ne change rien à la sécurité base de données, mais la mise en
   ligne réelle augmente la surface d'exposition (trafic public possible
   désormais, pas seulement `localhost`).
4. Activer la protection mot de passe compromis (HaveIBeenPwned) côté
   Supabase avant tout pilote public — toujours en attente, voir
   `docs/STATUT-PROJET.md`.
