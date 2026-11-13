/**
 * Cache hors ligne du catalogue (parité Kotlin, lot 4, ligne B13) : chaque lecture réussie est gardée sur le téléphone ; quand le réseau
 * est coupé, la dernière lecture est rendue à la place d'une erreur, avec son ancienneté pour que l'écran dise « hors ligne ».
 * Rien n'est gardé de personnel (que des données publiques du catalogue) et rien n'est envoyé : commander exige toujours le réseau.
 * Un cache de plus de 7 jours n'est plus servi — mieux vaut une erreur honnête qu'un menu d'il y a longtemps.
 */
export interface StockageCache { lire(cle: string): Promise<string | null>; ecrire(cle: string, valeur: string): Promise<void> }
export interface ResultatCache<T> { donnees: T; ageMs: number | null }

export const VALIDITE_CACHE_MS = 7 * 24 * 3600 * 1000;

export function creerCacheCatalogue(stockage: StockageCache, maintenant: () => number = () => Date.now()) {
  return {
    /**
     * Lit en frais, garde, et rend ; si la lecture fraîche échoue, rend le cache encore valable (revalidé par `valider`).
     * Une écriture du cache qui échoue n'empêche jamais d'afficher les données fraîches. Un cache absent, corrompu,
     * illisible ou trop vieux relance l'erreur d'origine : rien n'est inventé.
     */
    async lire<T>(cle: string, frais: () => Promise<T>, valider: (v: unknown) => T): Promise<ResultatCache<T>> {
      try {
        const donnees = await frais();
        try { await stockage.ecrire(cle, JSON.stringify({ le: maintenant(), donnees })); } catch { /* confort seulement */ }
        return { donnees, ageMs: null };
      } catch (e) {
        let brut: string | null = null;
        try { brut = await stockage.lire(cle); } catch { brut = null; }
        if (brut !== null) {
          try {
            const parsed = JSON.parse(brut) as { le?: unknown; donnees?: unknown };
            if (typeof parsed.le === 'number' && Number.isFinite(parsed.le) && 'donnees' in parsed) {
              const age = Math.max(0, maintenant() - parsed.le);
              if (age <= VALIDITE_CACHE_MS) return { donnees: valider(parsed.donnees), ageMs: age };
            }
          } catch { /* cache illisible ou données invalides : on relance l'erreur d'origine ci-dessous */ }
        }
        throw e;
      }
    },
  };
}
export type CacheCatalogue = ReturnType<typeof creerCacheCatalogue>;

/** Ancienneté en clair pour l'écran : « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 j ». */
export function libelleAgeCache(ageMs: number): string {
  if (ageMs < 60_000) return "à l'instant";
  if (ageMs < 3_600_000) return 'il y a ' + Math.floor(ageMs / 60_000) + ' min';
  if (ageMs < 24 * 3_600_000) return 'il y a ' + Math.floor(ageMs / 3_600_000) + ' h';
  return 'il y a ' + Math.floor(ageMs / (24 * 3_600_000)) + ' j';
}
