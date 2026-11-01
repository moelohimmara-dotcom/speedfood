import type { BaseLocale } from './0001-etat-demo.ts';
export async function initialiserPanierReel(db: BaseLocale) {
  const version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
  if (version !== 0 && version !== 1) throw Error('VERSION_PANIER_INCOMPATIBLE');
  const colonnes = await db.getAllAsync<{ name: string; type: string; pk: number; notnull: number }>('PRAGMA table_info(panier_client)');
  if (version === 0) {
    if (colonnes.length) throw Error('SCHEMA_PANIER_INCOMPATIBLE');
    try { await db.execAsync('BEGIN IMMEDIATE; CREATE TABLE panier_client (id INTEGER PRIMARY KEY NOT NULL CHECK(id=1), contenu TEXT NOT NULL); PRAGMA user_version=1; COMMIT;'); }
    catch { try { await db.execAsync('ROLLBACK'); } catch {} throw Error('INITIALISATION_PANIER_IMPOSSIBLE'); }
  } else if (colonnes.length !== 2 || !colonnes.some(c => c.name === 'id' && c.type === 'INTEGER' && c.pk === 1 && c.notnull === 1) || !colonnes.some(c => c.name === 'contenu' && c.type === 'TEXT' && c.notnull === 1)) throw Error('SCHEMA_PANIER_INCOMPATIBLE');
}
