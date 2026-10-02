import { useCallback } from 'react';
import type { EntityId } from '../../../shared/domain';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
import type { Account, Card } from '../domain/types';
import { useAccountRepositories } from './useAccountRepositories';

export type AccountsOverview = {
  accounts: Account[];
  cards: Card[];
};

/** Active accounts and active cards, read from SQLite. */
export function useAccountsOverview() {
  const repositories = useAccountRepositories();
  const load = useCallback(async (): Promise<AccountsOverview> => {
    const [accounts, cards] = await Promise.all([
      repositories.accounts.list(),
      repositories.cards.list(),
    ]);
    return { accounts, cards };
  }, [repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}

export type AccountDetail = {
  account: Account;
  cards: Card[];
} | null;

/** One active account with its active cards; null when it does not exist or is archived. */
export function useAccountDetail(accountId: EntityId) {
  const repositories = useAccountRepositories();
  const load = useCallback(async (): Promise<AccountDetail> => {
    const account = await repositories.accounts.getById(accountId);
    if (!account) {
      return null;
    }
    return {
      account,
      cards: await repositories.cards.listByAccount(accountId),
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
