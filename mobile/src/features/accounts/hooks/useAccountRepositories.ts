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

export type AccountRepositories = {
  accounts: AccountRepository;
  cards: CardRepository;
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
    }),
    [db],
  );
}
