import { sql } from 'drizzle-orm';
import {
  check,
  index,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';
import { accounts } from './accounts';
import { isOneOf, timestampChecks, timestampColumns } from './columns';

export const CARD_NETWORKS = ['visa', 'mastercard', 'amex', 'other'] as const;

/** SECURITY: never add the full card number, CVV, PIN or expiration date. */
export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    alias: text('alias').notNull(),
    last4: text('last4').notNull(),
    network: text('network', { enum: CARD_NETWORKS }),
    ...timestampColumns,
  },
  table => [
    // Parent key of the composite FK transactions(card_id, account_id).
    unique('cards_id_account_id_unique').on(table.id, table.accountId),
    index('cards_account_id_idx').on(table.accountId),
    check(
      'cards_last4_check',
      sql`${table.last4} GLOB '[0-9][0-9][0-9][0-9]'`,
    ),
    check(
      'cards_network_check',
      sql`${table.network} IS NULL OR ${isOneOf(table.network, CARD_NETWORKS)}`,
    ),
    check('cards_timestamps_check', sql`${timestampChecks(table)}`),
  ],
);

export type CardRow = typeof cards.$inferSelect;
export type CardInsert = typeof cards.$inferInsert;
