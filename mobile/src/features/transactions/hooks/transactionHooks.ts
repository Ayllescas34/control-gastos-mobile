import { useCallback, useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import type { EntityId } from '../../../shared/domain';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
// Repositories by module (not the feature index) to keep features free of import cycles.
import { createAccountRepository } from '../../accounts/data/accountRepository';
import { createCardRepository } from '../../accounts/data/cardRepository';
import { createCategoryRepository } from '../../categories/data/categoryRepository';
import {
  createTransactionRepository,
  type TransactionFilters,
} from '../data/transactionRepository';
import type { Transaction } from '../domain/types';
import {
  createReferenceLookup,
  type ReferenceLookup,
} from '../components/referenceLookup';

/** Every repository the transactions screens read from. Screens never touch SQL. */
export function useTransactionRepositories() {
  const { db } = useDatabase();
  return useMemo(
    () => ({
      transactions: createTransactionRepository(db),
      accounts: createAccountRepository(db),
      cards: createCardRepository(db),
      categories: createCategoryRepository(db),
    }),
    [db],
  );
}

type Repositories = ReturnType<typeof useTransactionRepositories>;

/**
 * Accounts, cards and categories by id, archived ones included so past movements keep
 * their names. One read per entity type, not per transaction.
 */
async function loadReferences(
  repositories: Repositories,
): Promise<ReferenceLookup> {
  const [accounts, cards, categories] = await Promise.all([
    repositories.accounts.list({ includeArchived: true }),
    repositories.cards.list({ includeArchived: true }),
    repositories.categories.list({ includeArchived: true }),
  ]);
  return createReferenceLookup({ accounts, cards, categories });
}

export type TransactionsData = {
  transactions: Transaction[];
  references: ReferenceLookup;
};

/**
 * Transactions matching `filters` (filtered and searched in SQL), with their references.
 * Reloads on focus and whenever the filters change.
 */
export function useTransactions(filters: TransactionFilters) {
  const repositories = useTransactionRepositories();
  const load = useCallback(async (): Promise<TransactionsData> => {
    const [transactions, references] = await Promise.all([
      repositories.transactions.list(filters),
      loadReferences(repositories),
    ]);
    return { transactions, references };
  }, [repositories, filters]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type TransactionDetailData = {
  transaction: Transaction;
  references: ReferenceLookup;
} | null;

/** One active transaction with its references; null when missing or archived. */
export function useTransactionDetail(transactionId: EntityId) {
  const repositories = useTransactionRepositories();
  const load = useCallback(async (): Promise<TransactionDetailData> => {
    const [transaction, references] = await Promise.all([
      repositories.transactions.getById(transactionId),
      loadReferences(repositories),
    ]);
    return transaction ? { transaction, references } : null;
  }, [repositories, transactionId]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type TransactionFormData = {
  references: ReferenceLookup;
  /** The transaction being edited; null when creating or when it is gone. */
  transaction: Transaction | null;
};

/** What the create/edit form needs: references and, when editing, the transaction. */
export function useTransactionFormData(transactionId: EntityId | undefined) {
  const repositories = useTransactionRepositories();
  const load = useCallback(async (): Promise<TransactionFormData> => {
    const [transaction, references] = await Promise.all([
      transactionId
        ? repositories.transactions.getById(transactionId)
        : Promise.resolve(null),
      loadReferences(repositories),
    ]);
    return { transaction, references };
  }, [repositories, transactionId]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
