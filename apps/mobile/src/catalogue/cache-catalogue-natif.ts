import { openDatabaseAsync, type SQLiteBindParams } from 'expo-sqlite';
import type { StockageCache } from './cache-catalogue';

/**
 * Stockage du cache hors ligne du catalogue (B13) : une petite base SQLite dédiée (`speedfood-catalogue-cache.db`),
 * clé/valeur avec l'horodatage porté par la valeur elle-même. Que des données publiques du catalogue ; rien de personnel.
 * Même patron d'ouverture que le panier réel : une seule ouverture partagée, refermée en cas d'échec d'initialisation.
 */
let ouverture: Promise<StockageCache> | null = null;

async function ouvrir(): Promise<StockageCache> {
  const base = await openDatabaseAsync('speedfood-catalogue-cache.db');
  try {
    const init = await base.prepareAsync('CREATE TABLE IF NOT EXISTS cache_catalogue (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)');
    try { await init.executeAsync(); } finally { await init.finalizeAsync(); }
    async function executer(sql: string, params: unknown[], lecture: boolean): Promise<Record<string, unknown>[]> {
      const statement = await base.prepareAsync(sql);
      try {
        if (lecture) {
          const resultat = await statement.executeForRawResultAsync(params as SQLiteBindParams);
          return (await resultat.getAllAsync()) as unknown as Record<string, unknown>[];
        }
        await statement.executeAsync(params as SQLiteBindParams);
        return [];
      } finally { await statement.finalizeAsync(); }
    }
    return {
      async lire(cle: string) {
        const lignes = await executer('SELECT valeur FROM cache_catalogue WHERE cle = ?', [cle], true);
        const v = lignes[0]?.valeur;
        return typeof v === 'string' ? v : null;
      },
      async ecrire(cle: string, valeur: string) {
        await executer('INSERT OR REPLACE INTO cache_catalogue (cle, valeur) VALUES (?, ?)', [cle, valeur], false);
      },
    };
  } catch (e) {
    await base.closeAsync().catch(() => undefined);
    throw e;
  }
}

export function ouvrirStockageCacheCatalogue(): Promise<StockageCache> {
  ouverture ??= ouvrir().catch(e => { ouverture = null; throw e; });
  return ouverture;
}
