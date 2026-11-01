import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { eq } from 'drizzle-orm';
import { etatClientDemo } from './schema.ts';
import type { DepotTexte } from './session.ts';

export type ExecuterLocal = (sql: string, params: unknown[], lecture: boolean) => Promise<unknown[][]>;
/** Adaptateur asynchrone LOCAL : aucune requête HTTP malgré le nom sqlite-proxy. */
export function creerDepotDrizzle(executer: ExecuterLocal): DepotTexte {
  const orm = drizzle(async (sql, params, method) => {
    if (method !== 'all' && method !== 'run') throw new Error('METHODE_LOCALE_NON_PREVUE');
    return { rows: await executer(sql, params, method === 'all') };
  });
  return {
    lire: async () => (await orm.select({ contenu: etatClientDemo.contenu }).from(etatClientDemo).where(eq(etatClientDemo.id, 1)).all())[0]?.contenu ?? null,
    ecrire: async contenu => {
      await orm.insert(etatClientDemo).values({ id: 1, contenu }).onConflictDoUpdate({ target: etatClientDemo.id, set: { contenu } }).run();
    },
  };
}
