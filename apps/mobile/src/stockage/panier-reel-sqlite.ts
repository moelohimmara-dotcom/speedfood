import { openDatabaseAsync, type SQLiteBindParams } from 'expo-sqlite';
import { creerDepotPanier } from './panier-reel-depot';
import { initialiserPanierReel } from './migrations/0001-panier-reel';
import { SessionPanierReel } from './panier-reel-session';
let ouverture: Promise<SessionPanierReel> | null = null;
async function ouvrir() {
  const db = await openDatabaseAsync('speedfood-client-reel.db');
  try {
    await initialiserPanierReel(db);
    return new SessionPanierReel(creerDepotPanier(async (sql, params, lecture) => {
      const requete = await db.prepareAsync(sql);
      try {
        if (lecture) return await (await requete.executeForRawResultAsync(params as SQLiteBindParams)).getAllAsync();
        await requete.executeAsync(params as SQLiteBindParams); return [];
      } finally { await requete.finalizeAsync(); }
    }));
  } catch (e) { await db.closeAsync().catch(() => undefined); throw e; }
}
export function ouvrirPanierReel() { ouverture ??= ouvrir().catch(e => { ouverture = null; throw e; }); return ouverture; }
