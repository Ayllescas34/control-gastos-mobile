import { useMemo } from 'react';
import { useDatabase } from '../../../core/db';
import {
  createAccountRepository,
  type AccountRepository,
} from '../data/accountRepository';
import {
  createCardRepository,
  type CardRepository,
} from '../data/cardRepository';
// By module, not the transactions feature index, to keep features free of import cycles.
import {
  createTransactionRepository,
  type TransactionRepository,
} from '../../transactions/data/transactionRepository';

export type AccountRepositories = {
  accounts: AccountRepository;
  cards: CardRepository;
  /** Balances are derived from movements, so they come from the transactions repository. */
  transactions: TransactionRepository;
};

/**
 * The accounts feature's repositories over the app database. Screens use these (or the
 * hooks built on them) and never touch Drizzle, op-sqlite or SQL.
 */
export function useAccountRepositories(): AccountRepositories {
  const { db } = useDatabase();
  return useMemo(
    () => ({
      accounts: createAccountRepository(db),
      cards: createCardRepository(db),
      transactions: createTransactionRepository(db),
    }),
    [db],
  );
}
