export interface BaseLocale {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
  getAllAsync<T>(source: string): Promise<T[]>;
}
interface Colonne { name: string; type: string; notnull: number; pk: number }
export async function initialiserBase(base: BaseLocale): Promise<void> {
  const version = (await base.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
  if (typeof version === 'number' && version > 1) throw new Error('VERSION_LOCALE_INCOMPATIBLE');
  const colonnes = await base.getAllAsync<Colonne>('PRAGMA table_info(etat_client_demo)');
  if (version === 0) {
    if (colonnes.length) throw new Error('SCHEMA_LOCAL_INCOMPATIBLE');
    try {
      // SQL constant uniquement ; aucune donnée de la personne n'est interpolée.
      await base.execAsync(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS etat_client_demo (
          id INTEGER PRIMARY KEY NOT NULL CONSTRAINT etat_unique CHECK(id = 1),
          contenu TEXT NOT NULL
        );
        PRAGMA user_version=1;
        COMMIT;`);
    } catch {
      try { await base.execAsync('ROLLBACK'); } catch { /* Pas de transaction active. */ }
      throw new Error('INITIALISATION_LOCALE_IMPOSSIBLE');
    }
  } else if (version !== 1) throw new Error('SCHEMA_LOCAL_INCOMPATIBLE');
  const apres = await base.getAllAsync<Colonne>('PRAGMA table_info(etat_client_demo)');
  if (apres.length !== 2 || !apres.some(c => c.name === 'id' && c.type === 'INTEGER' && c.pk === 1 && c.notnull === 1) ||
    !apres.some(c => c.name === 'contenu' && c.type === 'TEXT' && c.notnull === 1)) throw new Error('SCHEMA_LOCAL_INCOMPATIBLE');
}
