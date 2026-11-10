import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import {
  isCurrencyCode,
  isIsoDateTime,
  isOneOf,
  isSafeInteger,
  timestampChecks,
  timestampColumns,
} from './columns';
import { transactions } from './transactions';

/** What the captured message describes. A withdrawal moves cash out of the account. */
export const WALLET_CAPTURE_KINDS = ['expense', 'income', 'withdrawal'] as const;

export const WALLET_CAPTURE_STATUSES = [
  'new',
  'registered',
  'dismissed',
] as const;

/**
 * Payments read from Google Wallet notifications (docs/google-wallet.md). A capture is the
 * raw evidence of a payment; the movement itself lives in `transactions`. `registered`
 * captures point to the movement they became; `new` ones wait in "Por revisar".
 * Device-local inbox: not part of the backup file.
 */
export const walletCaptures = sqliteTable(
  'wallet_captures',
  {
    id: text('id').primaryKey(),
    /** Stable id computed on the device from the notification; deduplicates re-reads. */
    externalRef: text('external_ref').notNull(),
    /** Android package that posted the notification. */
    sourceApp: text('source_app').notNull(),
    rawTitle: text('raw_title'),
    rawText: text('raw_text'),
    merchant: text('merchant'),
    amountMinor: integer('amount_minor', { mode: 'number' }).notNull(),
    currency: text('currency').notNull(),
    cardLast4: text('card_last4'),
    /** Account name as the bank wrote it ("TCREDITO"), from bank SMS. */
    accountLabel: text('account_label'),
    kind: text('kind', { enum: WALLET_CAPTURE_KINDS })
      .notNull()
      .default('expense'),
    /** UTC instant of the payment notification. */
    postedAt: text('posted_at').notNull(),
    status: text('status', { enum: WALLET_CAPTURE_STATUSES }).notNull(),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'restrict',
    }),
    ...timestampColumns,
  },
  table => [
    uniqueIndex('wallet_captures_external_ref_unique').on(table.externalRef),
    index('wallet_captures_status_posted_at_idx')
      .on(table.status, table.postedAt)
      .where(sql`${table.deletedAt} IS NULL`),
    check(
      'wallet_captures_amount_minor_check',
      sql`${isSafeInteger(table.amountMinor)} AND ${table.amountMinor} > 0`,
    ),
    check('wallet_captures_currency_check', isCurrencyCode(table.currency)),
    check(
      'wallet_captures_card_last4_check',
      sql`${table.cardLast4} IS NULL OR ${table.cardLast4} GLOB '[0-9][0-9][0-9][0-9]'`,
    ),
    check('wallet_captures_kind_check', isOneOf(table.kind, WALLET_CAPTURE_KINDS)),
    check(
      'wallet_captures_status_check',
      isOneOf(table.status, WALLET_CAPTURE_STATUSES),
    ),
    check(
      'wallet_captures_registered_check',
      sql`(${table.status} = 'registered') = (${table.transactionId} IS NOT NULL)`,
    ),
    check('wallet_captures_posted_at_check', isIsoDateTime(table.postedAt)),
    check('wallet_captures_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type WalletCaptureRow = typeof walletCaptures.$inferSelect;
export type WalletCaptureInsert = typeof walletCaptures.$inferInsert;
