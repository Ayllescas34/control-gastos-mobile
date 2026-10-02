import { useCallback } from 'react';
import type { EntityId } from '../../../shared/domain';
import type { MinorUnits } from '../../../shared/lib/money';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
import type { Account, Card } from '../domain/types';
import { useAccountRepositories } from './useAccountRepositories';

export type AccountsOverview = {
  accounts: Account[];
  cards: Card[];
  /** Current balance of each active account (initial balance plus its movements). */
  balances: Record<EntityId, MinorUnits>;
};

/** Active accounts, active cards and current balances (one query each), from SQLite. */
export function useAccountsOverview() {
  const repositories = useAccountRepositories();
  const load = useCallback(async (): Promise<AccountsOverview> => {
    const [accounts, cards, balances] = await Promise.all([
      repositories.accounts.list(),
      repositories.cards.list(),
      repositories.transactions.listAccountBalances(),
    ]);
    return { accounts, cards, balances };
  }, [repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type AccountDetail = {
  account: Account;
  cards: Card[];
  /** Initial balance plus the account's movements. */
  balanceMinor: MinorUnits;
} | null;

/** One active account with its active cards; null when it does not exist or is archived. */
export function useAccountDetail(accountId: EntityId) {
  const repositories = useAccountRepositories();
  const load = useCallback(async (): Promise<AccountDetail> => {
    const account = await repositories.accounts.getById(accountId);
    if (!account) {
      return null;
    }
    const [cards, balanceMinor] = await Promise.all([
      repositories.cards.listByAccount(accountId),
      repositories.transactions.getAccountBalance(accountId),
    ]);
    return {
      account,
      cards,
      balanceMinor: balanceMinor ?? account.initialBalanceMinor,
    };
  }, [repositories, accountId]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type CardDetail = {
  card: Card;
  /** The card's account; null only if it was archived through another path. */
  account: Account | null;
} | null;

/** One active card with its account; null when the card does not exist or is archived. */
export function useCardDetail(cardId: EntityId) {
  const repositories = useAccountRepositories();
  const load = useCallback(async (): Promise<CardDetail> => {
    const card = await repositories.cards.getById(cardId);
    if (!card) {
      return null;
    }
    return {
      card,
      account: await repositories.accounts.getById(card.accountId),
    };
  }, [repositories, cardId]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
