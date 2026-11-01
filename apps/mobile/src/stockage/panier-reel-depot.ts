import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';
import type { ExecuterLocal } from './depot-drizzle.ts';
const table = sqliteTable('panier_client', { id: integer('id').primaryKey().notNull(), contenu: text('contenu').notNull() });
export function creerDepotPanier(executer: ExecuterLocal) {
  const orm = drizzle(async (sql, params, methode) => {
    if (methode !== 'all' && methode !== 'run') throw Error('METHODE_PANIER_INVALIDE');
    return { rows: await executer(sql, params, methode === 'all') };
  });
  return {
    lire: async () => (await orm.select({ contenu: table.contenu }).from(table).where(eq(table.id, 1)).all())[0]?.contenu ?? null,
    ecrire: async (contenu: string) => { await orm.insert(table).values({ id: 1, contenu }).onConflictDoUpdate({ target: table.id, set: { contenu } }).run(); },
  };
}
