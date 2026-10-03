import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import {
  accounts,
  cards,
  categories,
  generateId,
  notDeleted,
  transactions,
  type AppDatabase,
} from '../../../core/db';
import type { EntityId, LocalDate } from '../../../shared/domain';
import { nowIsoDateTime } from '../../../shared/lib/dates';
import type { CurrencyCode, MinorUnits } from '../../../shared/lib/money';
import type { Transaction, TransactionType } from '../domain/types';
import {
  validateTransaction,
  type TransactionValidationContext,
  type TransactionValidationError,
} from '../domain/validateTransaction';
import { rowToTransaction, transactionToInsert } from './transactionMappers';

export type NewTransaction = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export type TransactionChanges = Partial<NewTransaction>;

/** Every filter is optional and they combine (AND). */
export type TransactionFilters = {
  type?: TransactionType;
  /** Movements of the account: the ones it originates plus incoming transfers. */
  accountId?: EntityId;
  categoryId?: EntityId;
  /** Inclusive civil-date range on localDate (YYYY-MM-DD). */
  from?: LocalDate;
  to?: LocalDate;
  /** Text contained in payee, description or note. */
  search?: string;
  limit?: number;
};

/** Inclusive civil-date range on localDate (YYYY-MM-DD). */
export type LocalDateRange = { from: LocalDate; to: LocalDate };

/** Sum of the income or expense movements of one civil day in one currency. */
export type DailyTotal = {
  localDate: LocalDate;
  type: 'income' | 'expense';
  currency: CurrencyCode;
  totalMinor: MinorUnits;
};

/** Sum of the expenses of one category (null: uncategorized) in one currency. */
export type CategoryExpenseTotal = {
  categoryId: EntityId | null;
  currency: CurrencyCode;
  totalMinor: MinorUnits;
};

/** Thrown before writing when validateTransaction() reports broken domain rules. */
export class InvalidTransactionError extends Error {
  readonly errors: TransactionValidationError[];

  constructor(errors: TransactionValidationError[]) {
    super(`Invalid transaction: ${errors.join(', ')}`);
    this.name = 'InvalidTransactionError';
    this.errors = errors;
  }
}

