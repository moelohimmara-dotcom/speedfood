import { openDatabaseAsync, type SQLiteBindParams } from 'expo-sqlite';
import { creerDepotPanier } from './panier-reel-depot';
import { initialiserPanierReel } from './migrations/0001-panier-reel';
import { decoderMemos, encoderMemos, memoriserCommande, type MemoCommande } from '../catalogue/recommande';
import type { PanierReel } from '../catalogue/panier-reel';
/**
 * Mémoire locale des dernières commandes ENVOYÉES depuis cet appareil (pour « Commander à nouveau »). Base à part (`speedfood-client-commandes.db`), même forme qu'un panier :
 * une ligne, un texte versionné. Écritures strictement l'une après l'autre ; un échec de stockage ne gêne jamais l'envoi d'une commande.
 */
export interface MemoireCommandes { lire(): Promise<MemoCommande[]>; memoriser(reference: string, panier: PanierReel): Promise<void> }
let ouverture: Promise<MemoireCommandes> | null = null;
async function ouvrir(): Promise<MemoireCommandes> {
  const db = await openDatabaseAsync('speedfood-client-commandes.db');
  try {
    await initialiserPanierReel(db);
    const depot = creerDepotPanier(async (sql, params, lecture) => {
      const requete = await db.prepareAsync(sql);
      try {
        if (lecture) return await (await requete.executeForRawResultAsync(params as SQLiteBindParams)).getAllAsync();
        await requete.executeAsync(params as SQLiteBindParams); return [];
      } finally { await requete.finalizeAsync(); }
    });
    let file: Promise<unknown> = Promise.resolve();
    const enfiler = <T,>(tache: () => Promise<T>): Promise<T> => { const suite = file.then(tache, tache); file = suite.catch(() => undefined); return suite; };
    return {
      lire: () => enfiler(async () => decoderMemos(await depot.lire())),
      memoriser: (reference, panier) => enfiler(async () => { const liste = decoderMemos(await depot.lire()); await depot.ecrire(encoderMemos(memoriserCommande(liste, reference, panier, Date.now()))); }),
    };
  } catch (e) { await db.closeAsync().catch(() => undefined); throw e; }
}
export function ouvrirCommandesEnvoyees() { ouverture ??= ouvrir().catch(e => { ouverture = null; throw e; }); return ouverture; }
