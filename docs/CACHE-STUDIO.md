# Cache des contenus publiés (Studio)

## Principe
Les pages (`/p/[slug]`) et les bannières de l'accueil sont lues par `src/lib/cms/lecture.ts`. Ces deux lectures, et elles seules, passent par `lireAvecCache` (`src/lib/cms/cache.ts`), qui s'appuie sur la **Cache API du Worker** (`caches.default`) : incluse dans Cloudflare Workers, sans quota, sans ressource à créer (ni KV, ni R2, ni D1).

- Clés : `page:<slug>` et `bannieres`, stockées sous l'URL interne `https://cms.cache.interne/v1/<clé encodée>`.
- Valeur : le JSON de la lecture, avec `Cache-Control: public, max-age=<ttl>` et un horodatage de stockage ; la fraîcheur est revérifiée à la lecture (jamais de donnée gardée au-delà du TTL).
- L'écriture dans le cache ne bloque pas la réponse (`ctx.waitUntil` quand le contexte Cloudflare est disponible).
- Règles pures (clé, fraîcheur, TTL) : `src/lib/cms/cache-regles.ts`, testées par `scripts/tests/cache.test.mts`.

## TTL
- **60 s** par défaut.
- **10 s au plus** pour une valeur vide (`null` ou `[]`) : une page tout juste publiée ne reste pas « introuvable ».
- Une erreur de lecture en base n'est jamais mise en cache.

## Ce qui n'est jamais mis en cache
Les brouillons : la lecture d'aperçu vit dans `src/lib/cms/apercu.ts`, et la fonction `resoudre` de `src/app/p/[slug]/page.tsx` (qui mêle publié et brouillon) n'est pas enveloppée. Un test échoue si `lecture.ts` (ou le cache) importe `apercu.ts`.

## Invalidation et limites
Les actions de `src/lib/system-admin/contenus.ts` (création, modification, publication et dépublication de page ; création, publication, dépublication, suppression de bannière) appellent `invaliderCache` après l'écriture réussie.

**Limite** : la Cache API est **propre à chaque centre de données**. L'invalidation ne purge que celui qui traite l'action ; ailleurs, l'ancienne version peut être servie jusqu'à **60 s** (10 s pour une absence). C'est le délai maximal d'une publication ou d'une dépublication.

## Repli
Sans `caches.default` (Node, `next dev`) ou si le cache échoue à n'importe quelle étape (lecture, écriture, suppression, entrée illisible), la lecture se fait directement en base, sans erreur visible. Le site fonctionne donc à l'identique, simplement sans cache.

## Évolution possible (non faite)
Un compteur de version dans un KV gratuit, inclus dans la clé (`v<n>:page:<slug>`) et incrémenté à chaque publication, rendrait l'invalidation globale et immédiate. Cela crée une ressource Cloudflare : à décider avec Malika.

## Limite : efficace sur domaine personnalisé ; à vérifier sur workers.dev
La documentation Cloudflare de la Cache API (https://developers.cloudflare.com/workers/runtime-apis/cache/, consultée le 6 octobre 2026) indique que les Workers déployés sur des **domaines personnalisés** disposent d'opérations `cache` fonctionnelles, sans citer les sous-domaines `workers.dev` parmi eux (et précise que les opérations du tableau de bord et du Playground n'ont aucun effet). Le déploiement actuel est sur `speedfood-app.moelohimmara.workers.dev` : le cache peut donc y être **sans effet** (no-op). Ce n'est pas dangereux (le repli lit directement en base) mais le gain peut être nul tant que le site n'a pas de domaine personnalisé. Le test local `cf:preview` (workerd) montre un HIT, mais il ne prouve rien pour `workers.dev`.

**Contrôle au déploiement** : publier une page de test, la lire deux fois (`/p/<slug>`), modifier son titre directement en base (sans passer par la console, donc sans invalidation) entre les deux lectures. Si la seconde lecture montre encore l'ancien titre pendant au plus 60 s puis le nouveau, le cache fonctionne. Si elle montre immédiatement le nouveau titre, le cache est sans effet sur ce domaine. Supprimer la page de test ensuite.
