import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { categories } from './categories';
import {
  isCurrencyCode,
  isSafeInteger,
  timestampChecks,
  timestampColumns,
} from './columns';

/**
 * Recurring monthly spending limit of one expense category in one currency. No dates are
 * stored: the period is always the current month. "The category is an expense category"
 * spans two tables, so the domain enforces it (no triggers).
 */
export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    amountMinor: integer('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    ...timestampColumns,
  },
  table => [
    // Second barrier for the domain's duplicate rule: one active budget per category and
    // currency. Partial, so a new budget can replace an archived one.
    uniqueIndex('budgets_category_currency_unique')
      .on(table.categoryId, table.currency)
      .where(sql`${table.deletedAt} IS NULL`),
    check(
      'budgets_amount_minor_check',
      sql`${isSafeInteger(table.amountMinor)} AND ${table.amountMinor} > 0`,
    ),
    check('budgets_currency_check', isCurrencyCode(table.currency)),
    check('budgets_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type BudgetRow = typeof budgets.$inferSelect;
export type BudgetInsert = typeof budgets.$inferInsert;
