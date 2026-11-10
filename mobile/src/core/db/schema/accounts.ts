import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import {
  isCurrencyCode,
  isOneOf,
  isSafeInteger,
  timestampChecks,
  timestampColumns,
} from './columns';

export const ACCOUNT_TYPES = [
  'cash',
  'bank',
  'savings',
  'credit_card',
  'other',
] as const;

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    currency: text('currency').notNull(),
    /** Signed: negative means debt. The current balance is derived, never stored. */
    initialBalanceMinor: integer('initial_balance_minor', {
      mode: 'number',
    }).notNull(),
    /**
     * How the bank names this account in its SMS ("TCREDITO", "BICHEQUE3"); several
     * separated by commas. Bank messages are matched to the account by it
     * (docs/bank-messages.md). Shape validated by the domain.
     */
    bankLabel: text('bank_label'),
    ...timestampColumns,
  },
  table => [
    check('accounts_type_check', isOneOf(table.type, ACCOUNT_TYPES)),
    check('accounts_currency_check', isCurrencyCode(table.currency)),
    check(
      'accounts_initial_balance_minor_check',
      isSafeInteger(table.initialBalanceMinor),
    ),
    check('accounts_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;
export type AccountInsert = typeof accounts.$inferInsert;
