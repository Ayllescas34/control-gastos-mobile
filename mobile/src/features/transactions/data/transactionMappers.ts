import type { TransactionInsert, TransactionRow } from '../../../core/db';
import type { Transaction } from '../domain/types';

/** DB row → domain entity. */
export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    categoryId: row.categoryId,
    cardId: row.cardId,
    occurredAt: row.occurredAt,
    localDate: row.localDate,
    description: row.description,
    payee: row.payee,
    note: row.note,
    source: row.source,
    status: row.status,
    externalRef: row.externalRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Domain entity → DB insert values. */
export function transactionToInsert(
  transaction: Transaction,
): TransactionInsert {
  return {
    id: transaction.id,
    type: transaction.type,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId,
    categoryId: transaction.categoryId,
    cardId: transaction.cardId,
    occurredAt: transaction.occurredAt,
    localDate: transaction.localDate,
    description: transaction.description,
    payee: transaction.payee,
    note: transaction.note,
    source: transaction.source,
    status: transaction.status,
    externalRef: transaction.externalRef,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    deletedAt: transaction.deletedAt,
  };
}