/** LIKE pattern for "contains", with %, _ and \ in the text matched literally. */
function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, character => `\\${character}`)}%`;
}

function containsText(column: SQLiteColumn, pattern: string): SQL {
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

/**
 * Signed effect of a movement on the account whose id is `accountId`: income adds,
 * expenses and outgoing transfers subtract, incoming transfers add. A credit card payment
 * is an incoming transfer to the credit_card account, never a second expense.
 */
function movementEffect(accountId: SQLiteColumn | EntityId): SQL {
  return sql`CASE
    WHEN ${transactions.accountId} = ${accountId} AND ${transactions.type} = 'income' THEN ${transactions.amountMinor}
    WHEN ${transactions.accountId} = ${accountId} THEN -${transactions.amountMinor}
    ELSE ${transactions.amountMinor}
  END`;
}

/**
 * Transactions persistence. Domain rules run first (validateTransaction); the schema's
 * CHECKs and foreign keys are the second barrier. Reads exclude soft-deleted rows.
 */
export function createTransactionRepository(db: AppDatabase) {
  const isActive = (id: EntityId) =>
    and(eq(transactions.id, id), notDeleted(transactions));

  /**
   * Entities the transaction may reference: active ones, plus (when editing) the ones it
   * already referenced, so a past movement keeps an archived category, card or account.
   */
  async function validationContext(
    transaction: Transaction,
    previous: Transaction | null,
  ): Promise<TransactionValidationContext> {
    const usable = (
      table: typeof accounts | typeof cards | typeof categories,
      ids: (EntityId | null)[],
      kept: (EntityId | null | undefined)[],
    ): SQL | undefined => {
      const wanted = ids.filter((id): id is EntityId => id !== null);
      const keep = kept.filter((id): id is EntityId => Boolean(id));
      return and(
        inArray(table.id, wanted),
        keep.length > 0
          ? or(notDeleted(table), inArray(table.id, keep))
          : notDeleted(table),
      );
    };

    const accountIds = [transaction.accountId, transaction.toAccountId];
    const [accountRows, cardRows, categoryRows] = await Promise.all([
      db
        .select({ id: accounts.id, currency: accounts.currency })
        .from(accounts)
        .where(
          usable(accounts, accountIds, [
            previous?.accountId,
            previous?.toAccountId,
          ]),
        ),
      transaction.cardId === null
        ? []
        : db
            .select({ id: cards.id, accountId: cards.accountId })
            .from(cards)
            .where(usable(cards, [transaction.cardId], [previous?.cardId])),
      transaction.categoryId === null
        ? []
        : db
            .select({ id: categories.id, kind: categories.kind })
            .from(categories)
            .where(
              usable(
                categories,
                [transaction.categoryId],
                [previous?.categoryId],
              ),
            ),
    ]);
    return { accounts: accountRows, cards: cardRows, categories: categoryRows };
  }

  async function assertValid(
    transaction: Transaction,
    previous: Transaction | null = null,
  ): Promise<void> {
    const result = validateTransaction(
      transaction,
      await validationContext(transaction, previous),
    );
    if (!result.valid) {
      throw new InvalidTransactionError(result.errors);
    }
  }

  async function getById(id: EntityId): Promise<Transaction | null> {
    const row = await db.select().from(transactions).where(isActive(id)).get();
    return row ? rowToTransaction(row) : null;
  }

  /** Most recent first (civil date, then instant). Filtering happens in SQL. */
  async function list(
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    const conditions: SQL[] = [notDeleted(transactions)];
    if (filters.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters.accountId) {
      const byAccount = or(
        eq(transactions.accountId, filters.accountId),
        eq(transactions.toAccountId, filters.accountId),
      );
      if (byAccount) {
        conditions.push(byAccount);
      }
    }
    if (filters.categoryId) {
      conditions.push(eq(transactions.categoryId, filters.categoryId));
    }
    if (filters.from) {
      conditions.push(gte(transactions.localDate, filters.from));
    }
    if (filters.to) {
      conditions.push(lte(transactions.localDate, filters.to));
    }
    const search = filters.search?.trim();
    if (search) {
      const pattern = containsPattern(search);
      const matches = or(
        containsText(transactions.payee, pattern),
        containsText(transactions.description, pattern),
        containsText(transactions.note, pattern),
      );
      if (matches) {
        conditions.push(matches);
      }
    }

    const query = db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.localDate), desc(transactions.occurredAt));
    const rows = await (filters.limit === undefined
      ? query
      : query.limit(filters.limit));
    return rows.map(rowToTransaction);
  }

  return {
    getById,
    list,

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

    /** Movements of an account: the ones it originates plus incoming transfers. */
    listByAccount(accountId: EntityId): Promise<Transaction[]> {
      return list({ accountId });
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
      await assertValid(next, current);
      const rows = await db
        .update(transactions)
        .set(transactionToInsert(next))
        .where(isActive(id))
        .returning();
      return rows[0] ? rowToTransaction(rows[0]) : null;
    },

    /** Archives the transaction (soft delete). Returns false when it was not active. */
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
          deltaMinor: sql<number>`coalesce(sum(${movementEffect(
            accountId,
          )}), 0)`,
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

    /**
     * The same derived balance for every active account, in a single query (no query per
     * account in lists). Keyed by account id.
     */
    async listAccountBalances(): Promise<Record<EntityId, MinorUnits>> {
      const rows = await db
        .select({
          accountId: accounts.id,
          balanceMinor: sql<number>`${
            accounts.initialBalanceMinor
          } + coalesce(sum(${movementEffect(accounts.id)}), 0)`,
        })
        .from(accounts)
        .leftJoin(
          transactions,
          and(
            notDeleted(transactions),
            or(
              eq(transactions.accountId, accounts.id),
              eq(transactions.toAccountId, accounts.id),
            ),
          ),
        )
        .where(notDeleted(accounts))
        .groupBy(accounts.id);
      return Object.fromEntries(
        rows.map(row => [row.accountId, row.balanceMinor]),
      );
    },

    /**
     * Income and expense totals per civil day and currency in `range` (summed in SQL, never
     * across currencies). Transfers are left out: they are neither income nor expense, so a
     * credit card payment never counts as a second expense. Same rows as the balances:
     * non-deleted movements, `pending` included. Ordered by day.
     */
    async listDailyTotals(range: LocalDateRange): Promise<DailyTotal[]> {
      const rows = await db
        .select({
          localDate: transactions.localDate,
          type: transactions.type,
          currency: transactions.currency,
          totalMinor: sql<number>`sum(${transactions.amountMinor})`,
        })
        .from(transactions)
        .where(
          and(
            notDeleted(transactions),
            inArray(transactions.type, ['income', 'expense']),
            gte(transactions.localDate, range.from),
            lte(transactions.localDate, range.to),
          ),
        )
        .groupBy(
          transactions.localDate,
          transactions.type,
          transactions.currency,
        )
        .orderBy(transactions.localDate, transactions.type);
      return rows.map(row => ({
        localDate: row.localDate,
        type: row.type === 'income' ? 'income' : 'expense',
        currency: row.currency,
        totalMinor: row.totalMinor,
      }));
    },

    /**
     * Expense totals per category and currency in `range`, largest first (summed in SQL).
     * Archived categories keep their movements, so they appear here too.
     */
    async listExpenseTotalsByCategory(
      range: LocalDateRange,
    ): Promise<CategoryExpenseTotal[]> {
      const totalMinor = sql<number>`sum(${transactions.amountMinor})`;
      return db
        .select({
          categoryId: transactions.categoryId,
          currency: transactions.currency,
          totalMinor,
        })
        .from(transactions)
        .where(
          and(
            notDeleted(transactions),
            eq(transactions.type, 'expense'),
            gte(transactions.localDate, range.from),
            lte(transactions.localDate, range.to),
          ),
        )
        .groupBy(transactions.categoryId, transactions.currency)
        .orderBy(desc(totalMinor), transactions.categoryId);
    },
  };
}

export type TransactionRepository = ReturnType<
  typeof createTransactionRepository
>;
