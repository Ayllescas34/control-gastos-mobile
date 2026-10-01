import type { AccountInsert, AccountRow } from '../../../core/db';
import type { Account } from '../domain/types';

/** DB row → domain entity. Field by field so the domain type never depends on Drizzle. */
export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    initialBalanceMinor: row.initialBalanceMinor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain entity → DB insert values. Drizzle maps the keys to snake_case columns. */
export function accountToInsert(account: Account): AccountInsert {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    initialBalanceMinor: account.initialBalanceMinor,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    deletedAt: account.deletedAt,
  };
}
