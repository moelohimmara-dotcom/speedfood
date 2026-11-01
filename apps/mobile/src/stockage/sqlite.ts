import { openDatabaseAsync, type SQLiteBindParams } from 'expo-sqlite';
import { creerDepotDrizzle } from './depot-drizzle';
import { initialiserBase } from './migrations/0001-etat-demo';
import { SessionLocale } from './session';

let ouverture: Promise<SessionLocale> | null = null;
async function ouvrir(): Promise<SessionLocale> {
  const base = await openDatabaseAsync('speedfood-demo-client.db');
  try {
    await initialiserBase(base);
    return new SessionLocale(creerDepotDrizzle(async (sql, params, lecture) => {
      const statement = await base.prepareAsync(sql);
      try {
        if (lecture) {
          const resultat = await statement.executeForRawResultAsync(params as SQLiteBindParams);
          return await resultat.getAllAsync();
        }
        await statement.executeAsync(params as SQLiteBindParams);
        return [];
      } finally { await statement.finalizeAsync(); }
    }));
  } catch (e) {
    await base.closeAsync().catch(() => undefined);
    throw e;
  }
}
export function ouvrirSessionLocale(): Promise<SessionLocale> {
  ouverture ??= ouvrir().catch(e => { ouverture = null; throw e; });
  return ouverture;
}
