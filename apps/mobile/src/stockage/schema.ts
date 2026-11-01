import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const etatClientDemo = sqliteTable('etat_client_demo', {
  id: integer('id').primaryKey().notNull(),
  contenu: text('contenu').notNull(),
}, table => [check('etat_unique', sql`${table.id} = 1`)]);
