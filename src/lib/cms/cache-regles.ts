/**
 * Règles PURES du cache des contenus publiés (Studio, tâche 2) : construction de la clé, fraîcheur, politique de TTL et
 * lecture à travers un cache injecté. Aucun import serveur : testable seul (`scripts/tests/cache.test.mts`). L'accès réel
 * à `caches.default` est dans `cache.ts`.
 */

export const TTL_DEFAUT_SECONDES = 60;
/** Durée maximale de conservation d'une valeur vide (`null` / `[]`) : une page tout juste publiée ne reste pas « introuvable ». */
export const TTL_VIDE_SECONDES = 10;
export const BASE_CLE = "https://cms.cache.interne/v1/";
export const ENTETE_STOCKE_LE = "x-cms-stocke-le";
export const ENTETE_TTL = "x-cms-ttl";

/** Forme minimale du cache utilisée ici (sous-ensemble de `Cache`). */
export interface CacheMinimal {
  match(cle: string): Promise<Response | undefined>;
  put(cle: string, reponse: Response): Promise<void>;
  delete(cle: string): Promise<boolean>;
}

/** URL de clé interne : la clé logique est entièrement échappée (aucun `/`, `?` ni `#` ne sort du dernier segment). */
export function cleCache(cle: string): string {
  return BASE_CLE + encodeURIComponent(cle);
}

/** Vrai pour `null`, `undefined` et tableau vide : ces valeurs ne vivent que `TTL_VIDE_SECONDES` au plus. */
export function estVide(valeur: unknown): boolean {
  return valeur === null || valeur === undefined || (Array.isArray(valeur) && valeur.length === 0);
}

export function ttlEffectif(valeur: unknown, ttlSecondes: number): number {
  const ttl = Number.isFinite(ttlSecondes) && ttlSecondes > 0 ? Math.floor(ttlSecondes) : TTL_DEFAUT_SECONDES;
  return estVide(valeur) ? Math.min(ttl, TTL_VIDE_SECONDES) : ttl;
}

/** Une entrée est fraîche si son âge est dans [0, ttl[. Un horodatage illisible ou futur est traité comme périmé. */
export function estFrais(maintenantMs: number, stockeLeMs: number, ttlSecondes: number): boolean {
  if (!Number.isFinite(stockeLeMs) || !Number.isFinite(ttlSecondes)) return false;
  const age = maintenantMs - stockeLeMs;
  return age >= 0 && age < ttlSecondes * 1000;
}

export interface DependancesCache {
  cache: CacheMinimal | null | undefined;
  maintenant: () => number;
  /** Planifie une écriture sans bloquer la réponse (`ctx.waitUntil`) ; absent : l'écriture est attendue. */
  planifier?: (travail: Promise<unknown>) => void;
}

/** Lit dans le cache ; toute erreur ou entrée périmée/illisible vaut « absent ». Jamais d'exception. */
async function lireEntree<T>(cache: CacheMinimal, url: string, maintenant: number): Promise<{ valeur: T } | null> {
  try {
    const reponse = await cache.match(url);
    if (!reponse) return null;
    const stockeLe = Number(reponse.headers.get(ENTETE_STOCKE_LE));
    const ttl = Number(reponse.headers.get(ENTETE_TTL));
    if (!estFrais(maintenant, stockeLe, ttl)) return null;
    const corps = (await reponse.json()) as { v?: T };
    if (!corps || typeof corps !== "object" || !("v" in corps)) return null;
    return { valeur: corps.v as T };
  } catch {
    return null;
  }
}

async function ecrireEntree(cache: CacheMinimal, url: string, valeur: unknown, ttl: number, maintenant: number) {
  try {
    const reponse = new Response(JSON.stringify({ v: valeur === undefined ? null : valeur }), {
      headers: {
        "content-type": "application/json",
        "cache-control": `public, max-age=${ttl}`,
        [ENTETE_STOCKE_LE]: String(maintenant),
        [ENTETE_TTL]: String(ttl),
      },
    });
    await cache.put(url, reponse);
  } catch {
    // Écriture impossible : sans conséquence, la prochaine lecture ira simplement à la base.
  }
}

/**
 * Lecture à travers le cache. Sans cache, ou si le cache échoue : repli sur `producteur`. Une erreur du producteur
 * remonte telle quelle et n'est jamais mise en cache.
 */
export async function lireAvecCacheInjecte<T>(
  deps: DependancesCache,
  cle: string,
  producteur: () => Promise<T>,
  ttlSecondes: number = TTL_DEFAUT_SECONDES
): Promise<T> {
  const cache = deps.cache;
  if (!cache) return producteur();

  const url = cleCache(cle);
  const touche = await lireEntree<T>(cache, url, deps.maintenant());
  if (touche) return touche.valeur;

  const valeur = await producteur();
  const ttl = ttlEffectif(valeur, ttlSecondes);
  const ecriture = ecrireEntree(cache, url, valeur, ttl, deps.maintenant());
  if (deps.planifier) {
    try {
      deps.planifier(ecriture);
    } catch {
      await ecriture;
    }
  } else {
    await ecriture;
  }
  return valeur;
}

/** Supprime les entrées ; chaque suppression est isolée, aucune erreur ne remonte. */
export async function invaliderInjecte(cache: CacheMinimal | null | undefined, cles: string[]): Promise<void> {
  if (!cache) return;
  await Promise.all(
    cles.map(async (cle) => {
      try {
        await cache.delete(cleCache(cle));
      } catch {
        // Sans effet : le TTL borne la durée de vie de l'entrée.
      }
    })
  );
}
