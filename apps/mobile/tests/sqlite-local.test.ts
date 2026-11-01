import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { initialiserBase, type BaseLocale } from '../src/stockage/migrations/0001-etat-demo.ts';
import { SessionLocale } from '../src/stockage/session.ts';
import { creerDepotDrizzle } from '../src/stockage/depot-drizzle.ts';
import { etatLocalVide } from '../src/stockage/codec.ts';
interface BaseNode {
  exec(sql: string): void;
  prepare(sql: string): { get(...p: unknown[]): Record<string, unknown> | undefined; all(...p: unknown[]): Record<string, unknown>[]; run(...p: unknown[]): unknown };
  close(): void;
}
// Node >=22.13 fournit le vrai moteur SQLite. Pas de module natif externe ni faux moteur.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (chemin: string) => BaseNode };
function port(db: BaseNode): BaseLocale {
  return {
    execAsync: async s => { db.exec(s); },
    getFirstAsync: async <T>(s: string) => (db.prepare(s).get() ?? null) as T | null,
    getAllAsync: async <T>(s: string) => db.prepare(s).all() as T[],
  };
}
test('SQLite réel : initialisation idempotente, contraintes et version future préservées', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    await initialiserBase(port(db)); await initialiserBase(port(db));
    assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 1);
    assert.throws(() => db.prepare('INSERT INTO etat_client_demo (id, contenu) VALUES (?, ?)').run(2, '{}'));
    db.exec('PRAGMA user_version=2');
    await assert.rejects(initialiserBase(port(db)), /VERSION_LOCALE_INCOMPATIBLE/);
    assert.equal(db.prepare('PRAGMA user_version').get()?.user_version, 2);
  } finally { db.close(); }
});
test('SQLite réel : un schéma inconnu est refusé sans effacement', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE etat_client_demo (ancien TEXT); INSERT INTO etat_client_demo VALUES (\'conserver\')');
    await assert.rejects(initialiserBase(port(db)), /SCHEMA_LOCAL_INCOMPATIBLE/);
    assert.equal(db.prepare('SELECT ancien FROM etat_client_demo').get()?.ancien, 'conserver');
  } finally { db.close(); }
});
test('SQLite réel sur disque : sauvegarde puis fermeture et réouverture', async () => {
  const chemin = join(tmpdir(), `speedfood-demo-test-${randomUUID()}.db`);
  let db = new DatabaseSync(chemin);
  try {
    await initialiserBase(port(db));
    const depot = () => creerDepotDrizzle(async (sql, params, lecture) => {
      const statement = db.prepare(sql);
      if (lecture) return statement.all(...params).map(row => Object.values(row));
      statement.run(...params); return [];
    });
    const session = new SessionLocale(depot()); await session.charger();
    await session.sauver({ ...etatLocalVide(), favoris: ['marmite-demo'] });
    db.close(); db = new DatabaseSync(chemin);
    await initialiserBase(port(db));
    assert.deepEqual((await new SessionLocale(depot()).charger()).favoris, ['marmite-demo']);
  } finally { db.close(); unlinkSync(chemin); }
});

