import { useCallback } from 'react';
import { appConfig } from '../../../core/config/appConfig';
import { useDatabase } from '../../../core/db';
import {
  useAsyncResource,
  useReloadOnFocus,
  useReloadOnForeground,
} from '../../../shared/hooks';
import { monthRange } from '../../../shared/lib/dates';
// By module, not the transactions feature index, to keep features free of import cycles.
import type { LocalDateRange } from '../../transactions/data/transactionRepository';
import type { Transaction } from '../../transactions/domain/types';
import type { ReferenceLookup } from '../../transactions/components/referenceLookup';
import {
  loadReferences,
  useTransactionRepositories,
} from '../../transactions/hooks/transactionHooks';
import {
  loadWalletSummary,
  type WalletSummary,
} from '../../wallet/hooks/walletHooks';
import type { WalletAccount } from '../components/WalletCarousel';
import { loadInsights, type CurrencyInsights } from './loadInsights';
import {
  summarizeByCurrency,
  type CurrencySummary,
} from '../domain/dashboardSummary';

/** How many movements "Movimientos recientes" shows. */
export const RECENT_TRANSACTIONS_LIMIT = 5;

export type DashboardData = {
  /** The current month in the device's civil calendar. */
  period: LocalDateRange;
  /** One per currency, the default currency first. Empty when there is nothing to show. */
  summaries: CurrencySummary[];
  recentTransactions: Transaction[];
  /** Names and icons of accounts, cards and categories, archived ones included. */
  references: ReferenceLookup;
  /** Active accounts as wallet cards, with their balance and active cards. */
  walletAccounts: WalletAccount[];
  /** Google Wallet connection and payments waiting for review. */
  wallet: WalletSummary;
  /** Chart data of the current month, per currency. */
  insights: CurrencyInsights[];
  /** No active account and no movement yet: a new install. */
  isEmpty: boolean;
};

/**
 * The dashboard's figures, read from SQLite on every focus (after creating, editing or
 * archiving elsewhere). Aggregation happens in SQL; balances reuse the accounts' derived
 * balance. The month is computed at load time, so it rolls over on the next focus.
 */
export function useDashboard() {
  const database = useDatabase();
  const repositories = useTransactionRepositories();
  const load = useCallback(async (): Promise<DashboardData> => {
    // Pending Google Wallet payments become movements before the figures are read.
    const wallet = await loadWalletSummary(database, repositories);
    const period = monthRange(new Date());
    const [
      accounts,
      balances,
      dailyTotals,
      categoryTotals,
      recentTransactions,
      references,
    ] = await Promise.all([
      repositories.accounts.list(),
      repositories.transactions.listAccountBalances(),
      repositories.transactions.listDailyTotals(period),
      repositories.transactions.listExpenseTotalsByCategory(period),
      repositories.transactions.list({ limit: RECENT_TRANSACTIONS_LIMIT }),
      loadReferences(repositories),
    ]);
    const insights = await loadInsights(repositories, references, period.from);
    return {
      period,
      insights,
      summaries: summarizeByCurrency({
        accounts,
        balances,
        dailyTotals,
        categoryTotals,
        primaryCurrency: appConfig.defaultCurrency,
      }),
      recentTransactions,
      references,
      walletAccounts: accounts.map(account => ({
        account,
        balanceMinor: balances[account.id] ?? null,
        cards: references.activeCardsOf(account.id),
      })),
      wallet,
      isEmpty: accounts.length === 0 && recentTransactions.length === 0,
    };
  }, [database, repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  // Back from system settings or after a Google Wallet payment in the background.
  useReloadOnForeground(reload);
  return { resource, reload };
}
