import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { accounts } from './accounts';
import {
  isLocalDate,
  isSafeInteger,
  timestampChecks,
  timestampColumns,
} from './columns';

/**
 * "I want X accumulated in this account". What is saved is never stored: it is the
 * account's derived balance, in the account's currency (docs/savings.md). "The account is
 * active and not a credit card" spans two tables, so the domain enforces it (no triggers).
 */
export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    targetAmountMinor: integer('target_amount_minor', {
      mode: 'number',
    }).notNull(),
    /** Optional civil date (YYYY-MM-DD), informative only. */
    targetDate: text('target_date'),
    ...timestampColumns,
  },
  table => [
    // Second barrier for the domain's rule: one active goal per account. Partial, so a new
    // goal can replace an archived one.
    uniqueIndex('savings_goals_account_unique')
      .on(table.accountId)
      .where(sql`${table.deletedAt} IS NULL`),
    check('savings_goals_name_check', sql`length(trim(${table.name})) > 0`),
    check(
      'savings_goals_target_amount_minor_check',
      sql`${isSafeInteger(table.targetAmountMinor)} AND ${
        table.targetAmountMinor
      } > 0`,
    ),
    check(
      'savings_goals_target_date_check',
      sql`${table.targetDate} IS NULL OR ${isLocalDate(table.targetDate)}`,
    ),
    check('savings_goals_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type SavingsGoalRow = typeof savingsGoals.$inferSelect;
export type SavingsGoalInsert = typeof savingsGoals.$inferInsert;
