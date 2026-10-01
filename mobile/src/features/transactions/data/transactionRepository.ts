import { and, desc, eq, or, sql } from 'drizzle-orm';
import {
  accounts,
  cards,
  generateId,
  notDeleted,
  transactions,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import type { MinorUnits } from '../../../shared/lib/money';
import type { Transaction } from '../domain/types';
import {
  validateTransaction,
  type TransactionValidationError,
} from '../domain/validateTransaction';
import { rowToTransaction, transactionToInsert } from './transactionMappers';

export type NewTransaction = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type TransactionChanges = Partial<NewTransaction>;

/** Thrown before writing when validateTransaction() reports broken domain rules. */
export class InvalidTransactionError extends Error {
  readonly errors: TransactionValidationError[];

  constructor(errors: TransactionValidationError[]) {
    super(`Invalid transaction: ${errors.join(', ')}`);
    this.name = 'InvalidTransactionError';
    this.errors = errors;
  }
}

/**
 * Transactions persistence. Domain rules run first (validateTransaction); the schema's
 * CHECKs and foreign keys are the second barrier. Reads exclude soft-deleted rows.
 */
export function createTransactionRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(transactions.id, id), notDeleted(transactions));

  async function assertValid(transaction: Transaction): Promise<void> {
    const context = {
      cards:
        transaction.cardId === null
          ? []
          : await db
              .select({ id: cards.id, accountId: cards.accountId })
              .from(cards)
              .where(eq(cards.id, transaction.cardId)),
    };
    const result = validateTransaction(transaction, context);
    if (!result.valid) {
      throw new InvalidTransactionError(result.errors);
    }
  }

  async function getById(id: EntityId): Promise<Transaction | null> {
    const row = await db.select().from(transactions).where(isActive(id)).get();
    return row ? rowToTransaction(row) : null;
  }

  return {
    getById,

    async create(input: NewTransaction): Promise<Transaction> {
      const now = nowIsoDateTime();
      const transaction: Transaction = {
        ...input,
        id: await generateId(db),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await assertValid(transaction);
      await db.insert(transactions).values(transactionToInsert(transaction));
      return transaction;
    },

    /** Most recent first. */
    async list(): Promise<Transaction[]> {
      const rows = await db
        .select()
        .from(transactions)
        .where(notDeleted(transactions))
        .orderBy(desc(transactions.localDate), desc(transactions.occurredAt));
      return rows.map(rowToTransaction);
    },

    /** Movements of an account: the ones it originates plus incoming transfers. */
    async listByAccount(accountId: EntityId): Promise<Transaction[]> {
      const rows = await db
        .select()
        .from(transactions)
        .where(
          and(
            notDeleted(transactions),
            or(
              eq(transactions.accountId, accountId),
              eq(transactions.toAccountId, accountId),
            ),
          ),
        )
        .orderBy(desc(transactions.localDate), desc(transactions.occurredAt));
      return rows.map(rowToTransaction);
    },

    /** Validates the resulting entity before writing. Null when it does not exist or is deleted. */
    async update(
      id: EntityId,
      changes: TransactionChanges,
    ): Promise<Transaction | null> {
      const current = await getById(id);
      if (!current) {
        return null;
      }
      const defined = Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
      ) as TransactionChanges;
      const next: Transaction = {
        ...current,
        ...defined,
        updatedAt: nowIsoDateTime(),
      };
      await assertValid(next);
      const rows = await db
        .update(transactions)
        .set(transactionToInsert(next))
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToTransaction(rows[0]) : null;
    },

    /** Marks the transaction as deleted. Returns false when it was not active. */
    async softDelete(id: EntityId): Promise<boolean> {
      const now = nowIsoDateTime();
      const rows = await db
        .update(transactions)
        .set({ deletedAt: now, updatedAt: now })
        .where(isActive(id))
        .returning({ id: transactions.id });
      return rows.length > 0;
    },

    /**
     * Derived balance (never stored): initialBalanceMinor + income + incoming transfers
     * - expense - outgoing transfers, over non-deleted transactions. A card payment is an
     * incoming transfer to the credit_card account. `pending` transactions are included:
     * whether they affect the balance is still undecided (docs/domain-model.md) and no status
     * is excluded until it is. Null when the account does not exist or is deleted.
     */
    async getAccountBalance(accountId: EntityId): Promise<MinorUnits | null> {
      const account = await db
        .select({ initialBalanceMinor: accounts.initialBalanceMinor })
        .from(accounts)
        .where(and(eq(accounts.id, accountId), notDeleted(accounts)))
        .get();
      if (!account) {
        return null;
      }

      const movement = await db
        .select({
          deltaMinor: sql<number>`coalesce(sum(CASE
            WHEN ${transactions.accountId} = ${accountId} AND ${transactions.type} = 'income' THEN ${transactions.amountMinor}
            WHEN ${transactions.accountId} = ${accountId} THEN -${transactions.amountMinor}
            ELSE ${transactions.amountMinor}
          END), 0)`,
        })
        .from(transactions)
        .where(
          and(
            notDeleted(transactions),
            or(
              eq(transactions.accountId, accountId),
              eq(transactions.toAccountId, accountId),
            ),
          ),
        )
        .get();

      return account.initialBalanceMinor + (movement?.deltaMinor ?? 0);
    },
  };
}

export type TransactionRepository = ReturnType<
  typeof createTransactionRepository
>;
