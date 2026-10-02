import { sql } from 'drizzle-orm';
import {
  check,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { isOneOf, timestampChecks, timestampColumns } from './columns';

export const CATEGORY_KINDS = ['expense', 'income'] as const;

/**
 * Classifies income and expense transactions (never transfers). `icon` is a semantic name
 * from the app's icon system; it has no CHECK so new icons need no migration (the domain
 * validates it). Archived categories keep their rows so past transactions keep them.
 */
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    icon: text('icon').notNull(),
    ...timestampColumns,
  },
  table => [
    // Second barrier for the domain's duplicate-name rule: one active name per kind.
    // lower() only folds ASCII; the domain also folds accents and ñ.
    uniqueIndex('categories_kind_name_unique')
      .on(table.kind, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} IS NULL`),
    check('categories_kind_check', isOneOf(table.kind, CATEGORY_KINDS)),
    check('categories_name_check', sql`length(trim(${table.name})) > 0`),
    check('categories_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;
