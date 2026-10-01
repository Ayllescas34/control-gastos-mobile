import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { accounts } from './accounts';
import { cards } from './cards';
import {
  isCurrencyCode,
  isIsoDateTime,
  isLocalDate,
  isOneOf,
  isSafeInteger,
  timestampChecks,
  timestampColumns,
} from './columns';

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export const TRANSACTION_SOURCES = [
  'manual',
  'import',
  'notification',
  'api',
] as const;
export const TRANSACTION_STATUSES = ['confirmed', 'pending'] as const;

/**
 * A transfer is a single row: account_id (origin) → to_account_id (destination).
 * category_id has no FK yet: the categories table arrives with its domain.
 * UNIQUE(source, external_ref) is intentionally deferred to the import/integration stage.
 */
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    amountMinor: integer('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    toAccountId: text('to_account_id').references(() => accounts.id, {
      onDelete: 'restrict',
    }),
    categoryId: text('category_id'),
    cardId: text('card_id'),
    occurredAt: text('occurred_at').notNull(),
    localDate: text('local_date').notNull(),
    description: text('description'),
    payee: text('payee'),
    note: text('note'),
    source: text('source', { enum: TRANSACTION_SOURCES }).notNull(),
    status: text('status', { enum: TRANSACTION_STATUSES }).notNull(),
    externalRef: text('external_ref'),
    ...timestampColumns,
  },
  table => [
    // The card must belong to the transaction's account (not checked when card_id is NULL).
    foreignKey({
      name: 'transactions_card_account_fk',
      columns: [table.cardId, table.accountId],
      foreignColumns: [cards.id, cards.accountId],
    }).onDelete('restrict'),

    index('transactions_local_date_idx')
      .on(table.localDate, table.occurredAt)
      .where(sql`${table.deletedAt} IS NULL`),
    index('transactions_account_id_local_date_idx')
      .on(table.accountId, table.localDate)
      .where(sql`${table.deletedAt} IS NULL`),
    index('transactions_to_account_id_idx')
      .on(table.toAccountId)
      .where(
        sql`${table.toAccountId} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    index('transactions_category_id_local_date_idx')
      .on(table.categoryId, table.localDate)
      .where(
        sql`${table.categoryId} IS NOT NULL AND ${table.deletedAt} IS NULL`,
      ),
    index('transactions_card_id_idx')
      .on(table.cardId)
      .where(sql`${table.cardId} IS NOT NULL AND ${table.deletedAt} IS NULL`),

    check(
      'transactions_amount_minor_check',
      sql`${isSafeInteger(table.amountMinor)} AND ${table.amountMinor} > 0`,
    ),
    check('transactions_type_check', isOneOf(table.type, TRANSACTION_TYPES)),
    check(
      'transactions_source_check',
      isOneOf(table.source, TRANSACTION_SOURCES),
    ),
    check(
      'transactions_status_check',
      isOneOf(table.status, TRANSACTION_STATUSES),
    ),
    check('transactions_currency_check', isCurrencyCode(table.currency)),
    check(
      'transactions_transfer_check',
      sql`(${table.type} = 'transfer' AND ${table.toAccountId} IS NOT NULL AND ${table.toAccountId} <> ${table.accountId} AND ${table.categoryId} IS NULL AND ${table.cardId} IS NULL) OR (${table.type} <> 'transfer' AND ${table.toAccountId} IS NULL)`,
    ),
    check(
      'transactions_dates_check',
      sql`${isIsoDateTime(table.occurredAt)} AND ${isLocalDate(
        table.localDate,
      )}`,
    ),
    check('transactions_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type TransactionRow = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
