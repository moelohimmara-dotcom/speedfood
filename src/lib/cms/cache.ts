import "server-only";
import {
  TTL_DEFAUT_SECONDES,
  invaliderInjecte,
  lireAvecCacheInjecte,
  type CacheMinimal,
} from "./cache-regles";

/**
 * Cache des contenus PUBLIÉS (pages et bannières) dans la Cache API du Worker (`caches.default`) : gratuite, sans quota,
 * sans ressource Cloudflare à créer. Voir docs/CACHE-STUDIO.md.
 *
 * Ne JAMAIS y faire passer un brouillon ni un résultat qui en mêle (aperçu, `resoudre` de /p/[slug]) : ce module
 * n'importe rien d'`apercu.ts` et un test l'impose côté `lecture.ts`.
 *
 * Hors Workers (Node, `next dev`) il n'y a pas de `caches.default` : repli silencieux sur le producteur.
 */

function cacheLocal(): CacheMinimal | null {
  try {
    const cache = (globalThis as { caches?: { default?: CacheMinimal } }).caches?.default;
    return cache ?? null;
  } catch {
    return null;
  }
}

/** Écriture hors du chemin de réponse quand le contexte d'exécution le permet, sinon `undefined` (écriture attendue). */
async function obtenirPlanificateur(): Promise<((travail: Promise<unknown>) => void) | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = getCloudflareContext().ctx;
    if (typeof ctx?.waitUntil === "function") return (travail) => ctx.waitUntil(travail);
  } catch {
    // Pas de contexte Cloudflare (Node) : on attendra l'écriture.
  }
  return undefined;
}

export async function lireAvecCache<T>(
  cle: string,
  producteur: () => Promise<T>,
  options?: { ttlSecondes?: number }
): Promise<T> {
  const cache = cacheLocal();
  if (!cache) return producteur();
  const planifier = await obtenirPlanificateur();
  return lireAvecCacheInjecte(
    { cache, maintenant: () => Date.now(), planifier },
    cle,
    producteur,
    options?.ttlSecondes ?? TTL_DEFAUT_SECONDES
  );
}

/**
 * Supprime les entrées du centre de données LOCAL seulement : la Cache API ne se purge pas globalement. Ailleurs, le TTL
 * (60 s par défaut, 10 s pour une valeur vide) borne le délai avant que la nouvelle version soit servie.
 */
export async function invaliderCache(cles: string[]): Promise<void> {
  await invaliderInjecte(cacheLocal(), cles);
}
