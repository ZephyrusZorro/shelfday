import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const kitchenDocs = sqliteTable('kitchen_docs', {
  userId: text('user_id').primaryKey().notNull(),
  revision: integer('revision').notNull(),
  document: text('document').notNull(),
});
