import { useCallback } from 'react';
import { appConfig } from '../../../core/config/appConfig';
import { useAsyncResource, useReloadOnFocus } from '../../../shared/hooks';
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
  /** No active account and no movement yet: a new install. */
  isEmpty: boolean;
};

/**
 * The dashboard's figures, read from SQLite on every focus (after creating, editing or
 * archiving elsewhere). Aggregation happens in SQL; balances reuse the accounts' derived
 * balance. The month is computed at load time, so it rolls over on the next focus.
 */
export function useDashboard() {
  const repositories = useTransactionRepositories();
  const load = useCallback(async (): Promise<DashboardData> => {
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
    return {
      period,
      summaries: summarizeByCurrency({
        accounts,
        balances,
        dailyTotals,
        categoryTotals,
        primaryCurrency: appConfig.defaultCurrency,
      }),
      recentTransactions,
      references,
      isEmpty: accounts.length === 0 && recentTransactions.length === 0,
    };
  }, [repositories]);

  const { resource, reload } = useAsyncResource(load);
  useReloadOnFocus(reload);
  return { resource, reload };
}
